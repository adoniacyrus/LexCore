"""
Consultation request model.

consultation_id (e.g. CONS-2026-0001) is the durable business reference used for
search, reporting, and future conversion into a legal case.
"""

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class PracticeArea(models.TextChoices):
    CIVIL = "CIVIL", "Civil Law"
    CORPORATE = "CORPORATE", "Corporate Law"
    CRIMINAL = "CRIMINAL", "Criminal Law"
    FAMILY = "FAMILY", "Family Law"
    PROPERTY = "PROPERTY", "Property Law"
    TAX = "TAX", "Tax & Compliance"


class ConsultationMode(models.TextChoices):
    OFFICE = "OFFICE", "Office Visit"
    PHONE = "PHONE", "Phone Call"
    VIDEO = "VIDEO", "Video Call"


class ConsultationStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
    CANCELLED = "CANCELLED", "Cancelled"
    COMPLETED = "COMPLETED", "Completed"


class Consultation(models.Model):
    """Client-submitted consultation request."""

    consultation_id = models.CharField(
        max_length=32,
        unique=True,
        db_index=True,
        editable=False,
        help_text="Auto-generated reference, e.g. CONS-2026-0001.",
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="consultations",
    )
    practice_area = models.CharField(
        max_length=32,
        choices=PracticeArea.choices,
        blank=True,
        null=True,
    )
    consultation_mode = models.CharField(
        max_length=16,
        choices=ConsultationMode.choices,
    )
    preferred_date = models.DateField()
    preferred_time = models.TimeField()
    subject = models.CharField(max_length=255)
    issue_summary = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=ConsultationStatus.choices,
        default=ConsultationStatus.PENDING,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["client", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
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

    def save(self, *args, **kwargs):
        if not self.consultation_id:
            with transaction.atomic():
                self.consultation_id = self.next_consultation_id()
                return super().save(*args, **kwargs)
        return super().save(*args, **kwargs)
