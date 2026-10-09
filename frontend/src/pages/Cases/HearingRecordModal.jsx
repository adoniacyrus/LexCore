import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  createCaseHearingRecord,
  updateCaseHearingRecord,
} from '../../services/hearingService';
import { getErrorMessage } from '../../services/caseService';
import { NavIcon } from '../../components/dashboard/icons';
import './cases.css';

const HEARING_STAGE_OPTIONS = [
  'Regular Hearing',
  'Preliminary Hearing',
  'Framing of Issues',
  'Evidence & Examination',
  'Cross-Examination',
  'Interim Injunction / Stay',
  'Interlocutory Application',
  'Arguments',
  'Final Arguments',
  'Orders / Pronouncement of Judgment',
  'Compliance Hearing',
  'Mediation / Settlement Hearing',
  'Other',
];

function HearingRecordModal({
  open,
  mode = 'view', // 'view' | 'create' | 'edit'
  caseObj,
  hearingRecord,
  onClose,
  onSuccess,
  onSwitchToEdit,
}) {
  const { accessToken, user } = useAuth();
  const role = user?.role || 'CLIENT';
  const isClient = role === 'CLIENT';
  const backdropPointerDown = useRef(false);

  // Form states
  const [hearingDate, setHearingDate] = useState('');
  const [court, setCourt] = useState('');
  const [hearingType, setHearingType] = useState('Regular Hearing');
  const [proceedings, setProceedings] = useState('');
  const [outcome, setOutcome] = useState('');
  const [ordersOrDirections, setOrdersOrDirections] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Keyboard close handler
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Initialize form or view states
  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccessMsg('');
    setSubmitting(false);

    if (mode === 'create') {
      const today = new Date().toISOString().split('T')[0];
      setHearingDate(today);
      setCourt(caseObj?.court || '');
      setHearingType('Regular Hearing');
      setProceedings('');
      setOutcome('');
      setOrdersOrDirections('');
      setNextHearingDate('');
      setInternalNotes('');
    } else if (hearingRecord) {
      setHearingDate(hearingRecord.hearing_date || '');
      setCourt(hearingRecord.court || caseObj?.court || '');
      setHearingType(hearingRecord.hearing_type || 'Regular Hearing');
      setProceedings(hearingRecord.proceedings || '');
      setOutcome(hearingRecord.outcome || '');
      setOrdersOrDirections(hearingRecord.orders_or_directions || '');
      setNextHearingDate(hearingRecord.next_hearing_date || '');
      setInternalNotes(hearingRecord.internal_notes || '');
    }
  }, [open, mode, caseObj, hearingRecord]);

  if (!open) return null;

  const targetCaseId = caseObj?.case_reference || caseObj?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hearingDate) {
      setError('Hearing date is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    const payload = {
      hearing_date: hearingDate,
      court: court.trim(),
      hearing_type: hearingType,
      proceedings: proceedings.trim(),
      outcome: outcome.trim(),
      orders_or_directions: ordersOrDirections.trim(),
      next_hearing_date: nextHearingDate || null,
    };

    // Only internal roles can include internal_notes
    if (!isClient) {
      payload.internal_notes = internalNotes.trim();
    }

    try {
      if (mode === 'create') {
        await createCaseHearingRecord(accessToken, targetCaseId, payload);
        setSuccessMsg('Hearing record logged successfully.');
      } else {
        const hearingId = hearingRecord?.hearing_id || hearingRecord?.id;
        await updateCaseHearingRecord(accessToken, targetCaseId, hearingId, payload);
        setSuccessMsg('Hearing record updated successfully.');
      }
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 700);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save hearing record.'));
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const canManage =
    role === 'ADMIN' ||
    ((role === 'SENIOR_LAWYER' || role === 'JUNIOR_LAWYER') &&
      (caseObj?.responsible_lawyer?.id === user?.id || caseObj?.supervising_lawyer?.id === user?.id));

  return (
    <div
      className="case-modal-overlay"
      role="presentation"
      onPointerDown={(e) => {
        backdropPointerDown.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropPointerDown.current) {
          onClose?.();
        }
        backdropPointerDown.current = false;
      }}
    >
      <div
        className="case-modal case-modal--medium"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hearing-modal-title"
        style={{ maxWidth: '640px' }}
      >
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <p className="case-modal__tag">
              {mode === 'view' ? 'Official Hearing Record' : 'Court Hearing Log'}
            </p>
            <h2 id="hearing-modal-title" className="case-modal__title">
              {mode === 'view'
                ? `${hearingRecord?.hearing_id || 'Hearing'} — ${formatDate(hearingRecord?.hearing_date)}`
                : mode === 'create'
                ? 'Record Court Hearing'
                : `Edit Record (${hearingRecord?.hearing_id})`}
            </h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </header>

        <main className="case-modal__body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {error && <div className="cases-error">{error}</div>}
          {successMsg && <div className="cases-success">{successMsg}</div>}

          {mode === 'view' && hearingRecord ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* SUMMARY HIGHLIGHT BAR */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.65rem',
                  padding: '0.75rem',
                  backgroundColor: '#faf8f5',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#7a7371', fontWeight: 600, display: 'block' }}>
                    Hearing Date
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--color-primary)' }}>
                    {formatDate(hearingRecord.hearing_date)}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#7a7371', fontWeight: 600, display: 'block' }}>
                    Stage / Type
                  </span>
                  <span
                    className="case-tag-chip"
                    style={{
                      display: 'inline-block',
                      marginTop: '0.2rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: '#f5efe6',
                      color: 'var(--color-primary)',
                      border: '1px solid rgba(88, 28, 38, 0.2)',
                      padding: '0.1rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    {hearingRecord.hearing_type || 'Hearing'}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#7a7371', fontWeight: 600, display: 'block' }}>
                    Next Hearing
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: hearingRecord.next_hearing_date ? '#b45309' : '#888' }}>
                    {formatDate(hearingRecord.next_hearing_date)}
                  </strong>
                </div>
              </div>

              {/* COURT */}
              <div className="case-field">
                <span className="case-label">Court / Bench</span>
                <span className="case-value" style={{ fontWeight: 500 }}>
                  {hearingRecord.court || caseObj?.court || '—'}
                </span>
              </div>

              {/* OUTCOME */}
              {hearingRecord.outcome && (
                <div className="case-field">
                  <span className="case-label">Outcome / Disposition</span>
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#f8fafc',
                      borderLeft: '3px solid var(--color-primary)',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#1e293b',
                    }}
                  >
                    {hearingRecord.outcome}
                  </div>
                </div>
              )}

              {/* ORDERS & DIRECTIONS */}
              {hearingRecord.orders_or_directions && (
                <div className="case-field">
                  <span className="case-label">Judicial Orders & Directions</span>
                  <div
                    style={{
                      padding: '0.6rem 0.8rem',
                      backgroundColor: '#fffdfa',
                      border: '1px solid #ebd8b8',
                      borderLeft: '4px solid #c5a059',
                      borderRadius: '4px',
                      fontSize: '0.84rem',
                      lineHeight: '1.45',
                      color: '#2d2a29',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {hearingRecord.orders_or_directions}
                  </div>
                </div>
              )}

              {/* PROCEEDINGS */}
              {hearingRecord.proceedings && (
                <div className="case-field">
                  <span className="case-label">Summary of Proceedings</span>
                  <div
                    style={{
                      padding: '0.6rem 0.8rem',
                      backgroundColor: '#fff',
                      border: '1px solid var(--color-border)',
                      borderRadius: '4px',
                      fontSize: '0.84rem',
                      lineHeight: '1.5',
                      color: '#333',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {hearingRecord.proceedings}
                  </div>
                </div>
              )}

              {/* INTERNAL LAWYER NOTES (RESTRICTED TO LAWYERS/STAFF ONLY) */}
              {!isClient && hearingRecord.internal_notes && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderLeft: '4px solid #d97706',
                    borderRadius: '4px',
                    padding: '0.7rem 0.85rem',
                    marginTop: '0.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#92400e',
                      }}
                    >
                      Confidential Chamber Notes (Hidden from Client)
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.82rem',
                      lineHeight: '1.45',
                      color: '#78350f',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {hearingRecord.internal_notes}
                  </p>
                </div>
              )}

              {/* METADATA FOOTER */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #f0ebe6',
                  fontSize: '0.72rem',
                  color: '#8c8582',
                }}
              >
                <span>
                  Recorded by:{' '}
                  <strong>{hearingRecord.created_by_details?.full_name || hearingRecord.created_by_name || 'Legal Team'}</strong>
                </span>
                <span>Logged on: {formatDate(hearingRecord.created_at?.split('T')[0])}</span>
              </div>
            </div>
          ) : (
            /* CREATE OR EDIT FORM */
            <form id="hearing-record-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="case-field">
                  <label htmlFor="hr-date" className="case-label">
                    Hearing Date <span style={{ color: '#c0392b' }}>*</span>
                  </label>
                  <input
                    id="hr-date"
                    type="date"
                    required
                    value={hearingDate}
                    onChange={(e) => setHearingDate(e.target.value)}
                    className="cases-form-control"
                    style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  />
                </div>

                <div className="case-field">
                  <label htmlFor="hr-type" className="case-label">
                    Hearing Stage / Type
                  </label>
                  <select
                    id="hr-type"
                    value={hearingType}
                    onChange={(e) => setHearingType(e.target.value)}
                    className="cases-form-control"
                    style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  >
                    {HEARING_STAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                <div className="case-field">
                  <label htmlFor="hr-court" className="case-label">
                    Court / Bench / Forum
                  </label>
                  <input
                    id="hr-court"
                    type="text"
                    value={court}
                    onChange={(e) => setCourt(e.target.value)}
                    placeholder="e.g. Delhi High Court - Bench 2"
                    className="cases-form-control"
                    style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  />
                </div>

                <div className="case-field">
                  <label htmlFor="hr-next-date" className="case-label">
                    Next Hearing Date
                  </label>
                  <input
                    id="hr-next-date"
                    type="date"
                    value={nextHearingDate}
                    onChange={(e) => setNextHearingDate(e.target.value)}
                    className="cases-form-control"
                    style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div className="case-field">
                <label htmlFor="hr-outcome" className="case-label">
                  Hearing Outcome
                </label>
                <input
                  id="hr-outcome"
                  type="text"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="e.g. Arguments Heard, Adjourned, Interim Injunction Granted, Judgment Reserved"
                  className="cases-form-control"
                  style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                />
              </div>

              <div className="case-field">
                <label htmlFor="hr-proceedings" className="case-label">
                  What Happened During Hearing (Proceedings)
                </label>
                <textarea
                  id="hr-proceedings"
                  rows="3"
                  value={proceedings}
                  onChange={(e) => setProceedings(e.target.value)}
                  placeholder="Summarize arguments presented, appearance of counsels, court remarks, and discussion..."
                  className="cases-form-control"
                  style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>

              <div className="case-field">
                <label htmlFor="hr-orders" className="case-label">
                  Orders & Directions Issued by Court
                </label>
                <textarea
                  id="hr-orders"
                  rows="2"
                  value={ordersOrDirections}
                  onChange={(e) => setOrdersOrDirections(e.target.value)}
                  placeholder="Record specific judicial directions, compliance steps, deadlines, or interim orders..."
                  className="cases-form-control"
                  style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>

              {/* INTERNAL NOTES FOR LAWYERS ONLY */}
              {!isClient && (
                <div
                  style={{
                    backgroundColor: '#fffdf5',
                    border: '1px dashed #e2c08d',
                    borderRadius: '4px',
                    padding: '0.65rem 0.75rem',
                  }}
                >
                  <label
                    htmlFor="hr-internal-notes"
                    className="case-label"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}
                  >
                    <span>Internal Chamber Notes</span>
                    <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 600 }}>
                      Confidential (Hidden from client)
                    </span>
                  </label>
                  <textarea
                    id="hr-internal-notes"
                    rows="2"
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Private lawyer strategy observations, judge disposition, counsel preparation notes..."
                    className="cases-form-control"
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #ebd2ac', borderRadius: '4px', resize: 'vertical', background: '#fff' }}
                  />
                </div>
              )}
            </form>
          )}
        </main>

        <footer className="case-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          {mode === 'view' ? (
            <>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-ghost-dark"
                  onClick={() => onSwitchToEdit?.(hearingRecord)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <NavIcon name="edit" /> Edit Record
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Close
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost-dark"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="hearing-record-form"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Saving…' : mode === 'create' ? 'Save Hearing Record' : 'Save Changes'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

export default HearingRecordModal;
