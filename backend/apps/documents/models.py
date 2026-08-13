import uuid
from django.conf import settings
from django.db import models


class DocumentCategory(models.TextChoices):
    CLIENT_DOCUMENT = "CLIENT_DOCUMENT", "Client Document"
    LEGAL_DOCUMENT = "LEGAL_DOCUMENT", "Legal Document"
    EVIDENCE = "EVIDENCE", "Evidence"
    COURT_DOCUMENT = "COURT_DOCUMENT", "Court Document"
    OTHER = "OTHER", "Other"


class Document(models.Model):
    """
    Model representing case-specific documents, pleadings, and evidence files.
    """
    document_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )
    case = models.ForeignKey(
        "cases.Case",
        on_delete=models.CASCADE,
        related_name="documents",
    )
    task = models.ForeignKey(
        "tasks.CaseTask",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="uploaded_documents",
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="cases/documents/")
    category = models.CharField(
        max_length=32,
        choices=DocumentCategory.choices,
        default=DocumentCategory.OTHER,
        db_index=True,
    )
    description = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.get_category_display()})"
