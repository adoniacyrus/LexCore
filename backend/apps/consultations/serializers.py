"""Serializers for consultation workflow APIs."""

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User

from .models import (
    LAWYER_ROLES,
    Consultation,
    ConsultationMode,
    ConsultationPaymentStatus,
    ConsultationStatus,
    ConsultationType,
    LawyerAvailabilityProfile,
    LawyerDateOverride,
    LawyerTimeBlock,
    LawyerWeeklySchedule,
    PracticeArea,
    TimeBlockReason,
    Weekday,
)
from .services.availability_service import AvailabilityService, _add_minutes_to_time


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

    consultation_type_label = serializers.CharField(
        source="get_consultation_type_display",
        read_only=True,
    )
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
    client_name = serializers.SerializerMethodField()
    assigned_lawyer = LawyerBriefSerializer(read_only=True)
    assigned_lawyer_name = serializers.SerializerMethodField()
    case_id = serializers.SerializerMethodField()
    case_reference = serializers.SerializerMethodField()
    case_appointment_id = serializers.SerializerMethodField()
    case_appointment_ref = serializers.SerializerMethodField()
    fee_amount = serializers.SerializerMethodField()

    class Meta:
        model = Consultation
        fields = (
            "id",
            "consultation_id",
            "consultation_type",
            "consultation_type_label",
            "client",
            "client_name",
            "practice_area",
            "practice_area_id",
            "practice_area_label",
            "assigned_lawyer",
            "assigned_lawyer_name",
            "consultation_mode",
            "consultation_mode_label",
            "preferred_date",
            "preferred_time",
            "duration_minutes",
            "end_time",
            "subject",
            "issue_summary",
            "status",
            "status_label",
            "payment_status",
            "payment_status_label",
            "charged_fee",
            "fee_amount",
            "case_id",
            "case_reference",
            "case_appointment_id",
            "case_appointment_ref",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_fee_amount(self, obj):
        if obj.charged_fee is not None:
            return obj.charged_fee
        latest_payment = getattr(obj, "payments", None)
        if latest_payment is not None:
            first_p = latest_payment.order_by("-created_at").first()
            if first_p:
                return first_p.amount_rupees
        from django.conf import settings
        return getattr(settings, "RAZORPAY_DEFAULT_CONSULTATION_FEE", 500)

    def get_client_name(self, obj):
        if obj.client:
            return obj.client.full_name
        return "—"

    def get_practice_area_label(self, obj):
        if obj.practice_area_id and obj.practice_area:
            return obj.practice_area.name
        return "To be assigned"

    def get_assigned_lawyer_name(self, obj):
        if obj.assigned_lawyer_id and obj.assigned_lawyer:
            return obj.assigned_lawyer.full_name
        return "Not Assigned"

    def get_case_id(self, obj):
        if obj.case_appointment_id:
            return obj.case_appointment_id
        try:
            if hasattr(obj, "case") and obj.case:
                return obj.case.id
        except Exception:
            pass
        return None

    def get_case_reference(self, obj):
        if obj.case_appointment_id and obj.case_appointment:
            return obj.case_appointment.case_reference
        try:
            if hasattr(obj, "case") and obj.case:
                return obj.case.case_reference
        except Exception:
            pass
        return None

    def get_case_appointment_id(self, obj):
        return obj.case_appointment_id

    def get_case_appointment_ref(self, obj):
        if obj.case_appointment_id and obj.case_appointment:
            return obj.case_appointment.case_reference
        return None


class ConsultationCreateSerializer(serializers.Serializer):
    """Create a consultation request or existing case appointment for the authenticated client."""

    consultation_type = serializers.ChoiceField(
        choices=ConsultationType.choices,
        default=ConsultationType.NEW_MATTER,
        required=False,
    )
    case_id = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    knows_practice_area = serializers.BooleanField(required=False, allow_null=True)
    practice_area = serializers.PrimaryKeyRelatedField(
        queryset=PracticeArea.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    consultation_mode = serializers.ChoiceField(choices=ConsultationMode.choices)
    preferred_date = serializers.DateField()
    preferred_time = serializers.TimeField()
    subject = serializers.CharField(max_length=255, required=False, allow_blank=True)
    issue_summary = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    def validate_preferred_date(self, value):
        today = timezone.localdate()
        if value < today:
            raise serializers.ValidationError(
                "Preferred date cannot be before today."
            )
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        client = getattr(request, "user", None)
        cons_type = attrs.get("consultation_type", ConsultationType.NEW_MATTER)

        if cons_type == ConsultationType.EXISTING_CASE:
            from apps.cases.models import Case, CaseStatus
            case_identifier = attrs.get("case_id")
            if not case_identifier:
                raise serializers.ValidationError(
                    {"case_id": "Please select an existing case for this appointment."}
                )

            # Find case by numeric PK, case_reference, or UUID
            case = None
            if str(case_identifier).isdigit():
                case = Case.objects.filter(pk=int(case_identifier)).select_related("responsible_lawyer", "client", "practice_area").first()
            if not case:
                case = Case.objects.filter(case_reference=case_identifier).select_related("responsible_lawyer", "client", "practice_area").first()
            if not case:
                case = Case.objects.filter(case_id=case_identifier).select_related("responsible_lawyer", "client", "practice_area").first()

            if not case:
                raise serializers.ValidationError({"case_id": "The specified case could not be found."})

            # Check client ownership
            if client and case.client != client:
                raise serializers.ValidationError({"case_id": "You can only book appointments for your own cases."})

            # Case status rules (OPEN, IN_PROGRESS allowed; CLOSED, ARCHIVED, ON_HOLD disallowed)
            if case.status not in (CaseStatus.OPEN, CaseStatus.IN_PROGRESS):
                raise serializers.ValidationError({
                    "case_id": f"Appointments cannot be booked for a case with status '{case.get_status_display()}'. Only active cases are eligible."
                })

            # Responsible lawyer requirement
            if not case.responsible_lawyer:
                raise serializers.ValidationError({
                    "case_id": "This case currently has no responsible lawyer assigned. Please contact the firm."
                })

            # Fee configured requirement
            if case.appointment_fee is None or case.appointment_fee <= 0:
                raise serializers.ValidationError({
                    "case_id": "An appointment fee has not yet been configured for this case. Please contact the firm."
                })

            # Default subject if empty
            subject = (attrs.get("subject") or "").strip()
            if not subject:
                subject = f"Appointment for {case.case_reference}: {case.title}"
            attrs["subject"] = subject

            # Server-side authoritative assignment
            attrs["case_appointment"] = case
            attrs["assigned_lawyer"] = case.responsible_lawyer
            attrs["practice_area"] = case.practice_area
            attrs["charged_fee"] = case.appointment_fee

            # Validate availability of responsible lawyer with row-level concurrency lock
            lawyer = case.responsible_lawyer
            if transaction.get_connection().in_atomic_block:
                User.objects.select_for_update().filter(pk=lawyer.pk).first()
            duration = AvailabilityService.get_lawyer_duration(lawyer)
            pref_date = attrs["preferred_date"]
            pref_time = attrs["preferred_time"]
            is_avail, reason = AvailabilityService.check_slot_available(
                lawyer=lawyer,
                target_date=pref_date,
                preferred_time=pref_time,
                duration_minutes=duration,
            )
            if not is_avail:
                raise serializers.ValidationError({
                    "preferred_time": f"This time slot is no longer available: {reason}"
                })

            attrs["duration_minutes"] = duration
            attrs["end_time"] = _add_minutes_to_time(pref_time, duration)

        else:
            # NEW_MATTER flow
            subject = (attrs.get("subject") or "").strip()
            if not subject:
                raise serializers.ValidationError({"subject": "Subject is required."})
            attrs["subject"] = subject

            knows = attrs.get("knows_practice_area")
            if knows is None:
                raise serializers.ValidationError({
                    "knows_practice_area": "Please indicate whether you know the legal service required."
                })

            practice_area = attrs.get("practice_area")
            if knows:
                if not practice_area:
                    raise serializers.ValidationError({
                        "practice_area": (
                            "Please select a practice area, or choose "
                            "“I'm not sure”."
                        )
                    })
                if practice_area.is_general:
                    raise serializers.ValidationError({
                        "practice_area": (
                            "Please select a specific practice area, "
                            "or choose “I'm not sure”."
                        )
                    })
            else:
                practice_area = None

            from django.conf import settings
            default_fee = getattr(settings, "RAZORPAY_DEFAULT_CONSULTATION_FEE", 500)
            attrs["practice_area"] = practice_area
            attrs["charged_fee"] = default_fee
            attrs["case_appointment"] = None
            attrs["assigned_lawyer"] = None
            attrs["duration_minutes"] = 30
            attrs["end_time"] = _add_minutes_to_time(attrs["preferred_time"], 30)

        attrs["issue_summary"] = (attrs.get("issue_summary") or "").strip()
        return attrs

    def create(self, validated_data):
        validated_data.pop("knows_practice_area", None)
        validated_data.pop("case_id", None)
        client = self.context["request"].user
        return Consultation.objects.create(
            client=client,
            payment_status=ConsultationPaymentStatus.PENDING,
            **validated_data,
        )


class AdminConsultationUpdateSerializer(serializers.Serializer):
    """Admin assignment and lifecycle updates, including rescheduling and lawyer assignment."""

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
    preferred_date = serializers.DateField(required=False, allow_null=True)
    preferred_time = serializers.TimeField(required=False, allow_null=True)
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

        # Admin assignment and rescheduling: validate availability when assigned_lawyer or date/time is updated
        target_lawyer = lawyer if lawyer is not serializers.empty else (consultation.assigned_lawyer if consultation else None)
        target_date = attrs.get("preferred_date", consultation.preferred_date if consultation else None)
        target_time = attrs.get("preferred_time", consultation.preferred_time if consultation else None)

        if target_lawyer is not None and target_date and target_time:
            duration = AvailabilityService.get_lawyer_duration(target_lawyer)
            attrs["duration_minutes"] = duration
            attrs["end_time"] = _add_minutes_to_time(target_time, duration)

            is_avail, reason = AvailabilityService.check_slot_available(
                lawyer=target_lawyer,
                target_date=target_date,
                preferred_time=target_time,
                duration_minutes=duration,
                exclude_consultation_id=consultation.id if consultation else None,
            )
            if not is_avail:
                raise serializers.ValidationError(
                    {
                        "assigned_lawyer": (
                            f"{target_lawyer.full_name} is unavailable at "
                            f"{target_date} {target_time}: {reason}"
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
            if instance.assigned_lawyer:
                instance.duration_minutes = AvailabilityService.get_lawyer_duration(instance.assigned_lawyer)
                if instance.preferred_time:
                    instance.end_time = _add_minutes_to_time(instance.preferred_time, instance.duration_minutes)

        if "preferred_date" in validated_data and validated_data["preferred_date"]:
            instance.preferred_date = validated_data["preferred_date"]

        if "preferred_time" in validated_data and validated_data["preferred_time"]:
            instance.preferred_time = validated_data["preferred_time"]
            duration = instance.duration_minutes or 30
            instance.end_time = _add_minutes_to_time(instance.preferred_time, duration)

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


class LawyerWeeklyScheduleSerializer(serializers.ModelSerializer):
    weekday_label = serializers.CharField(source="get_weekday_display", read_only=True)

    class Meta:
        model = LawyerWeeklySchedule
        fields = (
            "id",
            "weekday",
            "weekday_label",
            "start_time",
            "end_time",
            "is_active",
        )
        read_only_fields = ("id", "weekday_label")

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and start >= end:
            raise serializers.ValidationError("Start time must be strictly before end time.")
        return attrs


class LawyerSchedulePeriodInputSerializer(serializers.Serializer):
    weekday = serializers.ChoiceField(choices=Weekday.choices)
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    is_active = serializers.BooleanField(default=True)

    def validate(self, attrs):
        if attrs["start_time"] >= attrs["end_time"]:
            raise serializers.ValidationError("Start time must be strictly before end time.")
        return attrs


class LawyerScheduleConfigSerializer(serializers.Serializer):
    consultation_duration = serializers.ChoiceField(choices=[30, 45], default=30)
    is_available = serializers.BooleanField(default=True)
    weekly_schedules = LawyerSchedulePeriodInputSerializer(many=True, required=False)

    def validate_weekly_schedules(self, schedules):
        # Validate that within any weekday, active schedules do not overlap
        by_day = {}
        for s in schedules:
            if not s.get("is_active", True):
                continue
            day = s["weekday"]
            if day not in by_day:
                by_day[day] = []
            start = s["start_time"]
            end = s["end_time"]
            for prev_start, prev_end in by_day[day]:
                if not (end <= prev_start or start >= prev_end):
                    day_name = dict(Weekday.choices).get(day, f"Day {day}")
                    raise serializers.ValidationError(
                        f"Overlapping working hours found for {day_name}: "
                        f"{start.strftime('%H:%M')}–{end.strftime('%H:%M')} overlaps with "
                        f"{prev_start.strftime('%H:%M')}–{prev_end.strftime('%H:%M')}."
                    )
            by_day[day].append((start, end))
        return schedules


class LawyerDateOverrideSerializer(serializers.ModelSerializer):
    class Meta:
        model = LawyerDateOverride
        fields = (
            "id",
            "start_date",
            "end_date",
            "is_unavailable",
            "start_time",
            "end_time",
            "reason",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("Start date cannot be after end date.")

        is_unavail = attrs.get("is_unavailable", getattr(self.instance, "is_unavailable", True))
        if not is_unavail:
            start_t = attrs.get("start_time", getattr(self.instance, "start_time", None))
            end_t = attrs.get("end_time", getattr(self.instance, "end_time", None))
            if not start_t or not end_t:
                raise serializers.ValidationError("Start time and end time are required when marked available.")
            if start_t >= end_t:
                raise serializers.ValidationError("Start time must be strictly before end time.")
        return attrs


class LawyerTimeBlockSerializer(serializers.ModelSerializer):
    reason_label = serializers.CharField(source="get_reason_display", read_only=True)

    class Meta:
        model = LawyerTimeBlock
        fields = (
            "id",
            "date",
            "start_time",
            "end_time",
            "reason",
            "reason_label",
            "notes",
            "created_at",
        )
        read_only_fields = ("id", "reason_label", "created_at")

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and start >= end:
            raise serializers.ValidationError("Start time must be strictly before end time.")
        return attrs

