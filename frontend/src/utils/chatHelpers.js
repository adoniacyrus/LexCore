export const CONVERSATION_TYPES = {
  CLIENT_LAWYER: 'CLIENT_LAWYER',
  TEAM: 'TEAM',
};

/**
 * Determines available chats based on user role and case assignment:
 * - Responsible Lawyer: [CLIENT_LAWYER, TEAM]
 * - Client: [CLIENT_LAWYER]
 * - Supervising Lawyer / Assistant Lawyer / Paralegal / Admin: [TEAM]
 *   (Admin only gets CLIENT_LAWYER if Admin is explicitly responsible_lawyer)
 *
 * @param {object} caseItem - The Case object from API
 * @param {object} currentUser - The currently authenticated user object
 * @returns {string[]} Array of available CONVERSATION_TYPES
 */
export function getAvailableChats(caseItem, currentUser) {
  if (!caseItem || !currentUser) return [];

  const currentUserId = currentUser.id;

  // Resolve IDs safely whether properties are objects or raw IDs
  const clientUserId = caseItem.client?.id ?? caseItem.client;
  const respLawyerId = caseItem.responsible_lawyer?.id ?? caseItem.responsible_lawyer;
  const superLawyerId = caseItem.supervising_lawyer?.id ?? caseItem.supervising_lawyer;
  const paralegalId = caseItem.supporting_paralegal?.id ?? caseItem.supporting_paralegal;

  const isResponsibleLawyer = respLawyerId != null && respLawyerId === currentUserId;
  const isClient = clientUserId != null && clientUserId === currentUserId;

  // Responsible lawyer gets BOTH
  if (isResponsibleLawyer) {
    return [CONVERSATION_TYPES.CLIENT_LAWYER, CONVERSATION_TYPES.TEAM];
  }

  // Client gets ONLY Client Chat
  if (isClient) {
    return [CONVERSATION_TYPES.CLIENT_LAWYER];
  }

  // Check if case team member or admin
  const isSupervisingLawyer = superLawyerId != null && superLawyerId === currentUserId;
  const isSupportingParalegal = paralegalId != null && paralegalId === currentUserId;
  const isAssistantLawyer =
    Array.isArray(caseItem.assistant_lawyers) &&
    caseItem.assistant_lawyers.some(
      (lawyer) => (lawyer?.id ?? lawyer) === currentUserId
    );
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.is_superuser;

  if (isSupervisingLawyer || isAssistantLawyer || isSupportingParalegal || isAdmin) {
    return [CONVERSATION_TYPES.TEAM];
  }

  return [];
}
