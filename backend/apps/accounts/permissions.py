"""Role-based API permission classes for LexCore."""

from rest_framework.permissions import BasePermission

from .models import UserRole


class IsAdminRole(BasePermission):
    """Allow access only to authenticated users with role ADMIN."""

    message = "Only firm administrators can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", None) == UserRole.ADMIN
        )
