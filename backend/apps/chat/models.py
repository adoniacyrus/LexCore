from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class CaseConversation(models.Model):
    """
    Represents a conversation container tied strictly one-to-one to a legal Case.
    """

    case = models.OneToOneField(
        "cases.Case",
        on_delete=models.CASCADE,
        related_name="conversation",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_case_conversations"
        verbose_name = "Case Conversation"
        verbose_name_plural = "Case Conversations"

    def __str__(self):
        return f"Conversation for {self.case.case_reference}"


class CaseMessage(models.Model):
    """
    Represents a single message sent within a CaseConversation.
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
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "chat_case_messages"
        ordering = ["created_at"]
        verbose_name = "Case Message"
        verbose_name_plural = "Case Messages"
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(content__regex=r"^\s*$"),
                name="chat_message_content_not_empty_or_whitespace",
            ),
        ]

    def clean(self):
        super().clean()
        if not self.content or not self.content.strip():
            raise ValidationError(
                {"content": "Message content cannot be empty or whitespace-only."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Message {self.id} from {self.sender} in {self.conversation}"
