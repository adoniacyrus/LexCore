import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateCaseAppointmentFee, getErrorMessage } from '../../services/caseService';
import './cases.css';

function EditAppointmentFeeModal({ open, caseObj, onClose, onSuccess }) {
  const { accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

  const [fee, setFee] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Keyboard close handler
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  // Reset/populate states on open
  useEffect(() => {
    if (!open || !caseObj) return;
    setFee(caseObj.appointment_fee !== null && caseObj.appointment_fee !== undefined ? String(caseObj.appointment_fee) : '');
    setError('');
    setSuccessMsg('');
    setSubmitting(false);
  }, [open, caseObj]);

  if (!open || !caseObj) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numFee = parseFloat(fee);
    if (isNaN(numFee) || numFee < 0) {
      setError('Please enter a valid positive monetary fee amount (e.g. 1500).');
      return;
    }

    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const targetId = caseObj.case_reference || caseObj.id;
      await updateCaseAppointmentFee(accessToken, targetId, numFee);
      setSuccessMsg('Case appointment fee updated successfully.');
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 900);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update case appointment fee.'));
      setSubmitting(false);
    }
  };

  const currentFeeDisplay =
    caseObj.appointment_fee !== null && caseObj.appointment_fee !== undefined
      ? `₹${Number(caseObj.appointment_fee).toLocaleString('en-IN')}`
      : 'Not configured';

  return (
    <div
      className="case-modal-overlay"
      role="presentation"
      onPointerDown={(e) => {
        backdropPointerDown.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropPointerDown.current && !submitting) {
          onClose?.();
        }
        backdropPointerDown.current = false;
      }}
    >
      <div
        className="case-modal case-modal--small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-appointment-fee-title"
      >
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <span className="case-modal__ref">{caseObj.case_reference}</span>
            <h2 id="edit-appointment-fee-title" className="case-modal__title">Configure Appointment Fee</h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close Fee Modal"
          >
            &times;
          </button>
        </header>

        <form onSubmit={handleSubmit} className="case-modal__body">
          {error && <p className="case-error" role="alert">{error}</p>}
          {successMsg && <p className="case-success" role="status">{successMsg}</p>}

          <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#faf9f6', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: '#888280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              Current Configured Fee
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              {currentFeeDisplay}
            </span>
            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.35rem', margin: 0 }}>
              This fee will be charged to the client when booking an appointment specifically for this case.
            </p>
          </div>

          <div className="case-field-group">
            <label htmlFor="appointment-fee-input" className="case-label" style={{ fontWeight: 600 }}>
              New Appointment Fee (₹ INR) <span style={{ color: '#c0392b' }}>*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '0.85rem', fontWeight: 700, color: '#666', fontSize: '1rem' }}>₹</span>
              <input
                id="appointment-fee-input"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 1500"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                disabled={submitting}
                style={{ paddingLeft: '2.2rem', width: '100%' }}
                className="case-input"
                required
                autoFocus
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#888280', marginTop: '0.35rem', display: 'block' }}>
              Only the responsible lawyer assigned to this case (or chambers admin) can adjust this fee. Historical bookings remain unchanged.
            </span>
          </div>

          <div className="case-modal__footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
              {submitting ? 'Saving Fee…' : 'Save Appointment Fee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditAppointmentFeeModal;
