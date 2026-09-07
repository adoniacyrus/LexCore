import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createCaseProceeding } from '../../services/hearingService';
import '../../pages/Cases/cases.css';

function AddCourtProceedingModal({ open, caseObj, onClose, onSuccess }) {
  const { accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

  // Form states
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('Hearing');
  const [courtName, setCourtName] = useState('');
  const [bench, setBench] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Keyboard close handler
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Load defaults
  useEffect(() => {
    if (!open || !caseObj) return;

    setError('');
    setSubmitting(false);

    // Autofill case court info if present
    setEventDate(new Date().toISOString().split('T')[0]);
    setEventType('Hearing');
    setCourtName(caseObj.court || '');
    setBench(caseObj.bench || '');
    setNextHearingDate('');
    setNotes('');
  }, [open, caseObj]);

  if (!open || !caseObj) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!eventDate || !eventType || !courtName) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        event_date: eventDate,
        event_type: eventType,
        court_name: courtName,
        bench,
        notes,
      };
      if (nextHearingDate) {
        payload.next_hearing_date = nextHearingDate;
      }
      await createCaseProceeding(accessToken, caseObj.id, payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record court proceeding.');
    } finally {
      setSubmitting(false);
    }
  };

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
        className="case-modal case-modal--small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-proceeding-title"
      >
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <p className="case-modal__tag">{caseObj.case_reference}</p>
            <h2 id="add-proceeding-title" className="case-modal__title">
              Record Court Proceeding
            </h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close form"
            disabled={submitting}
          >
            &times;
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <main className="case-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <p className="admin-dash__error" role="alert" style={{ margin: 0 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label className="auth-field">
                <span>Event Date *</span>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  disabled={submitting}
                  required
                />
              </label>

              <label className="auth-field">
                <span>Event Type *</span>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  disabled={submitting}
                  required
                >
                  <option value="Hearing">Court Hearing</option>
                  <option value="Filing">Filing / Submission</option>
                  <option value="Arguments">Arguments</option>
                  <option value="Order">Interim Order</option>
                  <option value="Judgment">Judgment / Final Order</option>
                  <option value="Other">Other Event</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label className="auth-field">
                <span>Court Name *</span>
                <input
                  type="text"
                  placeholder="e.g. District Court"
                  value={courtName}
                  onChange={(e) => setCourtName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </label>

              <label className="auth-field">
                <span>Bench / Division</span>
                <input
                  type="text"
                  placeholder="e.g. Civil Bench II"
                  value={bench}
                  onChange={(e) => setBench(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            <label className="auth-field">
              <span>Next Hearing Date (Optional)</span>
              <input
                type="date"
                value={nextHearingDate}
                onChange={(e) => setNextHearingDate(e.target.value)}
                disabled={submitting}
              />
            </label>

            <label className="auth-field">
              <span>Chamber & Filing Notes</span>
              <textarea
                placeholder="Details of what transpired or is required..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                }}
              />
            </label>
          </main>

          <footer className="case-modal__footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
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
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Recording…' : 'Record Proceeding'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default AddCourtProceedingModal;
