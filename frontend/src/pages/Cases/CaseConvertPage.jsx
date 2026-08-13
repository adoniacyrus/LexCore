import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import { listAssignedConsultations } from '../../services/consultationService';
import {
  convertConsultationToCase,
  listActiveParalegals,
  getErrorMessage,
} from '../../services/caseService';
import { getDashboardPath } from '../../utils/roleRoutes';
import { todayInputValue } from '../Consultations/consultationConstants';
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

function CaseConvertPage() {
  const { consultationReference, consultationId } = useParams();
  const targetConsultationRef = consultationReference || consultationId;
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken } = useAuth();

  const [consultation, setConsultation] = useState(location.state?.consultation || null);
  const [paralegals, setParalegals] = useState([]);
  const [loading, setLoading] = useState(!consultation);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [createdCaseRef, setCreatedCaseRef] = useState('');
  const [createdCaseId, setCreatedCaseId] = useState('');
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

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setError('');
    setLoading(true);
    try {
      // 1. Fetch paralegals
      const paralegalData = await listActiveParalegals(accessToken);
      setParalegals(Array.isArray(paralegalData) ? paralegalData : []);

      // 2. Fetch consultation details if not passed in route state
      if (!consultation) {
        const consultations = await listAssignedConsultations(accessToken);
        const match = consultations.find(
          (c) =>
            String(c.consultation_id) === String(targetConsultationRef) ||
            String(c.id) === String(targetConsultationRef)
        );
        if (match) {
          setConsultation(match);
          setTitle(`Matter: ${match.subject}`);
        } else {
          setError('Unable to find the associated consultation or unauthorized.');
        }
      } else {
        setTitle(`Matter: ${consultation.subject}`);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to initialize case creation page.'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, consultation, targetConsultationRef]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !caseType || !startDate) {
      setError('Please fill in all required fields (Case Title, Case Type, Start Date).');
      return;
    }

    setError('');
    setSubmitting(true);

    const payload = {
      originating_consultation: consultation?.id || targetConsultationRef,
      title: title.trim(),
      case_type: caseType,
      start_date: startDate,
      description: description.trim(),
      supporting_paralegal: supportingParalegal ? Number(supportingParalegal) : null,
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
      const data = await convertConsultationToCase(accessToken, payload);
      setSuccessMsg('Case created successfully.');
      setCreatedCaseRef(data.case_reference);
      setCreatedCaseId(data.id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to convert consultation to case.'));
      setSubmitting(false);
    }
  };

  const handleNavigateToDetails = () => {
    const role = user?.role || 'CLIENT';
    const dashboardPath = getDashboardPath(role);
    navigate(`${dashboardPath}/cases/${createdCaseRef || createdCaseId}`);
  };

  const dashboardPath = getDashboardPath(user?.role || 'CLIENT');
  const cancelPath = `${dashboardPath}/consultations`;

  if (loading) {
    return (
      <DashboardLayout showContext={false} activeModule="assigned-consultations" fillHeight>
        <div className="cases-page" style={{ textAlign: 'center', padding: '3rem' }}>
          Loading consultation context…
        </div>
      </DashboardLayout>
    );
  }

  if (successMsg) {
    return (
      <DashboardLayout showContext={false} activeModule="assigned-consultations" fillHeight>
        <div className="cases-page lw-fade-in" style={{ maxWidth: '600px', marginTop: '4rem' }}>
          <div className="case-form-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <span style={{ fontSize: '3rem', color: '#10b981', display: 'block', marginBottom: '1rem' }}>âœ“</span>
            <p className="section-tag-gold" style={{ marginBottom: '0.5rem' }}>Success</p>
            <h2 style={{ marginBottom: '1rem' }}>{successMsg}</h2>
            <p style={{ marginBottom: '2rem' }}>
              Originating consultation has been successfully converted.
              <br />
              Generated case reference: <strong className="cases-ref">{createdCaseRef}</strong>
            </p>
            <button type="button" className="btn btn-primary" onClick={handleNavigateToDetails}>
              Go to Case Details
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout showContext={false} activeModule="assigned-consultations" fillHeight>
      <div className="cases-page lw-fade-in">
        <PageHeader
          eyebrow="Advocate Workspace"
          title="Convert to Case"
          description="Initiate a new legal case file originating from a completed or accepted client consultation request."
        />

        {error ? (
          <p className="cases-error" role="alert">
            {error}
          </p>
        ) : null}

        {consultation ? (
          <form onSubmit={handleSubmit} className="case-form-card">
            <h2 className="case-section__title" style={{ marginTop: 0 }}>Case File Parameters</h2>

            <div className="case-form-grid">
              <div className="case-form-full-width case-origin-panel">
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
                  <span className="case-label">Originating Consultation</span>
                  <div className="case-value">{consultation.consultation_id}</div>
                </div>
              </div>

              <label className="auth-field">
                <span>Case Title <strong style={{ color: 'var(--color-primary)' }}>*</strong></span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp vs. State Dept"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>Case Type <strong style={{ color: 'var(--color-primary)' }}>*</strong></span>
                <select value={caseType} onChange={(e) => setCaseType(e.target.value)}>
                  {CASE_TYPE_CHOICES.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="auth-field">
                <span>Start Date <strong style={{ color: 'var(--color-primary)' }}>*</strong></span>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>Supporting Paralegal</span>
                <select
                  value={supportingParalegal}
                  onChange={(e) => setSupportingParalegal(e.target.value)}
                >
                  <option value="">No paralegal assigned</option>
                  {paralegals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="auth-field case-form-full-width">
                <span>Matter Description</span>
                <textarea
                  rows={4}
                  placeholder="Provide brief background context or litigation summary..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </div>

            <h2 className="case-section__title" style={{ marginTop: '2rem' }}>Court Filing Details (Optional)</h2>
            <p className="auth-sheet-lede" style={{ fontSize: '0.85rem', marginBottom: '1.5rem', color: '#888280' }}>
              If official filings are already initiated, you may supply court numbers and references below.
            </p>

            <div className="case-form-grid">
              <label className="auth-field">
                <span>Court Name</span>
                <input
                  type="text"
                  placeholder="e.g. Supreme Court of India"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>Jurisdiction</span>
                <input
                  type="text"
                  placeholder="e.g. Appellate Division"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>Bench</span>
                <input
                  type="text"
                  placeholder="e.g. Division Bench"
                  value={bench}
                  onChange={(e) => setBench(e.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>Court Location</span>
                <input
                  type="text"
                  placeholder="e.g. New Delhi"
                  value={locationField}
                  onChange={(e) => setLocationField(e.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>CNR Number</span>
                <input
                  type="text"
                  placeholder="e.g. DLHC010001232026"
                  value={cnrNumber}
                  onChange={(e) => setCnrNumber(e.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>Filing Number</span>
                <input
                  type="text"
                  placeholder="e.g. FIL/123/2026"
                  value={filingNumber}
                  onChange={(e) => setFilingNumber(e.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>Registration Number</span>
                <input
                  type="text"
                  placeholder="e.g. REG/456/2026"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>Official Court Reference</span>
                <input
                  type="text"
                  placeholder="e.g. W.P. (C) No. 789/2026"
                  value={officialCourtReference}
                  onChange={(e) => setOfficialCourtReference(e.target.value)}
                />
              </label>
            </div>

            <div className="case-form-actions">
              <Link to={cancelPath} className="btn btn-ghost-dark" disabled={submitting}>
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Converting…' : 'Create Case File'}
              </button>
            </div>
          </form>
        ) : (
          <div className="cases-error">Consultation context missing.</div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default CaseConvertPage;
