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
            "matter_category": "COURT_LITIGATION",
            "matter_stage": "UNDER_REVIEW",
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
            "matter_category": "COURT_LITIGATION",
            "matter_stage": "UNDER_REVIEW",
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
            "matter_category": "COURT_LITIGATION",
            "matter_stage": "UNDER_REVIEW",
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
            "matter_category": "COURT_LITIGATION",
            "matter_stage": "UNDER_REVIEW",
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

    def test_case_team_extended_administration(self):
        """Test the 25 specific assertions for Case Team & Assistant Lawyers."""
        # Create primary Case
        case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            supporting_paralegal=None,
            title="Team Administration Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
        )
        team_url = reverse("case-team-update", kwargs={"pk": case.id})
        list_url = reverse("case-list")
        detail_url = reverse("case-detail", kwargs={"pk": case.id})
        active_lawyers_url = reverse("active-lawyers")
        
        # Create additional users for testing
        inactive_lawyer = User.objects.create_user(
            email="inactivelawyer@lexcore.local",
            full_name="Inactive Lawyer",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
            is_active=False,
        )
        inactive_paralegal = User.objects.create_user(
            email="inactiveparalegal@lexcore.local",
            full_name="Inactive Paralegal",
            password="password123",
            role=UserRole.PARALEGAL,
            is_active=False,
        )
        other_lawyer = User.objects.create_user(
            email="otherlawyer@lexcore.local",
            full_name="Other Lawyer",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
        )

        # 1. Admin can add assistant lawyers.
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(team_url, {"assistant_lawyers": [self.lawyer_b.id]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["assistant_lawyers"]), 1)
        self.assertEqual(response.data["assistant_lawyers"][0]["id"], self.lawyer_b.id)

        # 2. Admin can remove assistant lawyers.
        response = self.client.patch(team_url, {"assistant_lawyers": []}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["assistant_lawyers"]), 0)

        # 3. Responsible Lawyer can add assistant lawyers.
        self.client.force_authenticate(user=self.lawyer_a)
        response = self.client.patch(team_url, {"assistant_lawyers": [self.lawyer_b.id]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["assistant_lawyers"]), 1)
        self.assertEqual(response.data["assistant_lawyers"][0]["id"], self.lawyer_b.id)

        # 4. Responsible Lawyer can remove assistant lawyers.
        response = self.client.patch(team_url, {"assistant_lawyers": []}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["assistant_lawyers"]), 0)

        # 5. Responsible Lawyer can assign paralegal.
        response = self.client.patch(team_url, {"supporting_paralegal": self.paralegal.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["supporting_paralegal"]["id"], self.paralegal.id)

        # 6. Responsible Lawyer can remove paralegal.
        response = self.client.patch(team_url, {"supporting_paralegal": None}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["supporting_paralegal"])

        # 7. Responsible Lawyer cannot change responsible lawyer.
        # Should return a clear 400 validation error (instead of discarding).
        response = self.client.patch(team_url, {"responsible_lawyer": self.lawyer_b.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("responsible_lawyer", response.data)

        # 8. Assistant Lawyer cannot manage team.
        # Let's add lawyer_b as assistant first (via Admin)
        self.client.force_authenticate(user=self.admin)
        self.client.patch(team_url, {"assistant_lawyers": [self.lawyer_b.id]}, format="json")
        # Check lawyer_b (assistant) gets 403 Forbidden
        self.client.force_authenticate(user=self.lawyer_b)
        response = self.client.patch(team_url, {"supporting_paralegal": self.paralegal.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 9. Other Lawyer cannot manage team.
        self.client.force_authenticate(user=other_lawyer)
        response = self.client.patch(team_url, {"supporting_paralegal": self.paralegal.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 10. Paralegal cannot manage team.
        self.client.force_authenticate(user=self.paralegal)
        response = self.client.patch(team_url, {"supporting_paralegal": None}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 11. Client cannot manage team.
        self.client.force_authenticate(user=self.client_user)
        response = self.client.patch(team_url, {"supporting_paralegal": None}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 12. Client cannot become assistant lawyer (invalid choice - 400).
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(team_url, {"assistant_lawyers": [self.client_user.id]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # 13. Paralegal cannot become assistant lawyer (invalid choice - 400).
        response = self.client.patch(team_url, {"assistant_lawyers": [self.paralegal.id]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # 14. Admin cannot assign inactive lawyer as assistant (400).
        response = self.client.patch(team_url, {"assistant_lawyers": [inactive_lawyer.id]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # 15. Responsible Lawyer cannot assign inactive lawyer as assistant (400).
        self.client.force_authenticate(user=self.lawyer_a)
        response = self.client.patch(team_url, {"assistant_lawyers": [inactive_lawyer.id]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # 16. Responsible Lawyer cannot assign themselves as assistant (lead cannot also be assistant).
        response = self.client.patch(team_url, {"assistant_lawyers": [self.lawyer_a.id]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assistant_lawyers", response.data)

        # 17. Duplicate assistant lawyers are rejected.
        response = self.client.patch(team_url, {"assistant_lawyers": [self.lawyer_b.id, self.lawyer_b.id]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assistant_lawyers", response.data)

        # Reset team via Admin for visibility testing
        self.client.force_authenticate(user=self.admin)
        self.client.patch(
            team_url,
            {"responsible_lawyer": self.lawyer_a.id, "assistant_lawyers": [self.lawyer_b.id], "supporting_paralegal": self.paralegal.id},
            format="json"
        )

        # 18. Assistant lawyers can see the Case (in list and detail).
        self.client.force_authenticate(user=self.lawyer_b)
        response = self.client.get(list_url)
        case_ids = [c["id"] for c in response.data]
        self.assertIn(case.id, case_ids)

        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 19. Removing an assistant lawyer removes their Case visibility.
        self.client.force_authenticate(user=self.admin)
        self.client.patch(team_url, {"assistant_lawyers": []}, format="json")
        
        self.client.force_authenticate(user=self.lawyer_b)
        response = self.client.get(list_url)
        case_ids = [c["id"] for c in response.data]
        self.assertNotIn(case.id, case_ids)

        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Reset assistant and reassign responsible lawyer
        self.client.force_authenticate(user=self.admin)
        self.client.patch(team_url, {"assistant_lawyers": [self.lawyer_b.id]}, format="json")

        # 20. Reassigning Responsible Lawyer updates Case ownership.
        response = self.client.patch(team_url, {"responsible_lawyer": self.lawyer_b.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["responsible_lawyer"]["id"], self.lawyer_b.id)

        # 21. New Responsible Lawyer gains access.
        self.client.force_authenticate(user=self.lawyer_b)
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 22. Old Responsible Lawyer (lawyer_a) loses access unless independently assigned as assistant.
        self.client.force_authenticate(user=self.lawyer_a)
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 23. If the new Responsible Lawyer was previously an assistant (lawyer_b),
        # they are removed from assistant_lawyers automatically.
        self.client.force_authenticate(user=self.admin)
        # Fetch current case team from DB
        case.refresh_from_db()
        self.assertEqual(case.responsible_lawyer, self.lawyer_b)
        self.assertNotIn(self.lawyer_b, case.assistant_lawyers.all())

        # 24. Client continues to see the Case.
        self.client.force_authenticate(user=self.client_user)
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 25. Supporting Paralegal continues to see the Case.
        # Assign paralegal first
        self.client.force_authenticate(user=self.admin)
        self.client.patch(team_url, {"supporting_paralegal": self.paralegal.id}, format="json")
        # Check access
        self.client.force_authenticate(user=self.paralegal)
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Test listing active lawyers endpoint access (accessible to lawyers)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(active_lawyers_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lawyer_ids = [l["id"] for l in response.data]
        self.assertNotIn(inactive_lawyer.id, lawyer_ids)
        self.assertIn(self.lawyer_b.id, lawyer_ids)

        self.client.force_authenticate(user=self.lawyer_a)
        response = self.client.get(active_lawyers_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_matter_classification(self):
        """Test Case classification: validation, updates, permissions, listing filters."""
        # Create case
        case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            supporting_paralegal=self.paralegal,
            title="Classification Test Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
        )
        detail_url = reverse("case-detail", kwargs={"pk": case.id})
        list_url = reverse("case-list")

        # 1. Check default values for created case
        self.assertEqual(case.matter_category, "COURT_LITIGATION")
        self.assertEqual(case.matter_stage, "UNDER_REVIEW")

        # 2. Responsible Lawyer can update category and stage
        self.client.force_authenticate(user=self.lawyer_a)
        payload = {"matter_category": "ADVISORY", "matter_stage": "PRE_LITIGATION"}
        response = self.client.patch(detail_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["matter_category"], "ADVISORY")
        self.assertEqual(response.data["matter_stage"], "PRE_LITIGATION")

        # 3. Admin can update category and stage
        self.client.force_authenticate(user=self.admin)
        payload = {"matter_category": "COMPLIANCE", "matter_stage": "NOTICE_ISSUED"}
        response = self.client.patch(detail_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["matter_category"], "COMPLIANCE")
        self.assertEqual(response.data["matter_stage"], "NOTICE_ISSUED")

        # 4. Clients cannot update category and stage
        self.client.force_authenticate(user=self.client_user)
        payload = {"matter_category": "MEDIATION"}
        response = self.client.patch(detail_url, payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Paralegals cannot update category and stage
        self.client.force_authenticate(user=self.paralegal)
        payload = {"matter_category": "MEDIATION"}
        response = self.client.patch(detail_url, payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Invalid choices are rejected
        self.client.force_authenticate(user=self.lawyer_a)
        payload = {"matter_category": "INVALID_CATEGORY"}
        response = self.client.patch(detail_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # 7. Listing filters work
        # Reset to compliance and notice_issued
        case.matter_category = "COMPLIANCE"
        case.matter_stage = "NOTICE_ISSUED"
        case.save()

        # Fetch cases with category filtering
        self.client.force_authenticate(user=self.admin)
        res_filtered = self.client.get(f"{list_url}?matter_category=COMPLIANCE")
        self.assertEqual(len(res_filtered.data), 1)

        res_filtered_none = self.client.get(f"{list_url}?matter_category=ADVISORY")
        self.assertEqual(len(res_filtered_none.data), 0)

        # Fetch cases with stage filtering
        res_filtered_stage = self.client.get(f"{list_url}?matter_stage=NOTICE_ISSUED")
        self.assertEqual(len(res_filtered_stage.data), 1)

        res_filtered_stage_none = self.client.get(f"{list_url}?matter_stage=UNDER_REVIEW")
        self.assertEqual(len(res_filtered_stage_none.data), 0)

    def test_matter_board_endpoint(self):
        """Test the /api/cases/matter-board/ API endpoint summary and categories logic."""
        # Create different consultations to satisfy the OneToOne constraint on originating_consultation
        from apps.consultations.models import Consultation, ConsultationStatus

        cons2 = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.lawyer_a,
            consultation_mode="OFFICE",
            preferred_date="2026-08-20",
            preferred_time="10:00:00",
            subject="Matter Board Sample 2",
            status=ConsultationStatus.ACCEPTED,
        )
        cons3 = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.lawyer_a,
            consultation_mode="OFFICE",
            preferred_date="2026-08-20",
            preferred_time="10:00:00",
            subject="Matter Board Sample 3",
            status=ConsultationStatus.ACCEPTED,
        )

        # Case 1: ADVISORY, OPEN
        Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            title="Advisory Open Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
            status=CaseStatus.OPEN,
            matter_category="ADVISORY",
            matter_stage="UNDER_REVIEW",
        )

        # Case 2: DOCUMENTATION, CLOSED
        Case.objects.create(
            originating_consultation=cons2,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            title="Doc Closed Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
            status=CaseStatus.CLOSED,
            matter_category="DOCUMENTATION",
            matter_stage="CLOSED",
        )

        # Case 3: COURT_LITIGATION, ARCHIVED
        Case.objects.create(
            originating_consultation=cons3,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            title="Litigation Archived Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
            status=CaseStatus.ARCHIVED,
            matter_category="COURT_LITIGATION",
            matter_stage="ARCHIVED",
        )

        url = reverse("case-matter-board")

        # 1. Admin user can fetch Matter Board
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify summaries
        summary = response.data["summary"]
        self.assertEqual(summary["total"], 3)
        self.assertEqual(summary["open"], 1)
        self.assertEqual(summary["closed"], 1)
        self.assertEqual(summary["archived"], 1)

        # Verify categories counts
        categories = response.data["categories"]
        # There should be exactly 11 categories returned
        self.assertEqual(len(categories), 11)

        advisory = next(c for c in categories if c["category"] == "ADVISORY")
        self.assertEqual(advisory["total"], 1)
        self.assertEqual(advisory["open"], 1)
        self.assertEqual(advisory["closed"], 0)

        documentation = next(c for c in categories if c["category"] == "DOCUMENTATION")
        self.assertEqual(documentation["total"], 1)
        self.assertEqual(documentation["open"], 0)
        self.assertEqual(documentation["closed"], 1)

        # 2. Responsible Lawyer user can fetch Matter Board (only their cases, which is 3)
        self.client.force_authenticate(user=self.lawyer_a)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total"], 3)

        # 3. Unassigned lawyer sees 0 cases
        self.client.force_authenticate(user=self.lawyer_b)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total"], 0)

        # 4. Paralegal (not supporting any of these) sees 0 cases
        self.client.force_authenticate(user=self.paralegal)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total"], 0)


class CaseTeamHierarchyTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin_hier@lexcore.local",
            full_name="Hier Admin",
            password="password123",
            role=UserRole.ADMIN,
        )
        self.senior_lawyer = User.objects.create_user(
            email="senior_hier@lexcore.local",
            full_name="Senior Hier",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.junior_lawyer = User.objects.create_user(
            email="junior_hier@lexcore.local",
            full_name="Junior Hier",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.other_junior = User.objects.create_user(
            email="other_junior_hier@lexcore.local",
            full_name="Other Junior",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.client_user = User.objects.create_user(
            email="client_hier@lexcore.local",
            full_name="John Client",
            password="password123",
            role=UserRole.CLIENT,
        )
        self.practice_area = PracticeArea.objects.get(name="Family Law")
        self.consultation = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.junior_lawyer,
            consultation_mode="OFFICE",
            preferred_date="2026-08-20",
            preferred_time="10:00:00",
            subject="Contract Dispute",
            status=ConsultationStatus.ACCEPTED,
        )
        self.case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.junior_lawyer,
            title="Junior Led Case",
            case_type=CaseType.CIVIL,
            status=CaseStatus.OPEN,
            start_date="2026-08-12",
        )

    def test_assign_junior_as_supervising_fails(self):
        """Cannot assign a Junior Lawyer as Supervising Lawyer."""
        self.client.force_authenticate(user=self.admin)
        url = reverse("case-team-update", kwargs={"pk": self.case.id})
        payload = {"supervising_lawyer": self.other_junior.id}
        response = self.client.patch(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("supervising_lawyer", response.data)
        self.assertEqual(response.data["supervising_lawyer"][0], "Only Senior Advocates can act as Supervising Lawyers.")

    def test_assign_senior_as_assistant_to_junior_led_fails(self):
        """Cannot assign a Senior Lawyer as Assistant to a Junior Lawyer led case."""
        self.client.force_authenticate(user=self.admin)
        url = reverse("case-team-update", kwargs={"pk": self.case.id})
        payload = {"assistant_lawyers": [self.senior_lawyer.id]}
        response = self.client.patch(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assistant_lawyers", response.data)
        self.assertEqual(response.data["assistant_lawyers"][0], "Senior Advocates cannot be assigned as Assistant Lawyers to a Junior-led matter. Assign them as Supervising Lawyer instead.")

    def test_assign_senior_as_supervising_and_junior_as_assistant_success(self):
        """Can assign Senior as Supervising Lawyer and Junior as Assistant to a Junior-led case."""
        self.client.force_authenticate(user=self.admin)
        url = reverse("case-team-update", kwargs={"pk": self.case.id})
        payload = {
            "supervising_lawyer": self.senior_lawyer.id,
            "assistant_lawyers": [self.other_junior.id],
        }
        response = self.client.patch(url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify db
        self.case.refresh_from_db()
        self.assertEqual(self.case.supervising_lawyer, self.senior_lawyer)
        self.assertIn(self.other_junior, self.case.assistant_lawyers.all())

        # Verify activity timeline log
        activities = self.case.activities.all()
        self.assertTrue(activities.filter(activity_type="SUPERVISING_COUNSEL_ASSIGNED").exists())
        self.assertTrue(activities.filter(activity_type="ASSISTANT_LAWYER_ADDED").exists())

    def test_supervising_lawyer_permissions(self):
        """Supervising lawyer has access to the case, tasks, and documents."""
        # Setup supervising lawyer
        self.case.supervising_lawyer = self.senior_lawyer
        self.case.save()

        self.client.force_authenticate(user=self.senior_lawyer)

        # 1. Access Case Detail
        detail_url = reverse("case-detail", kwargs={"pk": self.case.case_reference})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 2. Access/Create Tasks
        task_url = reverse("case-tasks", kwargs={"case_id": self.case.id})
        task_payload = {
            "title": "Supervisory strategy review",
            "assigned_to_id": self.junior_lawyer.id,
            "due_date": "2026-09-01",
        }
        response = self.client.post(task_url, task_payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

