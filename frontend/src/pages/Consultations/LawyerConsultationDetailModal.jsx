import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  assignedLawyerLabel,
  formatPreferredDate,
  formatPreferredTime,
  practiceAreaLabel,
  STATUS_LABELS,
} from './consultationConstants';
import { useAuth } from '../../context/AuthContext';
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
  const { user } = useAuth();
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
  const practiceLabel = practiceAreaLabel(consultation) || consultation.practice_area_label || '—';
  const lawyerLabel = assignedLawyerLabel(consultation) || consultation.assigned_lawyer_name || 'Not Assigned';
  const clientName = consultation.client?.full_name || consultation.client_name || '—';
  const submittedAt = consultation.created_at
    ? new Date(consultation.created_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const effectiveRole = userRole || user?.role;
  const dashboardPath = getDashboardPath(effectiveRole);

  const isExistingCaseAppt =
    consultation.consultation_type === 'EXISTING_CASE' ||
    Boolean(consultation.case_appointment_id) ||
    Boolean(consultation.case_appointment_ref);

  const linkedCaseRef =
    consultation.case_reference ||
    consultation.case_appointment_ref ||
    (consultation.case_id ? `CASE-${consultation.case_id}` : null);

  const isAlreadyConverted = Boolean(consultation.case_id) || Boolean(consultation.case_reference);

  // An existing case appointment was never a new matter, so it cannot be converted to a case.
  // A new matter can be converted only if not already converted and accepted/completed.
  const isEligibleForConversion =
    !isExistingCaseAppt &&
    !isAlreadyConverted &&
    (consultation.status === 'ACCEPTED' || consultation.status === 'COMPLETED');

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
    const targetRef =
      consultation.case_reference ||
      consultation.case_appointment_ref ||
      consultation.case_id ||
      consultation.case_appointment_id;
    if (targetRef) {
      navigate(`${dashboardPath}/cases/${targetRef}`);
    }
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
                  backgroundColor: isExistingCaseAppt ? '#faf3e0' : '#f0f4f8',
                  color: isExistingCaseAppt ? '#855b1b' : '#2c4a6f',
                  border: '1px solid var(--color-border)',
                }}
              >
                {consultation.consultation_type_label || (isExistingCaseAppt ? 'Existing Case Appointment' : 'New Legal Matter')}
              </span>
            </div>
            {submittedAt ? (
              <span className="cons-detail__submitted">Submitted {submittedAt}</span>
            ) : null}
          </div>

          <div className="cons-detail__grid">
            <DetailField label="Subject">{consultation.subject || '—'}</DetailField>
            {(isExistingCaseAppt || isAlreadyConverted) && linkedCaseRef && (
              <DetailField label="Linked Case">
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                  {linkedCaseRef}
                </span>
              </DetailField>
            )}
            <DetailField label="Client Name">{clientName}</DetailField>
            <DetailField label="Mode">{modeLabel}</DetailField>
            <DetailField label="Practice Area">{practiceLabel}</DetailField>
            <DetailField label="Assigned Lawyer">{lawyerLabel}</DetailField>
            <DetailField label="Preferred Date">
              {formatPreferredDate(consultation.preferred_date)}
            </DetailField>
            <DetailField label="Preferred Time">
              {formatPreferredTime(consultation.preferred_time)}
            </DetailField>
            <DetailField label={isExistingCaseAppt ? 'Appointment Fee' : 'Consultation Fee'}>
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
            {isExistingCaseAppt || isAlreadyConverted ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
                  {isExistingCaseAppt
                    ? 'This consultation is an appointment scheduled for an active case.'
                    : 'This consultation has already been converted into a case matter.'}
                </p>
                {linkedCaseRef && (
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        backgroundColor: 'var(--color-primary)',
                        borderColor: 'var(--color-primary)',
                        color: '#fff',
                        fontWeight: 600,
                        padding: '0.45rem 1rem',
                        fontSize: '0.85rem',
                      }}
                      onClick={handleCaseLinkClick}
                    >
                      <span>Go to Case ({linkedCaseRef})</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                )}
              </div>
            ) : isEligibleForConversion ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#888280', margin: 0 }}>
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
              <p style={{ fontSize: '0.85rem', color: '#888280', fontStyle: 'italic', margin: 0 }}>
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
