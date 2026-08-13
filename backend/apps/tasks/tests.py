from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.consultations.models import Consultation, ConsultationStatus, PracticeArea
from apps.cases.models import Case, CaseStatus, CaseType
from apps.documents.models import Document
from apps.tasks.models import CaseTask, TaskStatus

User = get_user_model()


class TaskModuleTests(APITestCase):
    def setUp(self):
        # Create users
        self.admin = User.objects.create_user(
            email="admin@lexcore.local",
            full_name="Firm Admin",
            password="password123",
            role=UserRole.ADMIN,
        )
        self.responsible_lawyer = User.objects.create_user(
            email="leadlawyer@lexcore.local",
            full_name="Vikram Malhotra",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.assistant_lawyer = User.objects.create_user(
            email="assistantlawyer@lexcore.local",
            full_name="Rahul Sharma",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.other_lawyer = User.objects.create_user(
            email="otherlawyer@lexcore.local",
            full_name="Other Lawyer",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.paralegal = User.objects.create_user(
            email="paralegal@lexcore.local",
            full_name="Sneha Kulkarni",
            password="password123",
            role=UserRole.PARALEGAL,
        )
        self.unrelated_employee = User.objects.create_user(
            email="unrelated@lexcore.local",
            full_name="Unrelated Employee",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.client_user = User.objects.create_user(
            email="client@lexcore.local",
            full_name="John Doe Client",
            password="password123",
            role=UserRole.CLIENT,
        )

        # Practice Area
        self.practice_area = PracticeArea.objects.get(name="Family Law")

        # Consultation
        self.consultation = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.responsible_lawyer,
            subject="Property Dispute",
            preferred_date="2026-08-20",
            preferred_time="10:00:00",
            status=ConsultationStatus.ACCEPTED,
        )

        # Case
        self.case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            supporting_paralegal=self.paralegal,
            title="Property Dispute Matter",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
        )
        self.case.assistant_lawyers.add(self.assistant_lawyer)

    def test_01_responsible_lawyer_can_create_task(self):
        """1. Responsible Lawyer can create a task."""
        self.client.force_authenticate(user=self.responsible_lawyer)
        url = reverse("case-tasks", kwargs={"case_id": self.case.id})
        payload = {
            "title": "Review Previous Agreement",
            "description": "Examine clause 4.",
            "assigned_to_id": self.assistant_lawyer.id,
            "due_date": "2026-08-20",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Review Previous Agreement")
        self.assertEqual(response.data["assigned_to"]["id"], self.assistant_lawyer.id)
        self.assertTrue(response.data["task_id"].startswith("TASK-"))

    def test_02_admin_can_create_task(self):
        """2. Admin can create a task."""
        self.client.force_authenticate(user=self.admin)
        url = reverse("case-tasks", kwargs={"case_id": self.case.id})
        payload = {
            "title": "Collect Property Deed",
            "description": "Gather deeds.",
            "assigned_to_id": self.paralegal.id,
            "due_date": "2026-08-15",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["assigned_to"]["id"], self.paralegal.id)

    def test_03_task_assigned_to_valid_case_team_member(self):
        """3. Task can be assigned to valid case-team members (Lead, Assistant, Paralegal)."""
        self.client.force_authenticate(user=self.responsible_lawyer)
        url = reverse("case-tasks", kwargs={"case_id": self.case.id})
        
        for team_member in [self.responsible_lawyer, self.assistant_lawyer, self.paralegal]:
            payload = {
                "title": f"Task for {team_member.full_name}",
                "assigned_to_id": team_member.id,
                "due_date": "2026-08-25",
            }
            response = self.client.post(url, payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_04_unrelated_employee_cannot_be_assigned(self):
        """4. Unrelated employee outside the case team cannot be assigned."""
        self.client.force_authenticate(user=self.responsible_lawyer)
        url = reverse("case-tasks", kwargs={"case_id": self.case.id})
        payload = {
            "title": "Invalid Task Assignment",
            "assigned_to_id": self.unrelated_employee.id,
            "due_date": "2026-08-20",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assigned_to_id", response.data)

    def test_05_assistant_lawyer_can_view_assigned_task(self):
        """5. Assistant Lawyer can view their assigned task."""
        task = CaseTask.objects.create(
            case=self.case,
            title="Assistant Task",
            assigned_to=self.assistant_lawyer,
            created_by=self.responsible_lawyer,
            due_date="2026-08-18",
        )
        self.client.force_authenticate(user=self.assistant_lawyer)
        url = reverse("task-detail", kwargs={"pk": task.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Assistant Task")

    def test_06_paralegal_can_view_assigned_task(self):
        """6. Paralegal can view their assigned task."""
        task = CaseTask.objects.create(
            case=self.case,
            title="Paralegal Document Search",
            assigned_to=self.paralegal,
            created_by=self.responsible_lawyer,
            due_date="2026-08-16",
        )
        self.client.force_authenticate(user=self.paralegal)
        url = reverse("task-detail", kwargs={"pk": task.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Paralegal Document Search")

    def test_07_client_cannot_access_task_apis(self):
        """7. Client cannot access task APIs (403 Forbidden)."""
        self.client.force_authenticate(user=self.client_user)
        list_url = reverse("case-tasks", kwargs={"case_id": self.case.id})
        response = self.client.get(list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        task = CaseTask.objects.create(
            case=self.case,
            title="Internal Legal Task",
            assigned_to=self.responsible_lawyer,
            created_by=self.responsible_lawyer,
            due_date="2026-08-18",
        )
        detail_url = reverse("task-detail", kwargs={"pk": task.id})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_08_unauthorized_lawyer_cannot_access_other_case_tasks(self):
        """8. Unauthorized lawyer cannot access another lawyer's case tasks."""
        task = CaseTask.objects.create(
            case=self.case,
            title="Private Case Task",
            assigned_to=self.responsible_lawyer,
            created_by=self.responsible_lawyer,
            due_date="2026-08-18",
        )
        self.client.force_authenticate(user=self.other_lawyer)
        url = reverse("task-detail", kwargs={"pk": task.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_09_assigned_member_can_update_task_status(self):
        """9. Assigned member can update their task status."""
        task = CaseTask.objects.create(
            case=self.case,
            title="Draft Research Notes",
            assigned_to=self.assistant_lawyer,
            created_by=self.responsible_lawyer,
            due_date="2026-08-18",
            status=TaskStatus.PENDING,
        )
        self.client.force_authenticate(user=self.assistant_lawyer)
        url = reverse("task-detail", kwargs={"pk": task.id})
        payload = {"status": TaskStatus.IN_PROGRESS}
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], TaskStatus.IN_PROGRESS)

    def test_10_unauthorized_member_cannot_update_non_status_task_fields(self):
        """10. Assistant/paralegal cannot modify metadata or reassign another's task."""
        task = CaseTask.objects.create(
            case=self.case,
            title="Research Case Law",
            assigned_to=self.responsible_lawyer,
            created_by=self.responsible_lawyer,
            due_date="2026-08-18",
        )
        self.client.force_authenticate(user=self.assistant_lawyer)
        url = reverse("task-detail", kwargs={"pk": task.id})
        # Assistant tries to edit title
        payload = {"title": "Hacked Title"}
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_11_task_document_upload_works(self):
        """11. Task document upload works."""
        task = CaseTask.objects.create(
            case=self.case,
            title="Collect Deed File",
            assigned_to=self.paralegal,
            created_by=self.responsible_lawyer,
            due_date="2026-08-15",
        )
        self.client.force_authenticate(user=self.paralegal)
        url = reverse("task-documents", kwargs={"pk": task.id})
        
        sample_file = SimpleUploadedFile("deed.pdf", b"Deed document content", content_type="application/pdf")
        payload = {
            "title": "Property Deed Document",
            "file": sample_file,
            "category": "LEGAL_DOCUMENT",
        }
        response = self.client.post(url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Property Deed Document")
        self.assertEqual(response.data["task"]["id"], task.id)

    def test_12_task_document_appears_in_task_documents(self):
        """12. Uploaded document appears in task documents endpoint."""
        task = CaseTask.objects.create(
            case=self.case,
            title="Evidence Task",
            assigned_to=self.assistant_lawyer,
            created_by=self.responsible_lawyer,
            due_date="2026-08-15",
        )
        sample_file = SimpleUploadedFile("evidence.pdf", b"Evidence content", content_type="application/pdf")
        doc = Document.objects.create(
            case=self.case,
            task=task,
            uploaded_by=self.assistant_lawyer,
            title="Case Photo Evidence",
            file=sample_file,
        )

        self.client.force_authenticate(user=self.assistant_lawyer)
        url = reverse("task-documents", kwargs={"pk": task.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], doc.id)

    def test_13_task_document_appears_in_common_case_repository(self):
        """13. The same task document appears automatically in common case documents repo."""
        task = CaseTask.objects.create(
            case=self.case,
            title="Agreement Task",
            assigned_to=self.responsible_lawyer,
            created_by=self.responsible_lawyer,
            due_date="2026-08-15",
        )
        sample_file = SimpleUploadedFile("agreement.pdf", b"Agreement content", content_type="application/pdf")
        doc = Document.objects.create(
            case=self.case,
            task=task,
            uploaded_by=self.responsible_lawyer,
            title="Prior Agreement",
            file=sample_file,
        )

        self.client.force_authenticate(user=self.responsible_lawyer)
        url = reverse("case-documents", kwargs={"case_id": self.case.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        doc_ids = [d["id"] for d in response.data]
        self.assertIn(doc.id, doc_ids)
        
        # Verify task attribution details exist in representation
        target_doc_data = next(d for d in response.data if d["id"] == doc.id)
        self.assertIsNotNone(target_doc_data["task"])
        self.assertEqual(target_doc_data["task"]["title"], "Agreement Task")

    def test_14_document_is_not_physically_duplicated(self):
        """14. Document is not physically duplicated in database."""
        task = CaseTask.objects.create(
            case=self.case,
            title="Single Storage Check",
            assigned_to=self.paralegal,
            created_by=self.responsible_lawyer,
            due_date="2026-08-15",
        )
        self.client.force_authenticate(user=self.paralegal)
        url = reverse("task-documents", kwargs={"pk": task.id})
        sample_file = SimpleUploadedFile("single_copy.pdf", b"Single copy content", content_type="application/pdf")
        payload = {
            "title": "Single Storage Test",
            "file": sample_file,
        }
        response = self.client.post(url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Assert only 1 document object exists in DB
        doc_count = Document.objects.filter(case=self.case).count()
        self.assertEqual(doc_count, 1)

    def test_15_task_document_cannot_be_associated_with_another_case(self):
        """15. A task document cannot be associated with another case."""
        other_consultation = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.other_lawyer,
            subject="Other Case Consultation",
            preferred_date="2026-08-22",
            preferred_time="11:00:00",
            status=ConsultationStatus.ACCEPTED,
        )
        other_case = Case.objects.create(
            originating_consultation=other_consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.other_lawyer,
            title="Other Lawyer Case",
            case_type=CaseType.CIVIL,
            start_date="2026-08-12",
        )

        task = CaseTask.objects.create(
            case=self.case,
            title="Case 1 Task",
            assigned_to=self.responsible_lawyer,
            created_by=self.responsible_lawyer,
            due_date="2026-08-15",
        )

        # Unauthorized lawyer for case 1 tries to upload doc to case 1's task
        self.client.force_authenticate(user=self.other_lawyer)
        url = reverse("task-documents", kwargs={"pk": task.id})
        sample_file = SimpleUploadedFile("cross.pdf", b"Cross upload content", content_type="application/pdf")
        payload = {"title": "Cross Upload", "file": sample_file}
        response = self.client.post(url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_16_case_reassignment_updates_task_access_permissions(self):
        """16. Case reassignment updates task access permissions dynamically."""
        task = CaseTask.objects.create(
            case=self.case,
            title="Reassignment Task Test",
            assigned_to=self.responsible_lawyer,
            created_by=self.responsible_lawyer,
            due_date="2026-08-15",
        )

        # Old lawyer can access task initially
        self.client.force_authenticate(user=self.responsible_lawyer)
        url = reverse("task-detail", kwargs={"pk": task.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Reassign responsible lawyer to other_lawyer (via Admin)
        self.client.force_authenticate(user=self.admin)
        team_url = reverse("case-team-update", kwargs={"pk": self.case.id})
        self.client.patch(team_url, {"responsible_lawyer": self.other_lawyer.id}, format="json")

        # Old responsible lawyer now loses access to the task
        self.client.force_authenticate(user=self.responsible_lawyer)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # New responsible lawyer gains access to the task
        self.client.force_authenticate(user=self.other_lawyer)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
