"""Serializers for consultation workflow APIs."""

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User

from .models import (
    LAWYER_ROLES,
    Consultation,
    ConsultationMode,
    ConsultationPaymentStatus,
    ConsultationStatus,
    PracticeArea,
)


GENERAL_CONSULTATION_NAME = "General Consultation"


class PracticeAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeArea
        fields = (
            "id",
            "name",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PracticeAreaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeArea
        fields = ("name", "description", "is_active")

    def validate_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name is required.")
        qs = PracticeArea.objects.filter(name__iexact=name)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A practice area with this name already exists."
            )
        return name


class LawyerBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name", "email", "role")
        read_only_fields = fields


class ClientBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name", "email", "phone_number")
        read_only_fields = fields


class ConsultationSerializer(serializers.ModelSerializer):
    """Unified read serializer for client, admin, and lawyer views."""

    practice_area = PracticeAreaSerializer(read_only=True)
    practice_area_id = serializers.IntegerField(
        source="practice_area.id",
        read_only=True,
        allow_null=True,
    )
    practice_area_label = serializers.SerializerMethodField()
    consultation_mode_label = serializers.CharField(
        source="get_consultation_mode_display",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    payment_status_label = serializers.CharField(
        source="get_payment_status_display",
        read_only=True,
    )
    client = ClientBriefSerializer(read_only=True)
    assigned_lawyer = LawyerBriefSerializer(read_only=True)
    assigned_lawyer_name = serializers.SerializerMethodField()
    case_id = serializers.SerializerMethodField()
    case_reference = serializers.SerializerMethodField()
    fee_amount = serializers.SerializerMethodField()

    class Meta:
        model = Consultation
        fields = (
            "id",
            "consultation_id",
            "client",
            "practice_area",
            "practice_area_id",
            "practice_area_label",
            "assigned_lawyer",
            "assigned_lawyer_name",
            "consultation_mode",
            "consultation_mode_label",
            "preferred_date",
            "preferred_time",
            "subject",
            "issue_summary",
            "status",
            "status_label",
            "payment_status",
            "payment_status_label",
            "fee_amount",
            "case_id",
            "case_reference",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_fee_amount(self, obj):
        latest_payment = getattr(obj, "payments", None)
        if latest_payment is not None:
            first_p = latest_payment.order_by("-created_at").first()
            if first_p:
                return first_p.amount_rupees
        from django.conf import settings
        return getattr(settings, "RAZORPAY_DEFAULT_CONSULTATION_FEE", 500)

    def get_practice_area_label(self, obj):
        if obj.practice_area_id and obj.practice_area:
            return obj.practice_area.name
        return "To be assigned"

    def get_assigned_lawyer_name(self, obj):
        if obj.assigned_lawyer_id and obj.assigned_lawyer:
            return obj.assigned_lawyer.full_name
        return "Not Assigned"

    def get_case_id(self, obj):
        try:
            if hasattr(obj, "case") and obj.case:
                return obj.case.id
        except Exception:
            pass
        return None

    def get_case_reference(self, obj):
        try:
            if hasattr(obj, "case") and obj.case:
                return obj.case.case_reference
        except Exception:
            pass
        return None


class ConsultationCreateSerializer(serializers.Serializer):
    """Create a consultation request for the authenticated client."""

    knows_practice_area = serializers.BooleanField(required=True)
    practice_area = serializers.PrimaryKeyRelatedField(
        queryset=PracticeArea.objects.filter(is_active=True),
        required=False,
        allow_null=True,
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

    def validate(self, attrs):
        knows = attrs.get("knows_practice_area")
        practice_area = attrs.get("practice_area")

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
            # Clients should not self-select General Consultation as a specialty.
            if practice_area.is_general:
                raise serializers.ValidationError(
                    {
                        "practice_area": (
                            "Please select a specific practice area, "
                            "or choose “I'm not sure”."
                        )
                    }
                )
        else:
            practice_area = None

        attrs["practice_area"] = practice_area
        attrs["issue_summary"] = (attrs.get("issue_summary") or "").strip()
        return attrs

    def create(self, validated_data):
        validated_data.pop("knows_practice_area", None)
        client = self.context["request"].user
        return Consultation.objects.create(
            client=client,
            payment_status=ConsultationPaymentStatus.PENDING,
            **validated_data,
        )


class AdminConsultationUpdateSerializer(serializers.Serializer):
    """Admin assignment and lifecycle updates."""

    practice_area = serializers.PrimaryKeyRelatedField(
        queryset=PracticeArea.objects.all(),
        required=False,
        allow_null=True,
    )
    assigned_lawyer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(
            role__in=LAWYER_ROLES,
            is_active=True,
        ),
        required=False,
        allow_null=True,
    )
    status = serializers.ChoiceField(
        choices=ConsultationStatus.choices,
        required=False,
    )

    def validate_status(self, value):
        allowed = {
            ConsultationStatus.PENDING,
            ConsultationStatus.UNDER_REVIEW,
            ConsultationStatus.APPROVED,
            ConsultationStatus.REJECTED,
            ConsultationStatus.CANCELLED,
            ConsultationStatus.COMPLETED,
            ConsultationStatus.ACCEPTED,
        }
        if value not in allowed:
            raise serializers.ValidationError("Invalid status.")
        return value

    def validate(self, attrs):
        consultation = self.instance
        if consultation and consultation.payment_status != ConsultationPaymentStatus.PAID:
            raise serializers.ValidationError(
                "Cannot review or assign an unpaid consultation. Payment must be captured first."
            )
        practice_area = attrs.get(
            "practice_area",
            consultation.practice_area if consultation else None,
        )
        lawyer = attrs.get("assigned_lawyer", serializers.empty)

        if lawyer is not serializers.empty and lawyer is not None:
            target_area = practice_area
            if target_area is None:
                target_area = PracticeArea.objects.filter(
                    name__iexact=GENERAL_CONSULTATION_NAME,
                    is_active=True,
                ).first()
                if target_area is None:
                    raise serializers.ValidationError(
                        {
                            "assigned_lawyer": (
                                "Assign a practice area first, or ensure "
                                "General Consultation exists."
                            )
                        }
                    )
            if not lawyer.practice_areas.filter(pk=target_area.pk).exists():
                raise serializers.ValidationError(
                    {
                        "assigned_lawyer": (
                            f"{lawyer.full_name} is not specialized in "
                            f"{target_area.name}."
                        )
                    }
                )

        return attrs

    def update(self, instance, validated_data):
        if "practice_area" in validated_data:
            new_area = validated_data["practice_area"]
            if (
                instance.practice_area_id
                and new_area
                and instance.practice_area_id != new_area.id
                and instance.assigned_lawyer_id
            ):
                # Clear lawyer if they no longer match the new practice area.
                if not instance.assigned_lawyer.practice_areas.filter(
                    pk=new_area.id
                ).exists():
                    instance.assigned_lawyer = None
            elif new_area is None and instance.assigned_lawyer_id:
                general = PracticeArea.objects.filter(
                    name__iexact=GENERAL_CONSULTATION_NAME
                ).first()
                if general and not instance.assigned_lawyer.practice_areas.filter(
                    pk=general.pk
                ).exists():
                    instance.assigned_lawyer = None
            instance.practice_area = new_area

        if "assigned_lawyer" in validated_data:
            instance.assigned_lawyer = validated_data["assigned_lawyer"]

        if "status" in validated_data:
            instance.status = validated_data["status"]

        instance.save()
        return instance


class LawyerStatusUpdateSerializer(serializers.Serializer):
    """Lawyer-only status transitions for assigned consultations."""

    status = serializers.ChoiceField(
        choices=[
            ConsultationStatus.ACCEPTED,
            ConsultationStatus.COMPLETED,
            ConsultationStatus.CANCELLED,
        ]
    )

    def validate(self, attrs):
        consultation = self.instance
        new_status = attrs["status"]
        current = consultation.status

        allowed = {
            ConsultationStatus.PENDING: {
                ConsultationStatus.ACCEPTED,
                ConsultationStatus.CANCELLED,
            },
            ConsultationStatus.UNDER_REVIEW: {
                ConsultationStatus.ACCEPTED,
                ConsultationStatus.CANCELLED,
            },
            ConsultationStatus.APPROVED: {
                ConsultationStatus.ACCEPTED,
                ConsultationStatus.CANCELLED,
            },
            ConsultationStatus.ACCEPTED: {
                ConsultationStatus.COMPLETED,
                ConsultationStatus.CANCELLED,
            },
        }
        next_allowed = allowed.get(current, set())
        if new_status not in next_allowed:
            raise serializers.ValidationError(
                {
                    "status": (
                        f"Cannot change status from {consultation.get_status_display()} "
                        f"to {dict(ConsultationStatus.choices).get(new_status, new_status)}."
                    )
                }
            )
        return attrs

    def update(self, instance, validated_data):
        instance.status = validated_data["status"]
        instance.save(update_fields=["status", "updated_at"])
        return instance


def eligible_lawyers_queryset(practice_area=None):
    """
    Lawyers specialized in the given practice area.
    When practice area is empty, use General Consultation specialists.
    """
    base = User.objects.filter(
        role__in=LAWYER_ROLES,
        is_active=True,
    ).order_by("full_name")

    if practice_area is not None:
        return base.filter(practice_areas=practice_area).distinct()

    general = PracticeArea.objects.filter(
        name__iexact=GENERAL_CONSULTATION_NAME,
        is_active=True,
    ).first()
    if general is None:
        return base.none()
    return base.filter(practice_areas=general).distinct()
