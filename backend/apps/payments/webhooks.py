"""
Razorpay webhook endpoint.
Verifies X-Razorpay-Signature against raw body and handles payment lifecycle events.
"""

import json
import logging
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import PaymentService, RazorpayService

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class RazorpayWebhookView(APIView):
    """
    POST /api/payments/webhook/
    Public webhook receiver for Razorpay payment lifecycle updates.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        signature = request.headers.get("X-Razorpay-Signature", "")
        raw_body = request.body

        if not signature or not raw_body:
            return Response(
                {"detail": "Missing webhook signature or payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify signature using timing-safe comparison with webhook secret
        is_valid = RazorpayService.verify_webhook_signature(raw_body, signature)
        if not is_valid:
            logger.warning("Rejected Razorpay webhook with invalid signature.")
            return Response(
                {"detail": "Invalid webhook signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return Response(
                {"detail": "Malformed JSON payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event = payload.get("event", "")
        event_payload = payload.get("payload", {})

        # Process relevant events idempotently
        PaymentService.process_webhook_event(event, event_payload)

        return Response({"status": "ok"}, status=status.HTTP_200_OK)
