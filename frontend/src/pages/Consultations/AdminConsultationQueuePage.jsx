import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  getErrorMessage,
  listAdminConsultations,
  listEligibleLawyers,
  listPracticeAreas,
  updateAdminConsultation,
} from '../../services/consultationService';
import {
  ADMIN_STATUS_ACTIONS,
  assignedLawyerLabel,
  formatCreatedDate,
  formatPreferredDate,
  formatPreferredTime,
  practiceAreaLabel,
  STATUS_LABELS,
} from './consultationConstants';
import './consultations.css';

function AdminManageModal({ open, item, practiceAreas, accessToken, onClose, onSaved }) {
  const [practiceAreaId, setPracticeAreaId] = useState('');
  const [lawyerId, setLawyerId] = useState('');
  const [lawyers, setLawyers] = useState([]);
  const [loadingLawyers, setLoadingLawyers] = useState(false);
  const [statusAction, setStatusAction] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setPracticeAreaId(item.practice_area?.id ? String(item.practice_area.id) : '');
    setLawyerId(item.assigned_lawyer?.id ? String(item.assigned_lawyer.id) : '');
    setStatusAction('');
    setError('');
    setSubmitting(false);
  }, [open, item]);

  useEffect(() => {
    if (!open || !accessToken) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingLawyers(true);
      try {
        const data = await listEligibleLawyers(
          accessToken,
          practiceAreaId ? Number(practiceAreaId) : null
        );
        if (!cancelled) setLawyers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setLawyers([]);
      } finally {
        if (!cancelled) setLoadingLawyers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, accessToken, practiceAreaId]);

  if (!open || !item) return null;

  const handleSave = async () => {
    setError('');
    setSubmitting(true);
    const payload = {
      practice_area: practiceAreaId ? Number(practiceAreaId) : null,
      assigned_lawyer: lawyerId ? Number(lawyerId) : null,
    };
    if (statusAction) payload.status = statusAction;

    try {
      const updated = await updateAdminConsultation(accessToken, item.id, payload);
      onSaved?.(updated);
      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update consultation.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cons-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="cons-modal cons-modal--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-cons-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cons-modal__header">
          <div>
            <p className="section-tag-gold">Manage Consultation</p>
            <h2 id="admin-cons-title">{item.consultation_id}</h2>
          </div>
          <button type="button" className="cons-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="cons-detail">
          <p className="cons-detail__submitted">
            Client: <strong>{item.client?.full_name || '—'}</strong>
            {item.client?.email ? ` · ${item.client.email}` : ''}
          </p>
          <p className="cons-detail__submitted">
            Current status:{' '}
            <span className={`cons-status is-${String(item.status).toLowerCase()}`}>
              {item.status_label || STATUS_LABELS[item.status] || item.status}
            </span>
          </p>

          <label className="auth-field">
            <span>Practice Area</span>
            <select
              value={practiceAreaId}
              onChange={(e) => {
                setPracticeAreaId(e.target.value);
                setLawyerId('');
              }}
            >
              <option value="">Unassigned (General Consultation lawyers)</option>
              {practiceAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                  {!area.is_active ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-field">
            <span>Assigned Lawyer</span>
            <select
              value={lawyerId}
              onChange={(e) => setLawyerId(e.target.value)}
              disabled={loadingLawyers}
            >
              <option value="">Not assigned</option>
              {lawyers.map((lawyer) => (
                <option key={lawyer.id} value={lawyer.id}>
                  {lawyer.full_name}
                </option>
              ))}
            </select>
            {loadingLawyers ? (
              <span className="cons-detail__submitted">Loading eligible lawyers…</span>
            ) : lawyers.length === 0 ? (
              <span className="cons-detail__submitted">
                No eligible lawyers for this practice area. Assign specializations on the Users page.
              </span>
            ) : null}
          </label>

          <label className="auth-field">
            <span>Status Action</span>
            <select value={statusAction} onChange={(e) => setStatusAction(e.target.value)}>
              <option value="">Keep current status</option>
              {ADMIN_STATUS_ACTIONS.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <p className="cons-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="cons-modal__actions">
          <button type="button" className="btn btn-ghost-dark" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminConsultationQueuePage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState([]);
  const [practiceAreas, setPracticeAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [list, areas] = await Promise.all([
        listAdminConsultations(accessToken, {
          q: q.trim() || undefined,
          status: statusFilter || undefined,
          practice_area: areaFilter || undefined,
        }),
        listPracticeAreas(accessToken),
      ]);
      setItems(Array.isArray(list) ? list : []);
      setPracticeAreas(Array.isArray(areas) ? areas : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load consultations.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, q, statusFilter, areaFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout showContext={false} activeModule="consultations" fillHeight>
      <div className="cons-page cons-page--fill lw-fade-in">
        <PageHeader
          eyebrow="Firm Administration"
          title="Consultations"
          description="Review requests, assign practice areas and lawyers, and manage consultation status."
        />

        <div className="cons-toolbar">
          <label className="cons-toolbar__search">
            <span className="lw-sr-only">Search</span>
            <input
              type="search"
              placeholder="Search reference or client…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            aria-label="Filter by practice area"
          >
            <option value="">All practice areas</option>
            <option value="unassigned">Unassigned</option>
            {practiceAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="cons-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="cons-table-wrap">
          {loading ? (
            <div className="cons-empty">Loading consultations…</div>
          ) : items.length === 0 ? (
            <EmptyState
              eyebrow="Consultations"
              title="No consultations found"
              description="New client requests will appear here for assignment and review."
            />
          ) : (
            <table className="cons-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Client</th>
                  <th>Practice Area</th>
                  <th>Status</th>
                  <th>Preferred Date</th>
                  <th>Preferred Time</th>
                  <th>Assigned Lawyer</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="cons-ref">{item.consultation_id}</td>
                    <td>{item.client?.full_name || '—'}</td>
                    <td>{practiceAreaLabel(item)}</td>
                    <td>
                      <span className={`cons-status is-${String(item.status).toLowerCase()}`}>
                        {item.status_label || STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td>{formatPreferredDate(item.preferred_date)}</td>
                    <td>{formatPreferredTime(item.preferred_time)}</td>
                    <td>{assignedLawyerLabel(item)}</td>
                    <td>{formatCreatedDate(item.created_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost-dark cons-table__action"
                        onClick={() => setSelected(item)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AdminManageModal
        open={Boolean(selected)}
        item={selected}
        practiceAreas={practiceAreas}
        accessToken={accessToken}
        onClose={() => setSelected(null)}
        onSaved={() => load()}
      />
    </DashboardLayout>
  );
}

export default AdminConsultationQueuePage;
