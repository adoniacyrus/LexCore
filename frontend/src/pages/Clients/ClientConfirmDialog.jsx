import React, { useEffect, useRef } from 'react';
import './clients.css';

function ClientConfirmDialog({
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
      className="cli-modal-overlay"
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
      <div
        className="cli-modal cli-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cli-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cli-modal__header">
          <div>
            <p className="section-tag-gold">Confirm Action</p>
            <h2 id="cli-confirm-title">{title}</h2>
          </div>
          <button
            type="button"
            className="cli-modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
          >
            ×
          </button>
        </header>
        <p className="cli-confirm__message">{message}</p>
        <div className="cli-modal__actions">
          <button type="button" className="btn btn-ghost-dark" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'cli-btn-danger' : 'btn-primary'}`}
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

export default ClientConfirmDialog;
