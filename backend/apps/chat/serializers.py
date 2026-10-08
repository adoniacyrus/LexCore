from rest_framework import serializers
from .models import CaseConversation, CaseMessage


class CaseMessageSerializer(serializers.ModelSerializer):
    """
    Read serializer for CaseMessage instances. Exposes safe fields including
    conversation type, text content, and attachment details.
    """

    sender_id = serializers.IntegerField(source="sender.id", read_only=True)
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.CharField(source="sender.role", read_only=True)
    conversation_type = serializers.CharField(source="conversation.conversation_type", read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = CaseMessage
        fields = [
            "id",
            "sender_id",
            "sender_name",
            "sender_role",
            "conversation_type",
            "content",
            "attachment",
            "attachment_url",
            "attachment_name",
            "attachment_size",
            "attachment_type",
            "created_at",
        ]
        read_only_fields = fields

    def get_sender_name(self, obj) -> str:
        return obj.sender.full_name or obj.sender.email

    def get_attachment_url(self, obj) -> str | None:
        if obj.attachment:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None


class CaseMessageCreateSerializer(serializers.ModelSerializer):
    """
    Write serializer for creating a CaseMessage.
    Accepts text content, file/image attachment, or both.
    """

    content = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        trim_whitespace=True,
        max_length=10000,
    )
    attachment = serializers.FileField(
        required=False,
        allow_null=True,
    )

    class Meta:
        model = CaseMessage
        fields = ["content", "attachment"]

    def validate(self, attrs):
        content = attrs.get("content", "").strip()
        attachment = attrs.get("attachment")
        if not content and not attachment:
            raise serializers.ValidationError("Message content cannot be empty unless an attachment is provided.")
        attrs["content"] = content
        return attrs
