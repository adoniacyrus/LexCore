from rest_framework.permissions import BasePermission
from apps.accounts.models import UserRole


class IsDocumentAuthorized(BasePermission):
    """
    Object-level permission checking:
    - User must be a participant of the case corresponding to the document.
    - Deletion is restricted to Case Staff (Admin, Lawyer, Paralegal)
      or the Client who uploaded the document.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        case = obj.case

        # 1. Enforce Case Participant access boundary
        is_participant = False
        if user.role == UserRole.ADMIN:
            is_participant = True
        elif user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            is_participant = (case.responsible_lawyer == user)
        elif user.role == UserRole.PARALEGAL:
            is_participant = (case.supporting_paralegal == user)
        elif user.role == UserRole.CLIENT:
            is_participant = (case.client == user)

        if not is_participant:
            return False

        # 2. Enforce Deletion permission boundaries
        if request.method == "DELETE":
            # Staff participants can delete any case document
            if user.role in (
                UserRole.ADMIN,
                UserRole.SENIOR_LAWYER,
                UserRole.JUNIOR_LAWYER,
                UserRole.PARALEGAL,
            ):
                return True
            # Clients can only delete documents they uploaded
            if user.role == UserRole.CLIENT:
                return obj.uploaded_by == user
            return False

        return True
