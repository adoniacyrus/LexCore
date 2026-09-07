import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  loadRazorpayScript,
  retryConsultationPayment,
  verifyPayment,
} from '../../services/paymentService';
import {
  assignedLawyerLabel,
  formatFeeAmount,
  formatPreferredDate,
  formatPreferredTime,
  paymentStatusLabel,
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
 * Detail view for a consultation request with payment status and retry support.
 */
function ConsultationDetailModal({ open, consultation, onClose, onUpdated }) {
  const { accessToken, user } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(consultation);
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    setCurrent(consultation);
    setError('');
    setRetrying(false);
    setVerifying(false);
  }, [consultation, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !retrying && !verifying) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, retrying, verifying, onClose]);

  if (!open || !current) return null;

  const isClient = user?.role === 'CLIENT';
  const isPaid = current.payment_status === 'PAID';
  const isPending = !current.payment_status || current.payment_status === 'PENDING';
  const isFailed = current.payment_status === 'FAILED';

  const statusLabel =
    current.status_label ||
    STATUS_LABELS[current.status] ||
    current.status;
  const modeLabel =
    current.consultation_mode_label || current.consultation_mode || '—';
  const practiceLabel = practiceAreaLabel(current);
  const lawyerLabel = assignedLawyerLabel(current);
  const submittedAt = current.created_at
    ? new Date(current.created_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const handleRetry = async () => {
    setError('');
    setRetrying(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to connect to Razorpay payment gateway.');
      }

      const retryRes = await retryConsultationPayment(accessToken, current.consultation_id);
      const order = retryRes.order;

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'LexCore Chambers',
        description: `Consultation Fee — ${current.consultation_id}`,
        order_id: order.order_id,
        prefill: {
          name: user?.full_name || '',
          email: user?.email || '',
          contact: user?.phone_number || '',
        },
        theme: {
          color: '#5c1d2e',
        },
        handler: async function (response) {
          setVerifying(true);
          try {
            const verifyRes = await verifyPayment(accessToken, {
              consultation_id: current.consultation_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const updated = verifyRes.consultation || { ...current, payment_status: 'PAID' };
            setCurrent(updated);
            onUpdated?.(updated);
          } catch (verifyErr) {
            setError(verifyErr?.response?.data?.detail || 'Payment verification failed.');
          } finally {
            setVerifying(false);
            setRetrying(false);
          }
        },
        modal: {
          ondismiss: function () {
            setRetrying(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setRetrying(false);
        setError(resp?.error?.description || 'Payment could not be completed.');
      });
      rzp.open();
    } catch (err) {
      setRetrying(false);
      setError(err?.response?.data?.detail || err.message || 'Unable to open checkout.');
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
        if (e.target === e.currentTarget && backdropPointerDown.current && !retrying && !verifying) {
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
            <h2 id="cons-detail-title">{current.consultation_id}</h2>
          </div>
          <button
            type="button"
            className="cons-modal__close"
            onClick={onClose}
            aria-label="Close details"
            disabled={retrying || verifying}
          >
            ×
          </button>
        </header>

        <div className="cons-detail">
          <div className="cons-detail__status-row">
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`cons-status is-${String(current.status).toLowerCase()}`}>
                {statusLabel}
              </span>
              <span
                className={`cons-status ${
                  isPaid ? 'is-approved' : isFailed ? 'is-rejected' : 'is-pending'
                }`}
              >
                {paymentStatusLabel(current)}
              </span>
            </div>
            {submittedAt ? (
              <span className="cons-detail__submitted">Submitted {submittedAt}</span>
            ) : null}
          </div>

          <div className="cons-detail__grid">
            <DetailField label="Subject">{current.subject || '—'}</DetailField>
            <DetailField label="Mode">{modeLabel}</DetailField>
            <DetailField label="Practice Area">{practiceLabel}</DetailField>
            <DetailField label="Assigned Lawyer">{lawyerLabel}</DetailField>
            <DetailField label="Preferred Date">
              {formatPreferredDate(current.preferred_date)}
            </DetailField>
            <DetailField label="Preferred Time">
              {formatPreferredTime(current.preferred_time)}
            </DetailField>
            <DetailField label="Payment Status">
              <span
                style={{
                  fontWeight: 600,
                  color: isPaid ? '#2f6b3a' : isFailed ? '#b42318' : '#8a6a2f',
                }}
              >
                {paymentStatusLabel(current)}
              </span>
            </DetailField>
            <DetailField label="Consultation Fee">
              {formatFeeAmount(current.fee_amount)}
            </DetailField>
          </div>

          <div className="cons-detail__summary">
            <span className="cons-detail__label">Issue Summary</span>
            <p className="cons-detail__summary-text">
              {current.issue_summary?.trim()
                ? current.issue_summary
                : 'No additional details were provided.'}
            </p>
          </div>

          {error ? <p className="cons-error" role="alert">{error}</p> : null}

          {isClient && !isPaid ? (
            <div className="cons-detail__unpaid-notice">
              <p>
                This consultation request is awaiting payment of{' '}
                <strong>{formatFeeAmount(current.fee_amount)}</strong>. Once payment is captured, our
                chambers will assign counsel to review your matter.
              </p>
            </div>
          ) : null}
        </div>

        <div className="cons-modal__actions">
          <button
            type="button"
            className="btn btn-ghost-dark"
            onClick={onClose}
            disabled={retrying || verifying}
          >
            Close
          </button>
          {isClient && !isPaid ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRetry}
              disabled={retrying || verifying}
            >
              {retrying || verifying ? (
                <>
                  <span className="auth-btn-spinner" aria-hidden="true" />
                  {verifying ? 'Verifying…' : 'Opening Checkout…'}
                </>
              ) : isFailed ? (
                'Retry Payment'
              ) : (
                'Pay Consultation Fee'
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ConsultationDetailModal;
