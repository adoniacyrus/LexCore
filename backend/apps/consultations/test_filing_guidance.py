"""
Tests for Phase 1 Petition Filing Guidance APIs and permissions.
"""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.consultations.models import PetitionGuidance, PracticeArea

User = get_user_model()


class PetitionFilingGuidanceAPITests(APITestCase):
    def setUp(self):
        self.practice_area = PracticeArea.objects.create(
            name="Test Arbitration Law",
            description="Arbitration and alternate dispute resolution.",
            is_active=True,
        )

        self.active_guidance = PetitionGuidance.objects.create(
            title="Arbitration Petitions",
            slug="arbitration-petitions",
            practice_area=self.practice_area,
            overview="Arbitration petitions involve domestic and international commercial arbitrations.",
            common_petition_types=[
                "Section 9 Interim Relief Petition",
                "Section 11 Appointment of Arbitrator",
            ],
            documents_required=[
                "Original agreement with arbitration clause",
                "Notice invoking arbitration and delivery proof",
            ],
            process_overview=[
                {"step": 1, "title": "Invocation Notice", "description": "Issuing formal notice to arbitrate."},
                {"step": 2, "title": "High Court Section 11 Petition", "description": "Filing petition for appointment."},
            ],
            what_to_prepare=[
                "Copy of contract and signed arbitration clause",
                "Chronology of default",
            ],
            disclaimer="Arbitration timelines are governed strictly by the Arbitration Act.",
            is_active=True,
            display_order=10,
        )

        self.inactive_guidance = PetitionGuidance.objects.create(
            title="Draft Insolvency Guidance",
            slug="draft-insolvency-guidance",
            overview="Pending review insolvency guidance.",
            is_active=False,
            display_order=99,
        )

        # Users for role testing
        self.client_user = User.objects.create_user(
            email="client.guidance@example.com",
            password="TestPassword123!",
            role=UserRole.CLIENT,
            full_name="Client Guidance Tester",
        )

        self.lawyer_user = User.objects.create_user(
            email="lawyer.guidance@example.com",
            password="TestPassword123!",
            role=UserRole.SENIOR_LAWYER,
            full_name="Senior Advocate Guidance Tester",
        )

        self.admin_user = User.objects.create_user(
            email="admin.guidance@example.com",
            password="TestPassword123!",
            role=UserRole.ADMIN,
            full_name="Firm Administrator",
        )

    def test_public_unauthenticated_can_list_active_guidance(self):
        """Unauthenticated public visitors can list active filing guidance."""
        url = "/api/consultations/filing-guidance/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        titles = [item["title"] for item in response.data]
        self.assertIn("Arbitration Petitions", titles)
        # Inactive guidance must NOT appear for public visitors
        self.assertNotIn("Draft Insolvency Guidance", titles)

    def test_client_authenticated_can_list_active_guidance(self):
        """Authenticated client portal users can list active filing guidance."""
        self.client.force_authenticate(user=self.client_user)
        url = "/api/consultations/filing-guidance/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        titles = [item["title"] for item in response.data]
        self.assertIn("Arbitration Petitions", titles)
        self.assertNotIn("Draft Insolvency Guidance", titles)

    def test_admin_can_view_all_including_inactive_guidance(self):
        """Admins can list all guidances, including inactive drafts."""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/consultations/filing-guidance/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        titles = [item["title"] for item in response.data]
        self.assertIn("Arbitration Petitions", titles)
        self.assertIn("Draft Insolvency Guidance", titles)

    def test_admin_can_filter_by_is_active_query_param(self):
        """Admin can filter explicitly with ?is_active=false or ?is_active=true."""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/consultations/filing-guidance/?is_active=false"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in response.data]
        self.assertIn("Draft Insolvency Guidance", titles)
        self.assertNotIn("Arbitration Petitions", titles)

    def test_guidance_detail_retrieval_by_id_and_slug(self):
        """Both numeric ID and string slug routes correctly return the detailed guidance."""
        # By ID
        url_id = f"/api/consultations/filing-guidance/{self.active_guidance.id}/"
        res_id = self.client.get(url_id)
        self.assertEqual(res_id.status_code, status.HTTP_200_OK)
        self.assertEqual(res_id.data["title"], "Arbitration Petitions")
        self.assertEqual(res_id.data["practice_area"], self.practice_area.id)
        self.assertEqual(res_id.data["practice_area_detail"]["name"], "Test Arbitration Law")
        self.assertEqual(len(res_id.data["common_petition_types"]), 2)
        self.assertEqual(len(res_id.data["documents_required"]), 2)
        self.assertEqual(len(res_id.data["process_overview"]), 2)
        self.assertEqual(len(res_id.data["what_to_prepare"]), 2)
        self.assertTrue(bool(res_id.data["disclaimer_text"]))

        # By Slug
        url_slug = f"/api/consultations/filing-guidance/{self.active_guidance.slug}/"
        res_slug = self.client.get(url_slug)
        self.assertEqual(res_slug.status_code, status.HTTP_200_OK)
        self.assertEqual(res_slug.data["title"], "Arbitration Petitions")

    def test_inactive_guidance_detail_is_404_for_public_and_client(self):
        """Public visitors and regular clients cannot access inactive guidance detail."""
        url = f"/api/consultations/filing-guidance/{self.inactive_guidance.id}/"
        res_public = self.client.get(url)
        self.assertEqual(res_public.status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(user=self.client_user)
        res_client = self.client.get(url)
        self.assertEqual(res_client.status_code, status.HTTP_404_NOT_FOUND)

        # Admin CAN access inactive guidance detail
        self.client.force_authenticate(user=self.admin_user)
        res_admin = self.client.get(url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(res_admin.data["title"], "Draft Insolvency Guidance")

    def test_unauthorized_modification_protection(self):
        """Unauthenticated, client, and lawyer users cannot POST, PATCH, or DELETE guidance."""
        payload = {
            "title": "Hacked Guidance",
            "overview": "Should not be created.",
        }

        # 1. Unauthenticated
        res = self.client.post("/api/consultations/filing-guidance/", payload)
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        res = self.client.patch(f"/api/consultations/filing-guidance/{self.active_guidance.id}/", {"title": "New Title"})
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        res = self.client.delete(f"/api/consultations/filing-guidance/{self.active_guidance.id}/")
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # 2. Client role
        self.client.force_authenticate(user=self.client_user)
        res = self.client.post("/api/consultations/filing-guidance/", payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.patch(f"/api/consultations/filing-guidance/{self.active_guidance.id}/", {"title": "New Title"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.delete(f"/api/consultations/filing-guidance/{self.active_guidance.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Lawyer role
        self.client.force_authenticate(user=self.lawyer_user)
        res = self.client.post("/api/consultations/filing-guidance/", payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.patch(f"/api/consultations/filing-guidance/{self.active_guidance.id}/", {"title": "New Title"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.delete(f"/api/consultations/filing-guidance/{self.active_guidance.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_update_and_delete_guidance(self):
        """Admin can create new guidance, update fields, toggle active, and delete."""
        self.client.force_authenticate(user=self.admin_user)

        # CREATE
        create_payload = {
            "title": "Maritime & Admiralty Petitions",
            "practice_area": self.practice_area.id,
            "overview": "Arrest of ships and maritime lien enforcement.",
            "common_petition_types": ["Admiralty Suit for Ship Arrest"],
            "documents_required": ["Charterparty agreement", "Bill of lading"],
            "process_overview": [
                {"step": 1, "title": "Caveat & Warrant", "description": "Filing warrant of arrest before High Court."}
            ],
            "what_to_prepare": ["Vessel name and current port call location"],
            "is_active": True,
            "display_order": 12,
        }
        res_create = self.client.post("/api/consultations/filing-guidance/", create_payload, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        new_id = res_create.data["id"]
        self.assertEqual(res_create.data["title"], "Maritime & Admiralty Petitions")
        self.assertEqual(res_create.data["slug"], "maritime-admiralty-petitions")
        self.assertEqual(res_create.data["practice_area"], self.practice_area.id)

        # UPDATE
        res_update = self.client.patch(
            f"/api/consultations/filing-guidance/{new_id}/",
            {"overview": "Updated overview for admiralty jurisdiction.", "is_active": False},
            format="json",
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)
        self.assertEqual(res_update.data["overview"], "Updated overview for admiralty jurisdiction.")
        self.assertFalse(res_update.data["is_active"])

        # DELETE
        res_delete = self.client.delete(f"/api/consultations/filing-guidance/{new_id}/")
        self.assertEqual(res_delete.status_code, status.HTTP_200_OK)
        self.assertFalse(PetitionGuidance.objects.filter(pk=new_id).exists())

    def test_create_validation_checks(self):
        """Rejects empty title, duplicate title, or non-list payloads."""
        self.client.force_authenticate(user=self.admin_user)

        # Empty title
        res = self.client.post("/api/consultations/filing-guidance/", {"title": "", "overview": "Test"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", res.data)

        # Duplicate title
        res_dup = self.client.post(
            "/api/consultations/filing-guidance/",
            {"title": "Arbitration Petitions", "overview": "Duplicate title attempt"},
        )
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", res_dup.data)

        # Non-list checklist
        res_invalid_list = self.client.post(
            "/api/consultations/filing-guidance/",
            {
                "title": "Invalid List Guidance",
                "overview": "Overview",
                "documents_required": "this should be a list, not string",
            },
        )
        self.assertEqual(res_invalid_list.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("documents_required", res_invalid_list.data)
