import uuid
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class CaseType(models.TextChoices):
    CIVIL = "CIVIL", "Civil"
    CRIMINAL = "CRIMINAL", "Criminal"
    FAMILY = "FAMILY", "Family"
    PROPERTY = "PROPERTY", "Property"
    CORPORATE = "CORPORATE", "Corporate"
    CONSUMER = "CONSUMER", "Consumer"
    TAX = "TAX", "Tax"
    OTHER = "OTHER", "Other"


class CaseStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    ON_HOLD = "ON_HOLD", "On Hold"
    CLOSED = "CLOSED", "Closed"
    ARCHIVED = "ARCHIVED", "Archived"


class MatterCategory(models.TextChoices):
    ADVISORY = "ADVISORY", "Advisory"
    DOCUMENTATION = "DOCUMENTATION", "Documentation"
    COMPLIANCE = "COMPLIANCE", "Compliance"
    LEGAL_NOTICE = "LEGAL_NOTICE", "Legal Notice"
    MEDIATION = "MEDIATION", "Mediation"
    POLICE_MATTER = "POLICE_MATTER", "Police Matter"
    COURT_LITIGATION = "COURT_LITIGATION", "Court Litigation"
    APPEAL = "APPEAL", "Appeal"
    ARBITRATION = "ARBITRATION", "Arbitration"
    EXECUTION = "EXECUTION", "Execution"
    RETAINER = "RETAINER", "Retainer"


class MatterStage(models.TextChoices):
    CONSULTATION = "CONSULTATION", "Consultation"
    UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
    PRE_LITIGATION = "PRE_LITIGATION", "Pre-Litigation"
    NOTICE_ISSUED = "NOTICE_ISSUED", "Notice Issued"
    FIR_REGISTERED = "FIR_REGISTERED", "FIR Registered"
    INVESTIGATION = "INVESTIGATION", "Investigation"
    COURT_PROCEEDINGS = "COURT_PROCEEDINGS", "Court Proceedings"
    APPEAL_PROCEEDINGS = "APPEAL_PROCEEDINGS", "Appeal Proceedings"
    SETTLEMENT = "SETTLEMENT", "Settlement"
    RESOLVED = "RESOLVED", "Resolved"
    CLOSED = "CLOSED", "Closed"
    ARCHIVED = "ARCHIVED", "Archived"


class Case(models.Model):
    """
    Law-firm-side Case representation, originating from a client consultation.
    """

    case_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )
    case_reference = models.CharField(
        max_length=32,
        unique=True,
        db_index=True,
        editable=False,
        help_text="Auto-generated reference, e.g. CASE-2026-0001.",
    )
    originating_consultation = models.OneToOneField(
        "consultations.Consultation",
        on_delete=models.CASCADE,
        related_name="case",
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cases",
    )
    practice_area = models.ForeignKey(
        "consultations.PracticeArea",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cases",
    )
    responsible_lawyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="responsible_cases",
    )
    supervising_lawyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervised_cases",
    )
    supporting_paralegal = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supporting_cases",
    )
    assistant_lawyers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="assistant_cases",
        blank=True,
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    case_type = models.CharField(
        max_length=32,
        choices=CaseType.choices,
    )
    status = models.CharField(
        max_length=20,
        choices=CaseStatus.choices,
        default=CaseStatus.OPEN,
        db_index=True,
    )
    matter_category = models.CharField(
        max_length=50,
        choices=MatterCategory.choices,
        default=MatterCategory.COURT_LITIGATION,
        db_index=True,
    )
    matter_stage = models.CharField(
        max_length=50,
        choices=MatterStage.choices,
        default=MatterStage.UNDER_REVIEW,
        db_index=True,
    )
    start_date = models.DateField()

    # Optional court related fields
    court = models.CharField(max_length=255, blank=True, default="")
    jurisdiction = models.CharField(max_length=255, blank=True, default="")
    bench = models.CharField(max_length=255, blank=True, default="")
    location = models.CharField(max_length=255, blank=True, default="")
    cnr_number = models.CharField(max_length=50, blank=True, default="")
    filing_number = models.CharField(max_length=50, blank=True, default="")
    registration_number = models.CharField(max_length=50, blank=True, default="")
    official_court_reference = models.CharField(max_length=255, blank=True, default="")

    appointment_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Lawyer-configured fee in INR for appointments on this case.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["client", "-created_at"]),
            models.Index(fields=["responsible_lawyer", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.case_reference} — {self.title}"

    @classmethod
    def next_case_reference(cls) -> str:
        """
        Next CASE-YYYY-#### for the current year.
        Must be called inside transaction.atomic() with a row lock held.
        """
        year = timezone.localdate().year
        prefix = f"CASE-{year}-"
        last = (
            cls.objects.select_for_update()
            .filter(case_reference__startswith=prefix)
            .order_by("-case_reference")
            .first()
        )
        if last:
            try:
                seq = int(last.case_reference.rsplit("-", 1)[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:04d}"

    def save(self, *args, **kwargs):
        if not self.case_reference:
            with transaction.atomic():
                self.case_reference = self.next_case_reference()
                return super().save(*args, **kwargs)
        return super().save(*args, **kwargs)


class CaseActivity(models.Model):
    """
    Timeline/Activity feed log for Case modifications.
    """
    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    activity_type = models.CharField(max_length=64)
    description = models.TextField()
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.case.case_reference} - {self.activity_type} - {self.created_at}"


class CourtProceeding(models.Model):
    """
    Case proceedings detailing event records and scheduled hearings.
    """
    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="proceedings",
    )
    event_date = models.DateField()
    event_type = models.CharField(max_length=100)
    court_name = models.CharField(max_length=255)
    bench = models.CharField(max_length=255, blank=True, default="")
    next_hearing_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-event_date", "-created_at"]

    def __str__(self):
        return f"{self.case.case_reference} - {self.event_type} on {self.event_date}"

    @property
    def hearing_status(self):
        if not self.next_hearing_date:
            return None
        from django.utils import timezone
        today = timezone.localdate()
        if self.next_hearing_date > today:
            return "UPCOMING"
        elif self.next_hearing_date == today:
            return "TODAY"
        else:
            newer_exists = CourtProceeding.objects.filter(
                case=self.case,
                event_date__gt=self.event_date
            ).exclude(pk=self.pk).exists()
            if newer_exists:
                return "COMPLETED"
            return "MISSED"


class Notification(models.Model):
    """
    User alerts for scheduled hearings.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    proceeding = models.ForeignKey(
        CourtProceeding,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )
    alert_type = models.CharField(max_length=50, blank=True, default="")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("user", "proceeding", "alert_type")

    def __str__(self):
        return f"{self.user.email} - {self.title} - {self.created_at}"


