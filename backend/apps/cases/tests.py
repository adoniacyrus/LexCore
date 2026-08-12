from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.consultations.models import Consultation, ConsultationStatus, PracticeArea
from apps.cases.models import Case, CaseStatus, CaseType

User = get_user_model()


class CaseMilestoneTests(APITestCase):
    def setUp(self):
        # Create users
        self.admin = User.objects.create_user(
            email="admin@lexcore.local",
            full_name="Firm Admin",
            password="password123",
            role=UserRole.ADMIN,
        )
        self.lawyer_a = User.objects.create_user(
            email="lawyera@lexcore.local",
            full_name="Lawyer Alpha",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.lawyer_b = User.objects.create_user(
            email="lawyerb@lexcore.local",
            full_name="Lawyer Beta",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.paralegal = User.objects.create_user(
            email="paralegal@lexcore.local",
            full_name="Paralegal One",
            password="password123",
            role=UserRole.PARALEGAL,
        )
        self.client_user = User.objects.create_user(
            email="client@lexcore.local",
            full_name="John Doe Client",
            password="password123",
            role=UserRole.CLIENT,
        )
        self.other_client = User.objects.create_user(
            email="otherclient@lexcore.local",
            full_name="Jane Smith Client",
            password="password123",
            role=UserRole.CLIENT,
        )

        # Practice Area
        self.practice_area = PracticeArea.objects.get(name="Family Law")
        self.lawyer_a.practice_areas.add(self.practice_area)

        # Consultation
        self.consultation = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.lawyer_a,
            consultation_mode="OFFICE",
            preferred_date="2026-08-20",
            preferred_time="10:00:00",
            subject="Divorce Settlement",
            status=ConsultationStatus.ACCEPTED,
        )

    def test_convert_consultation_success(self):
        """Assigned lawyer can convert their accepted consultation into a Case."""
        self.client.force_authenticate(user=self.lawyer_a)
        url = reverse("case-convert")
        payload = {
            "originating_consultation": self.consultation.id,
            "title": "Doe Divorce Proceedings",
            "case_type": CaseType.FAMILY,
            "start_date": "2026-08-15",
            "description": "Proceeding with formal divorce paperwork.",
            "supporting_paralegal": self.paralegal.id,
            "court": "District Court",
            "location": "New Delhi",
        }

        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("case_reference", response.data)
        self.assertEqual(response.data["title"], "Doe Divorce Proceedings")
        self.assertEqual(response.data["client"]["id"], self.client_user.id)
        self.assertEqual(response.data["responsible_lawyer"]["id"], self.lawyer_a.id)
        self.assertEqual(response.data["supporting_paralegal"]["id"], self.paralegal.id)

        # Verify database
        case = Case.objects.get(pk=response.data["id"])
        self.assertEqual(case.case_reference, response.data["case_reference"])
        self.assertTrue(case.case_reference.startswith("CASE-2026-"))
        self.assertEqual(case.status, CaseStatus.OPEN)

    def test_convert_unauthorized_lawyer_fails(self):
        """A lawyer not assigned to the consultation cannot perform conversion."""
        self.client.force_authenticate(user=self.lawyer_b)
        url = reverse("case-convert")
        payload = {
            "originating_consultation": self.consultation.id,
            "title": "Unauthorized Case",
            "case_type": CaseType.CIVIL,
            "start_date": "2026-08-15",
        }

        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("originating_consultation", response.data)

    def test_convert_already_converted_fails(self):
        """A consultation cannot be converted to a Case multiple times."""
        # Convert first time
        Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            title="First Case",
            case_type=CaseType.CIVIL,
            status=CaseStatus.OPEN,
            start_date="2026-08-12",
        )

        self.client.force_authenticate(user=self.lawyer_a)
        url = reverse("case-convert")
        payload = {
            "originating_consultation": self.consultation.id,
            "title": "Second Case Attempt",
            "case_type": CaseType.CIVIL,
            "start_date": "2026-08-15",
        }

        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("originating_consultation", response.data)

    def test_non_lawyers_cannot_convert(self):
        """Admin, Paralegal, and Clients are blocked from converting consultations."""
        url = reverse("case-convert")
        payload = {
            "originating_consultation": self.consultation.id,
            "title": "Block Test",
            "case_type": CaseType.CIVIL,
            "start_date": "2026-08-15",
        }

        for user in [self.admin, self.paralegal, self.client_user]:
            self.client.force_authenticate(user=user)
            response = self.client.post(url, payload)
            # Lawyers check is done at APIView permission level, returning 403.
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_case_list_role_filtering(self):
        """Assert users see only the cases matching their roles/assignments."""
        # Create Case for client_user
        case_1 = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            supporting_paralegal=self.paralegal,
            title="Client Case 1",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
        )

        url = reverse("case-list")

        # 1. Admin sees it
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(url)
        self.assertEqual(len(res.data), 1)

        # 2. Responsible Lawyer A sees it
        self.client.force_authenticate(user=self.lawyer_a)
        res = self.client.get(url)
        self.assertEqual(len(res.data), 1)

        # 3. Lawyer B does NOT see it
        self.client.force_authenticate(user=self.lawyer_b)
        res = self.client.get(url)
        self.assertEqual(len(res.data), 0)

        # 4. Client sees their own case
        self.client.force_authenticate(user=self.client_user)
        res = self.client.get(url)
        self.assertEqual(len(res.data), 1)

        # 5. Other client does NOT see it
        self.client.force_authenticate(user=self.other_client)
        res = self.client.get(url)
        self.assertEqual(len(res.data), 0)

    def test_case_detail_object_permissions(self):
        """Case details are strictly restricted to assigned participants."""
        case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            supporting_paralegal=self.paralegal,
            title="Private Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
        )

        url = reverse("case-detail", kwargs={"pk": case.id})

        # Authorized accesses
        for user in [self.admin, self.lawyer_a, self.paralegal, self.client_user]:
            self.client.force_authenticate(user=user)
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Unauthorized accesses
        for user in [self.lawyer_b, self.other_client]:
            self.client.force_authenticate(user=user)
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_case_update_permissions(self):
        """Test edit/update permissions on Case."""
        case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            supporting_paralegal=self.paralegal,
            title="Private Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
        )
        url = reverse("case-detail", kwargs={"pk": case.id})
        payload = {"title": "Updated Title"}

        # 1. Responsible lawyer can update own case
        self.client.force_authenticate(user=self.lawyer_a)
        response = self.client.patch(url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Updated Title")

        # 2. Another lawyer cannot update the case
        self.client.force_authenticate(user=self.lawyer_b)
        response = self.client.patch(url, payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Client cannot update the case
        self.client.force_authenticate(user=self.client_user)
        response = self.client.patch(url, payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Unassigned paralegal cannot update the case
        other_paralegal = User.objects.create_user(
            email="otherparalegal@lexcore.local",
            full_name="Other Paralegal",
            password="password123",
            role=UserRole.PARALEGAL,
        )
        self.client.force_authenticate(user=other_paralegal)
        response = self.client.patch(url, payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_case_update_immutable_fields(self):
        """Immutable fields cannot be changed through the update API."""
        case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            supporting_paralegal=self.paralegal,
            title="Immutable Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
        )
        url = reverse("case-detail", kwargs={"pk": case.id})

        # Try to modify read-only fields
        other_practice_area = PracticeArea.objects.get(name="Corporate Law")
        payload = {
            "case_reference": "NEW-REF-9999",
            "client": self.lawyer_b.id,
            "practice_area": other_practice_area.id,
            "responsible_lawyer": self.lawyer_b.id,
        }

        self.client.force_authenticate(user=self.lawyer_a)
        response = self.client.patch(url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify fields are unchanged
        self.assertEqual(response.data["case_reference"], case.case_reference)
        self.assertEqual(response.data["client"]["id"], self.client_user.id)
        self.assertEqual(response.data["practice_area"]["id"], self.practice_area.id)
        self.assertEqual(response.data["responsible_lawyer"]["id"], self.lawyer_a.id)

    def test_case_update_validations(self):
        """Invalid Case Status and Case Type are rejected, partial updates work."""
        case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            supporting_paralegal=self.paralegal,
            title="Validation Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
        )
        url = reverse("case-detail", kwargs={"pk": case.id})

        self.client.force_authenticate(user=self.lawyer_a)

        # 1. Invalid status choice
        response = self.client.patch(url, {"status": "INVALID_STATUS"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

        # 2. Invalid case type choice
        response = self.client.patch(url, {"case_type": "INVALID_TYPE"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("case_type", response.data)

        # 3. Empty title is rejected
        response = self.client.patch(url, {"title": ""})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)

        # 4. Valid partial update works
        payload = {
            "court": "Supreme Court of India",
            "cnr_number": "CNR123456",
            "status": CaseStatus.IN_PROGRESS,
        }
        response = self.client.patch(url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["court"], "Supreme Court of India")
        self.assertEqual(response.data["cnr_number"], "CNR123456")
        self.assertEqual(response.data["status"], CaseStatus.IN_PROGRESS)

    def test_admin_update_restrictions(self):
        """Admin can only update administrative fields (paralegal, status)."""
        case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            supporting_paralegal=None,
            title="Admin Edit Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
        )
        url = reverse("case-detail", kwargs={"pk": case.id})

        self.client.force_authenticate(user=self.admin)

        # Try to edit legal content (title) alongside paralegal
        payload = {
            "title": "Admin Changed Title",
            "supporting_paralegal": self.paralegal.id,
            "status": CaseStatus.ON_HOLD,
        }
        response = self.client.patch(url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Title should NOT be updated, but paralegal and status should be updated
        self.assertEqual(response.data["title"], "Admin Edit Case")
        self.assertEqual(response.data["supporting_paralegal"]["id"], self.paralegal.id)
        self.assertEqual(response.data["status"], CaseStatus.ON_HOLD)

        # Try to update ONLY legal content -> should return 400 Bad Request since no allowed fields are present
        response = self.client.patch(url, {"title": "Another Admin Title"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
