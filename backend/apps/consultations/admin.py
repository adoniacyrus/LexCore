from django.contrib import admin

from .models import Consultation


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = (
        "consultation_id",
        "client",
        "practice_area",
        "consultation_mode",
        "preferred_date",
        "status",
        "created_at",
    )
    list_filter = ("status", "practice_area", "consultation_mode")
    search_fields = ("consultation_id", "subject", "client__email", "client__full_name")
    readonly_fields = ("consultation_id", "created_at", "updated_at")
