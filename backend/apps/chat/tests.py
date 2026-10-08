import json
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import UserRole
from apps.cases.models import Case, CaseStatus, CaseType
from apps.chat.models import CaseConversation, CaseMessage, ConversationType
from apps.consultations.models import Consultation, ConsultationStatus, PracticeArea
from config.asgi import application

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
        self.supervising_lawyer = User.objects.create_user(
            email="superlawyer@lexcore.local",
            full_name="Supervising Partner Dave",
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
            supervising_lawyer=self.supervising_lawyer,
            supporting_paralegal=self.paralegal,
            title="Acme Merger",
            case_type=CaseType.CORPORATE,
            status=CaseStatus.OPEN,
            start_date="2026-09-02",
        )
        self.case_a.assistant_lawyers.add(self.assistant_lawyer)

        # 4. Setup Case Admin as Responsible Lawyer
        self.consultation_admin = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.admin,
            consultation_mode="OFFICE",
            preferred_date="2026-09-01",
            preferred_time="10:00:00",
            subject="Admin Handled Case",
            status=ConsultationStatus.ACCEPTED,
        )
        self.case_admin_resp = Case.objects.create(
            originating_consultation=self.consultation_admin,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.admin,
            title="Admin Lead Case",
            case_type=CaseType.CORPORATE,
            status=CaseStatus.OPEN,
            start_date="2026-09-02",
        )

        # 5. Setup Case B (separate case for isolation testing)
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
        self.url_admin = f"/api/cases/{self.case_admin_resp.case_reference}/messages/"

    def test_01_responsible_lawyer_can_access_client_chat(self):
        """1. Responsible lawyer can access Client Chat."""
        self.client.force_authenticate(user=self.responsible_lawyer)
        res = self.client.get(f"{self.url_a}?conversation=client")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        post_res = self.client.post(
            f"{self.url_a}?conversation=client",
            {"content": "Client update from lead lawyer."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(post_res.data["conversation_type"], ConversationType.CLIENT_LAWYER)

    def test_02_responsible_lawyer_can_access_team_chat(self):
        """2. Responsible lawyer can access Team Chat."""
        self.client.force_authenticate(user=self.responsible_lawyer)
        res = self.client.get(f"{self.url_a}?conversation=team")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        post_res = self.client.post(
            f"{self.url_a}?conversation=team",
            {"content": "Internal team direction."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(post_res.data["conversation_type"], ConversationType.TEAM)

    def test_03_client_can_access_client_chat(self):
        """3. Client can access Client Chat."""
        self.client.force_authenticate(user=self.client_user)
        res = self.client.get(f"{self.url_a}?conversation=client")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        post_res = self.client.post(
            f"{self.url_a}?conversation=client",
            {"content": "Hello advocate, filing query."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(post_res.data["conversation_type"], ConversationType.CLIENT_LAWYER)

    def test_04_client_cannot_access_team_chat(self):
        """4. Client cannot access Team Chat."""
        self.client.force_authenticate(user=self.client_user)
        res = self.client.get(f"{self.url_a}?conversation=team")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        post_res = self.client.post(
            f"{self.url_a}?conversation=team",
            {"content": "Unauthorized intrusion attempt."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_05_supervising_lawyer_can_access_team_chat(self):
        """5. Supervising lawyer can access Team Chat."""
        self.client.force_authenticate(user=self.supervising_lawyer)
        res = self.client.get(f"{self.url_a}?conversation=team")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        post_res = self.client.post(
            f"{self.url_a}?conversation=team",
            {"content": "Supervising lawyer team review."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)

    def test_06_supervising_lawyer_cannot_access_client_chat(self):
        """6. Supervising lawyer cannot access Client Chat."""
        self.client.force_authenticate(user=self.supervising_lawyer)
        res = self.client.get(f"{self.url_a}?conversation=client")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        post_res = self.client.post(
            f"{self.url_a}?conversation=client",
            {"content": "Supervising lawyer intrusion to client chat."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_07_assistant_lawyer_can_access_team_chat(self):
        """7. Assistant lawyer can access Team Chat."""
        self.client.force_authenticate(user=self.assistant_lawyer)
        res = self.client.get(f"{self.url_a}?conversation=team")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        post_res = self.client.post(
            f"{self.url_a}?conversation=team",
            {"content": "Assistant notes for the team."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)

    def test_08_assistant_lawyer_cannot_access_client_chat(self):
        """8. Assistant lawyer cannot access Client Chat."""
        self.client.force_authenticate(user=self.assistant_lawyer)
        res = self.client.get(f"{self.url_a}?conversation=client")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        post_res = self.client.post(
            f"{self.url_a}?conversation=client",
            {"content": "Assistant intrusion attempt to client chat."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_09_supporting_paralegal_can_access_team_chat(self):
        """9. Supporting paralegal can access Team Chat."""
        self.client.force_authenticate(user=self.paralegal)
        res = self.client.get(f"{self.url_a}?conversation=team")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        post_res = self.client.post(
            f"{self.url_a}?conversation=team",
            {"content": "Paralegal documents prepared."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)

    def test_10_supporting_paralegal_cannot_access_client_chat(self):
        """10. Supporting paralegal cannot access Client Chat."""
        self.client.force_authenticate(user=self.paralegal)
        res = self.client.get(f"{self.url_a}?conversation=client")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        post_res = self.client.post(
            f"{self.url_a}?conversation=client",
            {"content": "Paralegal intrusion attempt to client chat."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_11_admin_can_access_team_chat(self):
        """11. Admin can access Team Chat."""
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(f"{self.url_a}?conversation=team")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        post_res = self.client.post(
            f"{self.url_a}?conversation=team",
            {"content": "Admin operational directive."},
        )
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)

    def test_12_admin_cannot_access_client_chat_unless_responsible_lawyer(self):
        """12. Admin cannot access Client Chat unless admin is responsible lawyer."""
        self.client.force_authenticate(user=self.admin)

        # On Case A (admin is not responsible lawyer)
        res_a = self.client.get(f"{self.url_a}?conversation=client")
        self.assertEqual(res_a.status_code, status.HTTP_403_FORBIDDEN)

        post_res_a = self.client.post(
            f"{self.url_a}?conversation=client",
            {"content": "Admin trying to read client chat."},
        )
        self.assertEqual(post_res_a.status_code, status.HTTP_403_FORBIDDEN)

        # On Case Admin Resp (admin IS responsible lawyer)
        res_admin = self.client.get(f"{self.url_admin}?conversation=client")
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)

        post_res_admin = self.client.post(
            f"{self.url_admin}?conversation=client",
            {"content": "Admin as lead counsel message."},
        )
        self.assertEqual(post_res_admin.status_code, status.HTTP_201_CREATED)

    def test_13_client_chat_messages_never_appear_in_team_chat(self):
        """13. Client Chat messages never appear in Team Chat."""
        # Client posts to Client Chat
        self.client.force_authenticate(user=self.client_user)
        self.client.post(
            f"{self.url_a}?conversation=client",
            {"content": "Privileged client statement."},
        )

        # Responsible lawyer reads Team Chat
        self.client.force_authenticate(user=self.responsible_lawyer)
        team_res = self.client.get(f"{self.url_a}?conversation=team")
        team_contents = [m["content"] for m in team_res.data.get("results", team_res.data)]
        self.assertNotIn("Privileged client statement", team_contents)

        # Assistant lawyer reads Team Chat
        self.client.force_authenticate(user=self.assistant_lawyer)
        team_res_assist = self.client.get(f"{self.url_a}?conversation=team")
        team_contents_assist = [m["content"] for m in team_res_assist.data.get("results", team_res_assist.data)]
        self.assertNotIn("Privileged client statement", team_contents_assist)

    def test_14_team_chat_messages_never_appear_in_client_chat(self):
        """14. Team Chat messages never appear in Client Chat."""
        # Assistant lawyer posts to Team Chat
        self.client.force_authenticate(user=self.assistant_lawyer)
        self.client.post(
            f"{self.url_a}?conversation=team",
            {"content": "Internal lawyer deliberation strategy."},
        )

        # Client reads Client Chat
        self.client.force_authenticate(user=self.client_user)
        client_res = self.client.get(f"{self.url_a}?conversation=client")
        client_contents = [m["content"] for m in client_res.data.get("results", client_res.data)]
        self.assertNotIn("Internal lawyer deliberation strategy", client_contents)

    def test_19_message_sender_remains_request_user(self):
        """19. Message sender remains strictly request.user even if spoofed in payload."""
        self.client.force_authenticate(user=self.client_user)
        res = self.client.post(
            f"{self.url_a}?conversation=client",
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

    def test_20_existing_general_case_authorization_remains_passing(self):
        """20. Existing general case authorization tests remain passing."""
        # Unrelated client receives 403 on both
        self.client.force_authenticate(user=self.unrelated_client)
        res1 = self.client.get(f"{self.url_a}?conversation=client")
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)
        res2 = self.client.get(f"{self.url_a}?conversation=team")
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

        # Unrelated lawyer receives 403 on both
        self.client.force_authenticate(user=self.unrelated_lawyer)
        res3 = self.client.get(f"{self.url_a}?conversation=client")
        self.assertEqual(res3.status_code, status.HTTP_403_FORBIDDEN)
        res4 = self.client.get(f"{self.url_a}?conversation=team")
        self.assertEqual(res4.status_code, status.HTTP_403_FORBIDDEN)

        # Empty / whitespace validation
        self.client.force_authenticate(user=self.client_user)
        empty_res = self.client.post(f"{self.url_a}?conversation=client", {"content": ""})
        self.assertEqual(empty_res.status_code, status.HTTP_400_BAD_REQUEST)
        ws_res = self.client.post(f"{self.url_a}?conversation=client", {"content": "   \n\t  "})
        self.assertEqual(ws_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_22_attach_image_or_file_to_message(self):
        """Verify attaching a file/image via multipart upload."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.force_authenticate(user=self.responsible_lawyer)
        fake_image = SimpleUploadedFile(
            "screencapture.png",
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRfakeimagebytes",
            content_type="image/png",
        )
        res = self.client.post(
            f"{self.url_a}?conversation=team",
            {
                "content": "Look at this screenshot",
                "attachment": fake_image,
            },
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["content"], "Look at this screenshot")
        self.assertEqual(res.data["attachment_name"], "screencapture.png")
        self.assertEqual(res.data["attachment_type"], "image/png")
        self.assertIsNotNone(res.data["attachment_url"])
        self.assertTrue(res.data["attachment_size"] > 0)

    def test_23_attach_file_without_text_content(self):
        """Verify attaching a file without any text body succeeds."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.force_authenticate(user=self.client_user)
        fake_pdf = SimpleUploadedFile(
            "notice.pdf",
            b"%PDF-1.4 test file data",
            content_type="application/pdf",
        )
        res = self.client.post(
            f"{self.url_a}?conversation=client",
            {
                "content": "",
                "attachment": fake_pdf,
            },
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["attachment_name"], "notice.pdf")
        self.assertIsNotNone(res.data["attachment_url"])

    def test_24_message_without_text_and_without_attachment_rejected(self):
        """Verify posting without content and without attachment is rejected."""
        self.client.force_authenticate(user=self.responsible_lawyer)
        res = self.client.post(
            f"{self.url_a}?conversation=team",
            {"content": ""},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


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
        self.admin = User.objects.create_user(
            email="admin_ws@lexcore.local",
            full_name="Admin WS",
            password="password123",
            role=UserRole.ADMIN,
        )
        self.responsible_lawyer = User.objects.create_user(
            email="resplawyer_ws@lexcore.local",
            full_name="Senior Advocate WS",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.assistant_lawyer = User.objects.create_user(
            email="assist_ws@lexcore.local",
            full_name="Assistant Lawyer WS",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
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
        self.case.assistant_lawyers.add(self.assistant_lawyer)

    def tearDown(self):
        connection.close()

    def test_15_websocket_client_to_client_chat_succeeds(self):
        """15. Client WebSocket to client chat succeeds."""
        token = str(AccessToken.for_user(self.client_user))
        path = f"/ws/cases/{self.case.case_reference}/chat/client/?token={token}"

        async def run_ws():
            communicator = WebsocketCommunicator(application, path)
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()

        async_to_sync(run_ws)()

    def test_16_websocket_client_to_team_chat_is_rejected(self):
        """16. Client WebSocket to team chat is rejected."""
        token = str(AccessToken.for_user(self.client_user))
        path = f"/ws/cases/{self.case.case_reference}/chat/team/?token={token}"

        async def run_ws():
            communicator = WebsocketCommunicator(application, path)
            connected, _ = await communicator.connect()
            self.assertFalse(connected)
            await communicator.disconnect()

        async_to_sync(run_ws)()

    def test_17_websocket_responsible_lawyer_can_connect_to_both(self):
        """17. Responsible lawyer can connect to both WebSockets."""
        token = str(AccessToken.for_user(self.responsible_lawyer))
        path_client = f"/ws/cases/{self.case.case_reference}/chat/client/?token={token}"
        path_team = f"/ws/cases/{self.case.case_reference}/chat/team/?token={token}"

        async def run_ws():
            comm_client = WebsocketCommunicator(application, path_client)
            connected_client, _ = await comm_client.connect()
            self.assertTrue(connected_client)
            await comm_client.disconnect()

            comm_team = WebsocketCommunicator(application, path_team)
            connected_team, _ = await comm_team.connect()
            self.assertTrue(connected_team)
            await comm_team.disconnect()

        async_to_sync(run_ws)()

    def test_18_websocket_assistant_lawyer_can_connect_only_to_team_chat(self):
        """18. Assistant lawyer can connect only to Team Chat."""
        token = str(AccessToken.for_user(self.assistant_lawyer))
        path_client = f"/ws/cases/{self.case.case_reference}/chat/client/?token={token}"
        path_team = f"/ws/cases/{self.case.case_reference}/chat/team/?token={token}"

        async def run_ws():
            # Client chat rejected
            comm_client = WebsocketCommunicator(application, path_client)
            connected_client, _ = await comm_client.connect()
            self.assertFalse(connected_client)
            await comm_client.disconnect()

            # Team chat accepted
            comm_team = WebsocketCommunicator(application, path_team)
            connected_team, _ = await comm_team.connect()
            self.assertTrue(connected_team)
            await comm_team.disconnect()

        async_to_sync(run_ws)()

    def test_21_websocket_cross_channel_isolation(self):
        """Messages in client chat WebSocket never leak to team chat WebSocket."""
        token_lawyer = str(AccessToken.for_user(self.responsible_lawyer))
        token_client = str(AccessToken.for_user(self.client_user))
        token_assistant = str(AccessToken.for_user(self.assistant_lawyer))

        path_lawyer_client = f"/ws/cases/{self.case.case_reference}/chat/client/?token={token_lawyer}"
        path_client = f"/ws/cases/{self.case.case_reference}/chat/client/?token={token_client}"
        path_assistant_team = f"/ws/cases/{self.case.case_reference}/chat/team/?token={token_assistant}"

        async def run_ws():
            comm_lawyer = WebsocketCommunicator(application, path_lawyer_client)
            comm_client = WebsocketCommunicator(application, path_client)
            comm_assistant = WebsocketCommunicator(application, path_assistant_team)

            c1, _ = await comm_lawyer.connect()
            c2, _ = await comm_client.connect()
            c3, _ = await comm_assistant.connect()
            self.assertTrue(c1)
            self.assertTrue(c2)
            self.assertTrue(c3)

            # Client sends message in Client Chat
            await comm_client.send_json_to({"content": "Direct confidential note to lead lawyer"})

            # Responsible lawyer receives it
            received_lawyer = await comm_lawyer.receive_json_from()
            self.assertEqual(received_lawyer["content"], "Direct confidential note to lead lawyer")

            # Assistant lawyer in Team Chat receives NOTHING
            nothing_received = await comm_assistant.receive_nothing(timeout=0.5)
            self.assertTrue(nothing_received)

            await comm_lawyer.disconnect()
            await comm_client.disconnect()
            await comm_assistant.disconnect()

        async_to_sync(run_ws)()
