"""
Automated test suite for Razorpay payments module.
Covers all 18 test specifications including checkout, verification, idempotency, retry, security, and webhooks.
"""

from decimal import Decimal
import hashlib
import hmac
import json
from unittest.mock import patch

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.cases.models import Case, CaseActivity, CaseStatus, CaseType
from apps.consultations.models import (
    Consultation,
    ConsultationMode,
    ConsultationPaymentStatus,
    ConsultationStatus,
    ConsultationType,
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


class CaseAppointmentAndRevenueTests(APITestCase):
    """
    Test suite for:
    - Lawyer case appointment fee configuration and activity logging
    - Role-based permissions for fee setting
    - Client eligible cases discovery
    - Case appointment booking with server-side lawyer and fee derivation
    - Razorpay order fee calculations
    - Appointment confirmation upon payment capture
    - Historical fee preservation
    - Admin firm revenue reporting, filtering, and aggregations
    """

    def setUp(self):
        self.key_id = "rzp_test_mock_123"
        self.key_secret = "test_key_secret_abc123"
        self.webhook_secret = "test_webhook_secret_xyz789"
        settings.RAZORPAY_KEY_ID = self.key_id
        settings.RAZORPAY_KEY_SECRET = self.key_secret
        settings.RAZORPAY_WEBHOOK_SECRET = self.webhook_secret
        settings.RAZORPAY_DEFAULT_CONSULTATION_FEE = 500

        self.practice_area = PracticeArea.objects.create(
            name="Intellectual Property",
            is_active=True,
        )

        self.admin = User.objects.create_user(
            email="firm_admin@lexcore.local",
            full_name="Firm Administrator",
            password="Password123!",
            role=UserRole.ADMIN,
        )
        self.responsible_lawyer = User.objects.create_user(
            email="partner_ip@lexcore.local",
            full_name="Senior Partner IP",
            password="Password123!",
            role=UserRole.SENIOR_LAWYER,
        )
        self.responsible_lawyer.practice_areas.add(self.practice_area)

        self.assistant_lawyer = User.objects.create_user(
            email="assistant_ip@lexcore.local",
            full_name="Associate Lawyer",
            password="Password123!",
            role=UserRole.JUNIOR_LAWYER,
        )
        self.paralegal = User.objects.create_user(
            email="paralegal_ip@lexcore.local",
            full_name="Legal Assistant",
            password="Password123!",
            role=UserRole.PARALEGAL,
        )

        self.client_user = User.objects.create_user(
            email="acme_client@lexcore.local",
            full_name="Acme Corp Rep",
            password="Password123!",
            role=UserRole.CLIENT,
        )
        self.other_client = User.objects.create_user(
            email="other_client@lexcore.local",
            full_name="Other Client",
            password="Password123!",
            role=UserRole.CLIENT,
        )

        # Base consultation originating the case
        self.orig_cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="10:00:00",
            subject="Initial Trademark Discussion",
            payment_status=ConsultationPaymentStatus.PAID,
            status=ConsultationStatus.ACCEPTED,
        )

        # Base case
        self.case = Case.objects.create(
            originating_consultation=self.orig_cons,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            supporting_paralegal=self.paralegal,
            title="Acme Trademark Infringement",
            case_type=CaseType.CORPORATE,
            status=CaseStatus.OPEN,
            start_date=timezone.localdate(),
            appointment_fee=Decimal("1500.00"),
        )
        self.case.assistant_lawyers.add(self.assistant_lawyer)

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_responsible_lawyer_can_set_appointment_fee_and_logs_activity(self):
        """Responsible lawyer can set case appointment fee, which records CaseActivity."""
        self._auth(self.responsible_lawyer)
        url = f"/api/cases/{self.case.id}/appointment-fee/"
        res = self.client.patch(url, {"appointment_fee": "1800.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(res.data["appointment_fee"])), Decimal("1800.00"))

        self.case.refresh_from_db()
        self.assertEqual(self.case.appointment_fee, Decimal("1800.00"))

        activity = CaseActivity.objects.filter(case=self.case, activity_type="FEE_CHANGED").first()
        self.assertIsNotNone(activity)
        self.assertEqual(activity.user, self.responsible_lawyer)
        self.assertIn("1800.00", activity.description)

    def test_admin_can_set_appointment_fee(self):
        """Admin can also update case appointment fee."""
        self._auth(self.admin)
        url = f"/api/cases/{self.case.id}/appointment-fee/"
        res = self.client.patch(url, {"appointment_fee": "2200.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(res.data["appointment_fee"])), Decimal("2200.00"))

    def test_assistant_lawyer_paralegal_client_cannot_set_fee(self):
        """Assistant lawyers, paralegals, and clients receive 403 when attempting to edit fee."""
        url = f"/api/cases/{self.case.id}/appointment-fee/"

        # Assistant lawyer
        self._auth(self.assistant_lawyer)
        res1 = self.client.patch(url, {"appointment_fee": "2000.00"}, format="json")
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)

        # Paralegal
        self._auth(self.paralegal)
        res2 = self.client.patch(url, {"appointment_fee": "2000.00"}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

        # Client
        self._auth(self.client_user)
        res3 = self.client.patch(url, {"appointment_fee": "2000.00"}, format="json")
        self.assertEqual(res3.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_eligible_cases_endpoint(self):
        """Eligible cases endpoint returns only eligible active cases belonging to the requesting client."""
        # Create an ineligible case: no fee configured
        orig_cons2 = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="11:00:00",
            subject="No fee matter",
            payment_status=ConsultationPaymentStatus.PAID,
            status=ConsultationStatus.ACCEPTED,
        )
        case_no_fee = Case.objects.create(
            originating_consultation=orig_cons2,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            title="Case Without Fee",
            case_type=CaseType.CIVIL,
            status=CaseStatus.OPEN,
            start_date=timezone.localdate(),
            appointment_fee=None,
        )

        # Create closed case
        orig_cons3 = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="11:00:00",
            subject="Closed matter",
            payment_status=ConsultationPaymentStatus.PAID,
            status=ConsultationStatus.ACCEPTED,
        )
        case_closed = Case.objects.create(
            originating_consultation=orig_cons3,
            client=self.client_user,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            title="Closed Case",
            case_type=CaseType.CIVIL,
            status=CaseStatus.CLOSED,
            start_date=timezone.localdate(),
            appointment_fee=Decimal("1000.00"),
        )

        # Create other client's case
        orig_cons4 = Consultation.objects.create(
            client=self.other_client,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="11:00:00",
            subject="Other client matter",
            payment_status=ConsultationPaymentStatus.PAID,
            status=ConsultationStatus.ACCEPTED,
        )
        case_other = Case.objects.create(
            originating_consultation=orig_cons4,
            client=self.other_client,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            title="Other Client Case",
            case_type=CaseType.CIVIL,
            status=CaseStatus.OPEN,
            start_date=timezone.localdate(),
            appointment_fee=Decimal("1200.00"),
        )

        self._auth(self.client_user)
        res = self.client.get("/api/consultations/eligible-cases/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        eligible_ids = [c["id"] for c in res.data if c["is_eligible"]]
        all_returned_ids = [c["id"] for c in res.data]

        self.assertIn(self.case.id, eligible_ids)
        self.assertNotIn(case_no_fee.id, eligible_ids)
        self.assertNotIn(case_closed.id, eligible_ids)
        self.assertNotIn(case_other.id, all_returned_ids)

    @patch("apps.payments.services.RazorpayService.create_order")
    def test_book_case_appointment_server_side_derivation(self, mock_order):
        """Booking an existing case appointment derives lawyer and fee server-side, ignoring spoofed values."""
        mock_order.return_value = {
            "id": "order_case_mock_001",
            "amount": 150000,
            "currency": "INR",
            "status": "created",
        }
        self._auth(self.client_user)
        payload = {
            "consultation_type": ConsultationType.EXISTING_CASE,
            "case_id": self.case.id,
            "consultation_mode": ConsultationMode.VIDEO,
            "preferred_date": str(timezone.localdate()),
            "preferred_time": "14:00:00",
            "subject": "Injunction Briefing",
            "description": "Discussing upcoming motion hearing",
            # Spoof attempts:
            "appointment_fee": 10,
            "assigned_lawyer": self.admin.id,
        }
        res = self.client.post("/api/consultations/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        cons = Consultation.objects.get(consultation_id=res.data["consultation_id"])
        self.assertEqual(cons.consultation_type, ConsultationType.EXISTING_CASE)
        self.assertEqual(cons.case_appointment, self.case)
        # Verify server-side derived lawyer and fee
        self.assertEqual(cons.assigned_lawyer, self.responsible_lawyer)
        self.assertEqual(cons.charged_fee, Decimal("1500.00"))
        self.assertEqual(cons.practice_area, self.practice_area)
        self.assertEqual(cons.payment_status, ConsultationPaymentStatus.PENDING)
        self.assertEqual(cons.status, ConsultationStatus.PENDING)

    def test_cannot_book_appointment_for_unauthorized_or_ineligible_case(self):
        """Client cannot book for another client's case or a case without configured fee."""
        self._auth(self.client_user)

        # Other client's case
        orig_cons_other = Consultation.objects.create(
            client=self.other_client,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="11:00:00",
            subject="Other client",
            payment_status=ConsultationPaymentStatus.PAID,
            status=ConsultationStatus.ACCEPTED,
        )
        other_case = Case.objects.create(
            originating_consultation=orig_cons_other,
            client=self.other_client,
            practice_area=self.practice_area,
            responsible_lawyer=self.responsible_lawyer,
            title="Secret Dispute",
            case_type=CaseType.CORPORATE,
            status=CaseStatus.OPEN,
            start_date=timezone.localdate(),
            appointment_fee=Decimal("1500.00"),
        )

        res = self.client.post(
            "/api/consultations/",
            {
                "consultation_type": ConsultationType.EXISTING_CASE,
                "case_id": other_case.id,
                "consultation_mode": ConsultationMode.VIDEO,
                "preferred_date": str(timezone.localdate()),
                "preferred_time": "14:00:00",
                "subject": "Unauthorized Booking",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.payments.services.RazorpayService.create_order")
    def test_razorpay_order_uses_case_appointment_fee(self, mock_create_order):
        """Booking an existing case appointment creates Razorpay order with the case's appointment fee in paise."""
        mock_create_order.return_value = {
            "id": "order_case_appt_999",
            "amount": 150000,
            "currency": "INR",
            "status": "created",
        }

        self._auth(self.client_user)
        payload = {
            "consultation_type": ConsultationType.EXISTING_CASE,
            "case_id": self.case.id,
            "consultation_mode": ConsultationMode.VIDEO,
            "preferred_date": str(timezone.localdate()),
            "preferred_time": "15:00:00",
            "subject": "Fee Verification Appointment",
        }
        res = self.client.post("/api/consultations/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Verify that create_order was called with 150000 paise (₹1,500.00), not default 50000 paise
        call_kwargs = mock_create_order.call_args.kwargs
        self.assertEqual(call_kwargs["amount_paise"], 150000)
        self.assertEqual(res.data["order"]["amount"], 150000)

        # Also test retry payment creates order with 150000 paise
        mock_create_order.return_value = {
            "id": "order_case_retry_999",
            "amount": 150000,
            "currency": "INR",
            "status": "created",
        }
        res_retry = self.client.post(
            "/api/payments/retry/",
            {"consultation_id": res.data["consultation_id"]},
            format="json",
        )
        self.assertEqual(res_retry.status_code, status.HTTP_200_OK)
        self.assertEqual(res_retry.data["order"]["amount"], 150000)

    def test_case_appointment_payment_verification_confirms_appointment(self):
        """Verifying payment for an existing case appointment auto-accepts it with responsible lawyer."""
        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="15:00:00",
            subject="Verification Test Case Appt",
            payment_status=ConsultationPaymentStatus.PENDING,
            status=ConsultationStatus.PENDING,
            consultation_type=ConsultationType.EXISTING_CASE,
            case_appointment=self.case,
            assigned_lawyer=self.responsible_lawyer,
            charged_fee=Decimal("1500.00"),
        )

        order_id = "order_case_verify_777"
        payment_id = "pay_case_verify_888"
        Payment.objects.create(
            consultation=cons,
            amount=150000,
            status=PaymentStatus.PENDING,
            razorpay_order_id=order_id,
        )

        sig = _generate_sig(order_id, payment_id, self.key_secret)

        self._auth(self.client_user)
        res = self.client.post(
            "/api/payments/verify/",
            {
                "consultation_id": cons.consultation_id,
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": sig,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["payment"]["status"], "CAPTURED")
        self.assertEqual(res.data["consultation"]["payment_status"], "PAID")
        self.assertEqual(res.data["consultation"]["status"], "ACCEPTED")

        cons.refresh_from_db()
        self.assertEqual(cons.payment_status, ConsultationPaymentStatus.PAID)
        self.assertEqual(cons.status, ConsultationStatus.ACCEPTED)
        self.assertEqual(cons.assigned_lawyer, self.responsible_lawyer)

        pmt = Payment.objects.get(razorpay_order_id=order_id)
        self.assertEqual(pmt.status, PaymentStatus.CAPTURED)
        self.assertEqual(pmt.amount, 150000)

    def test_historical_appointment_fee_integrity(self):
        """Updating a case fee later does not change historical charged_fee on existing appointments."""
        cons = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="15:00:00",
            subject="Historical Fee Check",
            payment_status=ConsultationPaymentStatus.PAID,
            status=ConsultationStatus.ACCEPTED,
            consultation_type=ConsultationType.EXISTING_CASE,
            case_appointment=self.case,
            assigned_lawyer=self.responsible_lawyer,
            charged_fee=Decimal("1500.00"),
        )

        # Responsible lawyer changes fee
        self._auth(self.responsible_lawyer)
        self.client.patch(
            f"/api/cases/{self.case.id}/appointment-fee/",
            {"appointment_fee": "3500.00"},
            format="json",
        )

        self.case.refresh_from_db()
        self.assertEqual(self.case.appointment_fee, Decimal("3500.00"))

        cons.refresh_from_db()
        self.assertEqual(cons.charged_fee, Decimal("1500.00"))

    def test_admin_revenue_endpoint_access_and_aggregations(self):
        """Admin revenue endpoint provides accurate aggregations counting only captured payments."""
        # 1. Captured payment for new matter (₹500 -> 50000 paise)
        cons_new = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="10:00:00",
            subject="New Matter Rev Test",
            payment_status=ConsultationPaymentStatus.PAID,
            consultation_type=ConsultationType.NEW_MATTER,
            assigned_lawyer=self.responsible_lawyer,
        )
        Payment.objects.create(
            consultation=cons_new,
            amount=50000,
            status=PaymentStatus.CAPTURED,
            razorpay_order_id="order_rev_new",
            razorpay_payment_id="pay_rev_new",
        )

        # 2. Captured payment for existing case appointment (₹1500 -> 150000 paise)
        cons_case = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.VIDEO,
            preferred_date=timezone.localdate(),
            preferred_time="11:00:00",
            subject="Case Appt Rev Test",
            payment_status=ConsultationPaymentStatus.PAID,
            consultation_type=ConsultationType.EXISTING_CASE,
            case_appointment=self.case,
            assigned_lawyer=self.responsible_lawyer,
            charged_fee=Decimal("1500.00"),
        )
        Payment.objects.create(
            consultation=cons_case,
            amount=150000,
            status=PaymentStatus.CAPTURED,
            razorpay_order_id="order_rev_case",
            razorpay_payment_id="pay_rev_case",
        )

        # 3. Failed payment - MUST be ignored in revenue
        cons_failed = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="12:00:00",
            subject="Failed Rev Test",
            payment_status=ConsultationPaymentStatus.FAILED,
        )
        Payment.objects.create(
            consultation=cons_failed,
            amount=50000,
            status=PaymentStatus.FAILED,
            razorpay_order_id="order_rev_failed",
            razorpay_payment_id="pay_rev_failed",
        )

        # 4. Pending payment - MUST be ignored in revenue
        cons_pending = Consultation.objects.create(
            client=self.client_user,
            practice_area=self.practice_area,
            consultation_mode=ConsultationMode.OFFICE,
            preferred_date=timezone.localdate(),
            preferred_time="13:00:00",
            subject="Pending Rev Test",
            payment_status=ConsultationPaymentStatus.PENDING,
        )
        Payment.objects.create(
            consultation=cons_pending,
            amount=50000,
            status=PaymentStatus.PENDING,
            razorpay_order_id="order_rev_pending",
        )

        # Verify access control: Lawyer is forbidden
        self._auth(self.responsible_lawyer)
        res_lawyer = self.client.get("/api/payments/revenue/")
        self.assertEqual(res_lawyer.status_code, status.HTTP_403_FORBIDDEN)

        # Verify access control: Client is forbidden
        self._auth(self.client_user)
        res_client = self.client.get("/api/payments/revenue/")
        self.assertEqual(res_client.status_code, status.HTTP_403_FORBIDDEN)

        # Admin access: Success
        self._auth(self.admin)
        res_admin = self.client.get("/api/payments/revenue/")
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)

        metrics = res_admin.data["metrics"]
        self.assertEqual(Decimal(str(metrics["total_revenue"])), Decimal("2000.00"))
        self.assertEqual(metrics["paid_consultations_count"], 2)
        self.assertEqual(Decimal(str(metrics["new_matter_revenue"])), Decimal("500.00"))
        self.assertEqual(metrics["new_matter_count"], 1)
        self.assertEqual(Decimal(str(metrics["existing_case_revenue"])), Decimal("1500.00"))
        self.assertEqual(metrics["existing_case_count"], 1)

        # Filter by consultation_type=EXISTING_CASE
        res_filtered_case = self.client.get("/api/payments/revenue/?consultation_type=EXISTING_CASE")
        self.assertEqual(res_filtered_case.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(res_filtered_case.data["metrics"]["total_revenue"])), Decimal("1500.00"))
        self.assertEqual(res_filtered_case.data["metrics"]["paid_consultations_count"], 1)

        # Filter by consultation_type=NEW_MATTER
        res_filtered_new = self.client.get("/api/payments/revenue/?consultation_type=NEW_MATTER")
        self.assertEqual(res_filtered_new.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(res_filtered_new.data["metrics"]["total_revenue"])), Decimal("500.00"))
        self.assertEqual(res_filtered_new.data["metrics"]["paid_consultations_count"], 1)

