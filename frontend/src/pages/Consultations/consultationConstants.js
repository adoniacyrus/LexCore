export const PRACTICE_AREAS = [
  { value: 'CIVIL', label: 'Civil Law' },
  { value: 'CORPORATE', label: 'Corporate Law' },
  { value: 'CRIMINAL', label: 'Criminal Law' },
  { value: 'FAMILY', label: 'Family Law' },
  { value: 'PROPERTY', label: 'Property Law' },
  { value: 'TAX', label: 'Tax & Compliance' },
];

export const CONSULTATION_MODES = [
  { value: 'OFFICE', label: 'Office Visit' },
  { value: 'PHONE', label: 'Phone Call' },
  { value: 'VIDEO', label: 'Video Call' },
];

export const STATUS_LABELS = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
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

export function todayInputValue() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
