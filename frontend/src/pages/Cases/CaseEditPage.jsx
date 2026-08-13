import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  getCaseDetail,
  updateCase,
  listActiveParalegals,
  getErrorMessage,
} from '../../services/caseService';
import { getDashboardPath } from '../../utils/roleRoutes';
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

const STATUS_CHOICES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function CaseEditPage() {
  const { caseReference, id } = useParams();
  const targetRef = caseReference || id;
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();

  const [caseObj, setCaseObj] = useState(null);
  const [paralegals, setParalegals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [caseType, setCaseType] = useState('CIVIL');
  const [startDate, setStartDate] = useState('');
  const [statusValue, setStatusValue] = useState('OPEN');
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
    if (!accessToken || !targetRef) return;
    setError('');
    setLoading(true);
    try {
      // 1. Fetch case details
      const detail = await getCaseDetail(accessToken, targetRef);
      
      // Verify authorization on frontend as well
      if (detail.responsible_lawyer?.id !== user?.id) {
        setError('You are not authorized to edit this case. Only the responsible lawyer can perform this action.');
        setLoading(false);
        return;
      }
      
      setCaseObj(detail);

      // Pre-fill form fields
      setTitle(detail.title || '');
      setCaseType(detail.case_type || 'CIVIL');
      setStartDate(detail.start_date || '');
      setStatusValue(detail.status || 'OPEN');
      setDescription(detail.description || '');
      setSupportingParalegal(detail.supporting_paralegal?.id || '');

      setCourt(detail.court || '');
      setJurisdiction(detail.jurisdiction || '');
      setBench(detail.bench || '');
      setLocationField(detail.location || '');
      setCnrNumber(detail.cnr_number || '');
      setFilingNumber(detail.filing_number || '');
      setRegistrationNumber(detail.registration_number || '');
      setOfficialCourtReference(detail.official_court_reference || '');

      // 2. Fetch paralegals
      const paralegalData = await listActiveParalegals(accessToken);
      setParalegals(Array.isArray(paralegalData) ? paralegalData : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to initialize case editing page.'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, user?.id]);

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
    setSuccessMsg('');
    setSubmitting(true);

    const payload = {
      title: title.trim(),
      case_type: caseType,
      start_date: startDate,
      status: statusValue,
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
      await updateCase(accessToken, targetRef, payload);
      setSuccessMsg('Case details updated successfully.');
      setTimeout(() => {
        const role = user?.role || 'CLIENT';
        const dashboardPath = getDashboardPath(role);
        navigate(`${dashboardPath}/cases/${caseObj?.case_reference || targetRef}`);
      }, 1500);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save changes. Please review fields and try again.'));
      setSubmitting(false);
    }
  };

  const role = user?.role || 'CLIENT';
  const dashboardPath = getDashboardPath(role);
  const detailPath = `${dashboardPath}/cases/${caseObj?.case_reference || targetRef}`;

  return (
    <DashboardLayout showContext={false} activeModule="cases" fillHeight>
      <div className="cases-page lw-fade-in">
        <PageHeader
          eyebrow={caseObj?.case_reference || 'Case Matter'}
          title="Edit Case File"
          description="Update case details, assign supporting paralegals, and enter court filings or CNR references."
          actions={
            <Link to={detailPath} className="btn btn-ghost-dark">
              Cancel
            </Link>
          }
        />

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
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading case details…</div>
        ) : !caseObj ? (
          <div className="cases-error">Case not found or access denied.</div>
        ) : (
          <form onSubmit={handleSubmit} className="case-form-card">
            
            {/* 1. READ-ONLY GENERAL DETAILS */}
            <h2 className="case-section__title" style={{ marginTop: 0 }}>Read-Only Case Information</h2>
            <div className="case-origin-panel" style={{ marginBottom: '2rem' }}>
              <div>
                <span className="case-label">Case Reference</span>
                <div className="case-value" style={{ color: '#888' }}>{caseObj.case_reference}</div>
              </div>
              <div>
                <span className="case-label">Client Name</span>
                <div className="case-value" style={{ color: '#888' }}>{caseObj.client?.full_name || '—'}</div>
              </div>
              <div>
                <span className="case-label">Practice Area</span>
                <div className="case-value" style={{ color: '#888' }}>{caseObj.practice_area?.name || '—'}</div>
              </div>
              <div>
                <span className="case-label">Responsible Lawyer</span>
                <div className="case-value" style={{ color: '#888' }}>{caseObj.responsible_lawyer?.full_name || '—'}</div>
              </div>
              <div>
                <span className="case-label">Originating Consultation</span>
                <div className="case-value" style={{ color: '#888' }}>{caseObj.originating_consultation_ref}</div>
              </div>
            </div>

            {/* 2. EDITABLE CASE INFORMATION */}
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
                />
              </label>

              <label className="auth-field">
                <span>Case Type *</span>
                <select value={caseType} onChange={(e) => setCaseType(e.target.value)}>
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
                />
              </label>

              <label className="auth-field">
                <span>Case Status *</span>
                <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
                  {STATUS_CHOICES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* 3. MATTER DETAILS */}
            <h2 className="case-section__title">Matter Details</h2>
            <div className="case-form-grid">
              <label className="auth-field case-form-full-width">
                <span>Description</span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter detailed description of the matter, pleadings, or status notes..."
                />
              </label>
            </div>

            {/* 4. COURT INFORMATION */}
            <h2 className="case-section__title">Court Information</h2>
            <div className="case-form-grid">
              <label className="auth-field">
                <span>Court Name</span>
                <input
                  type="text"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  placeholder="e.g. Supreme Court, High Court"
                />
              </label>

              <label className="auth-field">
                <span>Jurisdiction</span>
                <input
                  type="text"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  placeholder="e.g. Appellate, Original"
                />
              </label>

              <label className="auth-field">
                <span>Bench</span>
                <input
                  type="text"
                  value={bench}
                  onChange={(e) => setBench(e.target.value)}
                  placeholder="e.g. Principal Bench, Division Bench"
                />
              </label>

              <label className="auth-field">
                <span>Location</span>
                <input
                  type="text"
                  value={locationField}
                  onChange={(e) => setLocationField(e.target.value)}
                  placeholder="e.g. New Delhi, Mumbai"
                />
              </label>
            </div>

            {/* 5. LEGAL REFERENCES */}
            <h2 className="case-section__title">Legal References</h2>
            <div className="case-form-grid">
              <label className="auth-field">
                <span>CNR Number</span>
                <input
                  type="text"
                  value={cnrNumber}
                  onChange={(e) => setCnrNumber(e.target.value)}
                  placeholder="e.g. MHNS010001232026"
                />
              </label>

              <label className="auth-field">
                <span>Filing Number</span>
                <input
                  type="text"
                  value={filingNumber}
                  onChange={(e) => setFilingNumber(e.target.value)}
                  placeholder="e.g. FIL/9912/2026"
                />
              </label>

              <label className="auth-field">
                <span>Registration Number</span>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. REG/1024/2026"
                />
              </label>

              <label className="auth-field">
                <span>Official Court Reference</span>
                <input
                  type="text"
                  value={officialCourtReference}
                  onChange={(e) => setOfficialCourtReference(e.target.value)}
                  placeholder="e.g. WP(C) No. 4410 of 2026"
                />
              </label>
            </div>

            {/* 6. CASE SUPPORT */}
            <h2 className="case-section__title">Case Support</h2>
            <div className="case-form-grid">
              <label className="auth-field">
                <span>Supporting Paralegal</span>
                <select
                  value={supportingParalegal}
                  onChange={(e) => setSupportingParalegal(e.target.value)}
                >
                  <option value="">-- No supporting paralegal assigned --</option>
                  {paralegals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.email})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* FORM ACTIONS */}
            <div className="case-form-actions">
              <Link to={detailPath} className="btn btn-ghost-dark" disabled={submitting}>
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving Changes…' : 'Save Changes'}
              </button>
            </div>

          </form>
        )}
      </div>
    </DashboardLayout>
  );
}

export default CaseEditPage;
