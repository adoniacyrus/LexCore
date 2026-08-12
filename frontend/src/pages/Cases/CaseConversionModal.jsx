import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  convertConsultationToCase,
  listActiveParalegals,
  getErrorMessage,
} from '../../services/caseService';
import { getDashboardPath } from '../../utils/roleRoutes';
import { todayInputValue } from '../Consultations/consultationConstants';
import { NavIcon } from '../../components/dashboard/icons';
import './cases.css';

const CASE_TYPE_CHOICES = [
  { value: 'CIVIL', label: 'Civil' },
  { value: 'CRIMINAL', label: 'Criminal' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'PROPERTY', label: 'Property' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'CONSUMER', label: 'Consumer' },
  { value: 'TAX', label: 'Tax' },
  { value: 'OTHER', label: 'Other' },
];

function CaseConversionModal({ open, consultation, onClose, onSuccess }) {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

  const [paralegals, setParalegals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [caseType, setCaseType] = useState('CIVIL');
  const [startDate, setStartDate] = useState(todayInputValue());
  const [description, setDescription] = useState('');
  const [supportingParalegal, setSupportingParalegal] = useState('');

  // Court info
  const [court, setCourt] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [bench, setBench] = useState('');
  const [locationField, setLocationField] = useState('');
  const [cnrNumber, setCnrNumber] = useState('');
  const [filingNumber, setFilingNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [officialCourtReference, setOfficialCourtReference] = useState('');

  // Trap Escape key
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Load active paralegals on open
  useEffect(() => {
    if (!open || !accessToken) return;
    
    // Reset form states
    setTitle(consultation ? `Matter: ${consultation.subject}` : '');
    setCaseType('CIVIL');
    setStartDate(todayInputValue());
    setDescription('');
    setSupportingParalegal('');
    setCourt('');
    setJurisdiction('');
    setBench('');
    setLocationField('');
    setCnrNumber('');
    setFilingNumber('');
    setRegistrationNumber('');
    setOfficialCourtReference('');
    setError('');
    setSuccessMsg('');
    setSubmitting(false);

    const loadParalegals = async () => {
      setLoading(true);
      try {
        const data = await listActiveParalegals(accessToken);
        setParalegals(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to retrieve active paralegals.'));
      } finally {
        setLoading(false);
      }
    };
    loadParalegals();
  }, [open, accessToken, consultation]);

  if (!open || !consultation) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !caseType || !startDate) {
      setError('Please fill in all required fields (Case Title, Case Type, and Start Date).');
      return;
    }

    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    const payload = {
      originating_consultation: consultation.id,
      title: title.trim(),
      case_type: caseType,
      start_date: startDate,
      description: description.trim(),
      supporting_paralegal: supportingParalegal || null,
      court: court.trim(),
      jurisdiction: jurisdiction.trim(),
      bench: bench.trim(),
      location: locationField.trim(),
      cnr_number: cnrNumber.trim(),
      filing_number: filingNumber.trim(),
      registration_number: registrationNumber.trim(),
      official_court_reference: officialCourtReference.trim(),
    };

    try {
      const result = await convertConsultationToCase(accessToken, payload);
      setSuccessMsg(`Case created successfully: ${result.case_reference}`);
      
      // Keep open briefly for success feedback, then close & trigger callback
      setTimeout(() => {
        onSuccess?.(result);
        onClose?.();
        // Redirect to case details page
        const role = user?.role || 'CLIENT';
        const dashboardPath = getDashboardPath(role);
        navigate(`${dashboardPath}/cases/${result.id}`);
      }, 1500);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to convert consultation to case file.'));
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
        className="case-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-convert-modal-title"
      >
        {/* FIXED HEADER */}
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <span className="case-modal__ref">{consultation.consultation_id}</span>
            <h2 id="case-convert-modal-title" className="case-modal__title">Convert to Case File</h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close Case Conversion Modal"
          >
            &times;
          </button>
        </header>

        {/* SCROLLABLE BODY */}
        <div className="case-modal__body">
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

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text)' }}>
              Loading active configuration parameters...
            </div>
          ) : (
            <form id="case-convert-form" onSubmit={handleSubmit} className="case-form-card">
              
              {/* Consultation Details */}
              <h2 className="case-section__title" style={{ marginTop: 0 }}>Consultation Origin</h2>
              <div className="case-origin-panel" style={{ marginBottom: '1.75rem' }}>
                <div>
                  <span className="case-label">Client Name</span>
                  <div className="case-value">{consultation.client?.full_name || '—'}</div>
                </div>
                <div>
                  <span className="case-label">Practice Area</span>
                  <div className="case-value">{consultation.practice_area?.name || '—'}</div>
                </div>
                <div>
                  <span className="case-label">Responsible Lawyer</span>
                  <div className="case-value">{consultation.assigned_lawyer?.full_name || '—'}</div>
                </div>
                <div>
                  <span className="case-label">Subject</span>
                  <div className="case-value">{consultation.subject || '—'}</div>
                </div>
              </div>

              {/* Case Information */}
              <h2 className="case-section__title">Case Information</h2>
              <div className="case-form-grid">
                <label className="auth-field">
                  <span>Case Title *</span>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter Case Title"
                    disabled={submitting}
                  />
                </label>

                <label className="auth-field">
                  <span>Case Type *</span>
                  <select
                    value={caseType}
                    onChange={(e) => setCaseType(e.target.value)}
                    disabled={submitting}
                  >
                    {CASE_TYPE_CHOICES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="auth-field">
                  <span>Start Date *</span>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={submitting}
                  />
                </label>

                <label className="auth-field">
                  <span>Supporting Paralegal</span>
                  <select
                    value={supportingParalegal}
                    onChange={(e) => setSupportingParalegal(e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">-- Assign later / No paralegal --</option>
                    {paralegals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.email})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Description */}
              <h2 className="case-section__title">Matter Description</h2>
              <div className="case-form-grid">
                <label className="auth-field case-form-full-width">
                  <span>Description / Pleading Summaries</span>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide description of the litigation matter..."
                    disabled={submitting}
                  />
                </label>
              </div>

              {/* Court Information */}
              <h2 className="case-section__title">Court Information</h2>
              <div className="case-form-grid">
                <label className="auth-field">
                  <span>Court Name</span>
                  <input
                    type="text"
                    value={court}
                    onChange={(e) => setCourt(e.target.value)}
                    placeholder="e.g. Supreme Court of India"
                    disabled={submitting}
                  />
                </label>

                <label className="auth-field">
                  <span>Jurisdiction</span>
                  <input
                    type="text"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    placeholder="e.g. Original / Appellate"
                    disabled={submitting}
                  />
                </label>

                <label className="auth-field">
                  <span>Bench</span>
                  <input
                    type="text"
                    value={bench}
                    onChange={(e) => setBench(e.target.value)}
                    placeholder="e.g. Principal Bench"
                    disabled={submitting}
                  />
                </label>

                <label className="auth-field">
                  <span>Location</span>
                  <input
                    type="text"
                    value={locationField}
                    onChange={(e) => setLocationField(e.target.value)}
                    placeholder="e.g. New Delhi"
                    disabled={submitting}
                  />
                </label>
              </div>

              {/* Legal References */}
              <h2 className="case-section__title">Legal References</h2>
              <div className="case-form-grid">
                <label className="auth-field">
                  <span>CNR Number</span>
                  <input
                    type="text"
                    value={cnrNumber}
                    onChange={(e) => setCnrNumber(e.target.value)}
                    placeholder="e.g. DNDH010001002026"
                    disabled={submitting}
                  />
                </label>

                <label className="auth-field">
                  <span>Filing Number</span>
                  <input
                    type="text"
                    value={filingNumber}
                    onChange={(e) => setFilingNumber(e.target.value)}
                    placeholder="e.g. 5410/2026"
                    disabled={submitting}
                  />
                </label>

                <label className="auth-field">
                  <span>Registration Number</span>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="e.g. REG/102/2026"
                    disabled={submitting}
                  />
                </label>

                <label className="auth-field">
                  <span>Official Court Reference</span>
                  <input
                    type="text"
                    value={officialCourtReference}
                    onChange={(e) => setOfficialCourtReference(e.target.value)}
                    placeholder="e.g. WP(C) 1240/2026"
                    disabled={submitting}
                  />
                </label>
              </div>

            </form>
          )}
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
            type="submit"
            form="case-convert-form"
            className="btn btn-primary"
            disabled={submitting || loading}
          >
            {submitting ? 'Creating Case…' : 'Create Case'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default CaseConversionModal;
