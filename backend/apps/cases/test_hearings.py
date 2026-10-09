from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.consultations.models import Consultation, ConsultationStatus, PracticeArea
from apps.cases.models import Case, CaseStatus, CaseType, HearingRecord, CourtProceeding

User = get_user_model()


class HearingRecordTests(APITestCase):
    def setUp(self):
        # Users
        self.admin = User.objects.create_user(
            email="admin_hr@lexcore.local",
            full_name="Firm Admin",
            password="password123",
            role=UserRole.ADMIN,
        )
        self.responsible_lawyer = User.objects.create_user(
            email="responsible_hr@lexcore.local",
            full_name="Responsible Lawyer",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.supervising_lawyer = User.objects.create_user(
            email="supervising_hr@lexcore.local",
            full_name="Supervising Lawyer",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.assistant_lawyer = User.objects.create_user(
            email="assistant_hr@lexcore.local",
            full_name="Assistant Lawyer",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.paralegal = User.objects.create_user(
            email="paralegal_hr@lexcore.local",
            full_name="Supporting Paralegal",
            password="password123",
            role=UserRole.PARALEGAL,
        )
        self.client_user = User.objects.create_user(
            email="client_hr@lexcore.local",
            full_name="Client User",
            password="password123",
            role=UserRole.CLIENT,
        )
        self.other_lawyer = User.objects.create_user(
            email="other_lawyer_hr@lexcore.local",
            full_name="Other Unassigned Lawyer",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.other_client = User.objects.create_user(
            email="other_client_hr@lexcore.local",
            full_name="Other Client",
            password="password123",
            role=UserRole.CLIENT,
        )

        self.practice_area, _ = PracticeArea.objects.get_or_create(
            name="Civil Litigation",
            defaults={"description": "Civil disputes and litigation"}
        )

        # Case 1
        self.consultation1 = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.responsible_lawyer,
            consultation_mode="OFFICE",
            preferred_date="2026-08-01",
            preferred_time="10:00:00",
            subject="Commercial Dispute Case 1",
            status=ConsultationStatus.ACCEPTED,
        )
        self.case1 = Case.objects.create(
            originating_consultation=self.consultation1,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            supervising_lawyer=self.supervising_lawyer,
            supporting_paralegal=self.paralegal,
            title="Apex vs Zenith Tech",
            case_type=CaseType.CIVIL,
            court="Delhi High Court",
            start_date="2026-08-05",
        )
        self.case1.assistant_lawyers.add(self.assistant_lawyer)

        # Case 2 (Unrelated case)
        self.consultation2 = Consultation.objects.create(
            client=self.other_client,
            practice_area=self.practice_area,
            assigned_lawyer=self.other_lawyer,
            consultation_mode="OFFICE",
            preferred_date="2026-08-02",
            preferred_time="11:00:00",
            subject="Unrelated Matter Case 2",
            status=ConsultationStatus.ACCEPTED,
        )
        self.case2 = Case.objects.create(
            originating_consultation=self.consultation2,
            client=self.other_client,
            practice_area=self.practice_area,
            responsible_lawyer=self.other_lawyer,
            title="Second Unrelated Dispute",
            case_type=CaseType.CIVIL,
            court="Tis Hazari Court",
            start_date="2026-08-06",
        )

        # Initial Hearing Record on Case 1
        self.hearing1 = HearingRecord.objects.create(
            case=self.case1,
            hearing_date="2026-08-20",
            court="Delhi High Court - Courtroom 4",
            hearing_type="Interim Injunction Arguments",
            proceedings="Senior counsel presented oral arguments for petitioner. Opposing counsel requested adjournment.",
            outcome="Adjourned with Interim Protection",
            orders_or_directions="Status quo ordered till next hearing date. Counter-affidavit to be filed within 2 weeks.",
            next_hearing_date="2026-09-15",
            internal_notes="Opposing counsel unprepared. Bench receptive to our submissions. File rejoinder expeditiously.",
            created_by=self.responsible_lawyer,
        )

    def test_authorized_users_can_view_hearings(self):
        """All authorized case participants (Admin, Responsible, Supervising, Assistant, Paralegal, Client) can view hearings."""
        url = reverse("case-hearings", kwargs={"case_id": self.case1.case_reference})

        authorized_users = [
            self.admin,
            self.responsible_lawyer,
            self.supervising_lawyer,
            self.assistant_lawyer,
            self.paralegal,
            self.client_user,
        ]

        for user in authorized_users:
            self.client.force_authenticate(user=user)
            response = self.client.get(url)
            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
                f"User {user.email} ({user.role}) should be able to view hearings."
            )
            self.assertEqual(len(response.data), 1)
            self.assertEqual(response.data[0]["hearing_id"], self.hearing1.hearing_id)

    def test_authorized_lawyer_and_admin_can_create_hearing(self):
        """Responsible lawyer, supervising lawyer, and admin can create hearing records."""
        url = reverse("case-hearings", kwargs={"case_id": self.case1.case_reference})

        # 1. Responsible Lawyer creates hearing
        self.client.force_authenticate(user=self.responsible_lawyer)
        payload = {
            "hearing_date": "2026-09-15",
            "court": "Delhi High Court - Courtroom 4",
            "hearing_type": "Final Hearing",
            "proceedings": "Rejoinder filed and arguments concluded.",
            "outcome": "Judgment Reserved",
            "orders_or_directions": "Written submissions to be submitted in 7 days.",
            "next_hearing_date": "2026-10-05",
            "internal_notes": "Very favorable response from presiding judge.",
        }
        resp = self.client.post(url, payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["hearing_id"].startswith("HRNG-2026-"))
        self.assertEqual(resp.data["case_reference"], self.case1.case_reference)
        self.assertEqual(resp.data["outcome"], "Judgment Reserved")
        self.assertEqual(resp.data["created_by_details"]["id"], self.responsible_lawyer.id)

        # 2. Supervising Lawyer creates hearing
        self.client.force_authenticate(user=self.supervising_lawyer)
        payload2 = {
            "hearing_date": "2026-10-05",
            "court": "Delhi High Court",
            "hearing_type": "Pronouncement of Orders",
            "proceedings": "Orders pronounced in open court.",
            "outcome": "Allowed in Favor of Client",
            "orders_or_directions": "Injunction decreed with costs.",
            "internal_notes": "Decision in our favor. Arrange certified copy.",
        }
        resp2 = self.client.post(url, payload2)
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp2.data["created_by_details"]["id"], self.supervising_lawyer.id)

        # 3. Admin creates hearing
        self.client.force_authenticate(user=self.admin)
        payload3 = {
            "hearing_date": "2026-10-20",
            "court": "Delhi High Court",
            "hearing_type": "Compliance Hearing",
            "proceedings": "Compliance report verified by registry.",
            "outcome": "Compliance Recorded",
            "orders_or_directions": "Formal decree prepared.",
        }
        resp3 = self.client.post(url, payload3)
        self.assertEqual(resp3.status_code, status.HTTP_201_CREATED)

    def test_unauthorized_roles_cannot_create_hearing(self):
        """Assistant lawyers, paralegals, and clients cannot create hearing records."""
        url = reverse("case-hearings", kwargs={"case_id": self.case1.case_reference})
        payload = {
            "hearing_date": "2026-09-25",
            "hearing_type": "Motion Hearing",
            "proceedings": "Test proceedings",
            "outcome": "Adjourned",
        }

        restricted_users = [
            self.assistant_lawyer,
            self.paralegal,
            self.client_user,
        ]

        for user in restricted_users:
            self.client.force_authenticate(user=user)
            response = self.client.post(url, payload)
            self.assertEqual(
                response.status_code,
                status.HTTP_403_FORBIDDEN,
                f"User {user.email} ({user.role}) should be forbidden from creating hearings."
            )

    def test_unauthorized_user_cannot_access_another_case_hearings(self):
        """Unassigned lawyers and clients cannot view or mutate another case's hearings."""
        url_case1 = reverse("case-hearings", kwargs={"case_id": self.case1.case_reference})
        detail_url = reverse(
            "case-hearing-detail",
            kwargs={"case_id": self.case1.case_reference, "pk": self.hearing1.hearing_id}
        )

        unauthorized_users = [
            self.other_lawyer,
            self.other_client,
        ]

        for user in unauthorized_users:
            self.client.force_authenticate(user=user)
            # Cannot list
            resp_list = self.client.get(url_case1)
            self.assertEqual(resp_list.status_code, status.HTTP_403_FORBIDDEN)

            # Cannot create
            resp_post = self.client.post(url_case1, {"hearing_date": "2026-09-01", "outcome": "Test"})
            self.assertEqual(resp_post.status_code, status.HTTP_403_FORBIDDEN)

            # Cannot retrieve detail
            resp_detail = self.client.get(detail_url)
            self.assertEqual(resp_detail.status_code, status.HTTP_403_FORBIDDEN)

            # Cannot update
            resp_patch = self.client.patch(detail_url, {"outcome": "Malicious Update"})
            self.assertEqual(resp_patch.status_code, status.HTTP_403_FORBIDDEN)

            # Cannot delete
            resp_delete = self.client.delete(detail_url)
            self.assertEqual(resp_delete.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_cannot_access_internal_notes(self):
        """Client receives sanitized hearing information with internal_notes strictly excluded."""
        list_url = reverse("case-hearings", kwargs={"case_id": self.case1.case_reference})
        detail_url = reverse(
            "case-hearing-detail",
            kwargs={"case_id": self.case1.case_reference, "pk": self.hearing1.hearing_id}
        )
        case_detail_url = reverse("case-detail", kwargs={"pk": self.case1.case_reference})

        # 1. Client view - list endpoint
        self.client.force_authenticate(user=self.client_user)
        resp_list = self.client.get(list_url)
        self.assertEqual(resp_list.status_code, status.HTTP_200_OK)
        self.assertNotIn("internal_notes", resp_list.data[0])
        self.assertIn("outcome", resp_list.data[0])
        self.assertIn("proceedings", resp_list.data[0])
        self.assertIn("orders_or_directions", resp_list.data[0])

        # 2. Client view - detail endpoint
        resp_detail = self.client.get(detail_url)
        self.assertEqual(resp_detail.status_code, status.HTTP_200_OK)
        self.assertNotIn("internal_notes", resp_detail.data)

        # 3. Client view - nested in CaseDetailView
        resp_case = self.client.get(case_detail_url)
        self.assertEqual(resp_case.status_code, status.HTTP_200_OK)
        self.assertTrue(len(resp_case.data["hearing_records"]) > 0)
        self.assertNotIn("internal_notes", resp_case.data["hearing_records"][0])

        # 4. Contrast: Responsible lawyer can see internal notes
        self.client.force_authenticate(user=self.responsible_lawyer)
        resp_lawyer = self.client.get(detail_url)
        self.assertEqual(resp_lawyer.status_code, status.HTTP_200_OK)
        self.assertIn("internal_notes", resp_lawyer.data)
        self.assertEqual(resp_lawyer.data["internal_notes"], self.hearing1.internal_notes)

    def test_hearing_belongs_to_correct_case(self):
        """Hearings strictly belong to their case; cross-case access attempts fail with 404."""
        # Attempt to access Case 1's hearing under Case 2's URL
        cross_url = reverse(
            "case-hearing-detail",
            kwargs={"case_id": self.case2.case_reference, "pk": self.hearing1.hearing_id}
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(cross_url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

        # When creating on Case 1, passing case_id of Case 2 in payload is overridden by backend
        create_url = reverse("case-hearings", kwargs={"case_id": self.case1.case_reference})
        self.client.force_authenticate(user=self.responsible_lawyer)
        resp_create = self.client.post(create_url, {
            "case": self.case2.id,
            "hearing_date": "2026-09-30",
            "outcome": "Tamper Test",
        })
        self.assertEqual(resp_create.status_code, status.HTTP_201_CREATED)
        # Verified attached to case 1, not case 2
        record = HearingRecord.objects.get(hearing_id=resp_create.data["hearing_id"])
        self.assertEqual(record.case, self.case1)

    def test_update_authorization(self):
        """Authorized lawyers and admin can update hearing records; others are forbidden."""
        detail_url = reverse(
            "case-hearing-detail",
            kwargs={"case_id": self.case1.case_reference, "pk": self.hearing1.hearing_id}
        )

        # Client cannot update
        self.client.force_authenticate(user=self.client_user)
        resp_client = self.client.patch(detail_url, {"outcome": "Client Change"})
        self.assertEqual(resp_client.status_code, status.HTTP_403_FORBIDDEN)

        # Assistant lawyer cannot update
        self.client.force_authenticate(user=self.assistant_lawyer)
        resp_asst = self.client.patch(detail_url, {"outcome": "Assistant Change"})
        self.assertEqual(resp_asst.status_code, status.HTTP_403_FORBIDDEN)

        # Paralegal cannot update
        self.client.force_authenticate(user=self.paralegal)
        resp_para = self.client.patch(detail_url, {"outcome": "Paralegal Change"})
        self.assertEqual(resp_para.status_code, status.HTTP_403_FORBIDDEN)

        # Responsible lawyer can update
        self.client.force_authenticate(user=self.responsible_lawyer)
        resp_resp = self.client.patch(detail_url, {"outcome": "Updated by Responsible Lawyer"})
        self.assertEqual(resp_resp.status_code, status.HTTP_200_OK)
        self.hearing1.refresh_from_db()
        self.assertEqual(self.hearing1.outcome, "Updated by Responsible Lawyer")

        # Supervising lawyer can update
        self.client.force_authenticate(user=self.supervising_lawyer)
        resp_sup = self.client.patch(detail_url, {"outcome": "Updated by Supervising Lawyer"})
        self.assertEqual(resp_sup.status_code, status.HTTP_200_OK)
        self.hearing1.refresh_from_db()
        self.assertEqual(self.hearing1.outcome, "Updated by Supervising Lawyer")

        # Admin can update
        self.client.force_authenticate(user=self.admin)
        resp_admin = self.client.patch(detail_url, {"outcome": "Updated by Admin"})
        self.assertEqual(resp_admin.status_code, status.HTTP_200_OK)
        self.hearing1.refresh_from_db()
        self.assertEqual(self.hearing1.outcome, "Updated by Admin")

    def test_delete_authorization(self):
        """Only Admin, Responsible Lawyer, and Supervising Lawyer can delete hearing records."""
        # Create a record to delete
        temp_hearing = HearingRecord.objects.create(
            case=self.case1,
            hearing_date="2026-11-01",
            outcome="Temporary record",
            created_by=self.responsible_lawyer,
        )
        detail_url = reverse(
            "case-hearing-detail",
            kwargs={"case_id": self.case1.case_reference, "pk": temp_hearing.hearing_id}
        )

        # Client cannot delete
        self.client.force_authenticate(user=self.client_user)
        self.assertEqual(self.client.delete(detail_url).status_code, status.HTTP_403_FORBIDDEN)

        # Assistant lawyer cannot delete
        self.client.force_authenticate(user=self.assistant_lawyer)
        self.assertEqual(self.client.delete(detail_url).status_code, status.HTTP_403_FORBIDDEN)

        # Paralegal cannot delete
        self.client.force_authenticate(user=self.paralegal)
        self.assertEqual(self.client.delete(detail_url).status_code, status.HTTP_403_FORBIDDEN)

        # Responsible lawyer can delete
        self.client.force_authenticate(user=self.responsible_lawyer)
        resp_del = self.client.delete(detail_url)
        self.assertEqual(resp_del.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(HearingRecord.objects.filter(hearing_id=temp_hearing.hearing_id).exists())

    def test_court_calendar_integration(self):
        """When next_hearing_date is configured, a CourtProceeding is automatically registered for Court Calendar."""
        create_url = reverse("case-hearings", kwargs={"case_id": self.case1.case_reference})
        self.client.force_authenticate(user=self.responsible_lawyer)

        payload = {
            "hearing_date": "2026-08-25",
            "court": "Delhi High Court",
            "hearing_type": "Interlocutory Application",
            "proceedings": "Pleadings complete. Listed for disposal.",
            "outcome": "Adjourned for disposal",
            "next_hearing_date": "2026-09-28",
        }
        resp = self.client.post(create_url, payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        # Verify CourtProceeding was created for Court Calendar
        proceeding = CourtProceeding.objects.filter(
            case=self.case1,
            event_date="2026-08-25",
            next_hearing_date="2026-09-28",
        ).first()
        self.assertIsNotNone(proceeding, "CourtProceeding should be automatically created for Court Calendar.")
        self.assertEqual(proceeding.notes, "Adjourned for disposal")
