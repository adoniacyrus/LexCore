export const CONSULTATION_MODES = [
  { value: 'OFFICE', label: 'Office Visit' },
  { value: 'PHONE', label: 'Phone Call' },
  { value: 'VIDEO', label: 'Video Call' },
];

export const STATUS_LABELS = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

export const ADMIN_STATUS_ACTIONS = [
  { value: 'UNDER_REVIEW', label: 'Mark Under Review' },
  { value: 'APPROVED', label: 'Approve' },
  { value: 'REJECTED', label: 'Reject' },
  { value: 'COMPLETED', label: 'Mark Completed' },
  { value: 'CANCELLED', label: 'Cancel' },
  { value: 'PENDING', label: 'Reset to Pending' },
];

export const LAWYER_STATUS_ACTIONS = {
  PENDING: [
    { value: 'ACCEPTED', label: 'Accept' },
    { value: 'CANCELLED', label: 'Cancel' },
  ],
  UNDER_REVIEW: [
    { value: 'ACCEPTED', label: 'Accept' },
    { value: 'CANCELLED', label: 'Cancel' },
  ],
  APPROVED: [
    { value: 'ACCEPTED', label: 'Accept' },
    { value: 'CANCELLED', label: 'Cancel' },
  ],
  ACCEPTED: [
    { value: 'COMPLETED', label: 'Mark Completed' },
    { value: 'CANCELLED', label: 'Cancel' },
  ],
};

export function formatPreferredDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatPreferredTime(value) {
  if (!value) return '—';
  const [h, m] = value.split(':');
  const date = new Date();
  date.setHours(Number(h), Number(m || 0), 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatCreatedDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function todayInputValue() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function practiceAreaLabel(item) {
  return (
    item?.practice_area_label ||
    item?.practice_area?.name ||
    'To be assigned'
  );
}

export function assignedLawyerLabel(item) {
  return (
    item?.assigned_lawyer_name ||
    item?.assigned_lawyer?.full_name ||
    'Not Assigned'
  );
}
