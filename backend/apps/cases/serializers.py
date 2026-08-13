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
    assistant_lawyers = UserBriefSerializer(many=True, read_only=True)
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
            "assistant_lawyers",
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


class LawyerBriefSerializer(serializers.ModelSerializer):
    practice_areas = PracticeAreaBriefSerializer(many=True, read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = ("id", "full_name", "email", "role", "role_label", "practice_areas")
        read_only_fields = fields


class CaseTeamUpdateSerializer(serializers.ModelSerializer):
    responsible_lawyer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(
            role__in=(UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER),
            is_active=True,
        ),
        required=False,
    )
    supporting_paralegal = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=UserRole.PARALEGAL, is_active=True),
        required=False,
        allow_null=True,
    )
    assistant_lawyers = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(
            role__in=(UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER),
            is_active=True,
        ),
        many=True,
        required=False,
    )

    class Meta:
        model = Case
        fields = ("responsible_lawyer", "supporting_paralegal", "assistant_lawyers")

    def validate_responsible_lawyer(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign an inactive lawyer.")
        if value.role not in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            raise serializers.ValidationError("Assigned user must be a lawyer.")
        return value

    def validate_supporting_paralegal(self, value):
        if value is not None:
            if not value.is_active:
                raise serializers.ValidationError("Cannot assign an inactive paralegal.")
            if value.role != UserRole.PARALEGAL:
                raise serializers.ValidationError("Assigned user must be a paralegal.")
        return value

    def validate_assistant_lawyers(self, value):
        request = self.context.get("request")
        if request and "assistant_lawyers" in request.data:
            raw_ids = request.data["assistant_lawyers"]
            if isinstance(raw_ids, list) and len(raw_ids) != len(set(raw_ids)):
                raise serializers.ValidationError("Duplicate assistant lawyers are not allowed.")
        return value

    def validate(self, attrs):
        resp_lawyer = attrs.get("responsible_lawyer")
        if resp_lawyer is None and self.instance:
            resp_lawyer = self.instance.responsible_lawyer

        assistant_lawyers = attrs.get("assistant_lawyers")
        if assistant_lawyers is not None and resp_lawyer in assistant_lawyers:
            raise serializers.ValidationError(
                {"assistant_lawyers": "The responsible lawyer is already the lead lawyer for this case."}
            )
        return attrs

    def update(self, instance, validated_data):
        responsible_lawyer = validated_data.get("responsible_lawyer")
        assistant_lawyers = validated_data.get("assistant_lawyers")

        if responsible_lawyer and responsible_lawyer != instance.responsible_lawyer:
            instance.responsible_lawyer = responsible_lawyer

        if "supporting_paralegal" in validated_data:
            instance.supporting_paralegal = validated_data["supporting_paralegal"]

        instance.save()

        if assistant_lawyers is not None:
            # Filter out the responsible lawyer to be absolutely safe
            assistant_lawyers = [al for al in assistant_lawyers if al != instance.responsible_lawyer]
            instance.assistant_lawyers.set(assistant_lawyers)
        else:
            if responsible_lawyer and instance.assistant_lawyers.filter(pk=responsible_lawyer.pk).exists():
                instance.assistant_lawyers.remove(responsible_lawyer)

        return instance
