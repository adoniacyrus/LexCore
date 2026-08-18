from rest_framework.permissions import BasePermission
from apps.accounts.models import UserRole


class IsCaseParticipant(BasePermission):
    """
    Enforces role-based object access:
    - Admin: Full read access
    - Lawyer: Must be the responsible advocate
    - Paralegal: Must be the supporting paralegal
    - Client: Must be the client
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == UserRole.ADMIN:
            return True
        if user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            return obj.responsible_lawyer == user or obj.supervising_lawyer == user or obj.assistant_lawyers.filter(pk=user.pk).exists()
        if user.role == UserRole.PARALEGAL:
            return obj.supporting_paralegal == user
        if user.role == UserRole.CLIENT:
            return obj.client == user
        return False
