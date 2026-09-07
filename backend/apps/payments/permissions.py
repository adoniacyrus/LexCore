"""
Permissions for payments module.
"""

from rest_framework.permissions import BasePermission
from apps.accounts.models import UserRole


class IsPaymentOwnerOrStaff(BasePermission):
    """
    Allow access if user is staff (ADMIN) or if user is the client who owns the consultation.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.role == UserRole.ADMIN:
            return True

        # Consultation or Payment object
        if hasattr(obj, "client"):
            return obj.client == user
        if hasattr(obj, "consultation"):
            return obj.consultation.client == user

        return False
