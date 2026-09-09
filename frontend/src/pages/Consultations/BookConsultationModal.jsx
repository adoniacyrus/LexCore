import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  createConsultation,
  getErrorMessage,
  listEligibleCasesForAppointment,
  listPracticeAreas,
} from '../../services/consultationService';
import {
  loadRazorpayScript,
  retryConsultationPayment,
  verifyPayment,
} from '../../services/paymentService';
import {
  CONSULTATION_MODES,
  formatPreferredDate,
  formatPreferredTime,
  todayInputValue,
} from './consultationConstants';
import './consultations.css';

const EMPTY = {
  knowsPracticeArea: null,
  practice_area: '',
  subject: '',
  preferred_date: '',
  preferred_time: '',
  consultation_mode: 'OFFICE',
  issue_summary: '',
};

function BookConsultationModal({ open, onClose, onSubmitted, initialCase = null }) {
  const { accessToken, user } = useAuth();
  const [step, setStep] = useState('form'); // 'form' | 'review' | 'success' | 'failed'
  const [bookingType, setBookingType] = useState('NEW_MATTER'); // 'NEW_MATTER' | 'EXISTING_CASE'
  const [form, setForm] = useState(EMPTY);
  const [practiceAreas, setPracticeAreas] = useState([]);
  const [clientCases, setClientCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [createdConsultation, setCreatedConsultation] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    if (initialCase) {
      setBookingType('EXISTING_CASE');
      const isCaseActive = initialCase.status === 'OPEN' || initialCase.status === 'IN_PROGRESS';
      const hasLawyer = Boolean(initialCase.responsible_lawyer?.id || initialCase.responsible_lawyer?.full_name);
      const hasFee = initialCase.appointment_fee !== null && initialCase.appointment_fee !== undefined && Number(initialCase.appointment_fee) > 0;
      const isEligible = isCaseActive && hasLawyer && hasFee;

      let ineligibleReason = null;
      if (!isCaseActive) {
        ineligibleReason = `Case is ${initialCase.status_label || initialCase.status || 'inactive'} and not currently active.`;
      } else if (!hasLawyer) {
        ineligibleReason = 'This case currently has no responsible lawyer assigned. Please contact the firm.';
      } else if (!hasFee) {
        ineligibleReason = 'An appointment fee has not been configured for this case. Please contact the firm.';
      }

      setSelectedCase({
        id: initialCase.id,
        case_reference: initialCase.case_reference,
        title: initialCase.title,
        practice_area_name: initialCase.practice_area?.name || initialCase.practice_area_name || 'General Legal Matter',
        responsible_lawyer: initialCase.responsible_lawyer,
        appointment_fee: initialCase.appointment_fee,
        is_eligible: isEligible,
        ineligible_reason: ineligibleReason,
      });
    } else {
      setBookingType('NEW_MATTER');
      setSelectedCase(null);
    }
    setForm(EMPTY);
    setFieldErrors({});
    setError('');
    setSubmitting(false);
    setVerifying(false);
    setCreatedConsultation(null);
    setPendingOrder(null);
    backdropPointerDown.current = false;
  }, [open, initialCase]);

  useEffect(() => {
    if (!open || !accessToken || initialCase) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingCases(true);
      try {
        const [areasData, casesData] = await Promise.all([
          listPracticeAreas(accessToken),
          listEligibleCasesForAppointment(accessToken),
        ]);
        if (!cancelled) {
          setPracticeAreas(Array.isArray(areasData) ? areasData : []);
          setClientCases(Array.isArray(casesData) ? casesData : []);
        }
      } catch {
        if (!cancelled) {
          setPracticeAreas([]);
          setClientCases([]);
        }
      } finally {
        if (!cancelled) setLoadingCases(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, accessToken]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting && !verifying) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, verifying, onClose]);

  const selectedPracticeAreaName = useMemo(() => {
    if (bookingType === 'EXISTING_CASE') {
      return selectedCase?.practice_area_name || 'General Legal Matter';
    }
    if (form.knowsPracticeArea === false) {
      return 'General Consultation (Specialist to be assigned)';
    }
    const found = practiceAreas.find((a) => String(a.id) === String(form.practice_area));
    return found ? found.name : '—';
  }, [bookingType, selectedCase, form.knowsPracticeArea, form.practice_area, practiceAreas]);

  const selectedModeLabel = useMemo(() => {
    const found = CONSULTATION_MODES.find((m) => m.value === form.consultation_mode);
    return found ? found.label : form.consultation_mode;
  }, [form.consultation_mode]);

  const effectiveFee = useMemo(() => {
    if (bookingType === 'EXISTING_CASE' && selectedCase) {
      return Number(selectedCase.appointment_fee) || 0;
    }
    return 500;
  }, [bookingType, selectedCase]);

  if (!open) return null;

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const setKnows = (value) => {
    setForm((prev) => ({
      ...prev,
      knowsPracticeArea: value,
      practice_area: value ? prev.practice_area : '',
    }));
    setFieldErrors((prev) => ({ ...prev, practice_area: '', knowsPracticeArea: '' }));
  };

  const handleSelectCase = (c) => {
    if (!c.is_eligible) return;
    setSelectedCase(c);
    setFieldErrors((prev) => ({ ...prev, case_id: '' }));
    setError('');
  };

  const validate = () => {
    const next = {};

    if (bookingType === 'EXISTING_CASE') {
      if (!selectedCase) {
        next.case_id = 'Please select an existing case for this appointment.';
      } else if (!selectedCase.is_eligible) {
        next.case_id = selectedCase.ineligible_reason || 'This case is currently not eligible for booking.';
      }
    } else {
      if (form.knowsPracticeArea === null) {
        next.knowsPracticeArea = 'Please indicate whether you know the legal service required.';
      }
      if (form.knowsPracticeArea === true && !form.practice_area) {
        next.practice_area = 'Please select a practice area.';
      }
      if (!form.subject.trim()) next.subject = 'Subject is required.';
    }

    if (!form.preferred_date) next.preferred_date = 'Preferred date is required.';
    else if (form.preferred_date < todayInputValue()) {
      next.preferred_date = 'Preferred date cannot be before today.';
    }
    if (!form.preferred_time) next.preferred_time = 'Preferred time is required.';
    if (!form.consultation_mode) next.consultation_mode = 'Consultation mode is required.';

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleProceedToReview = (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setStep('review');
  };

  const launchRazorpayCheckout = (order, consultation) => {
    if (!window.Razorpay) {
      setError('Razorpay SDK failed to load. Please verify your connection.');
      setSubmitting(false);
      return;
    }

    const desc =
      bookingType === 'EXISTING_CASE' && selectedCase
        ? `Case Appointment Fee — ${selectedCase.case_reference}`
        : `Consultation Fee — ${consultation.consultation_id}`;

    const options = {
      key: order.key_id,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'LexCore Chambers',
      description: desc,
      order_id: order.order_id,
      prefill: {
        name: user?.full_name || '',
        email: user?.email || '',
        contact: user?.phone_number || '',
      },
      theme: {
        color: '#5c1d2e', // LexCore primary maroon
      },
      handler: async function (response) {
        setVerifying(true);
        setError('');
        try {
          const verifyRes = await verifyPayment(accessToken, {
            consultation_id: consultation.consultation_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          const updated = verifyRes.consultation || consultation;
          setCreatedConsultation(updated);
          setStep('success');
          onSubmitted?.(updated);
        } catch (verifyErr) {
          setError(getErrorMessage(verifyErr, 'Payment verification failed.'));
          setStep('failed');
        } finally {
          setVerifying(false);
          setSubmitting(false);
        }
      },
      modal: {
        ondismiss: function () {
          setSubmitting(false);
          setStep('failed');
          setError('Payment window was closed before completion. You can retry anytime.');
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setSubmitting(false);
        setStep('failed');
        setError(resp?.error?.description || 'Payment could not be completed.');
      });
      rzp.open();
    } catch (err) {
      setSubmitting(false);
      setError('Unable to open payment checkout.');
      setStep('failed');
    }
  };

  const handlePayAndSubmit = async () => {
    setError('');
    setSubmitting(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to connect to Razorpay payment gateway.');
      }

      let consultation = createdConsultation;
      let order = pendingOrder;

      if (!consultation || !order) {
        const payload =
          bookingType === 'EXISTING_CASE'
            ? {
                consultation_type: 'EXISTING_CASE',
                case_id: selectedCase.case_reference || selectedCase.id,
                preferred_date: form.preferred_date,
                preferred_time: form.preferred_time,
                consultation_mode: form.consultation_mode,
                issue_summary: form.issue_summary.trim(),
                subject: form.subject.trim() || `Appointment: ${selectedCase.case_reference}`,
              }
            : {
                consultation_type: 'NEW_MATTER',
                knows_practice_area: form.knowsPracticeArea,
                practice_area: form.knowsPracticeArea ? Number(form.practice_area) : null,
                subject: form.subject.trim(),
                preferred_date: form.preferred_date,
                preferred_time: form.preferred_time,
                consultation_mode: form.consultation_mode,
                issue_summary: form.issue_summary.trim(),
              };

        const responseData = await createConsultation(accessToken, payload);

        consultation = responseData;
        order = responseData.order;
        setCreatedConsultation(consultation);
        setPendingOrder(order);
      }

      if (!order?.order_id) {
        throw new Error('Payment order could not be generated. Please try again.');
      }

      launchRazorpayCheckout(order, consultation);
    } catch (err) {
      setSubmitting(false);
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        const mapped = {};
        Object.entries(data).forEach(([key, val]) => {
          if (Array.isArray(val)) mapped[key] = val[0];
          else if (typeof val === 'string') mapped[key] = val;
        });
        if (Object.keys(mapped).length) setFieldErrors((prev) => ({ ...prev, ...mapped }));
      }
      setError(getErrorMessage(err, 'Unable to initialize consultation payment.'));
    }
  };

  const handleRetryPayment = async () => {
    if (!createdConsultation) return;
    setError('');
    setSubmitting(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to connect to Razorpay payment gateway.');
      }

      const retryRes = await retryConsultationPayment(accessToken, createdConsultation.consultation_id);
      const order = retryRes.order;
      setPendingOrder(order);

      launchRazorpayCheckout(order, createdConsultation);
    } catch (err) {
      setSubmitting(false);
      setError(getErrorMessage(err, 'Unable to initiate payment retry.'));
    }
  };

  return (
    <div
      className="cons-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        backdropPointerDown.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (!submitting && !verifying && backdropPointerDown.current && e.target === e.currentTarget) {
          onClose?.();
        }
        backdropPointerDown.current = false;
      }}
    >
      <div
        className={`cons-modal ${step === 'review' || step === 'success' || step === 'failed' ? 'cons-modal--checkout' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cons-book-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cons-modal__header">
          <div>
            <p className="section-tag-gold">Legal Services</p>
            <h2 id="cons-book-title">
              {step === 'form' && (bookingType === 'EXISTING_CASE' ? 'Book Appointment' : 'Book Consultation')}
              {step === 'review' && (bookingType === 'EXISTING_CASE' ? 'Review & Pay Appointment Fee' : 'Consultation & Fee Review')}
              {step === 'success' && 'Appointment Confirmed'}
              {step === 'failed' && 'Payment Incomplete'}
            </h2>
          </div>
          <button
            type="button"
            className="cons-modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={submitting || verifying}
          >
            ×
          </button>
        </header>

        {/* STEP 1: FORM INPUTS */}
        {step === 'form' && (
          <form className="cons-form auth-form cons-modal__form" onSubmit={handleProceedToReview} noValidate>
            
            {/* BOOKING TYPE SELECTOR */}
            {!initialCase && (
              <div className="cons-category-selector" style={{ marginBottom: '0.15rem' }}>
                <p className="cons-choice-label" style={{ marginBottom: '0.15rem', fontWeight: 600 }}>
                  What would you like to book?
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingType('NEW_MATTER');
                      setError('');
                      setFieldErrors({});
                    }}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: bookingType === 'NEW_MATTER' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: bookingType === 'NEW_MATTER' ? '#fdf8f9' : '#fff',
                      color: bookingType === 'NEW_MATTER' ? 'var(--color-primary)' : '#444',
                      fontWeight: bookingType === 'NEW_MATTER' ? '600' : '500',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', marginBottom: '0.04rem' }}>New Legal Matter</div>
                    <div style={{ fontSize: '0.68rem', color: '#777', lineHeight: 1.2 }}>Intake consultation for a new legal dispute or advisory</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBookingType('EXISTING_CASE');
                      setError('');
                      setFieldErrors({});
                    }}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: bookingType === 'EXISTING_CASE' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: bookingType === 'EXISTING_CASE' ? '#fdf8f9' : '#fff',
                      color: bookingType === 'EXISTING_CASE' ? 'var(--color-primary)' : '#444',
                      fontWeight: bookingType === 'EXISTING_CASE' ? '600' : '500',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', marginBottom: '0.04rem' }}>Appointment for Existing Case</div>
                    <div style={{ fontSize: '0.68rem', color: '#777', lineHeight: 1.2 }}>Meet with the assigned lead counsel on your active matter</div>
                  </button>
                </div>
              </div>
            )}

            {/* FLOW A: NEW LEGAL MATTER */}
            {bookingType === 'NEW_MATTER' && (
              <>
                <div className="cons-choice-group">
                  <p className="cons-choice-label">Do you know which legal service you require?</p>
                  <div className="cons-choice-options">
                    <label className={`cons-choice ${form.knowsPracticeArea === true ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="knowsPracticeArea"
                        checked={form.knowsPracticeArea === true}
                        onChange={() => setKnows(true)}
                      />
                      Yes
                    </label>
                    <label className={`cons-choice ${form.knowsPracticeArea === false ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="knowsPracticeArea"
                        checked={form.knowsPracticeArea === false}
                        onChange={() => setKnows(false)}
                      />
                      I&apos;m not sure
                    </label>
                  </div>
                  {fieldErrors.knowsPracticeArea ? (
                    <p className="cons-error" role="alert">{fieldErrors.knowsPracticeArea}</p>
                  ) : null}
                </div>

                {form.knowsPracticeArea === true ? (
                  <label className="auth-field">
                    <span>Practice Area</span>
                    <select name="practice_area" value={form.practice_area} onChange={onChange}>
                      <option value="">Select a practice area</option>
                      {practiceAreas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.practice_area ? (
                      <span className="invalid-feedback d-block">{fieldErrors.practice_area}</span>
                    ) : null}
                  </label>
                ) : null}

                {form.knowsPracticeArea === false ? (
                  <p className="cons-hint cons-hint--compact">
                    Our team will review your matter and assign the appropriate specialist.
                  </p>
                ) : null}

                <label className="auth-field">
                  <span>Subject</span>
                  <input
                    name="subject"
                    type="text"
                    value={form.subject}
                    onChange={onChange}
                    placeholder="Brief title for your consultation"
                    required
                  />
                  {fieldErrors.subject ? (
                    <span className="invalid-feedback d-block">{fieldErrors.subject}</span>
                  ) : null}
                </label>
              </>
            )}

            {/* FLOW B: EXISTING CASE APPOINTMENT */}
            {bookingType === 'EXISTING_CASE' && (
              <div style={{ marginBottom: '0.25rem' }}>
                <p className="cons-choice-label" style={{ marginBottom: '0.25rem', fontWeight: 600 }}>
                  Select Your Case
                </p>

                {loadingCases ? (
                  <p className="cons-hint" style={{ padding: '1rem', textAlign: 'center' }}>
                    Loading your cases…
                  </p>
                ) : clientCases.length === 0 ? (
                  <div style={{ padding: '1rem', border: '1px dashed var(--color-border)', borderRadius: '6px', background: '#faf9f6', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
                      No active cases found in your account. To open a new legal file, please book a New Legal Matter.
                    </p>
                  </div>
                ) : !selectedCase ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {clientCases.map((c) => {
                      const isEligible = c.is_eligible;
                      return (
                        <div
                          key={c.id}
                          onClick={() => isEligible && handleSelectCase(c)}
                          style={{
                            padding: '0.75rem 0.9rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px',
                            background: isEligible ? '#fff' : '#f9f8f7',
                            cursor: isEligible ? 'pointer' : 'not-allowed',
                            opacity: isEligible ? 1 : 0.7,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-primary)' }}>
                                {c.case_reference}
                              </span>
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#222' }}>
                                {c.title}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#666' }}>
                              Lead Counsel: <strong>{c.responsible_lawyer ? c.responsible_lawyer.full_name : 'None assigned'}</strong>
                            </div>
                            {!isEligible && (
                              <span style={{ fontSize: '0.72rem', color: '#c0392b', fontWeight: 500 }}>
                                {c.ineligible_reason}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                            {c.appointment_fee !== null && c.appointment_fee !== undefined ? (
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                                ₹{Number(c.appointment_fee).toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#888', fontStyle: 'italic' }}>Fee not set</span>
                            )}
                            <button
                              type="button"
                              className={`btn ${isEligible ? 'btn-ghost-dark' : 'btn-ghost-dark disabled'}`}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', height: 'auto', minHeight: 'auto' }}
                              disabled={!isEligible}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCase(c);
                              }}
                            >
                              Select
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* SELECTED CASE BANNER */
                  <div style={{
                    padding: '0.55rem 0.8rem',
                    background: '#fcfaf6',
                    border: '1px solid #ebdcc5',
                    borderRadius: '6px',
                    marginBottom: '0.35rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-primary)' }}>
                            {selectedCase.case_reference}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#222' }}>
                            {selectedCase.title}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#555', marginBottom: '0.25rem' }}>
                          Lead Counsel: <strong>{selectedCase.responsible_lawyer?.full_name || 'Assigned Counsel'}</strong>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#555' }}>
                          Appointment Fee: <strong style={{ color: 'var(--color-primary)' }}>₹{Number(selectedCase.appointment_fee).toLocaleString('en-IN')}</strong>
                        </div>
                      </div>
                      {!initialCase && (
                        <button
                          type="button"
                          className="btn btn-ghost-dark"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', height: 'auto', minHeight: 'auto' }}
                          onClick={() => setSelectedCase(null)}
                        >
                          Change Case
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {fieldErrors.case_id ? (
                  <p className="cons-error" role="alert" style={{ marginTop: '0.5rem' }}>
                    {fieldErrors.case_id}
                  </p>
                ) : null}
              </div>
            )}

            {/* COMMON APPOINTMENT DATE & TIME */}
            <div className="cons-grid-2">
              <label className="auth-field">
                <span>Preferred Date</span>
                <input
                  name="preferred_date"
                  type="date"
                  min={todayInputValue()}
                  value={form.preferred_date}
                  onChange={onChange}
                  required
                />
                {fieldErrors.preferred_date ? (
                  <span className="invalid-feedback d-block">{fieldErrors.preferred_date}</span>
                ) : null}
              </label>

              <label className="auth-field">
                <span>Preferred Time</span>
                <input
                  name="preferred_time"
                  type="time"
                  value={form.preferred_time}
                  onChange={onChange}
                  required
                />
                {fieldErrors.preferred_time ? (
                  <span className="invalid-feedback d-block">{fieldErrors.preferred_time}</span>
                ) : null}
              </label>
            </div>

            <label className="auth-field">
              <span>Consultation Mode</span>
              <select
                name="consultation_mode"
                value={form.consultation_mode}
                onChange={onChange}
                required
              >
                {CONSULTATION_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
              {fieldErrors.consultation_mode ? (
                <span className="invalid-feedback d-block">{fieldErrors.consultation_mode}</span>
              ) : null}
            </label>

            <label className="auth-field">
              <span>
                {bookingType === 'EXISTING_CASE' ? 'Reason / Notes for Appointment' : 'Issue Summary'}{' '}
                <em style={{ fontStyle: 'normal', opacity: 0.7 }}>(optional)</em>
              </span>
              <textarea
                name="issue_summary"
                rows={2}
                value={form.issue_summary}
                onChange={onChange}
                placeholder={
                  bookingType === 'EXISTING_CASE'
                    ? 'Notes or questions regarding this case for the advocate'
                    : 'Optional background for preparation'
                }
              />
            </label>

            {error ? <p className="cons-error" role="alert">{error}</p> : null}

            <div className="cons-actions">
              <button
                type="button"
                className="btn btn-ghost-dark"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Review &amp; Pay
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: SUMMARY & FEE CONFIRMATION */}
        {step === 'review' && (
          <div className="cons-review-step">
            <div className="cons-review-card">
              <h3 className="cons-review-title">
                {bookingType === 'EXISTING_CASE' ? 'Case Appointment Summary' : 'Consultation Summary'}
              </h3>
              <div className="cons-review-grid">
                {bookingType === 'EXISTING_CASE' ? (
                  <>
                    <div className="cons-review-item">
                      <span className="cons-review-label">Case Reference</span>
                      <span className="cons-review-value" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {selectedCase?.case_reference}
                      </span>
                    </div>
                    <div className="cons-review-item">
                      <span className="cons-review-label">Case Title</span>
                      <span className="cons-review-value">{selectedCase?.title}</span>
                    </div>
                    <div className="cons-review-item">
                      <span className="cons-review-label">Assigned Lawyer</span>
                      <span className="cons-review-value">{selectedCase?.responsible_lawyer?.full_name}</span>
                    </div>
                    <div className="cons-review-item">
                      <span className="cons-review-label">Mode</span>
                      <span className="cons-review-value">{selectedModeLabel}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="cons-review-item">
                      <span className="cons-review-label">Practice Area</span>
                      <span className="cons-review-value">{selectedPracticeAreaName}</span>
                    </div>
                    <div className="cons-review-item">
                      <span className="cons-review-label">Subject</span>
                      <span className="cons-review-value">{form.subject}</span>
                    </div>
                    <div className="cons-review-item">
                      <span className="cons-review-label">Mode</span>
                      <span className="cons-review-value">{selectedModeLabel}</span>
                    </div>
                  </>
                )}
                <div className="cons-review-item">
                  <span className="cons-review-label">Preferred Slot</span>
                  <span className="cons-review-value">
                    {formatPreferredDate(form.preferred_date)} at {formatPreferredTime(form.preferred_time)}
                  </span>
                </div>
              </div>

              {form.issue_summary?.trim() ? (
                <div className="cons-review-summary-box">
                  <span className="cons-review-label">
                    {bookingType === 'EXISTING_CASE' ? 'Reason / Notes' : 'Summary'}
                  </span>
                  <p>{form.issue_summary}</p>
                </div>
              ) : null}
            </div>

            {/* FEE CARD */}
            <div className="cons-fee-card">
              <div className="cons-fee-row">
                <div>
                  <span className="cons-fee-title">
                    {bookingType === 'EXISTING_CASE' ? 'Case Appointment Fee' : 'Consultation Fee'}
                  </span>
                  <p className="cons-fee-desc">
                    {bookingType === 'EXISTING_CASE'
                      ? `Configured by lead counsel ${selectedCase?.responsible_lawyer?.full_name || 'Advocate'}`
                      : 'Standard initial consultation with legal counsel'}
                  </p>
                </div>
                <div className="cons-fee-amount">
                  ₹{Number(effectiveFee).toLocaleString('en-IN')}<span className="cons-fee-currency">.00</span>
                </div>
              </div>
              <div className="cons-fee-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
                <span>Secured by Razorpay · Official Test Mode</span>
              </div>
            </div>

            {error ? <p className="cons-error" role="alert">{error}</p> : null}

            <div className="cons-actions">
              <button
                type="button"
                className="btn btn-ghost-dark"
                onClick={() => setStep('form')}
                disabled={submitting || verifying}
              >
                Back to Edit
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePayAndSubmit}
                disabled={submitting || verifying}
              >
                {submitting || verifying ? (
                  <>
                    <span className="auth-btn-spinner" aria-hidden="true" />
                    {verifying ? 'Verifying Payment…' : 'Opening Checkout…'}
                  </>
                ) : (
                  bookingType === 'EXISTING_CASE' ? 'Pay & Book Appointment' : 'Pay & Submit Consultation'
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PAYMENT SUCCESS */}
        {step === 'success' && (
          <div className="cons-feedback-step is-success">
            <div className="cons-feedback-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <p className="section-tag-gold" style={{ marginTop: '0.5rem', marginBottom: '0.2rem' }}>
              {bookingType === 'EXISTING_CASE' ? 'Case Appointment Confirmed' : 'Consultation Request Submitted'}
            </p>
            <h3 className="cons-feedback-title">Payment Successful</h3>
            <p className="cons-feedback-desc">
              {bookingType === 'EXISTING_CASE'
                ? `Your appointment with ${selectedCase?.responsible_lawyer?.full_name || 'counsel'} regarding ${selectedCase?.case_reference} is confirmed.`
                : 'Your consultation request has been confirmed and submitted to our chambers.'}
            </p>

            <div className="cons-receipt-card">
              <div className="cons-receipt-row">
                <span className="cons-receipt-label">Booking Reference</span>
                <span className="cons-receipt-value cons-ref">
                  {createdConsultation?.consultation_id || 'CONS-2026-XXXX'}
                </span>
              </div>
              {bookingType === 'EXISTING_CASE' && selectedCase && (
                <div className="cons-receipt-row">
                  <span className="cons-receipt-label">Case</span>
                  <span className="cons-receipt-value" style={{ fontWeight: 600 }}>
                    {selectedCase.case_reference}
                  </span>
                </div>
              )}
              <div className="cons-receipt-row">
                <span className="cons-receipt-label">Amount Paid</span>
                <span className="cons-receipt-value" style={{ fontWeight: 700 }}>
                  ₹{Number(createdConsultation?.charged_fee || effectiveFee).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="cons-receipt-row">
                <span className="cons-receipt-label">Payment Status</span>
                <span className="cons-status is-approved">PAID</span>
              </div>
            </div>

            <div className="cons-actions" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onSubmitted?.(createdConsultation);
                  onClose?.();
                }}
              >
                View Details
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PAYMENT FAILED / RETRY */}
        {step === 'failed' && (
          <div className="cons-feedback-step is-failed">
            <div className="cons-feedback-icon is-danger" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b42318" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="cons-feedback-title">Payment Failed</h3>
            <p className="cons-feedback-desc">
              Payment could not be completed. Your booking details are saved. You can retry payment now without re-entering the form.
            </p>

            {createdConsultation?.consultation_id ? (
              <div className="cons-receipt-card">
                <div className="cons-receipt-row">
                  <span className="cons-receipt-label">Reference</span>
                  <span className="cons-receipt-value cons-ref">
                    {createdConsultation.consultation_id}
                  </span>
                </div>
                <div className="cons-receipt-row">
                  <span className="cons-receipt-label">Payment</span>
                  <span className="cons-status is-rejected">PAYMENT PENDING / FAILED</span>
                </div>
              </div>
            ) : null}

            {error ? <p className="cons-error" role="alert">{error}</p> : null}

            <div className="cons-actions" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost-dark"
                onClick={onClose}
                disabled={submitting || verifying}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRetryPayment}
                disabled={submitting || verifying}
              >
                {submitting || verifying ? (
                  <>
                    <span className="auth-btn-spinner" aria-hidden="true" />
                    Opening Checkout…
                  </>
                ) : (
                  'Retry Payment'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BookConsultationModal;
