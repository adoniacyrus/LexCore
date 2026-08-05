"""Consultation module permissions."""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.accounts.models import UserRole


class IsClientRole(BasePermission):
    """Authenticated client accounts only."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role == UserRole.CLIENT
        )


class IsAdminRole(BasePermission):
    """Firm administrator only."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role == UserRole.ADMIN
        )


class IsLawyerRole(BasePermission):
    """Senior or junior advocate."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER)
        )


class IsAuthenticatedStaffOrClientReadPracticeAreas(BasePermission):
    """
    Authenticated users may list active practice areas.
    Only admins may mutate practice areas.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.role == UserRole.ADMIN
