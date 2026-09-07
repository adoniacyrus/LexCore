"""
Serializers for payments module.
"""

from rest_framework import serializers
from .models import Payment, PaymentStatus


class PaymentSerializer(serializers.ModelSerializer):
    """Safe read serializer for Payment records — never exposes secrets."""

    consultation_ref = serializers.CharField(
        source="consultation.consultation_id",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    amount_rupees = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Payment
        fields = (
            "id",
            "consultation",
            "consultation_ref",
            "amount",
            "amount_rupees",
            "currency",
            "status",
            "status_label",
            "razorpay_order_id",
            "razorpay_payment_id",
            "paid_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class PaymentVerifySerializer(serializers.Serializer):
    """Input serializer for client-side checkout verification."""

    consultation_id = serializers.CharField(required=True)
    razorpay_order_id = serializers.CharField(required=True)
    razorpay_payment_id = serializers.CharField(required=True)
    razorpay_signature = serializers.CharField(required=True)


class PaymentRetrySerializer(serializers.Serializer):
    """Input serializer to request a fresh payment order for an existing consultation."""

    consultation_id = serializers.CharField(required=True)
