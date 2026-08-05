"""
Client-facing consultation request APIs.

Admin review / lawyer assignment will be added in a later phase.
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Consultation
from .permissions import IsClientRole
from .serializers import ConsultationCreateSerializer, ConsultationSerializer


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
        payload = ConsultationSerializer(consultation).data
        payload["message"] = "Consultation request submitted successfully."
        return Response(payload, status=status.HTTP_201_CREATED)


class MyConsultationsView(APIView):
    """GET /api/consultations/my/ — list the authenticated client's requests."""

    permission_classes = [IsClientRole]

    def get(self, request):
        queryset = Consultation.objects.filter(client=request.user).order_by(
            "-created_at"
        )
        return Response(
            ConsultationSerializer(queryset, many=True).data,
            status=status.HTTP_200_OK,
        )
