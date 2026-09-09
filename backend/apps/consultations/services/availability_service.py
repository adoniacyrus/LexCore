"""
Lawyer availability, working hours, and time slot derivation service.

Implements on-the-fly dynamic slot generation derived from:
- Lawyer default consultation duration (30 or 45 mins)
- Weekly default schedule (LawyerWeeklySchedule)
- Date-specific overrides (LawyerDateOverride)
- Blocked time periods (LawyerTimeBlock)
- Existing active or held consultations (Consultation)
- Past date and current-day past time exclusions
"""

import datetime
from typing import Any, Dict, List, Optional, Tuple

from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import User
from apps.consultations.models import (
    Consultation,
    ConsultationPaymentStatus,
    ConsultationStatus,
    LawyerAvailabilityProfile,
    LawyerDateOverride,
    LawyerTimeBlock,
    LawyerWeeklySchedule,
    PracticeArea,
)

BOOKING_HORIZON_DAYS = 30
HOLD_WINDOW_MINUTES = 15
DEFAULT_CONSULTATION_DURATION = 30


def _format_time_display(t: Any) -> str:
    """Formats 24h time to 12h AM/PM string, e.g. 10:00 -> '10:00 AM'."""
    t = _ensure_time(t)
    dummy = datetime.datetime.combine(datetime.date.today(), t)
    return dummy.strftime("%I:%M %p").lstrip("0")


def _ensure_time(t: Any) -> datetime.time:
    if isinstance(t, str):
        from django.utils.dateparse import parse_time
        parsed = parse_time(t)
        if parsed:
            return parsed
        parts = t.split(":")
        return datetime.time(int(parts[0]), int(parts[1]))
    return t


def _ensure_date(d: Any) -> datetime.date:
    if isinstance(d, str):
        from django.utils.dateparse import parse_date
        return parse_date(d) or datetime.date.fromisoformat(d)
    return d


def _add_minutes_to_time(t: Any, minutes: int) -> datetime.time:
    """Adds minutes to a datetime.time object."""
    t = _ensure_time(t)
    dt = datetime.datetime.combine(datetime.date.min, t)
    return (dt + datetime.timedelta(minutes=minutes)).time()


def _intervals_overlap(
    start_a: Any,
    end_a: Any,
    start_b: Any,
    end_b: Any,
) -> bool:
    """
    Returns True if [start_a, end_a) and [start_b, end_b) overlap.
    Back-to-back intervals (e.g., 10:00–10:30 and 10:30–11:00) do NOT overlap.
    """
    start_a = _ensure_time(start_a)
    end_a = _ensure_time(end_a)
    start_b = _ensure_time(start_b)
    end_b = _ensure_time(end_b)
    if end_a <= start_b or start_a >= end_b:
        return False
    return True


class AvailabilityService:
    """Authoritative domain service for lawyer availability and slot derivation."""

    @staticmethod
    def get_lawyer_duration(lawyer: User) -> int:
        """Retrieves consultation duration for the lawyer (30 or 45 minutes; default 30)."""
        try:
            profile = getattr(lawyer, "availability_profile", None)
            if profile is not None:
                return profile.consultation_duration
            p = LawyerAvailabilityProfile.objects.filter(lawyer=lawyer).first()
            if p:
                return p.consultation_duration
        except Exception:
            pass
        return DEFAULT_CONSULTATION_DURATION

    @staticmethod
    def is_lawyer_available_master(lawyer: User) -> bool:
        """Checks if lawyer's master availability toggle is enabled."""
        try:
            profile = getattr(lawyer, "availability_profile", None)
            if profile is not None:
                return profile.is_available
            p = LawyerAvailabilityProfile.objects.filter(lawyer=lawyer).first()
            if p:
                return p.is_available
        except Exception:
            pass
        return True

    @classmethod
    def get_working_periods_for_date(
        cls, lawyer: User, target_date: Any
    ) -> Tuple[List[Tuple[datetime.time, datetime.time]], Optional[str]]:
        """
        Determines the lawyer's working periods for target_date.
        Follows the strict priority hierarchy:
          1. Specific date override (if present)
          2. Default weekly schedule for that weekday
        Returns:
          (periods_list, override_reason_if_any)
        """
        target_date = _ensure_date(target_date)
        # 1. Check Specific Date Override (start_date <= target_date <= end_date)
        override = (
            LawyerDateOverride.objects.filter(
                lawyer=lawyer,
                start_date__lte=target_date,
                end_date__gte=target_date,
            )
            .order_by("-id")
            .first()
        )

        if override:
            if override.is_unavailable:
                return [], override.reason or "Unavailable (date override)"
            if override.start_time and override.end_time:
                if override.start_time < override.end_time:
                    return [(override.start_time, override.end_time)], None
            return [], override.reason or "Unavailable (date override)"

        # 2. Check Default Weekly Schedule (0=Monday ... 6=Sunday)
        weekday = target_date.weekday()
        weekly_schedules = LawyerWeeklySchedule.objects.filter(
            lawyer=lawyer,
            weekday=weekday,
            is_active=True,
        ).order_by("start_time")

        has_custom = LawyerWeeklySchedule.objects.filter(lawyer=lawyer).exists()
        if not has_custom:
            # Mon-Fri: 09:00 to 17:00 firm default
            if weekday < 5:
                return [(datetime.time(9, 0), datetime.time(17, 0))], None
            return [], "Firm default consultation hours are Monday to Friday."

        periods = []
        for s in weekly_schedules:
            if s.start_time < s.end_time:
                periods.append((s.start_time, s.end_time))

        return periods, None

    @classmethod
    def get_blocking_consultations(
        cls,
        lawyer: User,
        target_date: Any,
        exclude_consultation_id: Optional[Any] = None,
    ) -> List[Consultation]:
        """
        Retrieves consultations for this lawyer on target_date that currently block availability:
        - PAID consultations in active statuses [PENDING, UNDER_REVIEW, APPROVED, ACCEPTED]
        - PENDING payment consultations created within the temporary hold window (15 mins)
        """
        target_date = _ensure_date(target_date)
        cutoff_time = timezone.now() - datetime.timedelta(minutes=HOLD_WINDOW_MINUTES)
        active_statuses = [
            ConsultationStatus.PENDING,
            ConsultationStatus.UNDER_REVIEW,
            ConsultationStatus.APPROVED,
            ConsultationStatus.ACCEPTED,
        ]

        qs = Consultation.objects.filter(
            assigned_lawyer=lawyer,
            preferred_date=target_date,
        ).filter(
            Q(payment_status=ConsultationPaymentStatus.PAID, status__in=active_statuses)
            | Q(
                payment_status=ConsultationPaymentStatus.PENDING,
                created_at__gte=cutoff_time,
                status__in=active_statuses,
            )
        )

        if exclude_consultation_id is not None:
            if str(exclude_consultation_id).isdigit():
                qs = qs.exclude(pk=int(exclude_consultation_id))
            else:
                qs = qs.exclude(consultation_id=str(exclude_consultation_id))

        return list(qs)

    @classmethod
    def get_time_blocks(
        cls, lawyer: User, target_date: Any
    ) -> List[LawyerTimeBlock]:
        """Retrieves active time blocks for this lawyer on target_date."""
        target_date = _ensure_date(target_date)
        return list(
            LawyerTimeBlock.objects.filter(
                lawyer=lawyer,
                date=target_date,
            ).order_by("start_time")
        )

    @classmethod
    def get_available_slots(
        cls,
        lawyer: User,
        target_date: Any,
        exclude_consultation_id: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generates available consultation slots for lawyer on target_date.
        Excludes:
          - Past dates
          - Dates beyond booking horizon (30 days)
          - Times blocked by date override / lack of weekly schedule
          - Times blocked by LawyerTimeBlock
          - Times occupied by existing active or held consultations
          - Past time slots for current day
        """
        target_date = _ensure_date(target_date)
        today = timezone.localdate()
        if target_date < today:
            return []
        if target_date > today + datetime.timedelta(days=BOOKING_HORIZON_DAYS):
            return []

        if not cls.is_lawyer_available_master(lawyer):
            return []

        duration = cls.get_lawyer_duration(lawyer)
        periods, _ = cls.get_working_periods_for_date(lawyer, target_date)
        if not periods:
            return []

        # Candidate slot generation
        candidate_slots: List[Tuple[datetime.time, datetime.time]] = []
        for p_start, p_end in periods:
            curr = p_start
            while True:
                slot_end = _add_minutes_to_time(curr, duration)
                # Ensure slot_end doesn't exceed working period
                # Notice: if slot_end <= curr, time wrapped around midnight, abort
                if slot_end <= curr or slot_end > p_end:
                    break
                candidate_slots.append((curr, slot_end))
                curr = slot_end

        if not candidate_slots:
            return []

        # Retrieve blocks and active consultations
        time_blocks = cls.get_time_blocks(lawyer, target_date)
        blocking_consultations = cls.get_blocking_consultations(
            lawyer, target_date, exclude_consultation_id=exclude_consultation_id
        )

        now_time = None
        if target_date == today:
            now_time = timezone.localtime().time()

        available_slots = []
        for s_start, s_end in candidate_slots:
            # 1. Filter out past times for today
            if now_time and s_start <= now_time:
                continue

            # 2. Check overlap with time blocks
            is_blocked = False
            for b in time_blocks:
                if _intervals_overlap(s_start, s_end, b.start_time, b.end_time):
                    is_blocked = True
                    break
            if is_blocked:
                continue

            # 3. Check overlap with existing consultations
            has_conflict = False
            for c in blocking_consultations:
                c_start = c.preferred_time
                c_end = c.end_time or _add_minutes_to_time(
                    c_start, c.duration_minutes or duration
                )
                if _intervals_overlap(s_start, s_end, c_start, c_end):
                    has_conflict = True
                    break
            if has_conflict:
                continue

            # Slot is genuinely available
            available_slots.append({
                "start_time": s_start.strftime("%H:%M"),
                "end_time": s_end.strftime("%H:%M"),
                "display": f"{_format_time_display(s_start)} – {_format_time_display(s_end)}",
                "duration_minutes": duration,
            })

        return available_slots

    @classmethod
    def check_slot_available(
        cls,
        lawyer: User,
        target_date: Any,
        preferred_time: Any,
        duration_minutes: Optional[int] = None,
        exclude_consultation_id: Optional[Any] = None,
        check_past_time: bool = False,
    ) -> Tuple[bool, str]:
        """
        Validates whether a specific slot (target_date, preferred_time) is available for lawyer.
        Returns (is_available: bool, reason: str).
        """
        target_date = _ensure_date(target_date)
        preferred_time = _ensure_time(preferred_time)

        today = timezone.localdate()
        if target_date < today:
            return False, "Appointment date cannot be in the past."

        if check_past_time and target_date == today:
            if preferred_time <= timezone.localtime().time():
                return False, "Appointment time has already passed for today."

        if not cls.is_lawyer_available_master(lawyer):
            return False, f"{lawyer.full_name} is currently not accepting new consultations."

        duration = duration_minutes or cls.get_lawyer_duration(lawyer)
        slot_end = _add_minutes_to_time(preferred_time, duration)

        # Check working periods / overrides
        periods, override_reason = cls.get_working_periods_for_date(lawyer, target_date)
        if not periods:
            return False, override_reason or f"{lawyer.full_name} is not scheduled to work on {target_date.strftime('%A')}."

        # Check if slot falls completely within any working period
        within_working_hours = False
        for p_start, p_end in periods:
            if preferred_time >= p_start and slot_end <= p_end:
                within_working_hours = True
                break

        if not within_working_hours:
            return False, f"Selected time falls outside {lawyer.full_name}’s consultation working hours."

        # Check time blocks
        time_blocks = cls.get_time_blocks(lawyer, target_date)
        for b in time_blocks:
            if _intervals_overlap(preferred_time, slot_end, b.start_time, b.end_time):
                return False, f"{lawyer.full_name} has a blocked commitment ({b.get_reason_display()}) at this time."

        # Check existing consultations
        blocking_consultations = cls.get_blocking_consultations(
            lawyer, target_date, exclude_consultation_id=exclude_consultation_id
        )
        for c in blocking_consultations:
            c_start = c.preferred_time
            c_end = c.end_time or _add_minutes_to_time(
                c_start, c.duration_minutes or duration
            )
            if _intervals_overlap(preferred_time, slot_end, c_start, c_end):
                return False, f"{lawyer.full_name} is already booked for an appointment at this time."

        return True, "Available"

    @classmethod
    def get_eligible_lawyers_availability(
        cls,
        practice_area: Optional[PracticeArea],
        target_date: Optional[datetime.date] = None,
        target_time: Optional[datetime.time] = None,
        exclude_consultation_id: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        Returns list of eligible lawyers with their availability status for a given slot.
        Used by Admin when reviewing/assigning consultations.
        """
        from apps.consultations.serializers import eligible_lawyers_queryset

        lawyers = eligible_lawyers_queryset(practice_area)
        results = []

        for lawyer in lawyers:
            duration = cls.get_lawyer_duration(lawyer)
            if target_date and target_time:
                is_avail, reason = cls.check_slot_available(
                    lawyer=lawyer,
                    target_date=target_date,
                    preferred_time=target_time,
                    duration_minutes=duration,
                    exclude_consultation_id=exclude_consultation_id,
                )
            elif target_date:
                # Check day availability
                slots = cls.get_available_slots(lawyer, target_date, exclude_consultation_id)
                is_avail = len(slots) > 0
                reason = f"{len(slots)} slots available on {target_date.strftime('%b %d')}" if is_avail else "No available slots on this date"
            else:
                is_avail = cls.is_lawyer_available_master(lawyer)
                reason = "Accepting consultations" if is_avail else "Currently unavailable"

            results.append({
                "id": lawyer.id,
                "full_name": lawyer.full_name,
                "email": lawyer.email,
                "role": lawyer.role,
                "consultation_duration": duration,
                "is_available": is_avail,
                "status_reason": reason,
            })

        return results
