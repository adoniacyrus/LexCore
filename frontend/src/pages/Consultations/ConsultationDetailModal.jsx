import React, { useEffect, useRef } from 'react';
import {
  assignedLawyerLabel,
  formatPreferredDate,
  formatPreferredTime,
  practiceAreaLabel,
  STATUS_LABELS,
} from './consultationConstants';
import './consultations.css';

function DetailField({ label, children }) {
  return (
    <div className="cons-detail__field">
      <span className="cons-detail__label">{label}</span>
      <span className="cons-detail__value">{children}</span>
    </div>
  );
}

/**
 * Read-only detail view for a booked consultation request.
 */
function ConsultationDetailModal({ open, consultation, onClose }) {
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !consultation) return null;

  const statusLabel =
    consultation.status_label ||
    STATUS_LABELS[consultation.status] ||
    consultation.status;
  const modeLabel =
    consultation.consultation_mode_label || consultation.consultation_mode || '—';
  const practiceLabel = practiceAreaLabel(consultation);
  const lawyerLabel = assignedLawyerLabel(consultation);
  const submittedAt = consultation.created_at
    ? new Date(consultation.created_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className="cons-modal-overlay"
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
        className="cons-modal cons-modal--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cons-detail-title"
      >
        <header className="cons-modal__header">
          <div>
            <p className="section-tag-gold">Consultation Details</p>
            <h2 id="cons-detail-title">{consultation.consultation_id}</h2>
          </div>
          <button
            type="button"
            className="cons-modal__close"
            onClick={onClose}
            aria-label="Close details"
          >
            ×
          </button>
        </header>

        <div className="cons-detail">
          <div className="cons-detail__status-row">
            <span className={`cons-status is-${String(consultation.status).toLowerCase()}`}>
              {statusLabel}
            </span>
            {submittedAt ? (
              <span className="cons-detail__submitted">Submitted {submittedAt}</span>
            ) : null}
          </div>

          <div className="cons-detail__grid">
            <DetailField label="Subject">{consultation.subject || '—'}</DetailField>
            <DetailField label="Mode">{modeLabel}</DetailField>
            <DetailField label="Practice Area">{practiceLabel}</DetailField>
            <DetailField label="Assigned Lawyer">{lawyerLabel}</DetailField>
            <DetailField label="Preferred Date">
              {formatPreferredDate(consultation.preferred_date)}
            </DetailField>
            <DetailField label="Preferred Time">
              {formatPreferredTime(consultation.preferred_time)}
            </DetailField>
          </div>

          <div className="cons-detail__summary">
            <span className="cons-detail__label">Issue Summary</span>
            <p className="cons-detail__summary-text">
              {consultation.issue_summary?.trim()
                ? consultation.issue_summary
                : 'No additional details were provided.'}
            </p>
          </div>
        </div>

        <div className="cons-modal__actions">
          <button type="button" className="btn btn-ghost-dark" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConsultationDetailModal;
