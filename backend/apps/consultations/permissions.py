"""Role-based permissions for the consultations module."""

from rest_framework.permissions import BasePermission

from apps.accounts.models import UserRole


class IsClientRole(BasePermission):
    """Allow access only to authenticated users with role CLIENT."""

    message = "Only client accounts can access consultation requests."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", None) == UserRole.CLIENT
        )
