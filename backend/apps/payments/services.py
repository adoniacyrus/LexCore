"""
Razorpay payment integration services.
Handles server-side order creation, HMAC signature verification, and webhook processing.
"""

import hashlib
import hmac
import logging
from typing import Any, Dict, Optional

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
import razorpay
from razorpay.errors import SignatureVerificationError

from apps.consultations.models import Consultation, ConsultationPaymentStatus, ConsultationStatus
from .models import Payment, PaymentStatus

logger = logging.getLogger(__name__)


class RazorpayService:
    """Encapsulates interaction with the official Razorpay API client."""

    @classmethod
    def get_client(cls) -> razorpay.Client:
        key_id = settings.RAZORPAY_KEY_ID
        key_secret = settings.RAZORPAY_KEY_SECRET
        return razorpay.Client(auth=(key_id, key_secret))

    @classmethod
    def create_order(
        cls,
        amount_paise: int,
        currency: str = "INR",
        receipt: str = "",
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create an order with Razorpay server-side.
        Amount must be provided in integer paise (e.g. 50000 = ₹500.00).
        """
        payload = {
            "amount": int(amount_paise),
            "currency": currency,
            "receipt": receipt[:40] if receipt else "",
            "notes": notes or {},
            "payment_capture": 1,  # Automatic capture
        }
        client = cls.get_client()
        return client.order.create(data=payload)

    @classmethod
    def verify_payment_signature(
        cls,
        order_id: str,
        payment_id: str,
        signature: str,
    ) -> bool:
        """
        Verify checkout payment signature using HMAC-SHA256 with timing-safe compare.
        HMAC-SHA256(order_id + '|' + payment_id, RAZORPAY_KEY_SECRET)
        """
        if not order_id or not payment_id or not signature:
            return False

        secret = settings.RAZORPAY_KEY_SECRET
        if not secret:
            return False

        message = f"{order_id}|{payment_id}".encode("utf-8")
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            message,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected_sig, signature)

    @classmethod
    def verify_webhook_signature(cls, raw_body: bytes, signature: str) -> bool:
        """
        Verify webhook payload signature using HMAC-SHA256 and RAZORPAY_WEBHOOK_SECRET.
        """
        if not signature or not raw_body:
            return False

        secret = settings.RAZORPAY_WEBHOOK_SECRET
        if not secret:
            return False

        expected_sig = hmac.new(
            secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected_sig, signature)


class PaymentService:
    """Domain service managing consultation payment lifecycles and transactions."""

    @staticmethod
    def get_default_fee_paise() -> int:
        """Retrieve default consultation fee in paise from settings."""
        fee_in_rupees = getattr(settings, "RAZORPAY_DEFAULT_CONSULTATION_FEE", 500)
        return int(fee_in_rupees) * 100

    @classmethod
    def create_consultation_order(
        cls,
        consultation: Consultation,
    ) -> Dict[str, Any]:
        """
        Create server-side Razorpay order and initial Payment record for a consultation.
        """
        fee_paise = cls.get_default_fee_paise()

        # Generate Razorpay order
        notes = {
            "consultation_id": consultation.consultation_id,
            "client_id": str(consultation.client_id),
            "client_email": consultation.client.email,
        }
        order = RazorpayService.create_order(
            amount_paise=fee_paise,
            currency="INR",
            receipt=consultation.consultation_id,
            notes=notes,
        )

        payment = Payment.objects.create(
            consultation=consultation,
            amount=fee_paise,
            currency="INR",
            status=PaymentStatus.PENDING,
            razorpay_order_id=order.get("id"),
        )

        return {
            "order_id": order.get("id"),
            "amount": fee_paise,
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
            "payment_id": payment.id,
            "consultation_id": consultation.consultation_id,
        }

    @classmethod
    def verify_checkout_payment(
        cls,
        consultation: Consultation,
        payment_id: str,
        order_id: str,
        signature: str,
    ) -> Payment:
        """
        Verify payment signature against server-stored order and mark CAPTURED & PAID.
        Idempotent: returns existing captured payment if already verified.
        """
        # Retrieve payment matching this consultation and order
        payment = Payment.objects.filter(
            consultation=consultation,
            razorpay_order_id=order_id,
        ).first()

        if not payment:
            # Fallback to the latest pending payment for this consultation
            payment = (
                Payment.objects.filter(consultation=consultation)
                .order_by("-created_at")
                .first()
            )

        if not payment:
            raise ValidationError("No matching payment record found for this consultation.")

        # Idempotency check: already captured
        if (
            payment.status == PaymentStatus.CAPTURED
            and payment.razorpay_payment_id == payment_id
        ):
            return payment

        # Verify signature using authoritative server order ID
        server_order_id = payment.razorpay_order_id or order_id
        is_valid = RazorpayService.verify_payment_signature(
            order_id=server_order_id,
            payment_id=payment_id,
            signature=signature,
        )

        if not is_valid:
            payment.status = PaymentStatus.FAILED
            payment.save(update_fields=["status", "updated_at"])
            consultation.payment_status = ConsultationPaymentStatus.FAILED
            consultation.save(update_fields=["payment_status", "updated_at"])
            raise ValidationError("Invalid payment signature. Verification failed.")

        # Verification succeeded: atomically capture payment and update consultation
        with transaction.atomic():
            payment.status = PaymentStatus.CAPTURED
            payment.razorpay_payment_id = payment_id
            payment.razorpay_signature = signature
            payment.paid_at = timezone.now()
            payment.save(
                update_fields=[
                    "status",
                    "razorpay_payment_id",
                    "razorpay_signature",
                    "paid_at",
                    "updated_at",
                ]
            )

            consultation.payment_status = ConsultationPaymentStatus.PAID
            consultation.status = ConsultationStatus.PENDING  # Ready for firm review
            consultation.save(update_fields=["payment_status", "status", "updated_at"])

        return payment

    @classmethod
    def retry_payment(cls, consultation: Consultation) -> Dict[str, Any]:
        """
        Create a new payment attempt for an unpaid consultation without duplicating the consultation.
        """
        if consultation.payment_status == ConsultationPaymentStatus.PAID:
            raise ValidationError("This consultation has already been paid for.")

        fee_paise = cls.get_default_fee_paise()

        notes = {
            "consultation_id": consultation.consultation_id,
            "client_id": str(consultation.client_id),
            "client_email": consultation.client.email,
            "retry": "true",
        }
        order = RazorpayService.create_order(
            amount_paise=fee_paise,
            currency="INR",
            receipt=consultation.consultation_id,
            notes=notes,
        )

        payment = Payment.objects.create(
            consultation=consultation,
            amount=fee_paise,
            currency="INR",
            status=PaymentStatus.PENDING,
            razorpay_order_id=order.get("id"),
        )

        # Reset consultation payment status to pending
        if consultation.payment_status != ConsultationPaymentStatus.PENDING:
            consultation.payment_status = ConsultationPaymentStatus.PENDING
            consultation.save(update_fields=["payment_status", "updated_at"])

        return {
            "order_id": order.get("id"),
            "amount": fee_paise,
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
            "payment_id": payment.id,
            "consultation_id": consultation.consultation_id,
        }

    @classmethod
    def process_webhook_event(
        cls,
        event: str,
        payload: Dict[str, Any],
    ) -> bool:
        """
        Process Razorpay webhook events idempotently.
        Handles payment.captured and payment.failed.
        """
        entity = payload.get("payment", {}).get("entity", {})
        order_id = entity.get("order_id")
        payment_id = entity.get("id")

        if not order_id:
            logger.warning("Webhook received without order_id: %s", event)
            return False

        payment = Payment.objects.filter(razorpay_order_id=order_id).select_related("consultation").first()
        if not payment:
            logger.warning("No payment found for webhook order_id: %s", order_id)
            return False

        if event == "payment.captured":
            if payment.status == PaymentStatus.CAPTURED:
                # Idempotent: already processed
                return True

            with transaction.atomic():
                payment.status = PaymentStatus.CAPTURED
                if payment_id:
                    payment.razorpay_payment_id = payment_id
                payment.paid_at = timezone.now()
                payment.save(update_fields=["status", "razorpay_payment_id", "paid_at", "updated_at"])

                consultation = payment.consultation
                consultation.payment_status = ConsultationPaymentStatus.PAID
                consultation.status = ConsultationStatus.PENDING
                consultation.save(update_fields=["payment_status", "status", "updated_at"])
            return True

        elif event == "payment.failed":
            # Do NOT overwrite an already captured payment!
            if payment.status == PaymentStatus.CAPTURED:
                return True

            with transaction.atomic():
                payment.status = PaymentStatus.FAILED
                if payment_id and not payment.razorpay_payment_id:
                    payment.razorpay_payment_id = payment_id
                payment.save(update_fields=["status", "razorpay_payment_id", "updated_at"])

                consultation = payment.consultation
                if consultation.payment_status != ConsultationPaymentStatus.PAID:
                    consultation.payment_status = ConsultationPaymentStatus.FAILED
                    consultation.save(update_fields=["payment_status", "updated_at"])
            return True

        return True
