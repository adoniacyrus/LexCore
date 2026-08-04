/**
 * Portal sidebar registry.
 * `route` = live navigation. Others open Module Coming Soon via ?module=
 */
export const PORTAL_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'users', label: 'Users', icon: 'users', route: '/dashboard/admin/employees', roles: ['ADMIN'] },
  { id: 'clients', label: 'Clients', icon: 'clients' },
  { id: 'cases', label: 'Cases', icon: 'cases' },
  { id: 'hearings', label: 'Hearings', icon: 'hearings' },
  { id: 'consultations', label: 'Consultations', icon: 'consultations' },
  { id: 'documents', label: 'Documents', icon: 'documents' },
  { id: 'tasks', label: 'Tasks', icon: 'tasks' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'billing', label: 'Billing', icon: 'billing' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export const MODULE_META = {
  users: { title: 'Users', summary: 'Provision and manage internal staff accounts.' },
  clients: { title: 'Clients', summary: 'Client registry, intake, and relationship history.' },
  cases: { title: 'Cases', summary: 'Matter files, parties, and case lifecycle.' },
  hearings: { title: 'Hearings', summary: 'Court dates, listings, and appearance prep.' },
  consultations: { title: 'Consultations', summary: 'Client meetings and advisory sessions.' },
  documents: { title: 'Documents', summary: 'Pleadings, evidence, and chambers filings.' },
  tasks: { title: 'Tasks', summary: 'Deadlines, assignments, and follow-ups.' },
  calendar: { title: 'Calendar', summary: 'Firm-wide schedule across matters and courts.' },
  reports: { title: 'Reports', summary: 'Practice insights and compliance summaries.' },
  billing: { title: 'Billing', summary: 'Invoices, retainers, and fee notes.' },
  settings: { title: 'Settings', summary: 'Workspace preferences and firm configuration.' },
};
