from django.contrib import admin

from .models import Consultation, PracticeArea, PetitionGuidance


@admin.register(PracticeArea)
class PracticeAreaAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description")


@admin.register(PetitionGuidance)
class PetitionGuidanceAdmin(admin.ModelAdmin):
    list_display = ("title", "practice_area", "display_order", "is_active", "updated_at")
    list_filter = ("is_active", "practice_area")
    search_fields = ("title", "overview")
    prepopulated_fields = {"slug": ("title",)}
    autocomplete_fields = ("practice_area",)


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
