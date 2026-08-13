from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.consultations.models import Consultation, ConsultationStatus, PracticeArea
from apps.cases.models import Case, CaseStatus, CaseType
from apps.documents.models import Document, DocumentCategory

User = get_user_model()


class DocumentMilestoneTests(APITestCase):
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
        self.paralegal_a = User.objects.create_user(
            email="paralegala@lexcore.local",
            full_name="Paralegal A",
            password="password123",
            role=UserRole.PARALEGAL,
        )
        self.paralegal_b = User.objects.create_user(
            email="paralegalb@lexcore.local",
            full_name="Paralegal B",
            password="password123",
            role=UserRole.PARALEGAL,
        )
        self.client_a = User.objects.create_user(
            email="clienta@lexcore.local",
            full_name="Client Alpha",
            password="password123",
            role=UserRole.CLIENT,
        )
        self.client_b = User.objects.create_user(
            email="clientb@lexcore.local",
            full_name="Client Beta",
            password="password123",
            role=UserRole.CLIENT,
        )

        # Base parameters
        self.practice_area = PracticeArea.objects.get(name="Family Law")
        self.consultation = Consultation.objects.create(
            client=self.client_a,
            practice_area=self.practice_area,
            assigned_lawyer=self.lawyer_a,
            subject="Family Dispute Matter",
            preferred_date="2026-08-14",
            preferred_time="10:00:00",
            status=ConsultationStatus.ACCEPTED,
        )

        # Case
        self.case_a = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_a,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_a,
            supporting_paralegal=self.paralegal_a,
            title="Active Litigation Case A",
            case_type=CaseType.FAMILY,
            start_date="2026-08-14",
            status=CaseStatus.OPEN,
        )

        # URL targets
        self.list_create_url = reverse("case-documents", kwargs={"case_id": self.case_a.id})

    def _get_dummy_file(self, name, size_bytes, content_type="application/pdf"):
        return SimpleUploadedFile(name, b"0" * size_bytes, content_type=content_type)

    def test_authorized_lawyer_can_upload(self):
        """1. Authorized responsible lawyer can upload a document."""
        self.client.force_authenticate(user=self.lawyer_a)
        dummy_file = self._get_dummy_file("contract.pdf", 1024)
        payload = {
            "title": "Case Contract",
            "category": DocumentCategory.LEGAL_DOCUMENT,
            "file": dummy_file,
            "description": "Executed fee arrangement.",
        }
        response = self.client.post(self.list_create_url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Case Contract")
        self.assertEqual(response.data["uploaded_by"]["id"], self.lawyer_a.id)

    def test_assigned_paralegal_can_upload(self):
        """2. Assigned paralegal can upload a document."""
        self.client.force_authenticate(user=self.paralegal_a)
        dummy_file = self._get_dummy_file("evidence.png", 500, "image/png")
        payload = {
            "title": "Evidence Photo",
            "category": DocumentCategory.EVIDENCE,
            "file": dummy_file,
        }
        response = self.client.post(self.list_create_url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_client_can_upload_to_own_case(self):
        """3. Client can upload a document to their own Case."""
        self.client.force_authenticate(user=self.client_a)
        dummy_file = self._get_dummy_file("client_id.jpg", 300, "image/jpeg")
        payload = {
            "title": "Client ID Copy",
            "category": DocumentCategory.CLIENT_DOCUMENT,
            "file": dummy_file,
        }
        response = self.client.post(self.list_create_url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_can_upload(self):
        """4. Admin can upload to any Case."""
        self.client.force_authenticate(user=self.admin)
        dummy_file = self._get_dummy_file("court_doc.docx", 2048, "application/msword")
        payload = {
            "title": "Filing Docket",
            "category": DocumentCategory.COURT_DOCUMENT,
            "file": dummy_file,
        }
        response = self.client.post(self.list_create_url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_unauthorized_lawyer_cannot_upload(self):
        """5. Lawyer not responsible for the case is blocked from uploading."""
        self.client.force_authenticate(user=self.lawyer_b)
        dummy_file = self._get_dummy_file("leak.pdf", 100)
        payload = {
            "title": "Stray File",
            "category": DocumentCategory.OTHER,
            "file": dummy_file,
        }
        response = self.client.post(self.list_create_url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unassigned_paralegal_cannot_upload(self):
        """6. Paralegal not supporting the case is blocked from uploading."""
        self.client.force_authenticate(user=self.paralegal_b)
        dummy_file = self._get_dummy_file("leak.pdf", 100)
        payload = {
            "title": "Stray File",
            "category": DocumentCategory.OTHER,
            "file": dummy_file,
        }
        response = self.client.post(self.list_create_url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_cannot_upload_to_another_case(self):
        """7. Client cannot upload a document to another client's Case."""
        self.client.force_authenticate(user=self.client_b)
        dummy_file = self._get_dummy_file("exploit.pdf", 100)
        payload = {
            "title": "Injected Document",
            "category": DocumentCategory.OTHER,
            "file": dummy_file,
        }
        response = self.client.post(self.list_create_url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_authorized_users_can_list(self):
        """8. Authorized case participants can list documents."""
        # Create a document first
        Document.objects.create(
            case=self.case_a,
            uploaded_by=self.lawyer_a,
            title="Listing Doc",
            file=self._get_dummy_file("list.pdf", 100),
            category=DocumentCategory.OTHER,
        )

        for user in [self.admin, self.lawyer_a, self.paralegal_a, self.client_a]:
            self.client.force_authenticate(user=user)
            response = self.client.get(self.list_create_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(len(response.data), 1)
            self.assertEqual(response.data[0]["title"], "Listing Doc")

    def test_unauthorized_users_cannot_list(self):
        """9. Non-participants are blocked from listing case documents."""
        for user in [self.lawyer_b, self.paralegal_b, self.client_b]:
            self.client.force_authenticate(user=user)
            response = self.client.get(self.list_create_url)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_download_authorization_boundaries(self):
        """10. Access checks are verified on view/download details."""
        doc = Document.objects.create(
            case=self.case_a,
            uploaded_by=self.lawyer_a,
            title="Download Doc",
            file=self._get_dummy_file("secret.pdf", 50),
            category=DocumentCategory.OTHER,
        )
        detail_url = reverse("document-detail", kwargs={"pk": doc.id})

        # Non-participants are blocked from download
        for user in [self.lawyer_b, self.paralegal_b, self.client_b]:
            self.client.force_authenticate(user=user)
            response = self.client.get(detail_url)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Participants can download
        for user in [self.admin, self.lawyer_a, self.paralegal_a, self.client_a]:
            self.client.force_authenticate(user=user)
            response = self.client.get(detail_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unsupported_file_types_rejected(self):
        """11. Files with invalid extensions are rejected by serializers."""
        self.client.force_authenticate(user=self.lawyer_a)
        invalid_file = self._get_dummy_file("exploit.exe", 100, "application/octet-stream")
        payload = {
            "title": "Malware Doc",
            "category": DocumentCategory.OTHER,
            "file": invalid_file,
        }
        response = self.client.post(self.list_create_url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_oversized_files_rejected(self):
        """12. Files larger than 10MB are rejected."""
        self.client.force_authenticate(user=self.lawyer_a)
        # 10 MB + 1 byte
        oversized = self._get_dummy_file("huge.pdf", 10 * 1024 * 1024 + 1)
        payload = {
            "title": "Huge Document",
            "category": DocumentCategory.OTHER,
            "file": oversized,
        }
        response = self.client.post(self.list_create_url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_unauthorized_users_cannot_delete(self):
        """13. Non-participants cannot delete. Client cannot delete firm documents."""
        # Document uploaded by lawyer_a
        doc_firm = Document.objects.create(
            case=self.case_a,
            uploaded_by=self.lawyer_a,
            title="Firm Brief",
            file=self._get_dummy_file("brief.pdf", 50),
            category=DocumentCategory.LEGAL_DOCUMENT,
        )
        detail_url = reverse("document-detail", kwargs={"pk": doc_firm.id})

        # Client A is a participant but cannot delete firm documents
        self.client.force_authenticate(user=self.client_a)
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Unassigned staff/clients are blocked
        for user in [self.lawyer_b, self.paralegal_b, self.client_b]:
            self.client.force_authenticate(user=user)
            response = self.client.delete(detail_url)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_authorized_users_can_delete(self):
        """14. Staff can delete any. Client can delete only their own uploaded doc."""
        # 1. Client deletes their own document
        doc_client = Document.objects.create(
            case=self.case_a,
            uploaded_by=self.client_a,
            title="Client Photo",
            file=self._get_dummy_file("photo.jpg", 100, "image/jpeg"),
            category=DocumentCategory.CLIENT_DOCUMENT,
        )
        client_doc_url = reverse("document-detail", kwargs={"pk": doc_client.id})

        self.client.force_authenticate(user=self.client_a)
        response = self.client.delete(client_doc_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # 2. Staff deletes a document
        doc_legal = Document.objects.create(
            case=self.case_a,
            uploaded_by=self.lawyer_a,
            title="Pleadings Copy",
            file=self._get_dummy_file("pleadings.pdf", 500),
            category=DocumentCategory.LEGAL_DOCUMENT,
        )
        staff_doc_url = reverse("document-detail", kwargs={"pk": doc_legal.id})

        self.client.force_authenticate(user=self.paralegal_a)
        response = self.client.delete(staff_doc_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_uploaded_by_is_derived_from_user(self):
        """15. uploaded_by is always derived from authenticated caller."""
        self.client.force_authenticate(user=self.lawyer_a)
        dummy_file = self._get_dummy_file("contract.pdf", 100)
        # Attempt to spoof uploaded_by as self.client_b
        payload = {
            "title": "Spoofed Doc",
            "category": DocumentCategory.OTHER,
            "file": dummy_file,
            "uploaded_by": self.client_b.id,
        }
        response = self.client.post(self.list_create_url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["uploaded_by"]["id"], self.lawyer_a.id)
