from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "consultation",
        "amount",
        "currency",
        "status",
        "razorpay_order_id",
        "razorpay_payment_id",
        "paid_at",
        "created_at",
    )
    list_filter = ("status", "currency", "created_at")
    search_fields = (
        "razorpay_order_id",
        "razorpay_payment_id",
        "consultation__consultation_id",
        "consultation__client__email",
    )
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "paid_at",
    )
