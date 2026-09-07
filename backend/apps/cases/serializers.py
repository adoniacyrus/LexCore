from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import UserRole
from apps.consultations.models import Consultation, ConsultationStatus, PracticeArea
from .models import Case, CaseStatus, CaseType, MatterCategory, MatterStage, CaseActivity, CourtProceeding, Notification

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


class CaseActivitySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = CaseActivity
        fields = ("id", "activity_type", "description", "user_name", "created_at")
        read_only_fields = fields


class CourtProceedingSerializer(serializers.ModelSerializer):
    case_reference = serializers.CharField(source="case.case_reference", read_only=True)
    case_title = serializers.CharField(source="case.title", read_only=True)
    responsible_lawyer_name = serializers.CharField(source="case.responsible_lawyer.full_name", read_only=True)
    hearing_status = serializers.CharField(read_only=True)

    class Meta:
        model = CourtProceeding
        fields = (
            "id",
            "case",
            "case_reference",
            "case_title",
            "responsible_lawyer_name",
            "event_date",
            "event_type",
            "court_name",
            "bench",
            "next_hearing_date",
            "notes",
            "hearing_status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "user", "title", "message", "is_read", "created_at")
        read_only_fields = ("id", "user", "created_at")


class CaseSerializer(serializers.ModelSerializer):
    client = UserBriefSerializer(read_only=True)
    responsible_lawyer = UserBriefSerializer(read_only=True)
    supervising_lawyer = UserBriefSerializer(read_only=True)
    supporting_paralegal = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=UserRole.PARALEGAL, is_active=True),
        required=False,
        allow_null=True,
    )
    assistant_lawyers = UserBriefSerializer(many=True, read_only=True)
    activities = CaseActivitySerializer(many=True, read_only=True)
    practice_area = PracticeAreaBriefSerializer(read_only=True)
    proceedings = CourtProceedingSerializer(many=True, read_only=True)
    upcoming_hearing = serializers.SerializerMethodField()

    def get_upcoming_hearing(self, obj):
        from django.utils import timezone
        today = timezone.localdate()
        p = obj.proceedings.filter(next_hearing_date__gte=today).order_by("next_hearing_date").first()
        if p:
            return {
                "id": p.id,
                "next_hearing_date": p.next_hearing_date,
                "court_name": p.court_name,
                "bench": p.bench,
            }
        return None
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
    matter_category_label = serializers.CharField(
        source="get_matter_category_display",
        read_only=True,
    )
    matter_stage_label = serializers.CharField(
        source="get_matter_stage_display",
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
            "supervising_lawyer",
            "originating_consultation",
            "assistant_lawyers",
            "activities",
            "proceedings",
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
    matter_category = serializers.ChoiceField(
        choices=MatterCategory.choices,
        required=True,
    )
    matter_stage = serializers.ChoiceField(
        choices=MatterStage.choices,
        required=True,
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
            "matter_category",
            "matter_stage",
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
    supervising_lawyer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(
            role__in=(UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER),
            is_active=True,
        ),
        required=False,
        allow_null=True,
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
        fields = ("responsible_lawyer", "supervising_lawyer", "supporting_paralegal", "assistant_lawyers")

    def validate_responsible_lawyer(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign an inactive lawyer.")
        if value.role not in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            raise serializers.ValidationError("Assigned user must be a lawyer.")
        return value

    def validate_supervising_lawyer(self, value):
        if value is not None:
            if not value.is_active:
                raise serializers.ValidationError("Cannot assign an inactive lawyer.")
            if value.role != UserRole.SENIOR_LAWYER:
                raise serializers.ValidationError("Only Senior Advocates can act as Supervising Lawyers.")
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

        # Validation Rule: Senior Advocates cannot be assigned as Assistant Lawyers to a Junior-led matter
        if resp_lawyer and resp_lawyer.role == UserRole.JUNIOR_LAWYER:
            assistant_lawyers = attrs.get("assistant_lawyers")
            if assistant_lawyers is not None:
                for al in assistant_lawyers:
                    if al.role == UserRole.SENIOR_LAWYER:
                        raise serializers.ValidationError(
                            {"assistant_lawyers": "Senior Advocates cannot be assigned as Assistant Lawyers to a Junior-led matter. Assign them as Supervising Lawyer instead."}
                        )

        # Basic validations to prevent overlap in roles
        assistant_lawyers = attrs.get("assistant_lawyers")
        if assistant_lawyers is not None and resp_lawyer in assistant_lawyers:
            raise serializers.ValidationError(
                {"assistant_lawyers": "The responsible lawyer is already the lead lawyer for this case."}
            )

        supervising_lawyer = attrs.get("supervising_lawyer")
        if supervising_lawyer is None and self.instance:
            supervising_lawyer = self.instance.supervising_lawyer

        if supervising_lawyer:
            if resp_lawyer and supervising_lawyer == resp_lawyer:
                raise serializers.ValidationError(
                    {"supervising_lawyer": "The supervising lawyer cannot be the responsible lawyer."}
                )
            if assistant_lawyers is not None and supervising_lawyer in assistant_lawyers:
                raise serializers.ValidationError(
                    {"supervising_lawyer": "The supervising lawyer cannot be an assistant lawyer."}
                )

        return attrs

    def update(self, instance, validated_data):
        responsible_lawyer = validated_data.get("responsible_lawyer")
        supervising_lawyer = validated_data.get("supervising_lawyer")
        assistant_lawyers = validated_data.get("assistant_lawyers")

        # Track changes for timeline
        request = self.context.get("request")
        user = request.user if request else None

        old_supervising = instance.supervising_lawyer
        old_assistants = set(instance.assistant_lawyers.all())

        if responsible_lawyer and responsible_lawyer != instance.responsible_lawyer:
            instance.responsible_lawyer = responsible_lawyer

        if "supervising_lawyer" in validated_data:
            new_supervising = validated_data["supervising_lawyer"]
            if old_supervising != new_supervising:
                instance.supervising_lawyer = new_supervising
                if old_supervising is None:
                    CaseActivity.objects.create(
                        case=instance,
                        activity_type="SUPERVISING_COUNSEL_ASSIGNED",
                        description=f"Supervising Counsel Assigned: {new_supervising.full_name}",
                        user=user,
                    )
                elif new_supervising is None:
                    CaseActivity.objects.create(
                        case=instance,
                        activity_type="SUPERVISING_COUNSEL_CHANGED",
                        description=f"Supervising Counsel Removed (previously {old_supervising.full_name})",
                        user=user,
                    )
                else:
                    CaseActivity.objects.create(
                        case=instance,
                        activity_type="SUPERVISING_COUNSEL_CHANGED",
                        description=f"Supervising Counsel Changed from {old_supervising.full_name} to {new_supervising.full_name}",
                        user=user,
                    )

        if "supporting_paralegal" in validated_data:
            instance.supporting_paralegal = validated_data["supporting_paralegal"]

        instance.save()

        if assistant_lawyers is not None:
            # Filter out responsible and supervising lawyers to be safe
            assistant_lawyers = [al for al in assistant_lawyers if al != instance.responsible_lawyer]
            if instance.supervising_lawyer:
                assistant_lawyers = [al for al in assistant_lawyers if al != instance.supervising_lawyer]
            
            new_assistants = set(assistant_lawyers)
            instance.assistant_lawyers.set(assistant_lawyers)

            added_assistants = new_assistants - old_assistants
            removed_assistants = old_assistants - new_assistants

            for al in added_assistants:
                CaseActivity.objects.create(
                    case=instance,
                    activity_type="ASSISTANT_LAWYER_ADDED",
                    description=f"Assistant Lawyer Added: {al.full_name}",
                    user=user,
                )
            for al in removed_assistants:
                CaseActivity.objects.create(
                    case=instance,
                    activity_type="ASSISTANT_LAWYER_REMOVED",
                    description=f"Assistant Lawyer Removed: {al.full_name}",
                    user=user,
                )
        else:
            if responsible_lawyer and instance.assistant_lawyers.filter(pk=responsible_lawyer.pk).exists():
                instance.assistant_lawyers.remove(responsible_lawyer)
                CaseActivity.objects.create(
                    case=instance,
                    activity_type="ASSISTANT_LAWYER_REMOVED",
                    description=f"Assistant Lawyer Removed: {responsible_lawyer.full_name}",
                    user=user,
                )
            if instance.supervising_lawyer and instance.assistant_lawyers.filter(pk=instance.supervising_lawyer.pk).exists():
                instance.assistant_lawyers.remove(instance.supervising_lawyer)
                CaseActivity.objects.create(
                    case=instance,
                    activity_type="ASSISTANT_LAWYER_REMOVED",
                    description=f"Assistant Lawyer Removed: {instance.supervising_lawyer.full_name}",
                    user=user,
                )

        return instance


class CaseAppointmentFeeUpdateSerializer(serializers.Serializer):
    appointment_fee = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=0,
        required=True,
    )

    def update(self, instance, validated_data):
        old_fee = instance.appointment_fee
        new_fee = validated_data["appointment_fee"]
        instance.appointment_fee = new_fee
        instance.save(update_fields=["appointment_fee", "updated_at"])

        user = self.context.get("request").user if "request" in self.context else None
        old_display = f"₹{old_fee}" if old_fee is not None else "Not set"
        CaseActivity.objects.create(
            case=instance,
            activity_type="FEE_CHANGED",
            description=f"Appointment fee updated from {old_display} to ₹{new_fee}",
            user=user,
        )
        return instance

