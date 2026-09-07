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
from apps.consultations.models import Consultation, ConsultationType
from apps.consultations.permissions import IsAdminRole
from apps.consultations.serializers import ConsultationSerializer

from .models import Payment, PaymentStatus
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


class AdminRevenueView(APIView):
    """
    GET /api/payments/revenue/
    Provides firm consultation and appointment revenue metrics, breakdowns, and audit transactions.
    Only accessible by Admin.
    Revenue is calculated ONLY from successfully captured payments (PaymentStatus.CAPTURED).
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        from decimal import Decimal
        from django.db.models import Sum

        # Base captured payments
        captured_qs = Payment.objects.filter(status=PaymentStatus.CAPTURED).select_related(
            "consultation",
            "consultation__client",
            "consultation__assigned_lawyer",
            "consultation__practice_area",
            "consultation__case_appointment",
        )

        # Filters
        from_date = request.query_params.get("from_date", "").strip()
        to_date = request.query_params.get("to_date", "").strip()
        lawyer_id = request.query_params.get("lawyer_id", "").strip()
        cons_type = request.query_params.get("consultation_type", "").strip()
        payment_status_filter = request.query_params.get("payment_status", "ALL").strip()

        if from_date:
            captured_qs = captured_qs.filter(paid_at__date__gte=from_date)
        if to_date:
            captured_qs = captured_qs.filter(paid_at__date__lte=to_date)
        if lawyer_id and lawyer_id.isdigit():
            captured_qs = captured_qs.filter(consultation__assigned_lawyer_id=int(lawyer_id))
        if cons_type in (ConsultationType.NEW_MATTER, ConsultationType.EXISTING_CASE):
            captured_qs = captured_qs.filter(consultation__consultation_type=cons_type)

        # Total revenue & count from captured payments
        total_paise = captured_qs.aggregate(total=Sum("amount"))["total"] or 0
        total_revenue = Decimal(total_paise) / Decimal(100)
        paid_count = captured_qs.count()

        new_matter_paise = (
            captured_qs.filter(consultation__consultation_type=ConsultationType.NEW_MATTER).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )
        new_matter_revenue = Decimal(new_matter_paise) / Decimal(100)
        new_matter_count = captured_qs.filter(
            consultation__consultation_type=ConsultationType.NEW_MATTER
        ).count()

        existing_case_paise = (
            captured_qs.filter(consultation__consultation_type=ConsultationType.EXISTING_CASE).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )
        existing_case_revenue = Decimal(existing_case_paise) / Decimal(100)
        existing_case_count = captured_qs.filter(
            consultation__consultation_type=ConsultationType.EXISTING_CASE
        ).count()

        # All payments for status counts (pending / failed)
        all_payments_qs = Payment.objects.all().select_related("consultation")
        if from_date:
            all_payments_qs = all_payments_qs.filter(created_at__date__gte=from_date)
        if to_date:
            all_payments_qs = all_payments_qs.filter(created_at__date__lte=to_date)
        if lawyer_id and lawyer_id.isdigit():
            all_payments_qs = all_payments_qs.filter(consultation__assigned_lawyer_id=int(lawyer_id))
        if cons_type in (ConsultationType.NEW_MATTER, ConsultationType.EXISTING_CASE):
            all_payments_qs = all_payments_qs.filter(consultation__consultation_type=cons_type)

        pending_count = all_payments_qs.filter(status=PaymentStatus.PENDING).count()
        failed_count = all_payments_qs.filter(status=PaymentStatus.FAILED).count()

        # Breakdown by Lawyer
        lawyer_map = {}
        for p in captured_qs:
            lawyer = p.consultation.assigned_lawyer
            lid = lawyer.id if lawyer else None
            lname = lawyer.full_name if lawyer else "Unassigned / General Firm"
            if lid not in lawyer_map:
                lawyer_map[lid] = {"id": lid, "name": lname, "revenue": Decimal(0), "count": 0}
            lawyer_map[lid]["revenue"] += p.amount_rupees
            lawyer_map[lid]["count"] += 1
        revenue_by_lawyer = sorted(lawyer_map.values(), key=lambda x: x["revenue"], reverse=True)

        # Breakdown by Practice Area
        area_map = {}
        for p in captured_qs:
            pa = p.consultation.practice_area
            aid = pa.id if pa else None
            aname = pa.name if pa else "General Consultation"
            if aid not in area_map:
                area_map[aid] = {"id": aid, "name": aname, "revenue": Decimal(0), "count": 0}
            area_map[aid]["revenue"] += p.amount_rupees
            area_map[aid]["count"] += 1
        revenue_by_practice_area = sorted(area_map.values(), key=lambda x: x["revenue"], reverse=True)

        # Breakdown by Month
        month_map = {}
        for p in captured_qs:
            dt = p.paid_at or p.created_at
            month_key = dt.strftime("%Y-%m")
            month_label = dt.strftime("%b %Y")
            if month_key not in month_map:
                month_map[month_key] = {"month": month_key, "label": month_label, "revenue": Decimal(0), "count": 0}
            month_map[month_key]["revenue"] += p.amount_rupees
            month_map[month_key]["count"] += 1
        revenue_by_month = sorted(month_map.values(), key=lambda x: x["month"], reverse=True)

        # Recent transactions list
        tx_qs = all_payments_qs
        if payment_status_filter and payment_status_filter.upper() != "ALL":
            tx_qs = tx_qs.filter(status=payment_status_filter.upper())

        transactions = []
        for p in tx_qs.order_by("-created_at")[:100]:
            cons = p.consultation
            transactions.append({
                "id": p.id,
                "consultation_id": cons.consultation_id,
                "consultation_type": cons.consultation_type,
                "consultation_type_label": cons.get_consultation_type_display(),
                "case_reference": (
                    cons.case_appointment.case_reference
                    if cons.case_appointment
                    else getattr(getattr(cons, "case", None), "case_reference", None)
                ),
                "client_name": cons.client.full_name if cons.client else "—",
                "lawyer_name": cons.assigned_lawyer.full_name if cons.assigned_lawyer else "Not Assigned",
                "practice_area_name": cons.practice_area.name if cons.practice_area else "General",
                "amount": p.amount,
                "amount_rupees": p.amount_rupees,
                "currency": p.currency,
                "status": p.status,
                "status_label": p.get_status_display(),
                "razorpay_order_id": p.razorpay_order_id,
                "razorpay_payment_id": p.razorpay_payment_id,
                "paid_at": p.paid_at,
                "created_at": p.created_at,
            })

        return Response({
            "metrics": {
                "total_revenue": total_revenue,
                "new_matter_revenue": new_matter_revenue,
                "existing_case_revenue": existing_case_revenue,
                "paid_consultations_count": paid_count,
                "new_matter_count": new_matter_count,
                "existing_case_count": existing_case_count,
                "pending_payments_count": pending_count,
                "failed_payments_count": failed_count,
            },
            "revenue_by_lawyer": revenue_by_lawyer,
            "revenue_by_practice_area": revenue_by_practice_area,
            "revenue_by_month": revenue_by_month,
            "transactions": transactions,
        }, status=status.HTTP_200_OK)

