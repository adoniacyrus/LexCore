"""
Payment API views — checkout verification, retry, and status retrieval.
"""

from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserRole
from apps.consultations.models import Consultation
from apps.consultations.serializers import ConsultationSerializer

from .models import Payment
from .permissions import IsPaymentOwnerOrStaff
from .serializers import (
    PaymentRetrySerializer,
    PaymentSerializer,
    PaymentVerifySerializer,
)
from .services import PaymentService


def _get_consultation_or_404(pk_or_ref: str, user) -> Consultation:
    """Find consultation by ID or reference string, ensuring caller has access."""
    qs = Consultation.objects.select_related("client", "practice_area", "assigned_lawyer")
    if str(pk_or_ref).isdigit():
        consultation = get_object_or_404(qs, pk=int(pk_or_ref))
    else:
        consultation = get_object_or_404(qs, consultation_id=pk_or_ref)

    if user.role != UserRole.ADMIN and consultation.client != user:
        # Client cannot access another client's consultation
        raise ValidationError("You do not have permission to access this consultation.")

    return consultation


class PaymentVerifyView(APIView):
    """
    POST /api/payments/verify/
    Verifies Razorpay checkout signature and captures payment server-side.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PaymentVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            consultation = _get_consultation_or_404(data["consultation_id"], request.user)
        except ValidationError as err:
            return Response({"detail": str(err.message if hasattr(err, "message") else err)}, status=status.HTTP_403_FORBIDDEN)

        try:
            payment = PaymentService.verify_checkout_payment(
                consultation=consultation,
                payment_id=data["razorpay_payment_id"],
                order_id=data["razorpay_order_id"],
                signature=data["razorpay_signature"],
            )
        except ValidationError as err:
            return Response(
                {"detail": err.message if hasattr(err, "message") else str(err)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        consultation.refresh_from_db()
        return Response(
            {
                "payment": PaymentSerializer(payment).data,
                "consultation": ConsultationSerializer(consultation).data,
                "message": "Payment verified and captured successfully.",
            },
            status=status.HTTP_200_OK,
        )


class PaymentRetryView(APIView):
    """
    POST /api/payments/retry/
    Creates a new checkout order for an unpaid consultation without duplicating records.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PaymentRetrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            consultation = _get_consultation_or_404(data["consultation_id"], request.user)
        except ValidationError as err:
            return Response({"detail": str(err.message if hasattr(err, "message") else err)}, status=status.HTTP_403_FORBIDDEN)

        try:
            order_data = PaymentService.retry_payment(consultation)
        except ValidationError as err:
            return Response(
                {"detail": err.message if hasattr(err, "message") else str(err)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "order": order_data,
                "consultation": ConsultationSerializer(consultation).data,
                "message": "New payment order created successfully.",
            },
            status=status.HTTP_200_OK,
        )


class PaymentDetailView(APIView):
    """
    GET /api/payments/<consultation_id>/
    Retrieves payment transaction history for a consultation.
    """

    permission_classes = [IsAuthenticated, IsPaymentOwnerOrStaff]

    def get(self, request, consultation_id):
        try:
            consultation = _get_consultation_or_404(consultation_id, request.user)
        except ValidationError as err:
            return Response({"detail": str(err.message if hasattr(err, "message") else err)}, status=status.HTTP_403_FORBIDDEN)

        payments = Payment.objects.filter(consultation=consultation).order_by("-created_at")
        return Response(
            {
                "consultation": ConsultationSerializer(consultation).data,
                "payments": PaymentSerializer(payments, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
