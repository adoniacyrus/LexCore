/**
 * Live portal navigation — only modules that are implemented.
 * Add items here as features ship; unused modules stay in FUTURE_NAV_REGISTRY.
 */

export const PORTAL_NAV_BY_ROLE = {
  ADMIN: [
    {
      group: 'FIRM',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' },
      ],
    },
    {
      group: 'PEOPLE',
      items: [
        {
          id: 'users',
          label: 'Staff',
          icon: 'users',
          route: '/dashboard/admin/employees',
        },
        {
          id: 'clients',
          label: 'Clients',
          icon: 'clients',
          route: '/dashboard/admin/clients',
        },
      ],
    },
    {
      group: 'MATTERS',
      items: [
        {
          id: 'consultations',
          label: 'Consultations',
          icon: 'consultations',
          route: '/dashboard/admin/consultations',
        },
        {
          id: 'cases',
          label: 'Cases',
          icon: 'cases',
          route: '/dashboard/admin/cases',
        },
        {
          id: 'matter-board',
          label: 'Matter Board',
          icon: 'reports',
          route: '/dashboard/admin/matter-board',
        },
      ],
    },
    {
      group: 'FIRM SETUP',
      items: [
        {
          id: 'practice-areas',
          label: 'Practice Areas',
          icon: 'cases',
          route: '/dashboard/admin/practice-areas',
        },
      ],
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
      id: 'cases',
      label: 'My Cases',
      icon: 'cases',
      route: '/dashboard/client/cases',
    },
    {
      id: 'account',
      label: 'Account',
      icon: 'clients',
      route: '/dashboard/client/account',
    },
  ],
  SENIOR_LAWYER: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    {
      id: 'matter-board',
      label: 'Matter Board',
      icon: 'reports',
      route: '/dashboard/senior/matter-board',
    },
    {
      id: 'assigned-consultations',
      label: 'Assigned Consultations',
      icon: 'consultations',
      route: '/dashboard/senior/consultations',
    },
    {
      id: 'cases',
      label: 'My Cases',
      icon: 'cases',
      route: '/dashboard/senior/cases',
    },
  ],
  JUNIOR_LAWYER: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    {
      id: 'matter-board',
      label: 'Matter Board',
      icon: 'reports',
      route: '/dashboard/junior/matter-board',
    },
    {
      id: 'assigned-consultations',
      label: 'Assigned Consultations',
      icon: 'consultations',
      route: '/dashboard/junior/consultations',
    },
    {
      id: 'cases',
      label: 'My Cases',
      icon: 'cases',
      route: '/dashboard/junior/cases',
    },
  ],
  PARALEGAL: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    {
      id: 'matter-board',
      label: 'Matter Board',
      icon: 'reports',
      route: '/dashboard/paralegal/matter-board',
    },
    {
      id: 'cases',
      label: 'Supporting Cases',
      icon: 'cases',
      route: '/dashboard/paralegal/cases',
    },
  ],
};

/** Reserved for future modules — do not render until implemented. */
export const FUTURE_NAV_REGISTRY = [
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
  users: { title: 'Staff', summary: 'Provision and manage internal staff accounts.' },
  clients: { title: 'Clients', summary: 'Register and review client portal accounts.' },
  consultations: { title: 'Consultations', summary: 'Track, assign, and manage consultation requests.' },
  'practice-areas': { title: 'Practice Areas', summary: 'Firm practice area master list.' },
  'assigned-consultations': {
    title: 'Assigned Consultations',
    summary: 'Consultations assigned to you.',
  },
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
