import datetime

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .models import (
    LAWYER_ROLES,
    Consultation,
    ConsultationPaymentStatus,
    ConsultationStatus,
    LawyerAvailabilityProfile,
    LawyerDateOverride,
    LawyerTimeBlock,
    LawyerWeeklySchedule,
    PracticeArea,
)
from .permissions import (
    IsAdminRole,
    IsAuthenticatedStaffOrClientReadPracticeAreas,
    IsClientRole,
    IsLawyerRole,
)
from .serializers import (
    AdminConsultationUpdateSerializer,
    ConsultationCreateSerializer,
    ConsultationSerializer,
    LawyerBriefSerializer,
    LawyerDateOverrideSerializer,
    LawyerScheduleConfigSerializer,
    LawyerStatusUpdateSerializer,
    LawyerTimeBlockSerializer,
    LawyerWeeklyScheduleSerializer,
    PracticeAreaSerializer,
    PracticeAreaWriteSerializer,
    eligible_lawyers_queryset,
)
from .services.availability_service import AvailabilityService


def _consultation_qs():
    return Consultation.objects.select_related(
        "client",
        "practice_area",
        "assigned_lawyer",
        "case_appointment",
    )


# ---------------------------------------------------------------------------
# Practice areas
# ---------------------------------------------------------------------------


class PracticeAreaListCreateView(APIView):
    """
    GET  /api/consultations/practice-areas/
    POST /api/consultations/practice-areas/  (admin)
    """

    permission_classes = [IsAuthenticatedStaffOrClientReadPracticeAreas]

    def get(self, request):
        qs = PracticeArea.objects.all().order_by("name")
        if request.user.role != "ADMIN":
            qs = qs.filter(is_active=True)
            # Clients booking should not pick General Consultation as specialty.
            if request.user.role == "CLIENT":
                qs = qs.exclude(name__iexact="General Consultation")
        return Response(
            PracticeAreaSerializer(qs, many=True).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        if request.user.role != "ADMIN":
            return Response(
                {"detail": "Only administrators can create practice areas."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PracticeAreaWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        area = serializer.save()
        return Response(
            PracticeAreaSerializer(area).data,
            status=status.HTTP_201_CREATED,
        )


class PracticeAreaDetailView(APIView):
    """
    PATCH  /api/consultations/practice-areas/<id>/ — admin update
    DELETE /api/consultations/practice-areas/<id>/ — admin delete
    """

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        area = get_object_or_404(PracticeArea, pk=pk)
        serializer = PracticeAreaWriteSerializer(
            area,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        area = serializer.save()
        return Response(
            {
                **PracticeAreaSerializer(area).data,
                "message": "Practice area updated successfully.",
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        area = get_object_or_404(PracticeArea, pk=pk)
        if area.is_general:
            return Response(
                {
                    "detail": (
                        "General Consultation cannot be deleted. "
                        "Deactivate it instead if it must be hidden."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        name = area.name
        area.delete()
        return Response(
            {"message": f'Practice area "{name}" deleted successfully.'},
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class ConsultationCreateView(APIView):
    """POST /api/consultations/ — submit a consultation request."""

    permission_classes = [IsClientRole]

    def post(self, request):
        with transaction.atomic():
            serializer = ConsultationCreateSerializer(
                data=request.data,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            consultation = serializer.save()

            # Create Razorpay order and local payment record server-side
            from apps.payments.services import PaymentService
            order_data = PaymentService.create_consultation_order(consultation)

        payload = ConsultationSerializer(
            _consultation_qs().get(pk=consultation.pk)
        ).data
        payload["order"] = order_data
        payload["message"] = "Consultation request created. Please complete payment to confirm your booking."
        return Response(payload, status=status.HTTP_201_CREATED)


class MyConsultationsView(APIView):
    """GET /api/consultations/my/ — list the authenticated client's requests."""

    permission_classes = [IsClientRole]

    def get(self, request):
        queryset = _consultation_qs().filter(client=request.user).order_by(
            "-created_at"
        )
        return Response(
            ConsultationSerializer(queryset, many=True).data,
            status=status.HTTP_200_OK,
        )


class ClientEligibleCasesView(APIView):
    """
    GET /api/consultations/eligible-cases/
    Lists existing cases belonging to the authenticated client for appointment booking.
    Evaluates server-side appointment booking eligibility.
    """

    permission_classes = [IsClientRole]

    def get(self, request):
        from apps.cases.models import Case, CaseStatus

        cases = (
            Case.objects.filter(client=request.user)
            .select_related("responsible_lawyer", "practice_area")
            .order_by("-created_at")
        )

        results = []
        for c in cases:
            is_active_status = c.status in (CaseStatus.OPEN, CaseStatus.IN_PROGRESS)
            has_lawyer = bool(c.responsible_lawyer)
            has_fee = c.appointment_fee is not None and c.appointment_fee > 0

            is_eligible = is_active_status and has_lawyer and has_fee
            ineligible_reason = None
            if not is_active_status:
                ineligible_reason = f"Case is {c.get_status_display().lower()} and not currently active."
            elif not has_lawyer:
                ineligible_reason = "This case currently has no responsible lawyer assigned. Please contact the firm."
            elif not has_fee:
                ineligible_reason = "An appointment fee has not yet been configured for this case. Please contact the firm."

            results.append({
                "id": c.id,
                "case_reference": c.case_reference,
                "title": c.title,
                "case_type": c.case_type,
                "case_type_label": c.get_case_type_display(),
                "status": c.status,
                "status_label": c.get_status_display(),
                "practice_area_id": c.practice_area_id,
                "practice_area_name": c.practice_area.name if c.practice_area else "General",
                "responsible_lawyer": {
                    "id": c.responsible_lawyer.id,
                    "full_name": c.responsible_lawyer.full_name,
                    "email": c.responsible_lawyer.email,
                    "role": c.responsible_lawyer.role,
                } if c.responsible_lawyer else None,
                "appointment_fee": c.appointment_fee,
                "is_eligible": is_eligible,
                "ineligible_reason": ineligible_reason,
            })

        return Response(results, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Admin queue
# ---------------------------------------------------------------------------


class AdminConsultationListView(APIView):
    """
    GET /api/consultations/admin/
    Search: q (reference / client name)
    Filter: status, practice_area
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = _consultation_qs().all()

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(consultation_id__icontains=q)
                | Q(client__full_name__icontains=q)
                | Q(client__email__icontains=q)
            )

        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)

        payment_filter = (request.query_params.get("payment_status") or "").strip()
        if payment_filter:
            if payment_filter.lower() != "all":
                qs = qs.filter(payment_status=payment_filter)
        else:
            # By default only paid consultations enter the firm review queue
            qs = qs.filter(payment_status=ConsultationPaymentStatus.PAID)

        practice_area = (request.query_params.get("practice_area") or "").strip()
        if practice_area:
            if practice_area.lower() in ("none", "unassigned"):
                qs = qs.filter(practice_area__isnull=True)
            else:
                qs = qs.filter(practice_area_id=practice_area)

        qs = qs.order_by("-created_at")
        return Response(
            ConsultationSerializer(qs, many=True).data,
            status=status.HTTP_200_OK,
        )


def _get_consultation_or_404(qs, pk_or_ref, **kwargs):
    """Lookup Consultation by numeric PK or consultation_id (e.g. CONS-2026-0001)."""
    if str(pk_or_ref).isdigit():
        return get_object_or_404(qs, pk=int(pk_or_ref), **kwargs)
    return get_object_or_404(qs, consultation_id=pk_or_ref, **kwargs)


class AdminConsultationDetailView(APIView):
    """
    GET   /api/consultations/admin/<id>/
    PATCH /api/consultations/admin/<id>/
    """

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        consultation = _get_consultation_or_404(_consultation_qs(), pk)
        return Response(
            ConsultationSerializer(consultation).data,
            status=status.HTTP_200_OK,
        )

    def patch(self, request, pk):
        consultation = _get_consultation_or_404(_consultation_qs(), pk)
        serializer = AdminConsultationUpdateSerializer(
            consultation,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        consultation = serializer.save()
        consultation = _consultation_qs().get(pk=consultation.pk)
        return Response(
            ConsultationSerializer(consultation).data,
            status=status.HTTP_200_OK,
        )


class EligibleLawyersView(APIView):
    """
    GET /api/consultations/admin/eligible-lawyers/?practice_area=<id|empty>&date=<YYYY-MM-DD>&time=<HH:MM>&exclude_consultation_id=<id>
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        raw = (request.query_params.get("practice_area") or "").strip()
        practice_area = None
        if raw and raw.lower() not in ("none", "null", "unassigned"):
            practice_area = get_object_or_404(PracticeArea, pk=raw)

        raw_date = (request.query_params.get("date") or "").strip()
        raw_time = (request.query_params.get("time") or "").strip()
        exclude_id = (request.query_params.get("exclude_consultation_id") or "").strip() or None

        if raw_date:
            try:
                target_date = datetime.date.fromisoformat(raw_date)
            except ValueError:
                return Response(
                    {"detail": "Invalid date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            target_time = None
            if raw_time:
                try:
                    parts = raw_time.split(":")
                    target_time = datetime.time(int(parts[0]), int(parts[1]))
                except Exception:
                    return Response(
                        {"detail": "Invalid time format. Use HH:MM."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            results = AvailabilityService.get_eligible_lawyers_availability(
                practice_area=practice_area,
                target_date=target_date,
                target_time=target_time,
                exclude_consultation_id=exclude_id,
            )
            return Response(results, status=status.HTTP_200_OK)

        lawyers = eligible_lawyers_queryset(practice_area)
        return Response(
            LawyerBriefSerializer(lawyers, many=True).data,
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Lawyer assigned queue
# ---------------------------------------------------------------------------


class LawyerAssignedListView(APIView):
    """GET /api/consultations/assigned/ — consultations assigned to the lawyer."""

    permission_classes = [IsLawyerRole]

    def get(self, request):
        qs = (
            _consultation_qs()
            .filter(assigned_lawyer=request.user)
            .order_by("-created_at")
        )
        return Response(
            ConsultationSerializer(qs, many=True).data,
            status=status.HTTP_200_OK,
        )


class LawyerAssignedStatusView(APIView):
    """PATCH /api/consultations/assigned/<id>/status/ — limited status updates."""

    permission_classes = [IsLawyerRole]

    def patch(self, request, pk):
        consultation = _get_consultation_or_404(
            _consultation_qs(),
            pk,
            assigned_lawyer=request.user,
        )
        serializer = LawyerStatusUpdateSerializer(
            consultation,
            data=request.data,
            partial=False,
        )
        serializer.is_valid(raise_exception=True)
        consultation = serializer.save()
        consultation = _consultation_qs().get(pk=consultation.pk)
        return Response(
            ConsultationSerializer(consultation).data,
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Availability & Scheduling APIs
# ---------------------------------------------------------------------------


class LawyerAvailableSlotsView(APIView):
    """
    GET /api/consultations/availability/slots/?lawyer_id=<id>&date=<YYYY-MM-DD>
    Accessible to authenticated clients and staff to retrieve genuinely available slots.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw_lawyer_id = (request.query_params.get("lawyer_id") or "").strip()
        raw_date = (request.query_params.get("date") or "").strip()

        if not raw_lawyer_id or not raw_date:
            return Response(
                {"detail": "Both lawyer_id and date query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lawyer = User.objects.get(pk=raw_lawyer_id, role__in=LAWYER_ROLES, is_active=True)
        except (User.DoesNotExist, ValueError):
            return Response(
                {"detail": "Lawyer not found or inactive."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            target_date = datetime.date.fromisoformat(raw_date)
        except ValueError:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exclude_id = request.query_params.get("exclude_consultation_id")
        slots = AvailabilityService.get_available_slots(
            lawyer=lawyer,
            target_date=target_date,
            exclude_consultation_id=exclude_id,
        )
        duration = AvailabilityService.get_lawyer_duration(lawyer)

        return Response(
            {
                "lawyer_id": lawyer.id,
                "lawyer_name": lawyer.full_name,
                "date": raw_date,
                "duration_minutes": duration,
                "slots": slots,
            },
            status=status.HTTP_200_OK,
        )


class LawyerScheduleConfigView(APIView):
    """
    GET, PUT /api/consultations/availability/my-schedule/
    Allows the authenticated lawyer to manage their consultation duration and weekly schedule.
    """

    permission_classes = [IsLawyerRole]

    def get(self, request):
        profile, _ = LawyerAvailabilityProfile.objects.get_or_create(
            lawyer=request.user,
            defaults={"consultation_duration": 30, "is_available": True},
        )
        schedules = LawyerWeeklySchedule.objects.filter(lawyer=request.user).order_by("weekday", "start_time")

        return Response(
            {
                "consultation_duration": profile.consultation_duration,
                "is_available": profile.is_available,
                "weekly_schedules": LawyerWeeklyScheduleSerializer(schedules, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        serializer = LawyerScheduleConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            profile, _ = LawyerAvailabilityProfile.objects.get_or_create(lawyer=request.user)
            profile.consultation_duration = data.get("consultation_duration", 30)
            profile.is_available = data.get("is_available", True)
            profile.save()

            if "weekly_schedules" in data:
                LawyerWeeklySchedule.objects.filter(lawyer=request.user).delete()
                new_schedules = []
                for item in data["weekly_schedules"]:
                    new_schedules.append(
                        LawyerWeeklySchedule(
                            lawyer=request.user,
                            weekday=item["weekday"],
                            start_time=item["start_time"],
                            end_time=item["end_time"],
                            is_active=item.get("is_active", True),
                        )
                    )
                if new_schedules:
                    LawyerWeeklySchedule.objects.bulk_create(new_schedules)

        schedules = LawyerWeeklySchedule.objects.filter(lawyer=request.user).order_by("weekday", "start_time")
        return Response(
            {
                "message": "Consultation schedule saved successfully.",
                "consultation_duration": profile.consultation_duration,
                "is_available": profile.is_available,
                "weekly_schedules": LawyerWeeklyScheduleSerializer(schedules, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class LawyerDateOverrideListCreateView(APIView):
    """
    GET  /api/consultations/availability/overrides/ — list lawyer's date overrides
    POST /api/consultations/availability/overrides/ — create date override
    """

    permission_classes = [IsLawyerRole]

    def get(self, request):
        overrides = LawyerDateOverride.objects.filter(lawyer=request.user).order_by("start_date")
        return Response(
            LawyerDateOverrideSerializer(overrides, many=True).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = LawyerDateOverrideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        override = serializer.save(lawyer=request.user)
        return Response(
            LawyerDateOverrideSerializer(override).data,
            status=status.HTTP_201_CREATED,
        )


class LawyerDateOverrideDetailView(APIView):
    """
    DELETE /api/consultations/availability/overrides/<id>/ — delete date override
    """

    permission_classes = [IsLawyerRole]

    def delete(self, request, pk):
        override = get_object_or_404(LawyerDateOverride, pk=pk, lawyer=request.user)
        override.delete()
        return Response({"message": "Date override removed successfully."}, status=status.HTTP_200_OK)


class LawyerTimeBlockListCreateView(APIView):
    """
    GET  /api/consultations/availability/time-blocks/ — list lawyer's time blocks
    POST /api/consultations/availability/time-blocks/ — create time block
    """

    permission_classes = [IsLawyerRole]

    def get(self, request):
        blocks = LawyerTimeBlock.objects.filter(lawyer=request.user).order_by("date", "start_time")
        return Response(
            LawyerTimeBlockSerializer(blocks, many=True).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = LawyerTimeBlockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        block = serializer.save(lawyer=request.user)
        return Response(
            LawyerTimeBlockSerializer(block).data,
            status=status.HTTP_201_CREATED,
        )


class LawyerTimeBlockDetailView(APIView):
    """
    DELETE /api/consultations/availability/time-blocks/<id>/ — delete time block
    """

    permission_classes = [IsLawyerRole]

    def delete(self, request, pk):
        block = get_object_or_404(LawyerTimeBlock, pk=pk, lawyer=request.user)
        block.delete()
        return Response({"message": "Time block removed successfully."}, status=status.HTTP_200_OK)


class LawyerConsultationCalendarView(APIView):
    """
    GET /api/consultations/lawyer-calendar/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
    Returns consultations, blocks, overrides, and weekly schedule for calendar display.
    """

    permission_classes = [IsLawyerRole]

    def get(self, request):
        lawyer = request.user
        raw_start = request.query_params.get("start_date")
        raw_end = request.query_params.get("end_date")

        today = timezone.localdate()
        if raw_start:
            try:
                start_date = datetime.date.fromisoformat(raw_start)
            except ValueError:
                start_date = today.replace(day=1)
        else:
            start_date = today.replace(day=1)

        if raw_end:
            try:
                end_date = datetime.date.fromisoformat(raw_end)
            except ValueError:
                end_date = start_date + datetime.timedelta(days=35)
        else:
            end_date = start_date + datetime.timedelta(days=35)

        # 1. Consultations
        consultations = (
            Consultation.objects.filter(
                assigned_lawyer=lawyer,
                preferred_date__gte=start_date,
                preferred_date__lte=end_date,
            )
            .select_related("client", "practice_area", "case_appointment")
            .order_by("preferred_date", "preferred_time")
        )

        consultations_data = ConsultationSerializer(consultations, many=True).data

        # 2. Time blocks
        blocks = LawyerTimeBlock.objects.filter(
            lawyer=lawyer,
            date__gte=start_date,
            date__lte=end_date,
        ).order_by("date", "start_time")

        # 3. Date overrides
        overrides = LawyerDateOverride.objects.filter(
            lawyer=lawyer,
            start_date__lte=end_date,
            end_date__gte=start_date,
        ).order_by("start_date")

        # 4. Weekly schedule
        schedules = LawyerWeeklySchedule.objects.filter(
            lawyer=lawyer,
            is_active=True,
        ).order_by("weekday", "start_time")

        profile = getattr(lawyer, "availability_profile", None)

        return Response(
            {
                "consultation_duration": profile.consultation_duration if profile else 30,
                "is_available": profile.is_available if profile else True,
                "consultations": consultations_data,
                "time_blocks": LawyerTimeBlockSerializer(blocks, many=True).data,
                "date_overrides": LawyerDateOverrideSerializer(overrides, many=True).data,
                "weekly_schedules": LawyerWeeklyScheduleSerializer(schedules, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
