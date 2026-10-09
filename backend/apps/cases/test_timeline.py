from django.contrib.auth import get_user_model
from django.urls import reverse
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

User = get_user_model()


class CaseTimelineTests(APITestCase):
    def setUp(self):
        # 1. Users
        self.admin = User.objects.create_user(
            email="admin_tl@lexcore.local",
            full_name="Managing Partner Admin",
            password="password123",
            role=UserRole.ADMIN,
        )
        self.responsible_lawyer = User.objects.create_user(
            email="resp_lawyer_tl@lexcore.local",
            full_name="Lead Advocate Rao",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.supervising_lawyer = User.objects.create_user(
            email="super_lawyer_tl@lexcore.local",
            full_name="Senior Counsel Verma",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.assistant_lawyer = User.objects.create_user(
            email="assist_lawyer_tl@lexcore.local",
            full_name="Junior Associate Sharma",
            password="password123",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.paralegal = User.objects.create_user(
            email="paralegal_tl@lexcore.local",
            full_name="Litigation Paralegal Gupta",
            password="password123",
            role=UserRole.PARALEGAL,
        )
        self.client_user = User.objects.create_user(
            email="client_tl@lexcore.local",
            full_name="Client Priya Patel",
            password="password123",
            role=UserRole.CLIENT,
        )
        self.unrelated_lawyer = User.objects.create_user(
            email="unrelated_lawyer_tl@lexcore.local",
            full_name="Other Unassigned Lawyer",
            password="password123",
            role=UserRole.SENIOR_LAWYER,
        )
        self.unrelated_client = User.objects.create_user(
            email="unrelated_client_tl@lexcore.local",
            full_name="Unrelated Client",
            password="password123",
            role=UserRole.CLIENT,
        )

        self.practice_area, _ = PracticeArea.objects.get_or_create(
            name="Commercial Litigation",
            defaults={"description": "Commercial dispute resolution"}
        )

        # 2. Case 1: Comprehensive case with consultation, filing numbers, stage activities, and hearings
        self.consultation1 = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            assigned_lawyer=self.responsible_lawyer,
            consultation_mode="OFFICE",
            preferred_date="2026-06-01",
            preferred_time="10:00:00",
            subject="Commercial Injunction Dispute",
            status=ConsultationStatus.ACCEPTED,
        )
        self.case1 = Case.objects.create(
            originating_consultation=self.consultation1,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            supervising_lawyer=self.supervising_lawyer,
            supporting_paralegal=self.paralegal,
            title="Apex Infra vs Metro Corp",
            case_type=CaseType.CIVIL,
            matter_category=MatterCategory.COURT_LITIGATION,
            matter_stage=MatterStage.COURT_PROCEEDINGS,
            court="Delhi High Court",
            filing_number="DEL-HC/2026/00481",
            registration_number="REG/HC/7891",
            cnr_number="DEDC01004812026",
            start_date="2026-06-15",
        )
        self.case1.assistant_lawyers.add(self.assistant_lawyer)

        # Activities on Case 1
        CaseActivity.objects.create(
            case=self.case1,
            activity_type="STAGE_CHANGED",
            description="Matter stage transitioned from Under Review to Court Proceedings.",
            user=self.responsible_lawyer,
        )
        CaseActivity.objects.create(
            case=self.case1,
            activity_type="SUPERVISING_COUNSEL_ASSIGNED",
            description=f"Supervising Counsel Assigned: {self.supervising_lawyer.full_name}",
            user=self.admin,
        )

        # Hearings on Case 1
        self.hearing1 = HearingRecord.objects.create(
            case=self.case1,
            hearing_date="2026-07-10",
            court="Delhi High Court - Bench 2",
            hearing_type="Notice of Motion",
            proceedings="Counsel for plaintiff appeared and moved ad-interim injunction prayer.",
            outcome="Notice Issued",
            orders_or_directions="Reply to be filed by defendant within 10 days.",
            next_hearing_date="2026-08-15",
            internal_notes="Judge was favorable to interim relief. Ensure service of notice is expedited.",
            created_by=self.responsible_lawyer,
        )
        self.hearing2 = HearingRecord.objects.create(
            case=self.case1,
            hearing_date="2026-08-15",
            court="Delhi High Court - Bench 2",
            hearing_type="Interim Injunction Arguments",
            proceedings="Defendant filed reply. Rejoinder submitted on record. Extensive arguments heard.",
            outcome="Interim Injunction Granted",
            orders_or_directions="Status quo granted. Next date fixed for framing of issues.",
            next_hearing_date="2026-11-20",
            internal_notes="Major victory on interim stay. Draft proposed issues before next listing.",
            created_by=self.supervising_lawyer,
        )

        # 3. Case 2: Fresh Case with NO hearings and NO filing numbers
        self.consultation2 = Consultation.objects.create(
            client=self.unrelated_client,
            practice_area=self.practice_area,
            assigned_lawyer=self.unrelated_lawyer,
            consultation_mode="OFFICE",
            preferred_date="2026-09-01",
            preferred_time="14:00:00",
            subject="Advisory Intake",
            status=ConsultationStatus.ACCEPTED,
        )
        self.case2 = Case.objects.create(
            originating_consultation=self.consultation2,
            client=self.unrelated_client,
            practice_area=self.practice_area,
            responsible_lawyer=self.unrelated_lawyer,
            title="Fresh Advisory Matter",
            case_type=CaseType.CORPORATE,
            matter_category=MatterCategory.ADVISORY,
            matter_stage=MatterStage.UNDER_REVIEW,
            start_date="2026-09-05",
        )

    def test_authorization_all_case_participants_can_access_timeline(self):
        """Admin, Responsible, Supervising, Assistant lawyer, Paralegal, and Client can access timeline."""
        url = reverse("case-timeline", kwargs={"case_id": self.case1.case_reference})

        participants = [
            self.admin,
            self.responsible_lawyer,
            self.supervising_lawyer,
            self.assistant_lawyer,
            self.paralegal,
            self.client_user,
        ]

        for user in participants:
            self.client.force_authenticate(user=user)
            resp = self.client.get(url)
            self.assertEqual(
                resp.status_code,
                status.HTTP_200_OK,
                f"User {user.email} with role {user.role} should be authorized to access case timeline."
            )
            self.assertEqual(resp.data["case_reference"], self.case1.case_reference)
            self.assertTrue("pipeline" in resp.data)
            self.assertTrue("events" in resp.data)

    def test_unauthenticated_request_is_rejected(self):
        """Unauthenticated requests receive 401 Unauthorized."""
        url = reverse("case-timeline", kwargs={"case_id": self.case1.case_reference})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_case_isolation_unauthorized_client_and_lawyer_receive_403(self):
        """Clients or lawyers not assigned to the case are blocked with 403 Forbidden."""
        url = reverse("case-timeline", kwargs={"case_id": self.case1.case_reference})

        # 1. Unrelated client tries to view Case 1
        self.client.force_authenticate(user=self.unrelated_client)
        resp1 = self.client.get(url)
        self.assertEqual(resp1.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Unrelated lawyer tries to view Case 1
        self.client.force_authenticate(user=self.unrelated_lawyer)
        resp2 = self.client.get(url)
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_visibility_sanitizes_internal_notes_and_staff_milestones(self):
        """
        Clients receive client-appropriate timeline events:
        - Hearing internal_notes are NEVER exposed.
        - Internal staff assignments (SUPERVISING_COUNSEL_ASSIGNED) are hidden.
        - Legitimate case progress (intake, filing, stage updates, hearings) is visible.
        """
        url = reverse("case-timeline", kwargs={"case_id": self.case1.case_reference})

        # 1. Client view
        self.client.force_authenticate(user=self.client_user)
        resp_client = self.client.get(url)
        self.assertEqual(resp_client.status_code, status.HTTP_200_OK)

        events_client = resp_client.data["events"]
        event_types_client = [e["event_type"] for e in events_client]

        # Internal staff activity must NOT be present for client
        self.assertNotIn("INTERNAL_ACTIVITY", event_types_client)

        # Check every event to ensure internal_notes is not in description or metadata
        for event in events_client:
            self.assertNotIn("Judge was favorable", event.get("description", ""))
            self.assertNotIn("Major victory", event.get("description", ""))
            self.assertNotIn("internal_notes", event.get("metadata", {}))

        # Legitimate progress IS present for client
        self.assertIn("CONSULTATION", event_types_client)
        self.assertIn("CASE_CREATED", event_types_client)
        self.assertIn("COURT_FILING", event_types_client)
        self.assertIn("STAGE_CHANGED", event_types_client)
        self.assertIn("HEARING", event_types_client)

        # 2. Lawyer / Staff view
        self.client.force_authenticate(user=self.responsible_lawyer)
        resp_lawyer = self.client.get(url)
        self.assertEqual(resp_lawyer.status_code, status.HTTP_200_OK)

        events_lawyer = resp_lawyer.data["events"]
        event_types_lawyer = [e["event_type"] for e in events_lawyer]

        # Lawyers CAN see team assignment milestone
        self.assertIn("INTERNAL_ACTIVITY", event_types_lawyer)

    def test_timeline_ordering_is_chronological(self):
        """Events must be ordered strictly chronologically by date ascending."""
        url = reverse("case-timeline", kwargs={"case_id": self.case1.case_reference})
        self.client.force_authenticate(user=self.responsible_lawyer)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        events = resp.data["events"]
        self.assertGreater(len(events), 2)

        dates = [e["date"] for e in events]
        # Verify dates are in non-decreasing chronological order
        self.assertEqual(dates, sorted(dates))

    def test_correct_handling_of_cases_with_no_hearings_and_no_filings(self):
        """
        Cases with no hearings and no court filings are handled gracefully:
        - No fake hearing or filing events are created.
        - has_hearings is False, total_hearings is 0.
        - Pipeline accurately marks current stage.
        """
        url = reverse("case-timeline", kwargs={"case_id": self.case2.case_reference})
        self.client.force_authenticate(user=self.unrelated_client)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.assertFalse(resp.data["has_hearings"])
        self.assertEqual(resp.data["total_hearings"], 0)

        events = resp.data["events"]
        event_types = [e["event_type"] for e in events]

        # No hearings
        self.assertNotIn("HEARING", event_types)
        self.assertNotIn("UPCOMING_HEARING", event_types)
        # No fake filing (since case 2 has no filing/CNR/reg numbers)
        self.assertNotIn("COURT_FILING", event_types)

        # But legitimate creation and consultation exist
        self.assertIn("CONSULTATION", event_types)
        self.assertIn("CASE_CREATED", event_types)

        # Stage pipeline
        pipeline = resp.data["pipeline"]
        self.assertTrue(len(pipeline) > 0)
        current_step = [s for s in pipeline if s["is_current"]]
        self.assertEqual(len(current_step), 1)
        self.assertEqual(current_step[0]["key"], "UNDER_REVIEW")

    def test_upcoming_scheduled_hearing_is_represented(self):
        """If hearing has a future next_hearing_date, an UPCOMING event is generated."""
        url = reverse("case-timeline", kwargs={"case_id": self.case1.case_reference})
        self.client.force_authenticate(user=self.client_user)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        events = resp.data["events"]
        upcoming_events = [e for e in events if e["state"] == "UPCOMING"]
        self.assertTrue(len(upcoming_events) >= 1)
        # Next hearing date from hearing2 is 2026-11-20
        self.assertTrue(any(e["date"] == "2026-11-20" for e in upcoming_events))
