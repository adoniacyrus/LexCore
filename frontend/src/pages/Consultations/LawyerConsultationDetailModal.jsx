import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  assignedLawyerLabel,
  formatPreferredDate,
  formatPreferredTime,
  practiceAreaLabel,
  STATUS_LABELS,
} from './consultationConstants';
import { getDashboardPath } from '../../utils/roleRoutes';
import './consultations.css';

function DetailField({ label, children }) {
  return (
    <div className="cons-detail__field">
      <span className="cons-detail__label">{label}</span>
      <span className="cons-detail__value">{children}</span>
    </div>
  );
}

function LawyerConsultationDetailModal({ open, consultation, userRole, onClose, onConvert }) {
  const navigate = useNavigate();
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

  const dashboardPath = getDashboardPath(userRole);
  const isEligibleForConversion =
    consultation.status === 'ACCEPTED' || consultation.status === 'COMPLETED';
  const isAlreadyConverted = Boolean(consultation.case_id);

  const handleConvertClick = () => {
    if (onConvert) {
      onConvert(consultation);
    } else {
      onClose?.();
      navigate(`${dashboardPath}/cases/convert/${consultation.consultation_id}`, {
        state: { consultation },
      });
    }
  };

  const handleCaseLinkClick = () => {
    onClose?.();
    navigate(`${dashboardPath}/cases/${consultation.case_reference || consultation.case_id}`);
  };

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
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`cons-status is-${String(consultation.status).toLowerCase()}`}>
                {statusLabel}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px',
                  backgroundColor: consultation.consultation_type === 'EXISTING_CASE' ? '#faf3e0' : '#f0f4f8',
                  color: consultation.consultation_type === 'EXISTING_CASE' ? '#855b1b' : '#2c4a6f',
                  border: '1px solid var(--color-border)',
                }}
              >
                {consultation.consultation_type_label || (consultation.consultation_type === 'EXISTING_CASE' ? 'Existing Case Appointment' : 'New Legal Matter')}
              </span>
            </div>
            {submittedAt ? (
              <span className="cons-detail__submitted">Submitted {submittedAt}</span>
            ) : null}
          </div>

          <div className="cons-detail__grid">
            <DetailField label="Subject">{consultation.subject || '—'}</DetailField>
            {consultation.consultation_type === 'EXISTING_CASE' && (
              <DetailField label="Linked Case">
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                  {consultation.case_appointment_ref || consultation.case_reference || 'Case File'}
                </span>
              </DetailField>
            )}
            <DetailField label="Client Name">{consultation.client?.full_name || '—'}</DetailField>
            <DetailField label="Mode">{modeLabel}</DetailField>
            <DetailField label="Practice Area">{practiceLabel}</DetailField>
            <DetailField label="Assigned Lawyer">{lawyerLabel}</DetailField>
            <DetailField label="Preferred Date">
              {formatPreferredDate(consultation.preferred_date)}
            </DetailField>
            <DetailField label="Preferred Time">
              {formatPreferredTime(consultation.preferred_time)}
            </DetailField>
            <DetailField label={consultation.consultation_type === 'EXISTING_CASE' ? 'Appointment Fee' : 'Consultation Fee'}>
              ₹{Number(consultation.charged_fee || consultation.fee_amount || 500).toLocaleString('en-IN')}
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

          {/* Case Conversion / Status link section */}
          <div className="cons-detail__summary" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
            {isAlreadyConverted ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="cons-detail__label" style={{ margin: 0 }}>Linked Case:</span>
                <button
                  type="button"
                  className="btn btn-ghost-dark"
                  style={{ textDecoration: 'underline', color: 'var(--color-primary)', fontWeight: 'bold', padding: '0.2rem 0.5rem', height: 'auto', fontSize: '0.9rem' }}
                  onClick={handleCaseLinkClick}
                >
                  {consultation.case_reference || 'View Case File'}
                </button>
              </div>
            ) : isEligibleForConversion ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#888280' }}>
                  This matter is eligible for conversion to a formal law firm case.
                </p>
                <div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: '#fff' }}
                    onClick={handleConvertClick}
                  >
                    Convert to Case
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#888280', fontStyle: 'italic' }}>
                Consultation must be Accepted or Completed before it can be converted to a case file.
              </p>
            )}
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

export default LawyerConsultationDetailModal;
