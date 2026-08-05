"""Serializers for client consultation request APIs."""

from django.utils import timezone
from rest_framework import serializers

from .models import (
    Consultation,
    ConsultationMode,
    PracticeArea,
)


class ConsultationSerializer(serializers.ModelSerializer):
    """Read serializer for a client's consultation requests."""

    practice_area_label = serializers.SerializerMethodField()
    consultation_mode_label = serializers.CharField(
        source="get_consultation_mode_display",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    assigned_lawyer = serializers.SerializerMethodField()

    class Meta:
        model = Consultation
        fields = (
            "id",
            "consultation_id",
            "practice_area",
            "practice_area_label",
            "consultation_mode",
            "consultation_mode_label",
            "preferred_date",
            "preferred_time",
            "subject",
            "issue_summary",
            "status",
            "status_label",
            "assigned_lawyer",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_practice_area_label(self, obj):
        if not obj.practice_area:
            return "To be assigned"
        return obj.get_practice_area_display()

    def get_assigned_lawyer(self, obj):
        # Lawyer assignment is intentionally out of scope for this phase.
        return "Not Assigned"


class ConsultationCreateSerializer(serializers.Serializer):
    """Create a consultation request for the authenticated client."""

    knows_practice_area = serializers.BooleanField(required=True)
    practice_area = serializers.ChoiceField(
        choices=PracticeArea.choices,
        required=False,
        allow_null=True,
        allow_blank=True,
    )
    consultation_mode = serializers.ChoiceField(choices=ConsultationMode.choices)
    preferred_date = serializers.DateField()
    preferred_time = serializers.TimeField()
    subject = serializers.CharField(max_length=255)
    issue_summary = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    def validate_subject(self, value: str) -> str:
        subject = value.strip()
        if not subject:
            raise serializers.ValidationError("Subject is required.")
        return subject

    def validate_preferred_date(self, value):
        today = timezone.localdate()
        if value < today:
            raise serializers.ValidationError(
                "Preferred date cannot be before today."
            )
        return value

    def validate_preferred_time(self, value):
        if value is None:
            raise serializers.ValidationError("Preferred time is required.")
        return value

    def validate(self, attrs):
        knows = attrs.get("knows_practice_area")
        practice_area = attrs.get("practice_area") or None

        if knows:
            if not practice_area:
                raise serializers.ValidationError(
                    {
                        "practice_area": (
                            "Please select a practice area, or choose "
                            "“I'm not sure”."
                        )
                    }
                )
        else:
            # Explicitly clear when the client is unsure.
            practice_area = None

        attrs["practice_area"] = practice_area
        attrs["issue_summary"] = (attrs.get("issue_summary") or "").strip()
        return attrs

    def create(self, validated_data):
        validated_data.pop("knows_practice_area", None)
        client = self.context["request"].user
        return Consultation.objects.create(client=client, **validated_data)
