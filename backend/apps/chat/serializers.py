from rest_framework import serializers
from .models import CaseConversation, CaseMessage


class CaseMessageSerializer(serializers.ModelSerializer):
    """
    Read serializer for CaseMessage instances. Exposes only safe, relevant fields.
    """

    sender_id = serializers.IntegerField(source="sender.id", read_only=True)
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.CharField(source="sender.role", read_only=True)

    class Meta:
        model = CaseMessage
        fields = [
            "id",
            "sender_id",
            "sender_name",
            "sender_role",
            "content",
            "created_at",
        ]
        read_only_fields = fields

    def get_sender_name(self, obj) -> str:
        return obj.sender.full_name or obj.sender.email


class CaseMessageCreateSerializer(serializers.ModelSerializer):
    """
    Write serializer for creating a CaseMessage.
    Explicitly refuses sender or case from the request payload.
    """

    content = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        max_length=10000,
    )

    class Meta:
        model = CaseMessage
        fields = ["content"]

    def validate_content(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Message content cannot be empty or whitespace-only.")
        return stripped
