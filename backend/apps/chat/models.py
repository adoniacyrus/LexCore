from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class ConversationType(models.TextChoices):
    CLIENT_LAWYER = "CLIENT_LAWYER", "Client Lawyer"
    TEAM = "TEAM", "Team"


class CaseConversation(models.Model):
    """
    Represents a conversation container tied to a legal Case and conversation type.
    Each Case can have exactly one CLIENT_LAWYER conversation and one TEAM conversation.
    """

    case = models.ForeignKey(
        "cases.Case",
        on_delete=models.CASCADE,
        related_name="conversations",
    )
    conversation_type = models.CharField(
        max_length=20,
        choices=ConversationType.choices,
        default=ConversationType.CLIENT_LAWYER,
        db_index=True,
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_case_conversations"
        verbose_name = "Case Conversation"
        verbose_name_plural = "Case Conversations"
        constraints = [
            models.UniqueConstraint(
                fields=["case", "conversation_type"],
                name="unique_case_conversation_type",
            ),
        ]

    def __str__(self):
        return f"{self.conversation_type} conversation for {self.case.case_reference}"


import mimetypes
import os


class CaseMessage(models.Model):
    """
    Represents a single message sent within a CaseConversation.
    Can contain text content, an attached file/image, or both.
    """

    conversation = models.ForeignKey(
        CaseConversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sent_case_messages",
    )
    content = models.TextField(blank=True, default="")
    attachment = models.FileField(
        upload_to="chat/attachments/",
        blank=True,
        null=True,
    )
    attachment_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )
    attachment_size = models.PositiveIntegerField(
        null=True,
        blank=True,
    )
    attachment_type = models.CharField(
        max_length=120,
        blank=True,
        default="",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "chat_case_messages"
        ordering = ["created_at"]
        verbose_name = "Case Message"
        verbose_name_plural = "Case Messages"
        constraints = [
            models.CheckConstraint(
                condition=(
                    ~models.Q(content__regex=r"^\s*$")
                    | (models.Q(attachment__isnull=False) & ~models.Q(attachment=""))
                ),
                name="chat_message_content_or_attachment_required",
            ),
        ]

    def clean(self):
        super().clean()
        has_content = bool(self.content and self.content.strip())
        has_attachment = bool(self.attachment)
        if not has_content and not has_attachment:
            raise ValidationError(
                {"content": "Message content cannot be empty unless an attachment is provided."}
            )

    def save(self, *args, **kwargs):
        if self.attachment:
            if not self.attachment_name:
                self.attachment_name = os.path.basename(self.attachment.name)
            if not self.attachment_size:
                try:
                    self.attachment_size = self.attachment.size
                except Exception:
                    pass
            if not self.attachment_type:
                guessed, _ = mimetypes.guess_type(self.attachment_name)
                self.attachment_type = guessed or "application/octet-stream"

        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Message {self.id} from {self.sender} in {self.conversation}"
