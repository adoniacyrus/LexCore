import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateCase, getErrorMessage } from '../../services/caseService';
import './cases.css';

const STATUS_CHOICES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function ChangeCaseStatusModal({ open, caseObj, onClose, onSuccess }) {
  const { accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

  const [selectedStatus, setSelectedStatus] = useState('');
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

  // Reset/populate states on open
  useEffect(() => {
    if (!open || !caseObj) return;
    setSelectedStatus(caseObj.status || 'OPEN');
    setError('');
    setSuccessMsg('');
    setSubmitting(false);
  }, [open, caseObj]);

  if (!open || !caseObj) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStatus) return;

    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await updateCase(accessToken, caseObj.id, { status: selectedStatus });
      setSuccessMsg('Case status updated successfully.');
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 1200);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update case status.'));
      setSubmitting(false);
    }
  };

  const currentLabel = STATUS_CHOICES.find((opt) => opt.value === caseObj.status)?.label || caseObj.status;

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
        aria-labelledby="change-case-status-title"
      >
        {/* FIXED HEADER */}
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <span className="case-modal__ref">{caseObj.case_reference}</span>
            <h2 id="change-case-status-title" className="case-modal__title">Change Case Status</h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close Status Modal"
          >
            &times;
          </button>
        </header>

        {/* SCROLLABLE BODY */}
        <div className="case-modal__body" style={{ minHeight: 'auto' }}>
          {error ? (
            <p className="cases-error" role="alert">
              {error}
            </p>
          ) : null}

          {successMsg ? (
            <p className="cases-success" role="status">
              {successMsg}
            </p>
          ) : null}

          <form id="case-status-form" onSubmit={handleSubmit} className="case-form-card">
            
            <div style={{ marginBottom: '1.25rem' }}>
              <span className="case-label">Current Status</span>
              <div style={{ marginTop: '0.25rem' }}>
                <span className={`cons-status is-${String(caseObj.status).toLowerCase()}`}>
                  {currentLabel}
                </span>
              </div>
            </div>

            <div className="case-form-grid" style={{ gridTemplateColumns: '1fr', gap: '0' }}>
              <label className="auth-field">
                <span>New Status *</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  required
                  disabled={submitting}
                >
                  {STATUS_CHOICES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

          </form>
        </div>

        {/* FIXED FOOTER */}
        <footer className="case-modal__footer">
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
            form="case-status-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Updating Status…' : 'Update Status'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ChangeCaseStatusModal;
