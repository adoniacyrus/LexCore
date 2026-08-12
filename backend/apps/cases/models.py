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
    supporting_paralegal = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supporting_cases",
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
