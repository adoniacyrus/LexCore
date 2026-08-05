"""Consultation workflow APIs — client, admin, and lawyer."""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Consultation, PracticeArea
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
    LawyerStatusUpdateSerializer,
    PracticeAreaSerializer,
    PracticeAreaWriteSerializer,
    eligible_lawyers_queryset,
)


def _consultation_qs():
    return Consultation.objects.select_related(
        "client",
        "practice_area",
        "assigned_lawyer",
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
    """PATCH /api/consultations/practice-areas/<id>/ — admin update."""

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
        return Response(PracticeAreaSerializer(area).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class ConsultationCreateView(APIView):
    """POST /api/consultations/ — submit a consultation request."""

    permission_classes = [IsClientRole]

    def post(self, request):
        serializer = ConsultationCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        consultation = serializer.save()
        payload = ConsultationSerializer(
            _consultation_qs().get(pk=consultation.pk)
        ).data
        payload["message"] = "Consultation request submitted successfully."
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


class AdminConsultationDetailView(APIView):
    """
    GET   /api/consultations/admin/<id>/
    PATCH /api/consultations/admin/<id>/
    """

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        consultation = get_object_or_404(_consultation_qs(), pk=pk)
        return Response(
            ConsultationSerializer(consultation).data,
            status=status.HTTP_200_OK,
        )

    def patch(self, request, pk):
        consultation = get_object_or_404(_consultation_qs(), pk=pk)
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
    GET /api/consultations/admin/eligible-lawyers/?practice_area=<id|empty>
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        raw = (request.query_params.get("practice_area") or "").strip()
        practice_area = None
        if raw and raw.lower() not in ("none", "null", "unassigned"):
            practice_area = get_object_or_404(PracticeArea, pk=raw)

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
        consultation = get_object_or_404(
            _consultation_qs(),
            pk=pk,
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
