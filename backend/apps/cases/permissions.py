from rest_framework.permissions import BasePermission
from apps.accounts.models import UserRole


class IsCaseParticipant(BasePermission):
    """
    Enforces role-based object access:
    - Admin: Full read access
    - Lawyer: Must be the responsible advocate, supervising lawyer, or assistant lawyer
    - Paralegal: Must be the supporting paralegal
    - Client: Must be the client
    Works on Case objects directly or any object with a .case attribute.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        case = obj if hasattr(obj, "responsible_lawyer") else getattr(obj, "case", obj)
        if user.role == UserRole.ADMIN:
            return True
        if user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            return (
                case.responsible_lawyer_id == user.id
                or case.supervising_lawyer_id == user.id
                or case.assistant_lawyers.filter(pk=user.pk).exists()
            )
        if user.role == UserRole.PARALEGAL:
            return case.supporting_paralegal_id == user.id
        if user.role == UserRole.CLIENT:
            return case.client_id == user.id
        return False


class IsCaseResponsibleLawyerOrAdmin(BasePermission):
    """
    Enforces that only the case's responsible/main lawyer or an Admin can configure
    the case appointment fee. Assistant lawyers, paralegals, and clients are forbidden.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        case = obj if hasattr(obj, "responsible_lawyer") else getattr(obj, "case", obj)
        if user.role == UserRole.ADMIN:
            return True
        return case.responsible_lawyer_id == user.id


class IsHearingRecordAuthorized(BasePermission):
    """
    Enforces role-based permissions for Hearing Records:
    - Admin: can view/manage hearing records for authorized cases.
    - Responsible lawyer: can create/view/update/delete hearing records.
    - Supervising lawyer: can view/manage according to existing case permissions.
    - Assistant lawyers: can view according to existing case permissions.
    - Supporting paralegal: can view according to existing case permissions.
    - Client: can view appropriate hearing information for their own case (internal_notes excluded).
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        case = obj if hasattr(obj, "responsible_lawyer") else getattr(obj, "case", obj)

        # 1. Base participation check
        if not IsCaseParticipant().has_object_permission(request, view, case):
            return False

        # 2. Read access (GET, HEAD, OPTIONS) permitted for all authorized case participants
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True

        # 3. Mutating access (POST, PUT, PATCH, DELETE) restricted to Admin, Responsible Lawyer, Supervising Lawyer
        if user.role == UserRole.ADMIN:
            return True
        if user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            return (
                case.responsible_lawyer_id == user.id
                or case.supervising_lawyer_id == user.id
            )

        return False


