from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import UserRole
from apps.cases.models import Case, CaseStatus, CaseType
from apps.chat.models import CaseConversation, CaseMessage
from apps.consultations.models import Consultation, ConsultationStatus, PracticeArea
from config.asgi import application

from django.db import connection
from django.test import TransactionTestCase

User = get_user_model()


@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
)
class CaseChatRestTests(APITestCase):
    def setUp(self):
        # 1. Setup Practice Area
        self.practice_area, _ = PracticeArea.objects.get_or_create(
            name="Corporate Law",
            defaults={"description": "Corporate & Commercial Law"},
        )

        # 2. Setup Users
        self.admin = User.objects.create_user(
            email="admin@lexcore.local",
            full_name="Firm Admin",
            password="password123",
            role=UserRole.ADMIN,
        )
        self.responsible_lawyer = User.objects.create_user(
            email="resplawyer@lexcore.local",
            full_name="Senior Advocate Smith",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.assistant_lawyer = User.objects.create_user(
            email="assistlawyer@lexcore.local",
            full_name="Junior Advocate Doe",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.paralegal = User.objects.create_user(
            email="paralegal@lexcore.local",
            full_name="Paralegal Alex",
            password="password123",
            role=UserRole.PARALEGAL,
        )
        self.client_user = User.objects.create_user(
            email="client@lexcore.local",
            full_name="Acme Corp Client",
            password="password123",
            role=UserRole.CLIENT,
        )

        # Unrelated users
        self.unrelated_lawyer = User.objects.create_user(
            email="otherlawyer@lexcore.local",
            full_name="Other Lawyer",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.unrelated_paralegal = User.objects.create_user(
            email="otherparalegal@lexcore.local",
            full_name="Other Paralegal",
            password="password123",
            role=UserRole.PARALEGAL,
        )
        self.unrelated_client = User.objects.create_user(
            email="otherclient@lexcore.local",
            full_name="Other Client",
            password="password123",
            role=UserRole.CLIENT,
        )

        # 3. Setup Case A
        self.consultation_a = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.responsible_lawyer,
            consultation_mode="OFFICE",
            preferred_date="2026-09-01",
            preferred_time="10:00:00",
            subject="Merger Advisory",
            status=ConsultationStatus.ACCEPTED,
        )
        self.case_a = Case.objects.create(
            originating_consultation=self.consultation_a,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            supporting_paralegal=self.paralegal,
            title="Acme Merger",
            case_type=CaseType.CORPORATE,
            status=CaseStatus.OPEN,
            start_date="2026-09-02",
        )
        self.case_a.assistant_lawyers.add(self.assistant_lawyer)

        # 4. Setup Case B (separate case for isolation testing)
        self.consultation_b = Consultation.objects.create(
            client=self.unrelated_client,
            practice_area=self.practice_area,
            assigned_lawyer=self.unrelated_lawyer,
            consultation_mode="OFFICE",
            preferred_date="2026-09-01",
            preferred_time="11:00:00",
            subject="Other Advisory",
            status=ConsultationStatus.ACCEPTED,
        )
        self.case_b = Case.objects.create(
            originating_consultation=self.consultation_b,
            client=self.unrelated_client,
            practice_area=self.practice_area,
            responsible_lawyer=self.unrelated_lawyer,
            supporting_paralegal=self.unrelated_paralegal,
            title="Other Business",
            case_type=CaseType.CIVIL,
            status=CaseStatus.OPEN,
            start_date="2026-09-02",
        )

        self.url_a = f"/api/cases/{self.case_a.case_reference}/messages/"
        self.url_b = f"/api/cases/{self.case_b.case_reference}/messages/"

    def test_01_authorized_client_can_access_messages(self):
        """Authorized client can view and post messages to their case."""
        self.client.force_authenticate(user=self.client_user)
        # GET history
        res = self.client.get(self.url_a)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # POST message
        post_res = self.client.post(self.url_a, {"content": "Hello advocate, filing question."})
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(post_res.data["content"], "Hello advocate, filing question.")
        self.assertEqual(post_res.data["sender_id"], self.client_user.id)
        self.assertEqual(post_res.data["sender_role"], UserRole.CLIENT)

    def test_02_responsible_lawyer_can_access_messages(self):
        """Responsible lawyer can post and view messages in their case."""
        self.client.force_authenticate(user=self.responsible_lawyer)
        res = self.client.post(self.url_a, {"content": "Filing is scheduled for tomorrow."})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["sender_id"], self.responsible_lawyer.id)
        self.assertEqual(res.data["sender_role"], UserRole.SENIOR_LAWYER)

    def test_03_assistant_lawyer_can_access_messages(self):
        """Assistant lawyer on the case team can access and send messages."""
        self.client.force_authenticate(user=self.assistant_lawyer)
        res = self.client.post(self.url_a, {"content": "I reviewed the court notice."})
        self.assertEqual(post_res_status := res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["sender_id"], self.assistant_lawyer.id)

    def test_04_supporting_paralegal_can_access_messages(self):
        """Supporting paralegal assigned to the case can access and send messages."""
        self.client.force_authenticate(user=self.paralegal)
        res = self.client.post(self.url_a, {"content": "Documents uploaded to registry."})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["sender_id"], self.paralegal.id)

    def test_05_admin_can_access_case_messages(self):
        """Chambers Administrator has full access to case conversations."""
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url_a)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        post_res = self.client.post(self.url_a, {"content": "Administrative note added."})
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)

    def test_06_unrelated_client_receives_403(self):
        """A client not owning the case receives 403 Forbidden."""
        self.client.force_authenticate(user=self.unrelated_client)
        res = self.client.get(self.url_a)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        post_res = self.client.post(self.url_a, {"content": "Snoop message."})
        self.assertEqual(post_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_07_unrelated_lawyer_receives_403(self):
        """A lawyer not assigned to the case receives 403 Forbidden."""
        self.client.force_authenticate(user=self.unrelated_lawyer)
        res = self.client.get(self.url_a)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        post_res = self.client.post(self.url_a, {"content": "Intrusion attempt."})
        self.assertEqual(post_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_08_unrelated_paralegal_receives_403(self):
        """A paralegal not assigned to the case receives 403 Forbidden."""
        self.client.force_authenticate(user=self.unrelated_paralegal)
        res = self.client.get(self.url_a)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        post_res = self.client.post(self.url_a, {"content": "Paralegal intrusion."})
        self.assertEqual(post_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_09_sender_is_always_request_user(self):
        """Spoofed sender ID or case ID in payload is completely ignored."""
        self.client.force_authenticate(user=self.client_user)
        res = self.client.post(
            self.url_a,
            {
                "content": "Authentic message",
                "sender": self.admin.id,
                "sender_id": self.admin.id,
                "case": "something_else",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["sender_id"], self.client_user.id)
        self.assertNotEqual(res.data["sender_id"], self.admin.id)

    def test_10_empty_and_whitespace_messages_rejected(self):
        """Empty and whitespace-only messages are rejected with 400 Bad Request."""
        self.client.force_authenticate(user=self.client_user)
        # Empty
        res1 = self.client.post(self.url_a, {"content": ""})
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Whitespace
        res2 = self.client.post(self.url_a, {"content": "   \n\t  "})
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_11_message_is_stored_in_postgresql(self):
        """Verifies that the message is persisted to the database and linked to conversation."""
        self.client.force_authenticate(user=self.responsible_lawyer)
        res = self.client.post(self.url_a, {"content": "Persisted message content."})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        msg = CaseMessage.objects.get(id=res.data["id"])
        self.assertEqual(msg.content, "Persisted message content.")
        self.assertEqual(msg.sender, self.responsible_lawyer)
        self.assertEqual(msg.conversation.case, self.case_a)
        self.assertIsNotNone(msg.created_at)

    def test_12_message_history_isolated_per_case(self):
        """Messages in Case A are strictly not returned in Case B."""
        # Post to Case A
        self.client.force_authenticate(user=self.client_user)
        self.client.post(self.url_a, {"content": "Secret Case A message"})

        # Post to Case B
        self.client.force_authenticate(user=self.unrelated_client)
        self.client.post(self.url_b, {"content": "Secret Case B message"})

        # Check Case A history
        self.client.force_authenticate(user=self.responsible_lawyer)
        res_a = self.client.get(self.url_a)
        contents_a = [m["content"] for m in res_a.data.get("results", res_a.data)]
        self.assertIn("Secret Case A message", contents_a)
        self.assertNotIn("Secret Case B message", contents_a)

        # Check Case B history
        self.client.force_authenticate(user=self.unrelated_lawyer)
        res_b = self.client.get(self.url_b)
        contents_b = [m["content"] for m in res_b.data.get("results", res_b.data)]
        self.assertIn("Secret Case B message", contents_b)
        self.assertNotIn("Secret Case A message", contents_b)


@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
)
class CaseChatWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.practice_area, _ = PracticeArea.objects.get_or_create(
            name="Corporate Law WS",
            defaults={"description": "Corporate Law for WS"},
        )
        self.responsible_lawyer = User.objects.create_user(
            email="resplawyer_ws@lexcore.local",
            full_name="Senior Advocate WS",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.client_user = User.objects.create_user(
            email="client_ws@lexcore.local",
            full_name="Client WS",
            password="password123",
            role=UserRole.CLIENT,
        )
        self.unrelated_user = User.objects.create_user(
            email="unrelated_ws@lexcore.local",
            full_name="Unrelated WS",
            password="password123",
            role=UserRole.CLIENT,
        )

        self.consultation = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.responsible_lawyer,
            consultation_mode="OFFICE",
            preferred_date="2026-09-01",
            preferred_time="10:00:00",
            subject="WS Case Subject",
            status=ConsultationStatus.ACCEPTED,
        )
        self.case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            title="WS Test Case",
            case_type=CaseType.CORPORATE,
            status=CaseStatus.OPEN,
            start_date="2026-09-02",
        )

    def tearDown(self):
        connection.close()

    def test_13_websocket_authorized_participant_can_connect(self):
        """Authorized participant can connect via WebSocket with a valid JWT token."""
        token = str(AccessToken.for_user(self.responsible_lawyer))
        path = f"/ws/cases/{self.case.case_reference}/chat/?token={token}"

        async def run_ws():
            communicator = WebsocketCommunicator(application, path)
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()

        async_to_sync(run_ws)()

    def test_14_websocket_unauthorized_user_cannot_connect(self):
        """Unauthorized user connection is rejected."""
        token = str(AccessToken.for_user(self.unrelated_user))
        path = f"/ws/cases/{self.case.case_reference}/chat/?token={token}"

        async def run_ws():
            communicator = WebsocketCommunicator(application, path)
            connected, _ = await communicator.connect()
            self.assertFalse(connected)
            await communicator.disconnect()

        async_to_sync(run_ws)()

    def test_15_websocket_send_and_broadcast_message(self):
        """Valid participant can send message via WebSocket and receive broadcast."""
        token_lawyer = str(AccessToken.for_user(self.responsible_lawyer))
        token_client = str(AccessToken.for_user(self.client_user))

        path_lawyer = f"/ws/cases/{self.case.case_reference}/chat/?token={token_lawyer}"
        path_client = f"/ws/cases/{self.case.case_reference}/chat/?token={token_client}"

        async def run_ws():
            comm_lawyer = WebsocketCommunicator(application, path_lawyer)
            comm_client = WebsocketCommunicator(application, path_client)

            connected1, _ = await comm_lawyer.connect()
            connected2, _ = await comm_client.connect()
            self.assertTrue(connected1)
            self.assertTrue(connected2)

            # Lawyer sends message
            await comm_lawyer.send_json_to({"content": "Real-time update via WebSocket"})

            # Client receives broadcast
            received = await comm_client.receive_json_from()
            self.assertEqual(received["content"], "Real-time update via WebSocket")
            self.assertEqual(received["sender_id"], self.responsible_lawyer.id)
            self.assertEqual(received["sender_role"], UserRole.SENIOR_LAWYER)

            await comm_lawyer.disconnect()
            await comm_client.disconnect()

        async_to_sync(run_ws)()

        # Verify saved in PostgreSQL
        self.assertTrue(
            CaseMessage.objects.filter(content="Real-time update via WebSocket").exists()
        )
