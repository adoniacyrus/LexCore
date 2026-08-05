from django.contrib import admin

from .models import Consultation, PracticeArea


@admin.register(PracticeArea)
class PracticeAreaAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description")


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = (
        "consultation_id",
        "client",
        "practice_area",
        "assigned_lawyer",
        "status",
        "preferred_date",
        "consultation_mode",
        "created_at",
    )
    list_filter = ("status", "practice_area", "consultation_mode")
    search_fields = (
        "consultation_id",
        "subject",
        "client__full_name",
        "client__email",
    )
    autocomplete_fields = ("client", "practice_area", "assigned_lawyer")
    readonly_fields = ("consultation_id", "created_at", "updated_at")
