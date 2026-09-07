"""
Payments API routes — mounted at /api/payments/.
"""

from django.urls import path
from .views import AdminRevenueView, PaymentDetailView, PaymentRetryView, PaymentVerifyView
from .webhooks import RazorpayWebhookView

urlpatterns = [
    path("revenue/", AdminRevenueView.as_view(), name="admin-revenue"),
    path("verify/", PaymentVerifyView.as_view(), name="payment-verify"),
    path("retry/", PaymentRetryView.as_view(), name="payment-retry"),
    path("webhook/", RazorpayWebhookView.as_view(), name="payment-webhook"),
    path("<str:consultation_id>/", PaymentDetailView.as_view(), name="payment-detail"),
]
