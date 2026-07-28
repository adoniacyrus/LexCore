"""
Django Admin registration for LexCore's email-based User model.

Uses Django's UserAdmin patterns (password widgets, permission M2Ms) while
replacing username-centric fieldsets with email / full_name / role.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm
from django.utils.translation import gettext_lazy as _

from .models import User, UserRole


class CustomUserCreationForm(UserCreationForm):
    """Admin form for creating users (email + full_name instead of username)."""

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("email", "full_name", "role")


class CustomUserChangeForm(UserChangeForm):
    """Admin form for editing existing users."""

    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """
    Custom UserAdmin for email login and LexCore roles.

    Inherits password hashing UI, permission filters, and change-password
    views from DjangoUserAdmin; fieldsets are tailored to our User model.
    """

    form = CustomUserChangeForm
    add_form = CustomUserCreationForm
    change_password_form = AdminPasswordChangeForm

    ordering = ("email",)
    list_display = (
        "email",
        "full_name",
        "role",
        "is_staff",
        "is_active",
        "is_superuser",
        "created_at",
    )
    list_filter = ("role", "is_staff", "is_active", "is_superuser", "created_at")
    search_fields = ("email", "full_name", "phone_number")
    readonly_fields = ("created_at", "updated_at", "last_login")
    filter_horizontal = ("groups", "user_permissions")

    # Editing an existing user
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            _("Personal info"),
            {"fields": ("full_name", "phone_number", "role")},
        ),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (
            _("Important dates"),
            {"fields": ("last_login", "created_at", "updated_at")},
        ),
    )

    # Creating a new user (password1 / password2 from UserCreationForm)
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "full_name",
                    "phone_number",
                    "role",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )

    def get_form(self, request, obj=None, **kwargs):
        """Limit role choices help text context; form classes stay as configured."""
        form = super().get_form(request, obj, **kwargs)
        if "role" in form.base_fields:
            form.base_fields["role"].help_text = _(
                "Staff roles are assigned by administrators. "
                "Self-registration uses %(client)s."
            ) % {"client": UserRole.CLIENT.label}
        return form
