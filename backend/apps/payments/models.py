"""
Payment models for consultation booking transactions.
"""

from decimal import Decimal
from django.db import models
from apps.consultations.models import Consultation


class PaymentStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    AUTHORIZED = "AUTHORIZED", "Authorized"
    CAPTURED = "CAPTURED", "Captured"
    FAILED = "FAILED", "Failed"
    REFUNDED = "REFUNDED", "Refunded"


class Payment(models.Model):
    """
    Local payment record corresponding to a consultation booking attempt.
    """

    id = models.BigAutoField(primary_key=True)
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    amount = models.PositiveIntegerField(
        help_text="Transaction amount in integer paise (e.g. 50000 = ₹500.00).",
    )
    currency = models.CharField(
        max_length=10,
        default="INR",
    )
    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        db_index=True,
    )
    razorpay_order_id = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Order ID returned by Razorpay server-side Orders API.",
    )
    razorpay_payment_id = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Payment ID returned by Razorpay after successful capture.",
    )
    razorpay_signature = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="HMAC-SHA256 signature returned by Razorpay checkout.",
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when payment verification succeeded and status became CAPTURED.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["consultation", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["razorpay_order_id"]),
            models.Index(fields=["razorpay_payment_id"]),
        ]

    def __str__(self):
        return f"Payment #{self.id} — {self.consultation.consultation_id} — {self.status} (₹{self.amount_rupees})"

    @property
    def amount_rupees(self) -> Decimal:
        """Helper returning fee in decimal rupees."""
        return Decimal(self.amount) / Decimal(100)
