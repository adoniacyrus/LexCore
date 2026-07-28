/**
 * Map LexCore backend roles to dashboard preview routes.
 */
export function getDashboardPath(role) {
  switch (role) {
    case 'ADMIN':
      return '/dashboard/admin';
    case 'SENIOR_LAWYER':
      return '/dashboard/senior';
    case 'JUNIOR_LAWYER':
      return '/dashboard/junior';
    case 'PARALEGAL':
      return '/dashboard/paralegal';
    case 'CLIENT':
      return '/dashboard/client';
    default:
      return '/dashboard/client';
  }
}
