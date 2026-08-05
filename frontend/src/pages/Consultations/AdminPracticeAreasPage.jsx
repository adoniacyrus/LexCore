import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  createPracticeArea,
  getErrorMessage,
  listPracticeAreas,
  updatePracticeArea,
} from '../../services/consultationService';
import './consultations.css';

const EMPTY = { name: '', description: '', is_active: true };

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
        is_active: area.is_active !== false,
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
      is_active: form.is_active,
    };
    try {
      const result = isEdit
        ? await updatePracticeArea(accessToken, area.id, payload)
        : await createPracticeArea(accessToken, payload);
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
          <label className="cons-choice">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            />
            Active
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
  const [modal, setModal] = useState({ open: false, mode: 'create', area: null });

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

  return (
    <DashboardLayout showContext={false} activeModule="practice-areas" fillHeight>
      <div className="cons-page cons-page--fill lw-fade-in">
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
          <p className="cons-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="cons-table-wrap">
          {loading ? (
            <div className="cons-empty">Loading practice areas…</div>
          ) : items.length === 0 ? (
            <EmptyState
              eyebrow="Practice Areas"
              title="No practice areas"
              description="Add practice areas for client booking and lawyer specialization."
            />
          ) : (
            <table className="cons-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((area) => (
                  <tr key={area.id}>
                    <td className="cons-ref">{area.name}</td>
                    <td>{area.description || '—'}</td>
                    <td>
                      <span
                        className={`cons-status ${area.is_active ? 'is-approved' : 'is-cancelled'}`}
                      >
                        {area.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost-dark cons-table__action"
                        onClick={() => setModal({ open: true, mode: 'edit', area })}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PracticeAreaModal
        open={modal.open}
        mode={modal.mode}
        area={modal.area}
        accessToken={accessToken}
        onClose={() => setModal({ open: false, mode: 'create', area: null })}
        onSaved={load}
      />
    </DashboardLayout>
  );
}

export default AdminPracticeAreasPage;
