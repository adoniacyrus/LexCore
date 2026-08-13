import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { deleteCaseDocument, getErrorMessage } from '../../services/caseService';
import './cases.css';

function DeleteDocumentConfirmModal({ open, documentObj, caseObj, onClose, onSuccess }) {
  const { accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

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

  // Reset states on open
  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccessMsg('');
    setSubmitting(false);
  }, [open]);

  if (!open || !documentObj || !caseObj) return null;

  const handleDelete = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await deleteCaseDocument(accessToken, documentObj.id);
      setSuccessMsg('Document deleted successfully.');
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 1200);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete document.'));
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
        aria-labelledby="delete-document-title"
      >
        {/* FIXED HEADER */}
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <span className="case-modal__ref">{caseObj.case_reference}</span>
            <h2 id="delete-document-title" className="case-modal__title" style={{ color: '#c0392b' }}>Delete Document</h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close Delete Modal"
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

          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.4', margin: '0 0 1rem 0' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--color-primary)' }}>{documentObj.title}</strong> from the case file?
            </p>
            <p style={{ fontSize: '0.82rem', color: '#c0392b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              ⚠ This action is permanent and cannot be undone.
            </p>
          </div>
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
            type="button"
            className="btn btn-primary"
            style={{ backgroundColor: '#c0392b', borderColor: '#c0392b' }}
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting ? 'Deleting Document…' : 'Delete Document'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default DeleteDocumentConfirmModal;
