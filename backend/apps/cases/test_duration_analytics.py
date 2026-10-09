from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.consultations.models import Consultation, ConsultationStatus, PracticeArea
from apps.cases.models import (
    Case,
    CaseStatus,
    CaseType,
    MatterCategory,
    MatterStage,
    HearingRecord,
    CaseActivity,
)
from apps.cases.services import CaseDurationService, format_duration_days

User = get_user_model()


class CaseDurationAnalyticsTests(APITestCase):
    def setUp(self):
        self.today = timezone.localdate()

        # Users
        self.admin = User.objects.create_user(
            email="admin_dur@lexcore.local",
            full_name="Managing Partner Admin",
            password="password123",
            role=UserRole.ADMIN,
        )
        self.responsible_lawyer = User.objects.create_user(
            email="resp_dur@lexcore.local",
            full_name="Advocate Arjun Nair",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.supervising_lawyer = User.objects.create_user(
            email="super_dur@lexcore.local",
            full_name="Senior Counsel Mehra",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.paralegal = User.objects.create_user(
            email="paralegal_dur@lexcore.local",
            full_name="Paralegal Sharma",
            password="password123",
            role=UserRole.PARALEGAL,
        )
        self.client_user = User.objects.create_user(
            email="client_dur@lexcore.local",
            full_name="Client Rajesh Gupta",
            password="password123",
            role=UserRole.CLIENT,
        )
        self.unrelated_lawyer = User.objects.create_user(
            email="other_lawyer_dur@lexcore.local",
            full_name="Other Unassigned Lawyer",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.unrelated_client = User.objects.create_user(
            email="other_client_dur@lexcore.local",
            full_name="Other Unrelated Client",
            password="password123",
            role=UserRole.CLIENT,
        )

        self.practice_area, _ = PracticeArea.objects.get_or_create(
            name="Civil & Commercial Litigation",
            defaults={"description": "Commercial matters"}
        )

        self.consultation = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.responsible_lawyer,
            consultation_mode="OFFICE",
            preferred_date=self.today - timedelta(days=90),
            preferred_time="10:00:00",
            subject="Commercial Dispute",
            status=ConsultationStatus.ACCEPTED,
        )

        # Standard Active Case started 60 days ago
        self.active_case = Case.objects.create(
            originating_consultation=self.consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            supervising_lawyer=self.supervising_lawyer,
            supporting_paralegal=self.paralegal,
            title="Active Commercial Lawsuit",
            case_type=CaseType.CIVIL,
            matter_category=MatterCategory.COURT_LITIGATION,
            matter_stage=MatterStage.COURT_PROCEEDINGS,
            court="Delhi High Court",
            filing_number="DEL-HC/2026/001",
            registration_number="REG/HC/101",
            cnr_number="DEDC010012026",
            start_date=self.today - timedelta(days=60),
            status=CaseStatus.IN_PROGRESS,
        )

    def test_active_case_duration_calculation(self):
        """Active case calculations correctly compute elapsed days and stage data."""
        data = CaseDurationService.calculate_duration_metrics(self.active_case, self.responsible_lawyer)

        self.assertEqual(data["case_reference"], self.active_case.case_reference)
        self.assertFalse(data["is_closed"])
        self.assertEqual(data["start_date"], str(self.today - timedelta(days=60)))
        self.assertEqual(data["current_date"], str(self.today))
        self.assertEqual(data["elapsed_days"], 60)
        self.assertIn("60 days", data["elapsed_humanized"])
        self.assertIsNone(data["closure_date"])
        self.assertIsNone(data["total_closed_duration_days"])
        self.assertEqual(data["current_stage"], MatterStage.COURT_PROCEEDINGS)

    def _create_consultation(self, subject="Commercial Dispute"):
        return Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.responsible_lawyer,
            consultation_mode="OFFICE",
            preferred_date=self.today - timedelta(days=90),
            preferred_time="10:00:00",
            subject=subject,
            status=ConsultationStatus.ACCEPTED,
        )

    def test_closed_case_duration_calculation(self):
        """Closed case duration calculates factual days from start_date to closure_date."""
        closed_consultation = self._create_consultation("Closed Case Consultation")
        closed_case = Case.objects.create(
            originating_consultation=closed_consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            title="Concluded Commercial Matter",
            case_type=CaseType.CIVIL,
            matter_category=MatterCategory.COURT_LITIGATION,
            matter_stage=MatterStage.CLOSED,
            status=CaseStatus.CLOSED,
            start_date=self.today - timedelta(days=120),
        )

        closure_date = self.today - timedelta(days=20)
        # Create a STATUS_CHANGED activity simulating closure 20 days ago (100 days duration)
        act = CaseActivity.objects.create(
            case=closed_case,
            activity_type="STATUS_CHANGED",
            description="Case status updated from In Progress to Closed.",
            user=self.responsible_lawyer,
        )
        # Set created_at to closure date
        CaseActivity.objects.filter(pk=act.pk).update(
            created_at=timezone.now() - timedelta(days=20)
        )

        data = CaseDurationService.calculate_duration_metrics(closed_case, self.responsible_lawyer)

        self.assertTrue(data["is_closed"])
        self.assertEqual(data["start_date"], str(self.today - timedelta(days=120)))
        self.assertEqual(data["closure_date"], str(closure_date))
        self.assertEqual(data["total_closed_duration_days"], 100)
        self.assertEqual(data["elapsed_days"], 100)
        self.assertIn("100 days", data["total_closed_duration_humanized"])

    def test_missing_dates_handling(self):
        """Missing or null start_date is handled gracefully without crashing."""
        missing_consultation = self._create_consultation("Missing Date Consultation")
        case_missing = Case.objects.create(
            originating_consultation=missing_consultation,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            title="Case With Missing Date",
            case_type=CaseType.CIVIL,
            start_date=self.today,
        )
        # Artificially clear start_date and created_at on instance
        case_missing.start_date = None
        case_missing.created_at = None

        data = CaseDurationService.calculate_duration_metrics(case_missing, self.responsible_lawyer)
        self.assertIsNone(data["start_date"])
        self.assertIsNone(data["elapsed_days"])
        self.assertEqual(data["elapsed_humanized"], "Not available")

    def test_case_with_no_hearings(self):
        """A case with zero hearings returns clean empty hearing metrics."""
        data = CaseDurationService.calculate_duration_metrics(self.active_case, self.responsible_lawyer)

        self.assertEqual(data["total_hearings"], 0)
        self.assertEqual(data["completed_hearings_count"], 0)
        self.assertEqual(data["upcoming_hearings_count"], 0)
        self.assertFalse(data["has_hearings"])
        self.assertIsNone(data["most_recent_hearing"])
        self.assertIsNone(data["next_scheduled_hearing"])

    def test_case_with_past_and_upcoming_hearings(self):
        """Hearings correctly identify most recent past hearing and next scheduled upcoming hearing."""
        past_date_1 = self.today - timedelta(days=40)
        past_date_2 = self.today - timedelta(days=15)
        future_date = self.today + timedelta(days=10)

        # Hearing 1 (Past)
        HearingRecord.objects.create(
            case=self.active_case,
            hearing_date=past_date_1,
            court="Delhi High Court - Bench 1",
            hearing_type="Notice of Motion",
            outcome="Notice Issued",
            orders_or_directions="Reply within 14 days",
            internal_notes="Internal strategy discussion notes.",
        )
        # Hearing 2 (Most recent past)
        HearingRecord.objects.create(
            case=self.active_case,
            hearing_date=past_date_2,
            court="Delhi High Court - Bench 2",
            hearing_type="Interim Arguments",
            outcome="Arguments Heard in Part",
            orders_or_directions="Defendant counsel requested short adjournment",
            internal_notes="Senior Counsel requested next date.",
        )
        # Hearing 3 (Upcoming scheduled)
        HearingRecord.objects.create(
            case=self.active_case,
            hearing_date=future_date,
            court="Delhi High Court - Bench 2",
            hearing_type="Final Arguments",
            outcome="",
            orders_or_directions="",
        )

        data = CaseDurationService.calculate_duration_metrics(self.active_case, self.responsible_lawyer)

        self.assertEqual(data["total_hearings"], 3)
        self.assertEqual(data["completed_hearings_count"], 2)
        self.assertEqual(data["upcoming_hearings_count"], 1)
        self.assertTrue(data["has_hearings"])

        # Most recent hearing
        recent = data["most_recent_hearing"]
        self.assertIsNotNone(recent)
        self.assertEqual(recent["date"], str(past_date_2))
        self.assertEqual(recent["days_ago"], 15)
        self.assertEqual(recent["hearing_type"], "Interim Arguments")
        self.assertEqual(recent["outcome"], "Arguments Heard in Part")
        # Internal notes must not be present
        self.assertNotIn("internal_notes", recent)

        # Next scheduled hearing
        upcoming = data["next_scheduled_hearing"]
        self.assertIsNotNone(upcoming)
        self.assertEqual(upcoming["date"], str(future_date))
        self.assertEqual(upcoming["days_until"], 10)

        # Average days between past hearings (span = 40 - 15 = 25 days)
        staff_metrics = data["staff_metrics"]
        self.assertIsNotNone(staff_metrics)
        self.assertEqual(staff_metrics["average_days_between_hearings"], 25.0)
        self.assertEqual(staff_metrics["hearing_frequency_description"], "~25 days between hearings")

    def test_stages_breakdown_calculation(self):
        """Stage duration is properly tracked through CaseActivity history."""
        # Start date: 60 days ago
        # Transition to Court Proceedings 20 days ago (40 days in Under Review)
        act = CaseActivity.objects.create(
            case=self.active_case,
            activity_type="STAGE_CHANGED",
            description="Matter stage transitioned from Under Review to Court Proceedings.",
            user=self.responsible_lawyer,
        )
        CaseActivity.objects.filter(pk=act.pk).update(
            created_at=timezone.now() - timedelta(days=20)
        )

        data = CaseDurationService.calculate_duration_metrics(self.active_case, self.responsible_lawyer)
        breakdown = data["stages_breakdown"]

        self.assertEqual(len(breakdown), 2)
        # Stage 1: Under Review (40 days)
        self.assertEqual(breakdown[0]["stage"], MatterStage.UNDER_REVIEW)
        self.assertEqual(breakdown[0]["duration_days"], 40)
        self.assertFalse(breakdown[0]["is_current"])

        # Stage 2: Court Proceedings (20 days)
        self.assertEqual(breakdown[1]["stage"], MatterStage.COURT_PROCEEDINGS)
        self.assertEqual(breakdown[1]["duration_days"], 20)
        self.assertTrue(breakdown[1]["is_current"])

        self.assertEqual(data["time_in_current_stage_days"], 20)

    def test_authorization_participant_and_stranger(self):
        """Case duration endpoint enforces participant-based authorization."""
        url = reverse("case-duration", kwargs={"case_id": self.active_case.case_reference})

        # 1. Admin -> 200 OK
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.get(url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)

        # 2. Responsible Lawyer -> 200 OK
        self.client.force_authenticate(user=self.responsible_lawyer)
        res_lawyer = self.client.get(url)
        self.assertEqual(res_lawyer.status_code, status.HTTP_200_OK)

        # 3. Supporting Paralegal -> 200 OK
        self.client.force_authenticate(user=self.paralegal)
        res_para = self.client.get(url)
        self.assertEqual(res_para.status_code, status.HTTP_200_OK)

        # 4. Client -> 200 OK
        self.client.force_authenticate(user=self.client_user)
        res_client = self.client.get(url)
        self.assertEqual(res_client.status_code, status.HTTP_200_OK)

        # 5. Unrelated Lawyer -> 403 Forbidden
        self.client.force_authenticate(user=self.unrelated_lawyer)
        res_unrelated_lawyer = self.client.get(url)
        self.assertEqual(res_unrelated_lawyer.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Unrelated Client -> 403 Forbidden
        self.client.force_authenticate(user=self.unrelated_client)
        res_unrelated_client = self.client.get(url)
        self.assertEqual(res_unrelated_client.status_code, status.HTTP_403_FORBIDDEN)

        # 7. Unauthenticated -> 401 Unauthorized
        self.client.force_authenticate(user=None)
        res_unauth = self.client.get(url)
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_client_visibility_sanitization(self):
        """Clients see progress metrics without staff_metrics or internal notes."""
        url = reverse("case-duration", kwargs={"case_id": self.active_case.case_reference})

        # Hearing with confidential notes
        HearingRecord.objects.create(
            case=self.active_case,
            hearing_date=self.today - timedelta(days=5),
            court="Delhi High Court",
            hearing_type="Framing of Issues",
            outcome="Issues Framed",
            internal_notes="CONFIDENTIAL: Client might accept settlement under 50L.",
        )

        # Client request
        self.client.force_authenticate(user=self.client_user)
        res_client = self.client.get(url)
        self.assertEqual(res_client.status_code, status.HTTP_200_OK)
        data_client = res_client.data

        self.assertTrue(data_client["is_client_view"])
        self.assertIsNone(data_client["staff_metrics"])
        self.assertNotIn("internal_notes", str(data_client))

        # Lawyer request
        self.client.force_authenticate(user=self.responsible_lawyer)
        res_lawyer = self.client.get(url)
        self.assertEqual(res_lawyer.status_code, status.HTTP_200_OK)
        data_lawyer = res_lawyer.data

        self.assertFalse(data_lawyer["is_client_view"])
        self.assertIsNotNone(data_lawyer["staff_metrics"])
        self.assertEqual(data_lawyer["staff_metrics"]["responsible_lawyer_name"], self.responsible_lawyer.full_name)

    def test_case_detail_includes_duration_analytics(self):
        """CaseDetail endpoint returns duration_analytics directly on case payload."""
        url = reverse("case-detail", kwargs={"pk": self.active_case.id})
        self.client.force_authenticate(user=self.responsible_lawyer)

        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("duration_analytics", res.data)
        self.assertEqual(res.data["duration_analytics"]["elapsed_days"], 60)

    def test_format_duration_days_helper(self):
        """Duration string formatter behaves deterministically across ranges."""
        self.assertEqual(format_duration_days(None), "Not available")
        self.assertEqual(format_duration_days(-5), "0 days")
        self.assertEqual(format_duration_days(0), "0 days (Started today)")
        self.assertEqual(format_duration_days(1), "1 day")
        self.assertEqual(format_duration_days(15), "15 days")
        self.assertEqual(format_duration_days(45), "1 mo, 15 days (45 days)")
        self.assertEqual(format_duration_days(365), "1 yr (365 days)")
        self.assertEqual(format_duration_days(400), "1 yr, 1 mo (400 days)")
