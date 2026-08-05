/**
 * Live portal navigation — only modules that are implemented.
 * Add items here as features ship; unused modules stay in FUTURE_NAV_REGISTRY.
 */

export const PORTAL_NAV_BY_ROLE = {
  ADMIN: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    {
      id: 'users',
      label: 'Users',
      icon: 'users',
      route: '/dashboard/admin/employees',
    },
  ],
  CLIENT: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    {
      id: 'consultations',
      label: 'My Consultations',
      icon: 'consultations',
      route: '/dashboard/client/consultations',
    },
    {
      id: 'account',
      label: 'Account',
      icon: 'clients',
      route: '/dashboard/client/account',
    },
  ],
  SENIOR_LAWYER: [{ id: 'dashboard', label: 'Dashboard', icon: 'home' }],
  JUNIOR_LAWYER: [{ id: 'dashboard', label: 'Dashboard', icon: 'home' }],
  PARALEGAL: [{ id: 'dashboard', label: 'Dashboard', icon: 'home' }],
};

/** Reserved for future modules — do not render until implemented. */
export const FUTURE_NAV_REGISTRY = [
  { id: 'clients', label: 'Clients', icon: 'clients' },
  { id: 'cases', label: 'Cases', icon: 'cases' },
  { id: 'hearings', label: 'Hearings', icon: 'hearings' },
  { id: 'documents', label: 'Documents', icon: 'documents' },
  { id: 'tasks', label: 'Tasks', icon: 'tasks' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'billing', label: 'Billing', icon: 'billing' },
];

export function getNavItemsForRole(role) {
  return PORTAL_NAV_BY_ROLE[role] || PORTAL_NAV_BY_ROLE.CLIENT;
}

/** @deprecated Prefer getNavItemsForRole — kept for ModulePlaceholder meta. */
export const PORTAL_NAV_ITEMS = [
  ...PORTAL_NAV_BY_ROLE.ADMIN,
  ...PORTAL_NAV_BY_ROLE.CLIENT.filter((i) => i.id !== 'dashboard'),
  ...FUTURE_NAV_REGISTRY,
];

export const MODULE_META = {
  users: { title: 'Users', summary: 'Provision and manage internal staff accounts.' },
  consultations: { title: 'My Consultations', summary: 'Track and book consultation requests.' },
  account: { title: 'Account', summary: 'Your LexCore client account details.' },
  clients: { title: 'Clients', summary: 'Client registry, intake, and relationship history.' },
  cases: { title: 'Cases', summary: 'Matter files, parties, and case lifecycle.' },
  hearings: { title: 'Hearings', summary: 'Court dates, listings, and appearance prep.' },
  documents: { title: 'Documents', summary: 'Pleadings, evidence, and chambers filings.' },
  tasks: { title: 'Tasks', summary: 'Deadlines, assignments, and follow-ups.' },
  calendar: { title: 'Calendar', summary: 'Firm-wide schedule across matters and courts.' },
  reports: { title: 'Reports', summary: 'Practice insights and compliance summaries.' },
  billing: { title: 'Billing', summary: 'Invoices, retainers, and fee notes.' },
};
