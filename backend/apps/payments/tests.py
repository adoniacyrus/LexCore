"""
Automated test suite for Razorpay payments module.
Covers all 18 test specifications including checkout, verification, idempotency, retry, security, and webhooks.
"""

import hashlib
import hmac
import json
from unittest.mock import patch

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.consultations.models import (
    Consultation,
    ConsultationMode,
    ConsultationPaymentStatus,
    ConsultationStatus,
    PracticeArea,
)
from apps.payments.models import Payment, PaymentStatus


def _generate_sig(order_id: str, payment_id: str, secret: str = None) -> str:
    secret = secret or settings.RAZORPAY_KEY_SECRET or "test_secret"
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def _generate_webhook_sig(raw_body: bytes, secret: str = None) -> str:
    secret = secret or settings.RAZORPAY_WEBHOOK_SECRET or "webhook_secret"
    return hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()


class PaymentIntegrationTests(APITestCase):
    def setUp(self):
        # Override secrets for predictable signature verification
        self.key_id = "rzp_test_mock_123"
        self.key_secret = "test_key_secret_abc123"
        self.webhook_secret = "test_webhook_secret_xyz789"
        settings.RAZORPAY_KEY_ID = self.key_id
        settings.RAZORPAY_KEY_SECRET = self.key_secret
        settings.RAZORPAY_WEBHOOK_SECRET = self.webhook_secret
        settings.RAZORPAY_DEFAULT_CONSULTATION_FEE = 500

        # Create practice area
        self.practice_area = PracticeArea.objects.create(
            name="Corporate & Commercial",
            is_active=True,
        )

        # Create users
        self.client_user = User.objects.create_user(
            email="client1@example.com",
            full_name="Alice Client",
            password="Password123!",
            role=UserRole.CLIENT,
            phone_number="+919876543210",
        )

        self.other_client = User.objects.create_user(
            email="client2@example.com",
            full_name="Bob Other",
            password="Password123!",
            role=UserRole.CLIENT,
        )

        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            full_name="Senior Admin",
            password="Password123!",
            role=UserRole.ADMIN,
        )

        self.lawyer_user = User.objects.create_user(
            email="lawyer@example.com",
            full_name="Advocate Sharma",
            password="Password123!",
            role=UserRole.SENIOR_LAWYER,
        )
        self.lawyer_user.practice_areas.add(self.practice_area)

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    @patch("apps.payments.services.RazorpayService.create_order")
    def test_01_and_02_and_03_create_consultation_flow(self, mock_order):
        """
        1. Client can create a consultation.
        2. Starts in payment-pending state.
        3. Razorpay order is created server-side.
        4. Correct server-side amount is used (50000 paise).
        5. Client cannot manipulate consultation fee.
        """
        mock_order.return_value = {
            "id": "order_mock_001",
            "amount": 50000,
            "currency": "INR",
            "status": "created",
        }

        self._auth(self.client_user)
        payload = {
            "knows_practice_area": True,
            "practice_area": self.practice_area.id,
            "consultation_mode": ConsultationMode.OFFICE,
            "preferred_date": str(timezone.localdate()),
            "preferred_time": "14:30:00",
            "subject": "Shareholders Agreement Consultation",
            "issue_summary": "Need contract review",
            "fee": 1,  # Attempting to manipulate fee — must be ignored!
            "amount": 10,
        }

        response = self.client.post("/api/consultations/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        data = response.data
        self.assertIn("order", data)
        self.assertEqual(data["order"]["order_id"], "order_mock_001")
        self.assertEqual(data["order"]["amount"], 50000)
        self.assertEqual(data["order"]["currency"], "INR")
        self.assertEqual(data["payment_status"], "PENDING")

        # Verify Consultation record
        cons = Consultation.objects.get(consultation_id=data["consultation_id"])
        self.assertEqual(cons.payment_status, ConsultationPaymentStatus.PENDING)

        # Verify Payment record
        payment = Payment.objects.get(consultation=cons)
        self.assertEqual(payment.status, PaymentStatus.PENDING)
        self.assertEqual(payment.amount, 50000)
        self.assertEqual(payment.razorpay_order_id, "order_mock_001")

        # Verify secrets are NOT returned in response
        response_text = response.content.decode("utf-8")
        self.assertNotIn(self.key_secret, response_text)
        self.assertNotIn(self.webhook_secret, response_text)

    @patch("apps.payments.services.RazorpayService.create_order")
    def test_06_and_08_valid_signature_verification_succeeds(self, mock_order):
        """
        6. Valid Razorpay signature succeeds.
        8. Payment is marked captured only after verification.
        9. Consultation enters Admin review workflow only after successful payment.
        """
        mock_order.return_value = {"id": "order_test_002", "amount": 50000}
        self._auth(self.client_user)

        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.PHONE,
            preferred_date=timezone.localdate(),
            preferred_time="10:00:00",
            subject="Tax Advisory",
            payment_status=ConsultationPaymentStatus.PENDING,
        )
        payment = Payment.objects.create(
            consultation=cons,
            amount=50000,
            currency="INR",
            status=PaymentStatus.PENDING,
            razorpay_order_id="order_test_002",
        )

        payment_id = "pay_mock_999"
        valid_sig = _generate_sig("order_test_002", payment_id, self.key_secret)

        verify_payload = {
            "consultation_id": cons.consultation_id,
            "razorpay_order_id": "order_test_002",
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_sig,
        }

        res = self.client.post("/api/payments/verify/", verify_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        payment.refresh_from_db()
        cons.refresh_from_db()

        self.assertEqual(payment.status, PaymentStatus.CAPTURED)
        self.assertEqual(payment.razorpay_payment_id, payment_id)
        self.assertIsNotNone(payment.paid_at)
        self.assertEqual(cons.payment_status, ConsultationPaymentStatus.PAID)

        # 9. Test admin queue visibility: paid consultation appears in admin queue
        self._auth(self.admin_user)
        admin_res = self.client.get("/api/consultations/admin/")
        self.assertEqual(admin_res.status_code, status.HTTP_200_OK)
        ids = [c["consultation_id"] for c in admin_res.data]
        self.assertIn(cons.consultation_id, ids)

    def test_07_invalid_signature_fails(self):
        """7. Invalid signature fails with 400 and leaves consultation unpaid."""
        self._auth(self.client_user)

        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.VIDEO,
            preferred_date=timezone.localdate(),
            preferred_time="11:00:00",
            subject="Contract Review",
            payment_status=ConsultationPaymentStatus.PENDING,
        )
        payment = Payment.objects.create(
            consultation=cons,
            amount=50000,
            currency="INR",
            status=PaymentStatus.PENDING,
            razorpay_order_id="order_test_003",
        )

        verify_payload = {
            "consultation_id": cons.consultation_id,
            "razorpay_order_id": "order_test_003",
            "razorpay_payment_id": "pay_fake_111",
            "razorpay_signature": "invalid_forged_signature_hex",
        }

        res = self.client.post("/api/payments/verify/", verify_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        payment.refresh_from_db()
        cons.refresh_from_db()
        self.assertEqual(payment.status, PaymentStatus.FAILED)
        self.assertEqual(cons.payment_status, ConsultationPaymentStatus.FAILED)

        # Unpaid consultation must NOT enter normal admin review queue
        self._auth(self.admin_user)
        admin_res = self.client.get("/api/consultations/admin/")
        ids = [c["consultation_id"] for c in admin_res.data]
        self.assertNotIn(cons.consultation_id, ids)

    def test_09_unpaid_consultation_blocked_from_admin_assignment(self):
        """Unpaid consultation cannot be assigned or updated by admin."""
        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.PHONE,
            preferred_date=timezone.localdate(),
            preferred_time="16:00:00",
            subject="Unpaid matter",
            payment_status=ConsultationPaymentStatus.PENDING,
        )

        self._auth(self.admin_user)
        res = self.client.patch(
            f"/api/consultations/admin/{cons.consultation_id}/",
            {"assigned_lawyer": self.lawyer_user.id, "status": ConsultationStatus.APPROVED},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("unpaid", str(res.data).lower())

    @patch("apps.payments.services.RazorpayService.create_order")
    def test_10_and_11_payment_retry_without_duplicating_consultation(self, mock_order):
        """
        10. Failed payment does not create duplicate consultation.
        11. Payment retry creates new order for the same consultation.
        """
        mock_order.return_value = {"id": "order_retry_new"}
        self._auth(self.client_user)

        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="15:00:00",
            subject="Dispute Matter",
            payment_status=ConsultationPaymentStatus.FAILED,
        )
        Payment.objects.create(
            consultation=cons,
            amount=50000,
            status=PaymentStatus.FAILED,
            razorpay_order_id="order_failed_orig",
        )

        cons_count_before = Consultation.objects.count()

        # Retry payment
        retry_res = self.client.post(
            "/api/payments/retry/",
            {"consultation_id": cons.consultation_id},
            format="json",
        )
        self.assertEqual(retry_res.status_code, status.HTTP_200_OK)
        self.assertEqual(retry_res.data["order"]["order_id"], "order_retry_new")

        # Verify no duplicate consultation was created!
        self.assertEqual(Consultation.objects.count(), cons_count_before)

        # Verify 2 payment records exist for the same consultation
        payments = Payment.objects.filter(consultation=cons)
        self.assertEqual(payments.count(), 2)

    def test_12_duplicate_payment_verification_is_idempotent(self):
        """12. Duplicate payment verification is idempotent."""
        self._auth(self.client_user)

        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="14:00:00",
            subject="Trademark",
            payment_status=ConsultationPaymentStatus.PENDING,
        )
        payment = Payment.objects.create(
            consultation=cons,
            amount=50000,
            status=PaymentStatus.PENDING,
            razorpay_order_id="order_idem_001",
        )

        pay_id = "pay_idem_999"
        sig = _generate_sig("order_idem_001", pay_id, self.key_secret)

        payload = {
            "consultation_id": cons.consultation_id,
            "razorpay_order_id": "order_idem_001",
            "razorpay_payment_id": pay_id,
            "razorpay_signature": sig,
        }

        res1 = self.client.post("/api/payments/verify/", payload, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Second verification call with same data
        res2 = self.client.post("/api/payments/verify/", payload, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["payment"]["status"], "CAPTURED")

    def test_13_and_14_webhook_verification_and_idempotency(self):
        """
        13. Webhook signature verification and idempotency.
        14. Invalid webhook signature is rejected with 400.
        """
        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.PHONE,
            preferred_date=timezone.localdate(),
            preferred_time="12:00:00",
            subject="Employment law",
            payment_status=ConsultationPaymentStatus.PENDING,
        )
        payment = Payment.objects.create(
            consultation=cons,
            amount=50000,
            status=PaymentStatus.PENDING,
            razorpay_order_id="order_wh_001",
        )

        wh_data = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_wh_123",
                        "order_id": "order_wh_001",
                        "amount": 50000,
                    }
                }
            },
        }
        raw_body = json.dumps(wh_data).encode("utf-8")

        # 14. Invalid signature is rejected
        bad_res = self.client.post(
            "/api/payments/webhook/",
            data=raw_body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE="bad_signature",
        )
        self.assertEqual(bad_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 13. Valid signature succeeds
        valid_wh_sig = _generate_webhook_sig(raw_body, self.webhook_secret)
        good_res = self.client.post(
            "/api/payments/webhook/",
            data=raw_body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=valid_wh_sig,
        )
        self.assertEqual(good_res.status_code, status.HTTP_200_OK)

        payment.refresh_from_db()
        cons.refresh_from_db()
        self.assertEqual(payment.status, PaymentStatus.CAPTURED)
        self.assertEqual(cons.payment_status, ConsultationPaymentStatus.PAID)

        # Idempotent repeat webhook delivery
        repeat_res = self.client.post(
            "/api/payments/webhook/",
            data=raw_body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=valid_wh_sig,
        )
        self.assertEqual(repeat_res.status_code, status.HTTP_200_OK)

        # Test payment.failed webhook does not downgrade an already CAPTURED payment
        fail_data = {
            "event": "payment.failed",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_wh_fail",
                        "order_id": "order_wh_001",
                    }
                }
            },
        }
        raw_fail_body = json.dumps(fail_data).encode("utf-8")
        fail_sig = _generate_webhook_sig(raw_fail_body, self.webhook_secret)
        self.client.post(
            "/api/payments/webhook/",
            data=raw_fail_body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=fail_sig,
        )
        payment.refresh_from_db()
        self.assertEqual(payment.status, PaymentStatus.CAPTURED)

    def test_15_unauthenticated_cannot_access_protected_payment_apis(self):
        """15. Non-authenticated users cannot access protected payment APIs."""
        res_verify = self.client.post("/api/payments/verify/", {})
        self.assertEqual(res_verify.status_code, status.HTTP_401_UNAUTHORIZED)

        res_retry = self.client.post("/api/payments/retry/", {})
        self.assertEqual(res_retry.status_code, status.HTTP_401_UNAUTHORIZED)

        res_detail = self.client.get("/api/payments/CONS-2026-0001/")
        self.assertEqual(res_detail.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_16_client_cannot_access_another_clients_payment(self):
        """16. Client cannot access or verify another client's payment."""
        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="10:00:00",
            subject="Private Client Matter",
            payment_status=ConsultationPaymentStatus.PENDING,
        )
        Payment.objects.create(
            consultation=cons,
            amount=50000,
            status=PaymentStatus.PENDING,
            razorpay_order_id="order_other_client",
        )

        # Authenticate as other_client
        self._auth(self.other_client)

        # Attempt to get other client's payment details
        res_get = self.client.get(f"/api/payments/{cons.consultation_id}/")
        self.assertEqual(res_get.status_code, status.HTTP_403_FORBIDDEN)

        # Attempt to verify other client's payment
        res_verify = self.client.post(
            "/api/payments/verify/",
            {
                "consultation_id": cons.consultation_id,
                "razorpay_order_id": "order_other_client",
                "razorpay_payment_id": "pay_malicious",
                "razorpay_signature": "fake",
            },
            format="json",
        )
        self.assertEqual(res_verify.status_code, status.HTTP_403_FORBIDDEN)

    def test_17_razorpay_secrets_never_appear_in_api_responses(self):
        """17. Razorpay secrets never appear in API responses."""
        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="10:00:00",
            subject="Secret Check Matter",
            payment_status=ConsultationPaymentStatus.PAID,
        )
        Payment.objects.create(
            consultation=cons,
            amount=50000,
            status=PaymentStatus.CAPTURED,
            razorpay_order_id="order_sec_001",
            razorpay_payment_id="pay_sec_001",
        )

        self._auth(self.client_user)
        res = self.client.get(f"/api/payments/{cons.consultation_id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        content_str = res.content.decode("utf-8")
        self.assertNotIn(self.key_secret, content_str)
        self.assertNotIn(self.webhook_secret, content_str)

    def test_18_existing_consultation_assignment_workflow_intact(self):
        """18. Existing consultation assignment workflow continues passing once paid."""
        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="11:00:00",
            subject="Ready For Assignment",
            payment_status=ConsultationPaymentStatus.PAID,
            status=ConsultationStatus.PENDING,
        )

        self._auth(self.admin_user)
        res = self.client.patch(
            f"/api/consultations/admin/{cons.consultation_id}/",
            {
                "practice_area": self.practice_area.id,
                "assigned_lawyer": self.lawyer_user.id,
                "status": ConsultationStatus.APPROVED,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        cons.refresh_from_db()
        self.assertEqual(cons.assigned_lawyer, self.lawyer_user)
        self.assertEqual(cons.status, ConsultationStatus.APPROVED)
