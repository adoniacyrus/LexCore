import React, { useEffect, useRef } from 'react';

function EmployeeConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}) {
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className="emp-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        backdropPointerDown.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (!busy && backdropPointerDown.current && e.target === e.currentTarget) {
          onClose?.();
        }
        backdropPointerDown.current = false;
      }}
    >
      <div className="emp-modal emp-confirm" role="alertdialog" aria-modal="true" aria-labelledby="emp-confirm-title">
        <header className="emp-modal-header">
          <div>
            <p className="section-tag-gold">Confirm Action</p>
            <h2 id="emp-confirm-title">{title}</h2>
          </div>
          <button
            type="button"
            className="emp-modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
          >
            ×
          </button>
        </header>
        <p className="auth-sheet-lede emp-confirm__message">{message}</p>
        <div className="emp-modal-actions">
          <button type="button" className="btn btn-ghost-dark" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'emp-btn-danger' : 'btn-primary'}`}
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

export default EmployeeConfirmDialog;
