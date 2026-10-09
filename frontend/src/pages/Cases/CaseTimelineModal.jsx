import React, { useEffect, useRef } from 'react';
import CaseTimeline from './CaseTimeline';
import './cases.css';

export default function CaseTimelineModal({
  open,
  onClose,
  caseObj,
  timelineData,
  loading,
  onRefresh,
  role,
}) {
  const backdropPointerDown = useRef(false);

  // Close on Escape key
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="case-modal-backdrop"
      role="presentation"
      onPointerDown={(e) => {
        backdropPointerDown.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (backdropPointerDown.current && e.target === e.currentTarget) {
          onClose?.();
        }
        backdropPointerDown.current = false;
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem',
      }}
    >
      <div
        className="case-modal case-modal--large"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-modal-title"
        style={{
          backgroundColor: '#fff',
          borderRadius: 'var(--border-radius-sm)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          width: '100%',
          maxWidth: '880px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* MODAL HEADER */}
        <header
          className="case-modal__header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: '#fbf9f8',
          }}
        >
          <div className="case-modal__title-group">
            <span
              className="case-modal__tag"
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-primary)',
                display: 'block',
                marginBottom: '0.2rem',
              }}
            >
              Case Progression & Standing
            </span>
            <h2
              id="timeline-modal-title"
              className="case-modal__title"
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--color-dark)',
              }}
            >
              {caseObj?.case_reference
                ? `${caseObj.case_reference} — Timeline & Progress Tracker`
                : 'Case Timeline & Progress Tracker'}
            </h2>
            {caseObj?.title && (
              <p
                style={{
                  margin: '0.15rem 0 0',
                  fontSize: '0.8rem',
                  color: '#64748b',
                }}
              >
                {caseObj.title}
              </p>
            )}
          </div>

          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.4rem',
              color: '#64748b',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            &times;
          </button>
        </header>

        {/* MODAL BODY */}
        <main
          className="case-modal__body"
          style={{
            padding: '1.15rem',
            overflowY: 'auto',
            maxHeight: 'calc(92vh - 130px)',
            backgroundColor: '#fcfbfa',
          }}
        >
          <CaseTimeline
            timelineData={timelineData}
            loading={loading}
            onRefresh={onRefresh}
            role={role}
          />
        </main>

        {/* MODAL FOOTER */}
        <footer
          className="case-modal__footer"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: '#fff',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {role === 'CLIENT'
              ? 'Client verified progression records'
              : 'Official audit trail synchronized with Hearing Records'}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost-dark btn-sm"
              onClick={onRefresh}
              disabled={loading}
              style={{ fontSize: '0.78rem' }}
            >
              ↻ Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onClose}
              style={{ fontSize: '0.78rem' }}
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
