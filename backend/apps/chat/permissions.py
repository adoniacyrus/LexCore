from apps.accounts.models import UserRole
from apps.cases.permissions import IsCaseParticipant


def is_case_participant(user, case) -> bool:
    """
    Evaluates whether a user has access to a Case.
    Delegates directly to the business logic established in
    apps.cases.permissions.IsCaseParticipant to prevent divergence.
    """
    if not user or not user.is_authenticated:
        return False

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
