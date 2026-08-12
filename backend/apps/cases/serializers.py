from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import UserRole
from apps.consultations.models import Consultation, ConsultationStatus, PracticeArea
from .models import Case, CaseStatus, CaseType

User = get_user_model()


class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name", "email", "phone_number", "role")
        read_only_fields = fields


class PracticeAreaBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeArea
        fields = ("id", "name")
        read_only_fields = fields


class CaseSerializer(serializers.ModelSerializer):
    client = UserBriefSerializer(read_only=True)
    responsible_lawyer = UserBriefSerializer(read_only=True)
    supporting_paralegal = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=UserRole.PARALEGAL, is_active=True),
        required=False,
        allow_null=True,
    )
    practice_area = PracticeAreaBriefSerializer(read_only=True)
    originating_consultation_ref = serializers.CharField(
        source="originating_consultation.consultation_id",
        read_only=True,
    )
    case_type_label = serializers.CharField(
        source="get_case_type_display",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    class Meta:
        model = Case
        fields = "__all__"
        read_only_fields = (
            "id",
            "case_id",
            "case_reference",
            "created_at",
            "updated_at",
            "client",
            "practice_area",
            "responsible_lawyer",
            "originating_consultation",
        )

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.supporting_paralegal:
            ret["supporting_paralegal"] = UserBriefSerializer(instance.supporting_paralegal).data
        else:
            ret["supporting_paralegal"] = None
        return ret


class CaseConvertSerializer(serializers.ModelSerializer):
    originating_consultation = serializers.PrimaryKeyRelatedField(
        queryset=Consultation.objects.all()
    )
    supporting_paralegal = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=UserRole.PARALEGAL, is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Case
        fields = (
            "originating_consultation",
            "title",
            "case_type",
            "start_date",
            "description",
            "supporting_paralegal",
            "court",
            "jurisdiction",
            "bench",
            "location",
            "cnr_number",
            "filing_number",
            "registration_number",
            "official_court_reference",
        )

    def validate_originating_consultation(self, value):
        request = self.context.get("request")
        user = request.user if request else None

        # Verify assigned lawyer matches the request user
        if value.assigned_lawyer != user:
            raise serializers.ValidationError(
                "You are not authorized to convert this consultation. Only the assigned advocate can perform this action."
            )

        # Verify consultation has a client and a practice area
        if not value.client:
            raise serializers.ValidationError(
                "This consultation does not have a client associated with it."
            )
        if not value.practice_area:
            raise serializers.ValidationError(
                "This consultation does not have a practice area associated with it."
            )

        # Verify consultation status permits conversion
        if value.status not in (ConsultationStatus.ACCEPTED, ConsultationStatus.COMPLETED):
            raise serializers.ValidationError(
                f"Consultation cannot be converted in its current status: '{value.get_status_display()}'. It must be Accepted or Completed."
            )

        # Verify not already converted
        if hasattr(value, "case") and value.case is not None:
            raise serializers.ValidationError(
                "This consultation has already been converted to a case."
            )

        return value

    def create(self, validated_data):
        consultation = validated_data["originating_consultation"]

        # Derive fields from the originating consultation
        validated_data["client"] = consultation.client
        validated_data["practice_area"] = consultation.practice_area
        validated_data["responsible_lawyer"] = consultation.assigned_lawyer

        # Create the Case
        return super().create(validated_data)
