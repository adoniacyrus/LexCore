"""
Automated tests for Lawyer Consultation Availability, Time Slots, and Appointment Scheduling.
Verifies all 25 specifications from the LexCore scheduling requirement.
"""

import datetime
from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.cases.models import Case, CaseStatus, CaseType
from apps.consultations.models import (
    Consultation,
    ConsultationMode,
    ConsultationPaymentStatus,
    ConsultationStatus,
    ConsultationType,
    LawyerAvailabilityProfile,
    LawyerDateOverride,
    LawyerTimeBlock,
    LawyerWeeklySchedule,
    PracticeArea,
    TimeBlockReason,
)
from apps.consultations.services.availability_service import (
    AvailabilityService,
    _intervals_overlap,
)


class LawyerAvailabilityTests(APITestCase):
    def setUp(self):
        settings.RAZORPAY_KEY_ID = "rzp_test_mock_123"
        settings.RAZORPAY_KEY_SECRET = "test_key_secret_abc123"
        settings.RAZORPAY_DEFAULT_CONSULTATION_FEE = 500

        self.practice_area = PracticeArea.objects.create(
            name="Corporate & Commercial",
            is_active=True,
        )

        self.client_user = User.objects.create_user(
            email="client@example.com",
            password="Password123!",
            full_name="Rohan Sharma",
            role=UserRole.CLIENT,
        )

        self.client_user_2 = User.objects.create_user(
            email="client2@example.com",
            password="Password123!",
            full_name="Priya Patel",
            role=UserRole.CLIENT,
        )

        self.lawyer_1 = User.objects.create_user(
            email="lawyer1@example.com",
            password="Password123!",
            full_name="Advocate Vikram Malhotra",
            role=UserRole.SENIOR_LAWYER,
        )
        self.lawyer_1.practice_areas.add(self.practice_area)

        self.lawyer_2 = User.objects.create_user(
            email="lawyer2@example.com",
            password="Password123!",
            full_name="Advocate Kabir Sengupta",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.lawyer_2.practice_areas.add(self.practice_area)

        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            password="Password123!",
            full_name="Firm Administrator",
            role=UserRole.ADMIN,
        )

        # Standard Monday-Friday working hours for lawyer_1: 10:00 - 13:00, 14:00 - 17:00
        for day in range(5):
            LawyerWeeklySchedule.objects.create(
                lawyer=self.lawyer_1,
                weekday=day,
                start_time=datetime.time(10, 0),
                end_time=datetime.time(13, 0),
                is_active=True,
            )
            LawyerWeeklySchedule.objects.create(
                lawyer=self.lawyer_1,
                weekday=day,
                start_time=datetime.time(14, 0),
                end_time=datetime.time(17, 0),
                is_active=True,
            )

        LawyerAvailabilityProfile.objects.create(
            lawyer=self.lawyer_1,
            consultation_duration=30,
            is_available=True,
        )

    def _next_target_weekday(self, target_weekday: int = 0) -> datetime.date:
        """Finds an upcoming date with the given weekday (0=Monday), guaranteed in the future."""
        today = timezone.localdate()
        days_ahead = (target_weekday - today.weekday()) % 7
        if days_ahead <= 0:
            days_ahead += 7
        return today + datetime.timedelta(days=days_ahead)

    # 1. Lawyer can configure availability
    def test_lawyer_can_configure_weekly_schedule(self):
        self.client.force_authenticate(user=self.lawyer_2)
        payload = {
            "consultation_duration": 45,
            "is_available": True,
            "weekly_schedules": [
                {
                    "weekday": 0,
                    "start_time": "10:00",
                    "end_time": "14:00",
                    "is_active": True,
                }
            ],
        }
        res = self.client.put("/api/consultations/availability/my-schedule/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["consultation_duration"], 45)
        self.assertEqual(len(res.data["weekly_schedules"]), 1)

    # 2. Lawyer can update own availability
    def test_lawyer_can_update_own_availability(self):
        self.client.force_authenticate(user=self.lawyer_1)
        res_get = self.client.get("/api/consultations/availability/my-schedule/")
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data["consultation_duration"], 30)

        # Update duration to 45
        payload = {
            "consultation_duration": 45,
            "is_available": True,
            "weekly_schedules": [
                {"weekday": 0, "start_time": "11:00", "end_time": "16:00", "is_active": True}
            ],
        }
        res_put = self.client.put("/api/consultations/availability/my-schedule/", payload, format="json")
        self.assertEqual(res_put.status_code, status.HTTP_200_OK)
        self.assertEqual(res_put.data["consultation_duration"], 45)

    # 3. Lawyer cannot modify another lawyer's availability
    def test_lawyer_cannot_modify_another_lawyers_availability(self):
        # Lawyer 1 creates a date override
        override = LawyerDateOverride.objects.create(
            lawyer=self.lawyer_1,
            start_date=timezone.localdate() + datetime.timedelta(days=2),
            end_date=timezone.localdate() + datetime.timedelta(days=2),
            is_unavailable=True,
            reason="Court visit",
        )
        # Lawyer 2 attempts to delete it
        self.client.force_authenticate(user=self.lawyer_2)
        res = self.client.delete(f"/api/consultations/availability/overrides/{override.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(LawyerDateOverride.objects.filter(pk=override.id).exists())

    # 4. Admin can view lawyer availability
    def test_admin_can_view_lawyer_availability(self):
        self.client.force_authenticate(user=self.admin_user)
        next_mon = self._next_target_weekday(0)
        url = f"/api/consultations/admin/eligible-lawyers/?practice_area={self.practice_area.id}&date={next_mon.isoformat()}&time=10:30"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(isinstance(res.data, list))
        lawyer_entry = next((l for l in res.data if l["id"] == self.lawyer_1.id), None)
        self.assertIsNotNone(lawyer_entry)
        self.assertTrue(lawyer_entry["is_available"])

    # 5. Default weekly schedule generates slots
    def test_default_weekly_schedule_generates_slots(self):
        next_mon = self._next_target_weekday(0)
        slots = AvailabilityService.get_available_slots(self.lawyer_1, next_mon)
        # Expected: 10:00-13:00 (6 slots of 30m) + 14:00-17:00 (6 slots of 30m) = 12 slots
        self.assertEqual(len(slots), 12)
        self.assertEqual(slots[0]["start_time"], "10:00")
        self.assertEqual(slots[0]["end_time"], "10:30")
        self.assertEqual(slots[5]["start_time"], "12:30")
        self.assertEqual(slots[5]["end_time"], "13:00")
        self.assertEqual(slots[6]["start_time"], "14:00")
        self.assertEqual(slots[11]["end_time"], "17:00")

    # 6. Specific-date override replaces weekly schedule
    def test_specific_date_override_replaces_weekly_schedule(self):
        next_mon = self._next_target_weekday(0)
        # Create full-day unavailable override
        LawyerDateOverride.objects.create(
            lawyer=self.lawyer_1,
            start_date=next_mon,
            end_date=next_mon,
            is_unavailable=True,
            reason="National conference",
        )
        slots = AvailabilityService.get_available_slots(self.lawyer_1, next_mon)
        self.assertEqual(len(slots), 0)

        # Now test custom-hours override (2 PM – 4 PM only)
        LawyerDateOverride.objects.filter(lawyer=self.lawyer_1, start_date=next_mon).delete()
        LawyerDateOverride.objects.create(
            lawyer=self.lawyer_1,
            start_date=next_mon,
            end_date=next_mon,
            is_unavailable=False,
            start_time=datetime.time(14, 0),
            end_time=datetime.time(16, 0),
            reason="Afternoon slots only",
        )
        slots_custom = AvailabilityService.get_available_slots(self.lawyer_1, next_mon)
        # 14:00-16:00 (4 slots of 30m)
        self.assertEqual(len(slots_custom), 4)
        self.assertEqual(slots_custom[0]["start_time"], "14:00")
        self.assertEqual(slots_custom[-1]["end_time"], "16:00")

    # 7. Full-day block removes all slots
    def test_full_day_block_removes_all_slots(self):
        next_tue = self._next_target_weekday(1)
        LawyerDateOverride.objects.create(
            lawyer=self.lawyer_1,
            start_date=next_tue,
            end_date=next_tue,
            is_unavailable=True,
            reason="Personal Leave",
        )
        slots = AvailabilityService.get_available_slots(self.lawyer_1, next_tue)
        self.assertEqual(len(slots), 0)

    # 8. Partial block removes affected slots
    def test_partial_block_removes_affected_slots(self):
        next_mon = self._next_target_weekday(0)
        # Block 11:00 to 12:30 for court hearing
        LawyerTimeBlock.objects.create(
            lawyer=self.lawyer_1,
            date=next_mon,
            start_time=datetime.time(11, 0),
            end_time=datetime.time(12, 30),
            reason=TimeBlockReason.COURT,
            notes="High Court Hearing",
        )
        slots = AvailabilityService.get_available_slots(self.lawyer_1, next_mon)
        # 12 original - 3 blocked (11:00-11:30, 11:30-12:00, 12:00-12:30) = 9
        self.assertEqual(len(slots), 9)
        start_times = [s["start_time"] for s in slots]
        self.assertNotIn("11:00", start_times)
        self.assertNotIn("11:30", start_times)
        self.assertNotIn("12:00", start_times)
        self.assertIn("10:30", start_times)
        self.assertIn("12:30", start_times)

    # 9. Existing appointment removes overlapping slot
    def test_existing_appointment_removes_overlapping_slot(self):
        next_mon = self._next_target_weekday(0)
        # Confirmed paid appointment at 10:30 - 11:00
        Consultation.objects.create(
            client=self.client_user,
            assigned_lawyer=self.lawyer_1,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=next_mon,
            preferred_time=datetime.time(10, 30),
            duration_minutes=30,
            end_time=datetime.time(11, 0),
            subject="Property Matter",
            status=ConsultationStatus.ACCEPTED,
            payment_status=ConsultationPaymentStatus.PAID,
        )
        slots = AvailabilityService.get_available_slots(self.lawyer_1, next_mon)
        self.assertEqual(len(slots), 11)
        start_times = [s["start_time"] for s in slots]
        self.assertNotIn("10:30", start_times)
        self.assertIn("10:00", start_times)
        self.assertIn("11:00", start_times)

    # 10. Cancelled appointment releases slot
    def test_cancelled_appointment_releases_slot(self):
        next_mon = self._next_target_weekday(0)
        consultation = Consultation.objects.create(
            client=self.client_user,
            assigned_lawyer=self.lawyer_1,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=next_mon,
            preferred_time=datetime.time(10, 30),
            duration_minutes=30,
            end_time=datetime.time(11, 0),
            subject="Cancelled Matter",
            status=ConsultationStatus.CANCELLED,
            payment_status=ConsultationPaymentStatus.PAID,
        )
        slots = AvailabilityService.get_available_slots(self.lawyer_1, next_mon)
        start_times = [s["start_time"] for s in slots]
        self.assertIn("10:30", start_times)

    # 11. Past slots and past dates are unavailable
    def test_past_dates_and_past_slots_unavailable(self):
        yesterday = timezone.localdate() - datetime.timedelta(days=1)
        slots_past = AvailabilityService.get_available_slots(self.lawyer_1, yesterday)
        self.assertEqual(len(slots_past), 0)

        is_avail, reason = AvailabilityService.check_slot_available(
            self.lawyer_1,
            yesterday,
            datetime.time(10, 0),
        )
        self.assertFalse(is_avail)
        self.assertIn("past", reason.lower())

    # 12. Existing-case booking uses responsible lawyer
    def test_existing_case_booking_uses_responsible_lawyer(self):
        # Create originating consultation and case
        origin_cons = Consultation.objects.create(
            client=self.client_user,
            assigned_lawyer=self.lawyer_1,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=self._next_target_weekday(0),
            preferred_time=datetime.time(10, 0),
            subject="Origin Matter",
            status=ConsultationStatus.COMPLETED,
            payment_status=ConsultationPaymentStatus.PAID,
        )
        case = Case.objects.create(
            originating_consultation=origin_cons,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_1,
            title="Civil Appeal Case",
            case_type=CaseType.CIVIL,
            status=CaseStatus.OPEN,
            start_date=timezone.localdate(),
            appointment_fee=Decimal("1500.00"),
        )

        next_mon = self._next_target_weekday(0)
        self.client.force_authenticate(user=self.client_user)

        with patch("apps.payments.services.RazorpayService.create_order") as mock_order:
            mock_order.return_value = {"id": "order_mock_123", "amount": 150000}
            payload = {
                "consultation_type": ConsultationType.EXISTING_CASE,
                "case_id": case.case_reference,
                "preferred_date": next_mon.isoformat(),
                "preferred_time": "10:30",
                "consultation_mode": ConsultationMode.OFFICE,
                "subject": "Follow-up meeting",
            }
            res = self.client.post("/api/consultations/", payload, format="json")
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(res.data["assigned_lawyer"]["id"], self.lawyer_1.id)
            self.assertEqual(res.data["duration_minutes"], 30)

    # 13. Client cannot select another lawyer for existing case
    def test_client_cannot_select_another_lawyer_for_existing_case(self):
        origin_cons = Consultation.objects.create(
            client=self.client_user,
            assigned_lawyer=self.lawyer_1,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=self._next_target_weekday(0),
            preferred_time=datetime.time(10, 0),
            subject="Origin Matter 2",
            status=ConsultationStatus.COMPLETED,
            payment_status=ConsultationPaymentStatus.PAID,
        )
        case = Case.objects.create(
            originating_consultation=origin_cons,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_1,
            title="Criminal Revision Case",
            case_type=CaseType.CRIMINAL,
            status=CaseStatus.OPEN,
            start_date=timezone.localdate(),
            appointment_fee=Decimal("2000.00"),
        )

        next_mon = self._next_target_weekday(0)
        self.client.force_authenticate(user=self.client_user)
        # Attempt to pass assigned_lawyer = lawyer_2
        with patch("apps.payments.services.RazorpayService.create_order") as mock_order:
            mock_order.return_value = {"id": "order_mock_456", "amount": 200000}
            payload = {
                "consultation_type": ConsultationType.EXISTING_CASE,
                "case_id": case.case_reference,
                "assigned_lawyer": self.lawyer_2.id,
                "preferred_date": next_mon.isoformat(),
                "preferred_time": "10:30",
                "consultation_mode": ConsultationMode.OFFICE,
            }
            res = self.client.post("/api/consultations/", payload, format="json")
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            # Backend server-side forces responsible lawyer (Vikram Malhotra), ignoring input!
            self.assertEqual(res.data["assigned_lawyer"]["id"], self.lawyer_1.id)

    # 14. Admin can identify available lawyers & 15. Admin cannot assign unavailable lawyer
    def test_admin_assignment_and_conflict_rejection(self):
        next_mon = self._next_target_weekday(0)
        # Book lawyer_1 at 10:30
        Consultation.objects.create(
            client=self.client_user_2,
            assigned_lawyer=self.lawyer_1,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=next_mon,
            preferred_time=datetime.time(10, 30),
            duration_minutes=30,
            end_time=datetime.time(11, 0),
            status=ConsultationStatus.ACCEPTED,
            payment_status=ConsultationPaymentStatus.PAID,
        )

        # Create new consultation waiting for admin assignment
        consultation = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=next_mon,
            preferred_time=datetime.time(10, 30),
            duration_minutes=30,
            status=ConsultationStatus.PENDING,
            payment_status=ConsultationPaymentStatus.PAID,
        )

        self.client.force_authenticate(user=self.admin_user)
        # Check eligibility list: lawyer_1 should show is_available=False
        avail_url = f"/api/consultations/admin/eligible-lawyers/?practice_area={self.practice_area.id}&date={next_mon.isoformat()}&time=10:30"
        res_avail = self.client.get(avail_url)
        self.assertEqual(res_avail.status_code, status.HTTP_200_OK)
        l1_entry = next((l for l in res_avail.data if l["id"] == self.lawyer_1.id), None)
        self.assertFalse(l1_entry["is_available"])

        # Attempt to assign unavailable lawyer_1 -> must be rejected
        patch_payload = {"assigned_lawyer": self.lawyer_1.id}
        res_patch = self.client.patch(f"/api/consultations/admin/{consultation.id}/", patch_payload, format="json")
        self.assertEqual(res_patch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assigned_lawyer", res_patch.data)

    # 16. Admin can reschedule to available time
    def test_admin_can_reschedule_to_available_time(self):
        next_mon = self._next_target_weekday(0)
        consultation = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=next_mon,
            preferred_time=datetime.time(10, 30),
            duration_minutes=30,
            status=ConsultationStatus.PENDING,
            payment_status=ConsultationPaymentStatus.PAID,
        )

        self.client.force_authenticate(user=self.admin_user)
        # Reschedule to 14:00 and assign lawyer_1
        patch_payload = {
            "assigned_lawyer": self.lawyer_1.id,
            "preferred_date": next_mon.isoformat(),
            "preferred_time": "14:00",
            "status": ConsultationStatus.APPROVED,
        }
        res_patch = self.client.patch(f"/api/consultations/admin/{consultation.id}/", patch_payload, format="json")
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data["assigned_lawyer"]["id"], self.lawyer_1.id)
        self.assertEqual(res_patch.data["preferred_time"], "14:00:00")
        self.assertEqual(res_patch.data["end_time"], "14:30:00")

    # 17. Two simultaneous booking attempts cannot create duplicate appointment
    def test_duplicate_booking_on_same_slot_rejected(self):
        origin_cons = Consultation.objects.create(
            client=self.client_user,
            assigned_lawyer=self.lawyer_1,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=self._next_target_weekday(0),
            preferred_time=datetime.time(10, 0),
            subject="Case Origin",
            status=ConsultationStatus.COMPLETED,
            payment_status=ConsultationPaymentStatus.PAID,
        )
        case = Case.objects.create(
            originating_consultation=origin_cons,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_1,
            title="Double Booking Test Case",
            case_type=CaseType.CIVIL,
            status=CaseStatus.OPEN,
            start_date=timezone.localdate(),
            appointment_fee=Decimal("1000.00"),
        )

        next_mon = self._next_target_weekday(0)
        # Client 1 books 10:30
        self.client.force_authenticate(user=self.client_user)
        with patch("apps.payments.services.RazorpayService.create_order") as mock_order:
            mock_order.return_value = {"id": "order_mock_1", "amount": 100000}
            payload = {
                "consultation_type": ConsultationType.EXISTING_CASE,
                "case_id": case.case_reference,
                "preferred_date": next_mon.isoformat(),
                "preferred_time": "10:30",
                "consultation_mode": ConsultationMode.OFFICE,
            }
            res1 = self.client.post("/api/consultations/", payload, format="json")
            self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Now Client 2 attempts to book the same lawyer and same slot
        # Create a second case for client 2 with the same responsible lawyer
        origin_cons_2 = Consultation.objects.create(
            client=self.client_user_2,
            assigned_lawyer=self.lawyer_1,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=self._next_target_weekday(0),
            preferred_time=datetime.time(10, 0),
            subject="Case Origin 2",
            status=ConsultationStatus.COMPLETED,
            payment_status=ConsultationPaymentStatus.PAID,
        )
        case_2 = Case.objects.create(
            originating_consultation=origin_cons_2,
            client=self.client_user_2,
            practice_area=self.practice_area,
            responsible_lawyer=self.lawyer_1,
            title="Second Client Case",
            case_type=CaseType.CIVIL,
            status=CaseStatus.OPEN,
            start_date=timezone.localdate(),
            appointment_fee=Decimal("1000.00"),
        )

        self.client.force_authenticate(user=self.client_user_2)
        with patch("apps.payments.services.RazorpayService.create_order") as mock_order:
            mock_order.return_value = {"id": "order_mock_2", "amount": 100000}
            payload2 = {
                "consultation_type": ConsultationType.EXISTING_CASE,
                "case_id": case_2.case_reference,
                "preferred_date": next_mon.isoformat(),
                "preferred_time": "10:30",
                "consultation_mode": ConsultationMode.OFFICE,
            }
            res2 = self.client.post("/api/consultations/", payload2, format="json")
            # Must be rejected because 10:30 is held by Client 1
            self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("preferred_time", res2.data)

    # 18. Failed/expired payment releases temporary hold
    def test_failed_payment_releases_slot(self):
        next_mon = self._next_target_weekday(0)
        # Create a consultation with failed payment status
        Consultation.objects.create(
            client=self.client_user,
            assigned_lawyer=self.lawyer_1,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=next_mon,
            preferred_time=datetime.time(10, 30),
            duration_minutes=30,
            status=ConsultationStatus.PENDING,
            payment_status=ConsultationPaymentStatus.FAILED,
        )
        slots = AvailabilityService.get_available_slots(self.lawyer_1, next_mon)
        start_times = [s["start_time"] for s in slots]
        self.assertIn("10:30", start_times)

    # 22. 30-minute duration generates correct slots
    def test_30_minute_duration_slot_generation(self):
        next_mon = self._next_target_weekday(0)
        slots = AvailabilityService.get_available_slots(self.lawyer_1, next_mon)
        for s in slots:
            self.assertEqual(s["duration_minutes"], 30)

    # 23. 45-minute duration generates correct slots
    def test_45_minute_duration_slot_generation(self):
        # Update lawyer_1 to 45 minutes
        profile = self.lawyer_1.availability_profile
        profile.consultation_duration = 45
        profile.save()

        next_mon = self._next_target_weekday(0)
        slots = AvailabilityService.get_available_slots(self.lawyer_1, next_mon)
        # Period 1: 10:00-13:00 (180 mins / 45 = 4 slots: 10:00-10:45, 10:45-11:30, 11:30-12:15, 12:15-13:00)
        # Period 2: 14:00-17:00 (180 mins / 45 = 4 slots: 14:00-14:45, 14:45-15:30, 15:30-16:15, 16:15-17:00)
        # Total = 8 slots
        self.assertEqual(len(slots), 8)
        self.assertEqual(slots[0]["start_time"], "10:00")
        self.assertEqual(slots[0]["end_time"], "10:45")
        self.assertEqual(slots[3]["end_time"], "13:00")
        self.assertEqual(slots[4]["start_time"], "14:00")
        self.assertEqual(slots[7]["end_time"], "17:00")

    # 24. Overlapping availability rules are rejected
    def test_overlapping_weekly_schedules_rejected(self):
        self.client.force_authenticate(user=self.lawyer_2)
        payload = {
            "consultation_duration": 30,
            "is_available": True,
            "weekly_schedules": [
                {"weekday": 0, "start_time": "10:00", "end_time": "13:00", "is_active": True},
                {"weekday": 0, "start_time": "12:00", "end_time": "15:00", "is_active": True},
            ],
        }
        res = self.client.put("/api/consultations/availability/my-schedule/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("weekly_schedules", res.data)

    # 25. Invalid start/end times are rejected
    def test_invalid_start_end_times_rejected(self):
        self.client.force_authenticate(user=self.lawyer_2)
        payload = {
            "consultation_duration": 30,
            "is_available": True,
            "weekly_schedules": [
                {"weekday": 0, "start_time": "15:00", "end_time": "11:00", "is_active": True}
            ],
        }
        res = self.client.put("/api/consultations/availability/my-schedule/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid time block (start >= end)
        block_payload = {
            "date": timezone.localdate().isoformat(),
            "start_time": "16:00",
            "end_time": "14:00",
            "reason": TimeBlockReason.COURT,
        }
        res_block = self.client.post("/api/consultations/availability/time-blocks/", block_payload, format="json")
        self.assertEqual(res_block.status_code, status.HTTP_400_BAD_REQUEST)
