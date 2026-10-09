import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { deleteCaseHearingRecord } from '../../services/hearingService';
import { getErrorMessage } from '../../services/caseService';
import './cases.css';

function DeleteHearingRecordModal({ open, hearingRecord, caseObj, onClose, onSuccess }) {
  const { accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccessMsg('');
    setSubmitting(false);
  }, [open]);

  if (!open || !hearingRecord || !caseObj) return null;

  const targetCaseId = caseObj.case_reference || caseObj.id;
  const targetHearingId = hearingRecord.hearing_id || hearingRecord.id;

  const handleDelete = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await deleteCaseHearingRecord(accessToken, targetCaseId, targetHearingId);
      setSuccessMsg('Hearing record deleted successfully.');
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 700);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete hearing record.'));
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
        aria-labelledby="delete-hearing-title"
      >
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <p className="case-modal__tag" style={{ color: '#c0392b' }}>Delete Confirmation</p>
            <h2 id="delete-hearing-title" className="case-modal__title">
              Delete Hearing Record
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

        <form onSubmit={handleDelete}>
          <main className="case-modal__body">
            {error && <div className="cases-error">{error}</div>}
            {successMsg && <div className="cases-success">{successMsg}</div>}

            <p style={{ fontSize: '0.86rem', color: '#4a4543', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to delete hearing record{' '}
              <strong>{hearingRecord.hearing_id || 'this hearing'}</strong> from{' '}
              <strong>{caseObj.case_reference}</strong>?
            </p>

            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.6rem 0.75rem',
                background: '#fdf2f2',
                border: '1px solid #f8b4b4',
                borderRadius: '4px',
                fontSize: '0.78rem',
                color: '#9b1c1c',
              }}
            >
              This action permanently removes the proceedings, orders, and outcome record for this hearing session.
            </div>
          </main>

          <footer className="case-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
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
              style={{ backgroundColor: '#c0392b', borderColor: '#b03526' }}
              disabled={submitting}
            >
              {submitting ? 'Deleting…' : 'Delete Record'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default DeleteHearingRecordModal;
