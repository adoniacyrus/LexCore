import { useCallback, useEffect, useMemo, useState } from 'react';
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
  listFilingGuidances,
  createFilingGuidance,
  updateFilingGuidance,
  deleteFilingGuidance,
} from '../../services/consultationService';
import './consultations.css';

const PAGE_SIZE = 10;
const EMPTY_PA = { name: '', description: '' };

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
  const [form, setForm] = useState(EMPTY_PA);
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
      setForm(EMPTY_PA);
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

function GuidanceModal({ open, mode, guidance, practiceAreas, accessToken, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  const [activeSubTab, setActiveSubTab] = useState('basic'); // 'basic' | 'content' | 'process'
  const [form, setForm] = useState({
    title: '',
    practice_area: '',
    overview: '',
    common_petition_types: '',
    documents_required: '',
    process_overview: [],
    what_to_prepare: '',
    disclaimer: '',
    is_active: true,
    display_order: 0,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveSubTab('basic');
    if (isEdit && guidance) {
      setForm({
        title: guidance.title || '',
        practice_area: guidance.practice_area ? String(guidance.practice_area) : '',
        overview: guidance.overview || '',
        common_petition_types: Array.isArray(guidance.common_petition_types)
          ? guidance.common_petition_types.join('\n')
          : '',
        documents_required: Array.isArray(guidance.documents_required)
          ? guidance.documents_required.join('\n')
          : '',
        process_overview: Array.isArray(guidance.process_overview)
          ? guidance.process_overview
          : [],
        what_to_prepare: Array.isArray(guidance.what_to_prepare)
          ? guidance.what_to_prepare.join('\n')
          : '',
        disclaimer: guidance.disclaimer || '',
        is_active: guidance.is_active !== undefined ? guidance.is_active : true,
        display_order: guidance.display_order || 0,
      });
    } else {
      setForm({
        title: '',
        practice_area: '',
        overview: '',
        common_petition_types: '',
        documents_required: '',
        process_overview: [
          { step: 1, title: 'Case Evaluation', description: 'Review merits, jurisdiction, and limitation period.' },
          { step: 2, title: 'Notice / Pleading Preparation', description: 'Issue notice or draft verified petition.' },
          { step: 3, title: 'Court Registry Filing', description: 'File with registry, cure scrutiny objections.' },
          { step: 4, title: 'Admission & Hearings', description: 'Appear before bench and advance arguments.' },
        ],
        what_to_prepare: '',
        disclaimer: '',
        is_active: true,
        display_order: 0,
      });
    }
    setError('');
    setSubmitting(false);
  }, [open, isEdit, guidance]);

  if (!open) return null;

  const handleStepChange = (index, field, value) => {
    setForm((prev) => {
      const nextSteps = [...prev.process_overview];
      nextSteps[index] = { ...nextSteps[index], [field]: value };
      return { ...prev, process_overview: nextSteps };
    });
  };

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      process_overview: [
        ...prev.process_overview,
        {
          step: prev.process_overview.length + 1,
          title: `Step ${prev.process_overview.length + 1}`,
          description: '',
        },
      ],
    }));
  };

  const removeStep = (index) => {
    setForm((prev) => {
      const nextSteps = prev.process_overview.filter((_, i) => i !== index);
      return {
        ...prev,
        process_overview: nextSteps.map((s, idx) => ({ ...s, step: idx + 1 })),
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.overview.trim()) {
      setError('Overview is required.');
      return;
    }
    setSubmitting(true);

    const payload = {
      title: form.title.trim(),
      practice_area: form.practice_area ? Number(form.practice_area) : null,
      overview: form.overview.trim(),
      common_petition_types: form.common_petition_types
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      documents_required: form.documents_required
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      process_overview: form.process_overview.filter((s) => s.title && s.title.trim()),
      what_to_prepare: form.what_to_prepare
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      disclaimer: form.disclaimer.trim(),
      is_active: form.is_active,
      display_order: Number(form.display_order) || 0,
    };

    try {
      const result = isEdit
        ? await updateFilingGuidance(accessToken, guidance.id, payload)
        : await createFilingGuidance(accessToken, payload);
      onSaved?.(result);
      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save filing guidance.'));
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
        style={{ maxWidth: '680px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cons-modal__header">
          <div>
            <p className="section-tag-gold">Firm Content Management</p>
            <h2>{isEdit ? 'Edit Petition Filing Guidance' : 'Add Filing Guidance Category'}</h2>
          </div>
          <button type="button" className="cons-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {/* Modal Sub-Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e0d8d4', margin: '0 1.5rem 1rem' }}>
          <button
            type="button"
            className={`btn btn-link ${activeSubTab === 'basic' ? 'fw-bold' : ''}`}
            style={{
              padding: '0.5rem 0.75rem',
              color: activeSubTab === 'basic' ? 'var(--color-primary)' : '#665b59',
              borderBottom: activeSubTab === 'basic' ? '2px solid var(--color-primary)' : 'none',
              textDecoration: 'none',
              borderRadius: 0,
            }}
            onClick={() => setActiveSubTab('basic')}
          >
            1. Category & Overview
          </button>
          <button
            type="button"
            className={`btn btn-link ${activeSubTab === 'content' ? 'fw-bold' : ''}`}
            style={{
              padding: '0.5rem 0.75rem',
              color: activeSubTab === 'content' ? 'var(--color-primary)' : '#665b59',
              borderBottom: activeSubTab === 'content' ? '2px solid var(--color-primary)' : 'none',
              textDecoration: 'none',
              borderRadius: 0,
            }}
            onClick={() => setActiveSubTab('content')}
          >
            2. Petitions & Documents
          </button>
          <button
            type="button"
            className={`btn btn-link ${activeSubTab === 'process' ? 'fw-bold' : ''}`}
            style={{
              padding: '0.5rem 0.75rem',
              color: activeSubTab === 'process' ? 'var(--color-primary)' : '#665b59',
              borderBottom: activeSubTab === 'process' ? '2px solid var(--color-primary)' : 'none',
              textDecoration: 'none',
              borderRadius: 0,
            }}
            onClick={() => setActiveSubTab('process')}
          >
            3. Process & Preparation
          </button>
        </div>

        <form className="cons-form auth-form cons-modal__form" onSubmit={handleSubmit} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {activeSubTab === 'basic' && (
            <div className="lw-fade-in">
              <label className="auth-field">
                <span>Matter Category Title *</span>
                <input
                  value={form.title}
                  placeholder="e.g. Civil Matters, Employment Matters"
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </label>

              <label className="auth-field">
                <span>Linked Practice Area (for consultation routing)</span>
                <select
                  value={form.practice_area}
                  onChange={(e) => setForm((p) => ({ ...p, practice_area: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    border: '1px solid #dfd8d4',
                    borderRadius: '6px',
                    background: '#fff',
                  }}
                >
                  <option value="">— Select Linked Practice Area (Optional) —</option>
                  {practiceAreas.map((pa) => (
                    <option key={pa.id} value={pa.id}>
                      {pa.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="auth-field">
                <span>What This Matter Generally Involves (Overview) *</span>
                <textarea
                  rows={4}
                  value={form.overview}
                  placeholder="Describe the nature of this matter category in plain, beginner-friendly language..."
                  onChange={(e) => setForm((p) => ({ ...p, overview: e.target.value }))}
                  required
                />
              </label>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
                <label className="auth-field" style={{ flex: '1' }}>
                  <span>Display Ordering (Lower displays first)</span>
                  <input
                    type="number"
                    min="0"
                    value={form.display_order}
                    onChange={(e) => setForm((p) => ({ ...p, display_order: e.target.value }))}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Active & Visible to Clients</span>
                </label>
              </div>
            </div>
          )}

          {activeSubTab === 'content' && (
            <div className="lw-fade-in">
              <label className="auth-field">
                <span>Common Petition & Application Types (One per line)</span>
                <textarea
                  rows={4}
                  value={form.common_petition_types}
                  placeholder="e.g.&#10;Suit for Recovery of Money&#10;Injunction Application&#10;Specific Performance Plaint"
                  onChange={(e) => setForm((p) => ({ ...p, common_petition_types: e.target.value }))}
                />
                <small style={{ color: '#7a6e6b' }}>Enter typical petitions or proceedings for this category, one per line.</small>
              </label>

              <label className="auth-field" style={{ marginTop: '1rem' }}>
                <span>Commonly Required Documents Checklist (One per line)</span>
                <textarea
                  rows={5}
                  value={form.documents_required}
                  placeholder="e.g.&#10;Identity & Address Proof (Aadhaar/PAN)&#10;Original signed agreement or contract&#10;Bank account statements or payment receipts&#10;Copies of written notices and reply letters"
                  onChange={(e) => setForm((p) => ({ ...p, documents_required: e.target.value }))}
                />
                <small style={{ color: '#7a6e6b' }}>Documents clients should check off or prepare, one per line.</small>
              </label>
            </div>
          )}

          {activeSubTab === 'process' && (
            <div className="lw-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>General Process Steps</span>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={addStep}>
                  + Add Step
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {form.process_overview.map((st, idx) => (
                  <div key={idx} style={{ padding: '0.75rem', background: '#fcfaf9', border: '1px solid #ebdcd5', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>Step {idx + 1}:</span>
                      <input
                        style={{ flex: 1, padding: '0.35rem 0.5rem', border: '1px solid #dfd8d4', borderRadius: '4px' }}
                        value={st.title || ''}
                        placeholder="Step title (e.g. Legal Notice)"
                        onChange={(e) => handleStepChange(idx, 'title', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '1.1rem' }}
                        title="Remove step"
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #dfd8d4', borderRadius: '4px', fontSize: '0.85rem' }}
                      value={st.description || ''}
                      placeholder="Brief description of this stage..."
                      onChange={(e) => handleStepChange(idx, 'description', e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <label className="auth-field">
                <span>Information to Prepare for Lawyer (One per line)</span>
                <textarea
                  rows={3}
                  value={form.what_to_prepare}
                  placeholder="e.g.&#10;Chronological timeline of events&#10;Names and addresses of all opposing parties&#10;Exact financial claim amount"
                  onChange={(e) => setForm((p) => ({ ...p, what_to_prepare: e.target.value }))}
                />
              </label>

              <label className="auth-field" style={{ marginTop: '0.75rem' }}>
                <span>Custom Category Disclaimer (Optional)</span>
                <textarea
                  rows={2}
                  value={form.disclaimer}
                  placeholder="Leave blank to use standard firm disclaimer notice..."
                  onChange={(e) => setForm((p) => ({ ...p, disclaimer: e.target.value }))}
                />
              </label>
            </div>
          )}

          {error ? (
            <p className="cons-error" role="alert" style={{ marginTop: '1rem' }}>
              {error}
            </p>
          ) : null}

          <div className="cons-actions" style={{ marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-ghost-dark" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminPracticeAreasPage() {
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState('areas'); // 'areas' | 'guidance'

  // Practice Areas State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, mode: 'create', area: null });

  // Filing Guidance State
  const [guidanceItems, setGuidanceItems] = useState([]);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [guidanceModal, setGuidanceModal] = useState({ open: false, mode: 'create', guidance: null });

  // Confirmation state
  const [confirm, setConfirm] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  const loadPracticeAreas = useCallback(async () => {
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

  const loadGuidances = useCallback(async () => {
    if (!accessToken) return;
    setGuidanceLoading(true);
    try {
      const data = await listFilingGuidances(accessToken);
      setGuidanceItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load filing guidance.'));
      setGuidanceItems([]);
    } finally {
      setGuidanceLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadPracticeAreas();
    loadGuidances();
  }, [loadPracticeAreas, loadGuidances]);

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
        loadPracticeAreas();
      } else if (confirm.type === 'activate') {
        result = await setPracticeAreaActive(accessToken, confirm.area.id, true);
        loadPracticeAreas();
      } else if (confirm.type === 'delete') {
        result = await deletePracticeArea(accessToken, confirm.area.id);
        loadPracticeAreas();
      } else if (confirm.type === 'deactivate_guidance') {
        result = await updateFilingGuidance(accessToken, confirm.guidance.id, { is_active: false });
        loadGuidances();
      } else if (confirm.type === 'activate_guidance') {
        result = await updateFilingGuidance(accessToken, confirm.guidance.id, { is_active: true });
        loadGuidances();
      } else if (confirm.type === 'delete_guidance') {
        result = await deleteFilingGuidance(accessToken, confirm.guidance.id);
        loadGuidances();
      }
      showToast('success', result?.message || 'Action completed.');
      setConfirm(null);
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
          title={activeTab === 'areas' ? 'Practice Areas' : 'Petition Filing Guidance'}
          description={
            activeTab === 'areas'
              ? 'Master list of legal practice areas used for booking and lawyer specialization.'
              : 'Configure structured guidance, petition types, required documents, and process steps.'
          }
          actions={
            activeTab === 'areas' ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModal({ open: true, mode: 'create', area: null })}
              >
                Add Practice Area
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setGuidanceModal({ open: true, mode: 'create', guidance: null })}
              >
                Add Guidance Category
              </button>
            )
          }
        />

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '0.75rem', margin: '0 0 1.25rem', borderBottom: '1px solid #e2dad4' }}>
          <button
            type="button"
            className="btn btn-link"
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.925rem',
              color: activeTab === 'areas' ? 'var(--color-primary)' : '#665b59',
              borderBottom: activeTab === 'areas' ? '3px solid var(--color-primary)' : '3px solid transparent',
              textDecoration: 'none',
              borderRadius: 0,
            }}
            onClick={() => setActiveTab('areas')}
          >
            Practice Areas ({items.length})
          </button>
          <button
            type="button"
            className="btn btn-link"
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.925rem',
              color: activeTab === 'guidance' ? 'var(--color-primary)' : '#665b59',
              borderBottom: activeTab === 'guidance' ? '3px solid var(--color-primary)' : '3px solid transparent',
              textDecoration: 'none',
              borderRadius: 0,
            }}
            onClick={() => setActiveTab('guidance')}
          >
            Petition Filing Guidance ({guidanceItems.length})
          </button>
        </div>

        {error ? (
          <p className="lw-directory__error" role="alert">
            {error}
          </p>
        ) : null}

        {/* TAB 1: Practice Areas Table */}
        {activeTab === 'areas' && (
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
                                    message: `Deactivate ${area.name}? It will no longer appear for booking until reactivated.`,
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
                                    message: `Activate ${area.name}? It will become available for booking.`,
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
                                  message: `Permanently delete "${area.name}"? This action cannot be undone.`,
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

            {sortedItems.length > 0 ? (
              <footer className="lw-directory__footer">
                <p className="lw-directory__count">
                  Showing <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> of{' '}
                  <strong>{sortedItems.length}</strong> practice areas
                </p>
                <div className="lw-directory__pagination">
                  <button
                    type="button"
                    className="lw-directory__page-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="lw-directory__page-info">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="lw-directory__page-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </footer>
            ) : null}
          </div>
        )}

        {/* TAB 2: Petition Filing Guidance Table */}
        {activeTab === 'guidance' && (
          <div className="lw-directory__table-wrap">
            {guidanceLoading ? (
              <div className="cons-empty">Loading guidance categories…</div>
            ) : guidanceItems.length === 0 ? (
              <EmptyState
                eyebrow="Petition Filing Guidance"
                title="No guidance categories"
                description="Create guidance categories to help clients understand matter procedures and prepare documents."
                actionLabel="Add Guidance Category"
                onAction={() => setGuidanceModal({ open: true, mode: 'create', guidance: null })}
              />
            ) : (
              <table className="lw-directory__table cons-table">
                <thead>
                  <tr>
                    <th>Category Title</th>
                    <th>Linked Practice Area</th>
                    <th>Checklist Items</th>
                    <th>Process Stages</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th className="lw-directory__actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {guidanceItems.map((g) => (
                    <tr key={g.id} className={g.is_active ? undefined : 'cons-row--inactive'}>
                      <td>
                        <strong className="cons-ref">{g.title}</strong>
                        <div style={{ fontSize: '0.8rem', color: '#665b59', maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.overview}
                        </div>
                      </td>
                      <td>
                        {g.practice_area_detail?.name ? (
                          <span className="fg-cat-badge">{g.practice_area_detail.name}</span>
                        ) : (
                          <span style={{ color: '#998e8b', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          {(g.documents_required || []).length} documents
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          {(g.process_overview || []).length} stages
                        </span>
                      </td>
                      <td>{g.display_order}</td>
                      <td>
                        <span className={`cons-status ${g.is_active ? 'is-approved' : 'is-rejected'}`}>
                          {g.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="lw-directory__actions-col">
                        <div className="lw-directory__row-actions">
                          <button
                            type="button"
                            className="lw-directory__action-btn"
                            title="Edit guidance"
                            aria-label={`Edit ${g.title}`}
                            onClick={() => setGuidanceModal({ open: true, mode: 'edit', guidance: g })}
                          >
                            <ActionIcon name="edit" />
                          </button>
                          {g.is_active ? (
                            <button
                              type="button"
                              className="lw-directory__action-btn"
                              title="Deactivate guidance"
                              aria-label={`Deactivate ${g.title}`}
                              onClick={() =>
                                setConfirm({
                                  type: 'deactivate_guidance',
                                  guidance: g,
                                  title: 'Deactivate Guidance Category',
                                  message: `Deactivate "${g.title}"? It will no longer appear to prospective clients.`,
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
                              title="Activate guidance"
                              aria-label={`Activate ${g.title}`}
                              onClick={() =>
                                setConfirm({
                                  type: 'activate_guidance',
                                  guidance: g,
                                  title: 'Activate Guidance Category',
                                  message: `Activate "${g.title}"? It will become visible to clients.`,
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
                            title="Delete guidance"
                            aria-label={`Delete ${g.title}`}
                            onClick={() =>
                              setConfirm({
                                type: 'delete_guidance',
                                guidance: g,
                                title: 'Delete Guidance Category',
                                message: `Permanently delete "${g.title}"? Clients will no longer see this guidance.`,
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
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Practice Area Modal */}
      <PracticeAreaModal
        open={modal.open}
        mode={modal.mode}
        area={modal.area}
        accessToken={accessToken}
        onClose={() => setModal({ open: false, mode: 'create', area: null })}
        onSaved={(savedArea) => {
          showToast(
            'success',
            modal.mode === 'edit'
              ? `Practice area "${savedArea.name}" updated successfully.`
              : `Practice area "${savedArea.name}" created successfully.`
          );
          loadPracticeAreas();
        }}
      />

      {/* Guidance Modal */}
      <GuidanceModal
        open={guidanceModal.open}
        mode={guidanceModal.mode}
        guidance={guidanceModal.guidance}
        practiceAreas={items}
        accessToken={accessToken}
        onClose={() => setGuidanceModal({ open: false, mode: 'create', guidance: null })}
        onSaved={(savedG) => {
          showToast(
            'success',
            guidanceModal.mode === 'edit'
              ? `Guidance category "${savedG.title}" updated successfully.`
              : `Guidance category "${savedG.title}" created successfully.`
          );
          loadGuidances();
        }}
      />

      {/* Confirmation Dialog */}
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
