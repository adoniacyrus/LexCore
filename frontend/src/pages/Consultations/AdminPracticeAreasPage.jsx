import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  createPracticeArea,
  deletePracticeArea,
  getErrorMessage,
  listPracticeAreas,
  setPracticeAreaActive,
  updatePracticeArea,
} from '../../services/consultationService';
import './consultations.css';

const PAGE_SIZE = 10;
const EMPTY = { name: '', description: '' };

function ActionIcon({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    case 'edit':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
    case 'deactivate':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M8 12h8" />
        </svg>
      );
    case 'activate':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'delete':
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M9 7V5h6v2" />
          <path d="M7 7l1 12h8l1-12" />
        </svg>
      );
    default:
      return null;
  }
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="cons-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="cons-modal cons-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pa-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cons-modal__header">
          <div>
            <p className="section-tag-gold">Confirm Action</p>
            <h2 id="pa-confirm-title">{title}</h2>
          </div>
          <button
            type="button"
            className="cons-modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
          >
            ×
          </button>
        </header>
        <p className="cons-confirm__message">{message}</p>
        <div className="cons-actions">
          <button type="button" className="btn btn-ghost-dark" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'cons-btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PracticeAreaModal({ open, mode, area, accessToken, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && area) {
      setForm({
        name: area.name || '',
        description: area.description || '',
      });
    } else {
      setForm(EMPTY);
    }
    setError('');
    setSubmitting(false);
  }, [open, isEdit, area]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
    };
    try {
      const result = isEdit
        ? await updatePracticeArea(accessToken, area.id, payload)
        : await createPracticeArea(accessToken, {
            ...payload,
            is_active: true,
          });
      onSaved?.(result);
      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save practice area.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cons-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="cons-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cons-modal__header">
          <div>
            <p className="section-tag-gold">Practice Areas</p>
            <h2>{isEdit ? 'Edit Practice Area' : 'Add Practice Area'}</h2>
          </div>
          <button type="button" className="cons-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form className="cons-form auth-form cons-modal__form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </label>
          <label className="auth-field">
            <span>Description</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </label>
          {error ? (
            <p className="cons-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="cons-actions">
            <button type="button" className="btn btn-ghost-dark" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminPracticeAreasPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, mode: 'create', area: null });
  const [confirm, setConfirm] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await listPracticeAreas(accessToken);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load practice areas.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedItems = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => {
        if (Boolean(a.is_active) === Boolean(b.is_active)) {
          return (a.name || '').localeCompare(b.name || '');
        }
        return a.is_active ? -1 : 1;
      });
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedItems.slice(start, start + PAGE_SIZE);
  }, [sortedItems, page]);

  const rangeStart = sortedItems.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, sortedItems.length);

  const showToast = (type, message) => setToast({ type, message });

  const runConfirmedAction = async () => {
    if (!confirm || !accessToken) return;
    setActionBusy(true);
    try {
      let result;
      if (confirm.type === 'deactivate') {
        result = await setPracticeAreaActive(accessToken, confirm.area.id, false);
      } else if (confirm.type === 'activate') {
        result = await setPracticeAreaActive(accessToken, confirm.area.id, true);
      } else if (confirm.type === 'delete') {
        result = await deletePracticeArea(accessToken, confirm.area.id);
      }
      showToast('success', result?.message || 'Action completed.');
      setConfirm(null);
      load();
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Unable to complete action.'));
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <DashboardLayout showContext={false} activeModule="practice-areas" fillHeight>
      <div className="lw-directory lw-fade-in">
        <PageHeader
          eyebrow="Firm Administration"
          title="Practice Areas"
          description="Master list of legal practice areas used for booking and lawyer specialization."
          actions={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModal({ open: true, mode: 'create', area: null })}
            >
              Add Practice Area
            </button>
          }
        />

        {error ? (
          <p className="lw-directory__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="lw-directory__table-wrap">
          {loading ? (
            <div className="cons-empty">Loading practice areas…</div>
          ) : sortedItems.length === 0 ? (
            <EmptyState
              eyebrow="Practice Areas"
              title="No practice areas"
              description="Add practice areas for client booking and lawyer specialization."
            />
          ) : (
            <table className="lw-directory__table cons-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="lw-directory__actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((area) => {
                  const isGeneral =
                    (area.name || '').trim().toLowerCase() === 'general consultation';
                  return (
                    <tr
                      key={area.id}
                      className={area.is_active ? undefined : 'cons-row--inactive'}
                    >
                      <td className="cons-ref">{area.name}</td>
                      <td>{area.description || '—'}</td>
                      <td className="lw-directory__actions-col">
                        <div className="lw-directory__row-actions">
                          <button
                            type="button"
                            className="lw-directory__action-btn"
                            title="Edit practice area"
                            aria-label={`Edit ${area.name}`}
                            onClick={() => setModal({ open: true, mode: 'edit', area })}
                          >
                            <ActionIcon name="edit" />
                          </button>
                          {area.is_active ? (
                            <button
                              type="button"
                              className="lw-directory__action-btn"
                              title="Deactivate practice area"
                              aria-label={`Deactivate ${area.name}`}
                              onClick={() =>
                                setConfirm({
                                  type: 'deactivate',
                                  area,
                                  title: 'Deactivate practice area',
                                  message: `Deactivate ${area.name}? It will no longer appear for booking or specialization until reactivated.`,
                                  confirmLabel: 'Deactivate',
                                  tone: 'danger',
                                })
                              }
                            >
                              <ActionIcon name="deactivate" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="lw-directory__action-btn lw-directory__action-btn--accent"
                              title="Activate practice area"
                              aria-label={`Activate ${area.name}`}
                              onClick={() =>
                                setConfirm({
                                  type: 'activate',
                                  area,
                                  title: 'Activate practice area',
                                  message: `Reactivate ${area.name}? It will become available for booking and lawyer specialization.`,
                                  confirmLabel: 'Activate',
                                  tone: 'primary',
                                })
                              }
                            >
                              <ActionIcon name="activate" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="lw-directory__action-btn lw-directory__action-btn--danger"
                            title={
                              isGeneral
                                ? 'General Consultation cannot be deleted'
                                : 'Delete practice area'
                            }
                            aria-label={`Delete ${area.name}`}
                            disabled={isGeneral}
                            onClick={() =>
                              setConfirm({
                                type: 'delete',
                                area,
                                title: 'Delete practice area',
                                message: `Permanently delete ${area.name}? This cannot be undone.`,
                                confirmLabel: 'Delete',
                                tone: 'danger',
                              })
                            }
                          >
                            <ActionIcon name="delete" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && sortedItems.length > 0 ? (
          <nav className="lw-directory__pagination" aria-label="Practice area pages">
            <p className="lw-directory__pagination-meta">
              Showing {rangeStart}–{rangeEnd} of {sortedItems.length}
            </p>
            <div className="lw-directory__pagination-controls">
              <button
                type="button"
                className="lw-directory__page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`lw-directory__page-btn lw-directory__page-btn--num ${pageNum === page ? 'is-active' : ''}`.trim()}
                  aria-current={pageNum === page ? 'page' : undefined}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}
              <button
                type="button"
                className="lw-directory__page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </nav>
        ) : null}
      </div>

      <PracticeAreaModal
        open={modal.open}
        mode={modal.mode}
        area={modal.area}
        accessToken={accessToken}
        onClose={() => setModal({ open: false, mode: 'create', area: null })}
        onSaved={(result) => {
          showToast('success', result?.message || 'Practice area saved.');
          load();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone}
        busy={actionBusy}
        onClose={() => {
          if (!actionBusy) setConfirm(null);
        }}
        onConfirm={runConfirmedAction}
      />

      {toast ? (
        <div className={`cons-toast cons-toast--${toast.type}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default AdminPracticeAreasPage;
