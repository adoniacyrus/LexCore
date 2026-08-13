from rest_framework.permissions import BasePermission
from apps.accounts.models import UserRole


def is_user_in_case_team(user, case):
    """
    Checks if a user is part of the case team (Responsible Lawyer, Assistant Lawyer, or Supporting Paralegal).
    Admins are also authorized across all cases.
    """
    if not user or not user.is_authenticated:
        return False
    if user.role == UserRole.ADMIN:
        return True
    if case.responsible_lawyer_id == user.id:
        return True
    if case.supporting_paralegal_id == user.id:
        return True
    if case.assistant_lawyers.filter(pk=user.pk).exists():
        return True
    return False


class IsTaskAuthorized(BasePermission):
    """
    Permission class enforcing task access boundaries:
    - ADMIN: Full access to all tasks.
    - RESPONSIBLE LAWYER: Full access to tasks belonging to their case.
    - ASSISTANT LAWYER & PARALEGAL: Access to tasks in their case; status updates for assigned tasks; document attachments.
    - CLIENT: Blocked from internal task management APIs (403 Forbidden).
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        # Clients are completely blocked from internal task APIs
        if user.role == UserRole.CLIENT:
            return False
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == UserRole.ADMIN:
            return True
        if user.role == UserRole.CLIENT:
            return False

        # Verify caller is a member of the case team
        case = obj.case
        if not is_user_in_case_team(user, case):
            return False

        return True
