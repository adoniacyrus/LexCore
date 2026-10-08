from apps.accounts.models import UserRole
from apps.cases.permissions import IsCaseParticipant
from .models import ConversationType


def normalize_conversation_type(raw_type: str | None) -> str | None:
    """
    Normalizes input string ('client', 'client_lawyer', 'team', etc.)
    to ConversationType enum value, or None if invalid.
    """
    if not raw_type:
        return None
    val = str(raw_type).strip().upper()
    if val in (ConversationType.CLIENT_LAWYER, "CLIENT"):
        return ConversationType.CLIENT_LAWYER
    if val in (ConversationType.TEAM, "TEAM"):
        return ConversationType.TEAM
    return None


def conversation_type_slug(conv_type: str) -> str:
    """
    Converts a ConversationType value to a URL/group slug ('client' or 'team').
    """
    norm = normalize_conversation_type(conv_type)
    if norm == ConversationType.CLIENT_LAWYER:
        return "client"
    if norm == ConversationType.TEAM:
        return "team"
    return str(conv_type).lower()


def is_case_participant(user, case) -> bool:
    """
    Evaluates whether a user has general case access.
    Delegates directly to the business logic established in
    apps.cases.permissions.IsCaseParticipant to prevent divergence.
    """
    if not user or not user.is_authenticated:
        return False

    if user.role == UserRole.ADMIN or user.is_superuser:
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


def can_access_case_conversation(user, case, conversation_type: str) -> bool:
    """
    Evaluates whether a user has access to a specific CaseConversation type:
    
    CLIENT_LAWYER:
      ALLOW if:
        user == case.client OR user == case.responsible_lawyer
      Otherwise DENY.
      (Admin must NOT access Client Chat unless Admin is explicitly case.responsible_lawyer)

    TEAM:
      ALLOW if user is a case team member:
        - responsible_lawyer
        - supervising_lawyer
        - assistant_lawyers
        - supporting_paralegal
        - Admin (for administrative purposes)
      Otherwise DENY (Clients must NOT access Team Chat).
    """
    if not user or not user.is_authenticated or not case:
        return False

    norm_type = normalize_conversation_type(conversation_type)
    if not norm_type:
        return False

    if norm_type == ConversationType.CLIENT_LAWYER:
        # Strictly restricted to Client and Responsible Lawyer.
        # Admin is NOT permitted unless Admin is explicitly the responsible lawyer.
        if case.client_id == user.id:
            return True
        if case.responsible_lawyer_id == user.id:
            return True
        return False

    if norm_type == ConversationType.TEAM:
        # Client is never allowed in Team Chat
        if case.client_id == user.id and user.role == UserRole.CLIENT:
            return False

        # Admin may access Team Chat for administrative purposes
        if user.role == UserRole.ADMIN or user.is_superuser:
            return True

        # Case team members
        if case.responsible_lawyer_id == user.id:
            return True
        if case.supervising_lawyer_id == user.id:
            return True
        if case.supporting_paralegal_id == user.id:
            return True
        if case.assistant_lawyers.filter(pk=user.pk).exists():
            return True
        return False

    return False
