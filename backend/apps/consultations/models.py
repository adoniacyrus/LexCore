"""
Consultation workflow models.

PracticeArea is the firm master list. Lawyers specialize via M2M on User.
Consultation references client, optional practice area, and optional assigned lawyer.
"""

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class PracticeArea(models.Model):
    """Firm practice-area master (admin-managed)."""

    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "practice area"
        verbose_name_plural = "practice areas"

    def __str__(self) -> str:
        return self.name

    @property
    def is_general(self) -> bool:
        return self.name.strip().lower() == "general consultation"


class ConsultationMode(models.TextChoices):
    OFFICE = "OFFICE", "Office Visit"
    PHONE = "PHONE", "Phone Call"
    VIDEO = "VIDEO", "Video Call"


class ConsultationStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
    APPROVED = "APPROVED", "Approved"
    ACCEPTED = "ACCEPTED", "Accepted"
    REJECTED = "REJECTED", "Rejected"
    CANCELLED = "CANCELLED", "Cancelled"
    COMPLETED = "COMPLETED", "Completed"


class ConsultationPaymentStatus(models.TextChoices):
    PENDING = "PENDING", "Payment Pending"
    PAID = "PAID", "Paid"
    FAILED = "FAILED", "Payment Failed"


class ConsultationType(models.TextChoices):
    NEW_MATTER = "NEW_MATTER", "New Legal Matter"
    EXISTING_CASE = "EXISTING_CASE", "Existing Case Appointment"


LAWYER_ROLES = ("SENIOR_LAWYER", "JUNIOR_LAWYER")


class Consultation(models.Model):
    """Client-submitted consultation request with optional firm assignment."""

    consultation_id = models.CharField(
        max_length=32,
        unique=True,
        db_index=True,
        editable=False,
        help_text="Auto-generated reference, e.g. CONS-2026-0001.",
    )
    consultation_type = models.CharField(
        max_length=20,
        choices=ConsultationType.choices,
        default=ConsultationType.NEW_MATTER,
        db_index=True,
    )
    case_appointment = models.ForeignKey(
        "cases.Case",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="case_appointments",
        help_text="Linked case for an existing-case appointment.",
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="consultations",
    )
    practice_area = models.ForeignKey(
        PracticeArea,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="consultations",
    )
    assigned_lawyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_consultations",
        limit_choices_to={"role__in": LAWYER_ROLES},
    )
    consultation_mode = models.CharField(
        max_length=16,
        choices=ConsultationMode.choices,
    )
    preferred_date = models.DateField()
    preferred_time = models.TimeField()
    duration_minutes = models.PositiveIntegerField(
        default=30,
        help_text="Consultation duration in minutes (30 or 45).",
    )
    end_time = models.TimeField(
        null=True,
        blank=True,
        help_text="Calculated consultation end time.",
    )
    subject = models.CharField(max_length=255)
    issue_summary = models.TextField(blank=True, default="")
    charged_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Historical fee in INR charged at the time of booking.",
    )
    status = models.CharField(
        max_length=20,
        choices=ConsultationStatus.choices,
        default=ConsultationStatus.PENDING,
        db_index=True,
    )
    payment_status = models.CharField(
        max_length=20,
        choices=ConsultationPaymentStatus.choices,
        default=ConsultationPaymentStatus.PENDING,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["client", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["payment_status", "-created_at"]),
            models.Index(fields=["assigned_lawyer", "-created_at"]),
            models.Index(fields=["consultation_type", "-created_at"]),
            models.Index(fields=["preferred_date", "preferred_time"]),
        ]

    def __str__(self):
        return f"{self.consultation_id} — {self.subject}"

    @classmethod
    def next_consultation_id(cls) -> str:
        """
        Next CONS-YYYY-#### for the current year.

        Must be called inside transaction.atomic() with a row lock held.
        """
        year = timezone.localdate().year
        prefix = f"CONS-{year}-"
        last = (
            cls.objects.select_for_update()
            .filter(consultation_id__startswith=prefix)
            .order_by("-consultation_id")
            .first()
        )
        if last:
            try:
                seq = int(last.consultation_id.rsplit("-", 1)[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:04d}"

    def compute_end_time(self):
        if self.preferred_time:
            import datetime
            t = self.preferred_time
            if isinstance(t, str):
                from django.utils.dateparse import parse_time
                parsed = parse_time(t)
                if parsed:
                    t = parsed
                else:
                    parts = t.split(':')
                    t = datetime.time(int(parts[0]), int(parts[1]))
            base_dt = datetime.datetime.combine(datetime.date.min, t)
            mins = self.duration_minutes or 30
            return (base_dt + datetime.timedelta(minutes=mins)).time()
        return None

    def save(self, *args, **kwargs):
        if not self.end_time and self.preferred_time:
            self.end_time = self.compute_end_time()
        if not self.consultation_id:
            with transaction.atomic():
                self.consultation_id = self.next_consultation_id()
                return super().save(*args, **kwargs)
        return super().save(*args, **kwargs)


class LawyerAvailabilityProfile(models.Model):
    """Configures consultation duration and availability status for a lawyer."""

    DURATION_CHOICES = (
        (30, "30 minutes"),
        (45, "45 minutes"),
    )

    lawyer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="availability_profile",
        limit_choices_to={"role__in": LAWYER_ROLES},
    )
    consultation_duration = models.PositiveIntegerField(
        default=30,
        choices=DURATION_CHOICES,
        help_text="Standard duration of consultation appointments in minutes.",
    )
    is_available = models.BooleanField(
        default=True,
        help_text="Master toggle indicating whether the lawyer is accepting consultations.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Availability: {self.lawyer.full_name} ({self.consultation_duration}m)"


class Weekday(models.IntegerChoices):
    MONDAY = 0, "Monday"
    TUESDAY = 1, "Tuesday"
    WEDNESDAY = 2, "Wednesday"
    THURSDAY = 3, "Thursday"
    FRIDAY = 4, "Friday"
    SATURDAY = 5, "Saturday"
    SUNDAY = 6, "Sunday"


class LawyerWeeklySchedule(models.Model):
    """Recurring weekly working periods for lawyer consultations."""

    lawyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="weekly_schedules",
        limit_choices_to={"role__in": LAWYER_ROLES},
    )
    weekday = models.PositiveSmallIntegerField(
        choices=Weekday.choices,
        help_text="Day of the week (0=Monday, 6=Sunday).",
    )
    start_time = models.TimeField(help_text="Start of consultation working period.")
    end_time = models.TimeField(help_text="End of consultation working period.")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["weekday", "start_time"]

    def __str__(self):
        return f"{self.lawyer.full_name} — {self.get_weekday_display()} ({self.start_time.strftime('%H:%M')}–{self.end_time.strftime('%H:%M')})"


class LawyerDateOverride(models.Model):
    """Date-specific override for single dates or date ranges."""

    lawyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="date_overrides",
        limit_choices_to={"role__in": LAWYER_ROLES},
    )
    start_date = models.DateField(help_text="Start date of override (inclusive).")
    end_date = models.DateField(help_text="End date of override (inclusive).")
    is_unavailable = models.BooleanField(
        default=True,
        help_text="True if completely unavailable all day. False if available with custom hours.",
    )
    start_time = models.TimeField(
        null=True,
        blank=True,
        help_text="Custom start time if available.",
    )
    end_time = models.TimeField(
        null=True,
        blank=True,
        help_text="Custom end time if available.",
    )
    reason = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Optional reason for override (e.g., Vacation, Leave, Special Session).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start_date", "start_time"]

    def __str__(self):
        status_str = "Unavailable" if self.is_unavailable else f"{self.start_time}–{self.end_time}"
        return f"Override: {self.lawyer.full_name} [{self.start_date} to {self.end_date}] — {status_str}"


class TimeBlockReason(models.TextChoices):
    COURT = "COURT", "Court Appearance"
    PERSONAL = "PERSONAL", "Personal Commitment"
    MEETING = "MEETING", "Internal Meeting"
    LEAVE = "LEAVE", "Leave / Travel"
    OTHER = "OTHER", "Other Professional Commitment"


class LawyerTimeBlock(models.Model):
    """Specific blocked time period for a lawyer (court hearings, internal meetings, etc.)."""

    lawyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="time_blocks",
        limit_choices_to={"role__in": LAWYER_ROLES},
    )
    date = models.DateField(help_text="Date of time block.")
    start_time = models.TimeField(help_text="Start time of block.")
    end_time = models.TimeField(help_text="End time of block.")
    reason = models.CharField(
        max_length=32,
        choices=TimeBlockReason.choices,
        default=TimeBlockReason.COURT,
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "start_time"]

    def __str__(self):
        return f"Block: {self.lawyer.full_name} on {self.date} ({self.start_time.strftime('%H:%M')}–{self.end_time.strftime('%H:%M')}) [{self.get_reason_display()}]"

