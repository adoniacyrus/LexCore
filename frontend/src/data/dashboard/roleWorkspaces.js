/**
 * Role-specific workspace content (mock data for UI foundation).
 * Replace with API-backed loaders later — component tree stays the same.
 */

const ROLE_LABELS = {
  ADMIN: 'Firm Administrator',
  SENIOR_LAWYER: 'Senior Advocate',
  JUNIOR_LAWYER: 'Junior Advocate',
  PARALEGAL: 'Paralegal',
  CLIENT: 'Client',
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || 'Member';
}

const SHARED_NOTIFICATIONS = [
  { id: 'n1', title: 'Hearing reminder', body: 'District Court — tomorrow 10:45', time: '12m ago', unread: true },
  { id: 'n2', title: 'Document shared', body: 'Affidavit draft uploaded to Sharma v. State', time: '1h ago', unread: true },
  { id: 'n3', title: 'Task completed', body: 'Evidence index reviewed', time: '3h ago', unread: false },
];

const SHARED_DEADLINES = [
  { id: 'd1', label: 'File written submissions', matter: 'Menon Infrastructure LLP', due: 'Tomorrow' },
  { id: 'd2', label: 'Reply to notice', matter: 'Patel Family Trust', due: 'Fri' },
  { id: 'd3', label: 'Client affidavit', matter: 'Rao v. Municipal Corp', due: 'Mon' },
];

const SHARED_HEARINGS = [
  { id: 'h1', time: '10:45', matter: 'Sharma v. State of Kerala', court: 'District Court, Ernakulam' },
  { id: 'h2', time: '02:30', matter: 'Menon Infrastructure LLP', court: 'NCLT Kochi' },
  { id: 'h3', time: '11:00', matter: 'Patel Family Trust', court: 'Family Court' },
];

function baseWorkspace(overrides) {
  return {
    brief: [],
    nextEvent: null,
    agenda: [],
    matters: [],
    activity: [],
    quickActions: [],
    context: {
      hearings: SHARED_HEARINGS,
      deadlines: SHARED_DEADLINES,
      notifications: SHARED_NOTIFICATIONS,
      pinned: [],
    },
    ...overrides,
  };
}

const QUICK_ACTIONS_STAFF = [
  { id: 'qa-case', label: 'New Case', description: 'Open a matter file', icon: 'cases', comingSoon: true },
  { id: 'qa-hearing', label: 'Schedule Hearing', description: 'Add a court date', icon: 'hearings', comingSoon: true },
  { id: 'qa-client', label: 'Register Client', description: 'Create a client record', icon: 'clients', comingSoon: true },
  { id: 'qa-doc', label: 'Upload Document', description: 'Add to the repository', icon: 'documents', comingSoon: true },
  { id: 'qa-task', label: 'Create Task', description: 'Assign follow-up work', icon: 'tasks', comingSoon: true },
];

export function getWorkspaceContent(role) {
  switch (role) {
    case 'ADMIN':
      return baseWorkspace({
        brief: [
          { id: 'b1', label: 'Hearings Today', value: 2 },
          { id: 'b2', label: 'Pending Tasks', value: 4 },
          { id: 'b3', label: 'Client Meetings', value: 1 },
          { id: 'b4', label: 'New Documents', value: 3 },
          { id: 'b5', label: 'Consultation Requests', value: 2 },
        ],
        nextEvent: {
          time: '10:45',
          title: 'District Court Hearing',
          matter: 'Sharma v. State of Kerala',
          court: 'District Court, Ernakulam — Court Hall 3',
          status: 'Confirmed',
        },
        agenda: [
          { id: 'a1', time: '09:30', title: 'Client Consultation', meta: 'Intake — Patel Family Trust', type: 'meeting' },
          { id: 'a2', time: '10:45', title: 'District Court Hearing', meta: 'Sharma v. State of Kerala', type: 'hearing' },
          { id: 'a3', time: '14:00', title: 'Document Review', meta: 'Affidavit draft · Menon LLP', type: 'document' },
          { id: 'a4', time: '16:30', title: 'Internal Meeting', meta: 'Junior progress sync', type: 'meeting' },
        ],
        matters: [
          {
            id: 'm1',
            name: 'Sharma v. State of Kerala',
            caseNumber: 'CRL 214/2024',
            court: 'District Court, Ernakulam',
            status: 'Active',
            priority: 'High',
            team: ['Rohan Nair', 'Meera Krishnan'],
            nextHearing: 'Today · 10:45',
            progress: 62,
          },
          {
            id: 'm2',
            name: 'Menon Infrastructure LLP',
            caseNumber: 'CP 88/2025',
            court: 'NCLT Kochi',
            status: 'Discovery',
            priority: 'Medium',
            team: ['Ananya Menon', 'Sanjay Pillai'],
            nextHearing: 'Thu · 14:30',
            progress: 40,
          },
          {
            id: 'm3',
            name: 'Patel Family Trust',
            caseNumber: 'OP 41/2025',
            court: 'Family Court',
            status: 'Advisory',
            priority: 'Low',
            team: ['Meera Krishnan'],
            nextHearing: 'Mon · 11:00',
            progress: 28,
          },
        ],
        activity: [
          { id: 'act1', title: 'Consultation booked', detail: 'New enquiry from Coastal Logistics', time: '18m ago', type: 'consultation' },
          { id: 'act2', title: 'Employee onboarded', detail: 'Paralegal account provisioned', time: '1h ago', type: 'user' },
          { id: 'act3', title: 'Document uploaded', detail: 'Board resolution · Menon LLP', time: '2h ago', type: 'document' },
          { id: 'act4', title: 'Case assigned', detail: 'Junior advocate added to Sharma matter', time: 'Yesterday', type: 'case' },
        ],
        quickActions: [
          ...QUICK_ACTIONS_STAFF,
          { id: 'qa-employee', label: 'Add Employee', description: 'Invite chambers staff', icon: 'users', comingSoon: true },
          {
            id: 'qa-users',
            label: 'Manage Users',
            description: 'Staff directory & access',
            icon: 'users',
            to: '/dashboard/admin/employees',
          },
        ],
        context: {
          hearings: SHARED_HEARINGS,
          deadlines: SHARED_DEADLINES,
          notifications: SHARED_NOTIFICATIONS,
          pinned: [
            { id: 'p1', name: 'Sharma v. State of Kerala', meta: 'CRL 214/2024' },
            { id: 'p2', name: 'Firm consultations queue', meta: '2 awaiting review' },
          ],
        },
        focusNote: 'Firm overview · user management · recent consultations',
      });

    case 'SENIOR_LAWYER':
      return baseWorkspace({
        brief: [
          { id: 'b1', label: 'Hearings Today', value: 2 },
          { id: 'b2', label: 'Assigned Matters', value: 5 },
          { id: 'b3', label: 'Junior Reviews', value: 3 },
          { id: 'b4', label: 'Client Calls', value: 1 },
          { id: 'b5', label: 'Drafts Pending', value: 2 },
        ],
        nextEvent: {
          time: '10:45',
          title: 'Lead Appearance',
          matter: 'Sharma v. State of Kerala',
          court: 'District Court, Ernakulam — Court Hall 3',
          status: 'Lead Counsel',
        },
        agenda: [
          { id: 'a1', time: '09:15', title: 'Briefing with Junior', meta: 'Hearing prep · Sharma', type: 'meeting' },
          { id: 'a2', time: '10:45', title: 'District Court Hearing', meta: 'Sharma v. State of Kerala', type: 'hearing' },
          { id: 'a3', time: '15:00', title: 'Client Strategy Call', meta: 'Menon Infrastructure LLP', type: 'meeting' },
          { id: 'a4', time: '17:00', title: 'Draft Review', meta: 'Written submissions', type: 'document' },
        ],
        matters: [
          {
            id: 'm1',
            name: 'Sharma v. State of Kerala',
            caseNumber: 'CRL 214/2024',
            court: 'District Court, Ernakulam',
            status: 'Listed',
            priority: 'High',
            team: ['Rohan Nair', 'Meera Krishnan'],
            nextHearing: 'Today · 10:45',
            progress: 72,
          },
          {
            id: 'm2',
            name: 'Coastal Logistics Arbitration',
            caseNumber: 'ARB 12/2025',
            court: 'SIAC / Kochi seat',
            status: 'Active',
            priority: 'High',
            team: ['Rohan Nair'],
            nextHearing: 'Next week',
            progress: 55,
          },
        ],
        activity: [
          { id: 'act1', title: 'Hearing rescheduled', detail: 'NCLT matter moved to Thursday', time: '40m ago', type: 'hearing' },
          { id: 'act2', title: 'Junior progress update', detail: 'Evidence index completed', time: '2h ago', type: 'task' },
          { id: 'act3', title: 'Document uploaded', detail: 'Skeleton arguments', time: '4h ago', type: 'document' },
        ],
        quickActions: QUICK_ACTIONS_STAFF,
        context: {
          hearings: SHARED_HEARINGS.slice(0, 2),
          deadlines: SHARED_DEADLINES,
          notifications: SHARED_NOTIFICATIONS,
          pinned: [{ id: 'p1', name: 'Sharma v. State of Kerala', meta: 'Today’s lead matter' }],
        },
        focusNote: 'Today’s hearings · assigned matters · junior progress',
      });

    case 'JUNIOR_LAWYER':
      return baseWorkspace({
        brief: [
          { id: 'b1', label: 'Assigned Tasks', value: 6 },
          { id: 'b2', label: 'Drafts Due', value: 2 },
          { id: 'b3', label: 'Documents to Review', value: 4 },
          { id: 'b4', label: 'Hearings Assisting', value: 1 },
          { id: 'b5', label: 'Mentorship Notes', value: 1 },
        ],
        nextEvent: {
          time: '09:15',
          title: 'Hearing Prep Briefing',
          matter: 'Sharma v. State of Kerala',
          court: 'Chambers · Conference Room B',
          status: 'Assisting',
        },
        agenda: [
          { id: 'a1', time: '09:15', title: 'Briefing with Senior', meta: 'Sharma hearing prep', type: 'meeting' },
          { id: 'a2', time: '10:45', title: 'Court Assistance', meta: 'District Court · Hall 3', type: 'hearing' },
          { id: 'a3', time: '14:00', title: 'Draft Affidavit', meta: 'Patel Family Trust', type: 'document' },
          { id: 'a4', time: '16:00', title: 'Research Memo', meta: 'Limitation issues', type: 'task' },
        ],
        matters: [
          {
            id: 'm1',
            name: 'Sharma v. State of Kerala',
            caseNumber: 'CRL 214/2024',
            court: 'District Court, Ernakulam',
            status: 'Assisting',
            priority: 'High',
            team: ['Rohan Nair', 'Meera Krishnan'],
            nextHearing: 'Today · 10:45',
            progress: 50,
          },
          {
            id: 'm2',
            name: 'Patel Family Trust',
            caseNumber: 'OP 41/2025',
            court: 'Family Court',
            status: 'Drafting',
            priority: 'Medium',
            team: ['Meera Krishnan'],
            nextHearing: 'Mon · 11:00',
            progress: 35,
          },
        ],
        activity: [
          { id: 'act1', title: 'Task assigned', detail: 'Prepare chronology for Sharma', time: '25m ago', type: 'task' },
          { id: 'act2', title: 'Draft commented', detail: 'Senior reviewed affidavit outline', time: '2h ago', type: 'document' },
          { id: 'act3', title: 'Document uploaded', detail: 'Case law bundle', time: 'Yesterday', type: 'document' },
        ],
        quickActions: QUICK_ACTIONS_STAFF.filter((a) => a.id !== 'qa-client'),
        context: {
          hearings: [SHARED_HEARINGS[0]],
          deadlines: SHARED_DEADLINES.slice(0, 2),
          notifications: SHARED_NOTIFICATIONS,
          pinned: [{ id: 'p1', name: 'Affidavit draft', meta: 'Due today 16:00' }],
        },
        focusNote: 'Assigned tasks · drafts · documents',
      });

    case 'PARALEGAL':
      return baseWorkspace({
        brief: [
          { id: 'b1', label: 'Uploads Pending', value: 3 },
          { id: 'b2', label: 'Evidence Items', value: 7 },
          { id: 'b3', label: 'Filing Deadlines', value: 2 },
          { id: 'b4', label: 'Document Requests', value: 4 },
          { id: 'b5', label: 'Court Filings', value: 1 },
        ],
        nextEvent: {
          time: '11:30',
          title: 'Evidence Index Review',
          matter: 'Menon Infrastructure LLP',
          court: 'Document Room · Chambers',
          status: 'In Progress',
        },
        agenda: [
          { id: 'a1', time: '09:00', title: 'Scan & Upload Bundle', meta: 'Exhibit set A–D', type: 'document' },
          { id: 'a2', time: '11:30', title: 'Evidence Index Review', meta: 'Menon Infrastructure LLP', type: 'document' },
          { id: 'a3', time: '15:00', title: 'Court Filing Prep', meta: 'Index + vakalat', type: 'task' },
          { id: 'a4', time: '16:45', title: 'Handover to Counsel', meta: 'Hearing pack', type: 'meeting' },
        ],
        matters: [
          {
            id: 'm1',
            name: 'Menon Infrastructure LLP',
            caseNumber: 'CP 88/2025',
            court: 'NCLT Kochi',
            status: 'Evidence',
            priority: 'High',
            team: ['Sanjay Pillai', 'Ananya Menon'],
            nextHearing: 'Thu · 14:30',
            progress: 45,
          },
        ],
        activity: [
          { id: 'act1', title: 'Document uploaded', detail: 'Exhibit D — bank statements', time: '10m ago', type: 'document' },
          { id: 'act2', title: 'Task completed', detail: 'Pagination of paper book', time: '1h ago', type: 'task' },
          { id: 'act3', title: 'Evidence tagged', detail: '12 items indexed', time: '3h ago', type: 'document' },
        ],
        quickActions: QUICK_ACTIONS_STAFF.filter((a) =>
          ['qa-doc', 'qa-task', 'qa-hearing'].includes(a.id)
        ),
        context: {
          hearings: [SHARED_HEARINGS[1]],
          deadlines: SHARED_DEADLINES,
          notifications: SHARED_NOTIFICATIONS,
          pinned: [{ id: 'p1', name: 'Evidence set — Menon LLP', meta: '7 items pending OCR' }],
        },
        focusNote: 'Document management · evidence · uploads',
      });

    case 'CLIENT':
    default:
      return baseWorkspace({
        brief: [
          { id: 'b1', label: 'My Cases', value: 2 },
          { id: 'b2', label: 'Upcoming Consultations', value: 1 },
          { id: 'b3', label: 'Open Invoices', value: 1 },
          { id: 'b4', label: 'New Documents', value: 3 },
          { id: 'b5', label: 'Unread Messages', value: 2 },
        ],
        nextEvent: {
          time: '09:30',
          title: 'Consultation with Counsel',
          matter: 'Patel Family Trust',
          court: 'Video conference · LexCore Chambers',
          status: 'Confirmed',
        },
        agenda: [
          { id: 'a1', time: '09:30', title: 'Client Consultation', meta: 'Adv. Meera Krishnan', type: 'meeting' },
          { id: 'a2', time: '—', title: 'Document review window', meta: 'Share requested papers by Friday', type: 'document' },
        ],
        matters: [
          {
            id: 'm1',
            name: 'Patel Family Trust',
            caseNumber: 'OP 41/2025',
            court: 'Family Court',
            status: 'Active',
            priority: 'Medium',
            team: ['Meera Krishnan'],
            nextHearing: 'Mon · 11:00',
            progress: 30,
          },
          {
            id: 'm2',
            name: 'Property Advisory',
            caseNumber: 'ADV 09/2025',
            court: 'Advisory',
            status: 'Open',
            priority: 'Low',
            team: ['Rohan Nair'],
            nextHearing: 'Not listed',
            progress: 15,
          },
        ],
        activity: [
          { id: 'act1', title: 'Message from counsel', detail: 'Please upload title deed scan', time: '1h ago', type: 'message' },
          { id: 'act2', title: 'Invoice issued', detail: 'Retainer — March engagement', time: 'Yesterday', type: 'billing' },
          { id: 'act3', title: 'Document shared', detail: 'Engagement letter', time: '2d ago', type: 'document' },
        ],
        quickActions: [
          { id: 'qa-consult', label: 'Book Consultation', description: 'Request a meeting', icon: 'consultations', comingSoon: true },
          { id: 'qa-doc', label: 'Upload Document', description: 'Share papers securely', icon: 'documents', comingSoon: true },
          { id: 'qa-msg', label: 'Message Counsel', description: 'Secure chambers inbox', icon: 'messages', comingSoon: true },
          { id: 'qa-bill', label: 'View Invoices', description: 'Fees and payments', icon: 'billing', comingSoon: true },
        ],
        context: {
          hearings: [{ id: 'h1', time: '11:00', matter: 'Patel Family Trust', court: 'Family Court · Monday' }],
          deadlines: [{ id: 'd1', label: 'Upload title documents', matter: 'Property Advisory', due: 'Fri' }],
          notifications: SHARED_NOTIFICATIONS,
          pinned: [{ id: 'p1', name: 'Patel Family Trust', meta: 'Your primary matter' }],
        },
        focusNote: 'My cases · consultations · invoices · documents',
      });
  }
}
