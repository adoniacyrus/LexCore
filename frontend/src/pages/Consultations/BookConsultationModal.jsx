import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  createConsultation,
  getErrorMessage,
  listPracticeAreas,
} from '../../services/consultationService';
import { CONSULTATION_MODES, todayInputValue } from './consultationConstants';
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

function BookConsultationModal({ open, onClose, onSubmitted }) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [practiceAreas, setPracticeAreas] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setFieldErrors({});
    setError('');
    setSubmitting(false);
    backdropPointerDown.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || !accessToken) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await listPracticeAreas(accessToken);
        if (!cancelled) setPracticeAreas(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setPracticeAreas([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, accessToken]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

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

  const validate = () => {
    const next = {};
    if (form.knowsPracticeArea === null) {
      next.knowsPracticeArea = 'Please indicate whether you know the legal service required.';
    }
    if (form.knowsPracticeArea === true && !form.practice_area) {
      next.practice_area = 'Please select a practice area.';
    }
    if (!form.subject.trim()) next.subject = 'Subject is required.';
    if (!form.preferred_date) next.preferred_date = 'Preferred date is required.';
    else if (form.preferred_date < todayInputValue()) {
      next.preferred_date = 'Preferred date cannot be before today.';
    }
    if (!form.preferred_time) next.preferred_time = 'Preferred time is required.';
    if (!form.consultation_mode) next.consultation_mode = 'Consultation mode is required.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const created = await createConsultation(accessToken, {
        knows_practice_area: form.knowsPracticeArea,
        practice_area: form.knowsPracticeArea ? Number(form.practice_area) : null,
        subject: form.subject.trim(),
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time,
        consultation_mode: form.consultation_mode,
        issue_summary: form.issue_summary.trim(),
      });
      onSubmitted?.(created);
      onClose?.();
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        const mapped = {};
        Object.entries(data).forEach(([key, val]) => {
          if (Array.isArray(val)) mapped[key] = val[0];
          else if (typeof val === 'string') mapped[key] = val;
        });
        if (Object.keys(mapped).length) setFieldErrors((prev) => ({ ...prev, ...mapped }));
      }
      setError(getErrorMessage(err, 'Unable to submit consultation request.'));
    } finally {
      setSubmitting(false);
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
        if (!submitting && backdropPointerDown.current && e.target === e.currentTarget) {
          onClose?.();
        }
        backdropPointerDown.current = false;
      }}
    >
      <div
        className="cons-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cons-book-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cons-modal__header">
          <div>
            <p className="section-tag-gold">Appointments</p>
            <h2 id="cons-book-title">Book Consultation</h2>
          </div>
          <button
            type="button"
            className="cons-modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
          >
            ×
          </button>
        </header>

        <form className="cons-form auth-form cons-modal__form" onSubmit={handleSubmit} noValidate>
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
              Our team will assign the appropriate specialist.
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
              Issue Summary <em style={{ fontStyle: 'normal', opacity: 0.7 }}>(optional)</em>
            </span>
            <textarea
              name="issue_summary"
              rows={2}
              value={form.issue_summary}
              onChange={onChange}
              placeholder="Optional background for preparation"
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
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookConsultationModal;
