import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getCaseDetail, getErrorMessage } from '../../services/caseService';
import { getDashboardPath } from '../../utils/roleRoutes';
import { NavIcon } from '../../components/dashboard/icons';
import CaseEditModal from './CaseEditModal';
import './cases.css';

function DetailField({ label, value, long = false }) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  return (
    <div className="case-field">
      <span className="case-label">{label}</span>
      <span className={`case-value ${long ? 'case-value--long' : ''}`}>{value}</span>
    </div>
  );
}

function CaseDetailPage() {
  const { id } = useParams();
  const { user, accessToken } = useAuth();
  const [item, setItem] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError('');
    try {
      const data = await getCaseDetail(accessToken, id);
      setItem(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load case details.'));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    load();
  }, [load]);

  const role = user?.role || 'CLIENT';
  const dashboardPath = getDashboardPath(role);
  const listPath = `${dashboardPath}/cases`;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const hasCourtInfo = item && (
    item.court ||
    item.jurisdiction ||
    item.bench ||
    item.location ||
    item.cnr_number ||
    item.filing_number ||
    item.registration_number ||
    item.official_court_reference
  );

  return (
    <DashboardLayout showContext={false} activeModule="cases" fillHeight>
      <div className="cases-page lw-fade-in">
        <PageHeader
          eyebrow={item?.case_reference || 'Case Matter'}
          title={item?.title || 'Loading case…'}
          description="View comprehensive case details, assignment structures, and official court information."
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link to={listPath} className="btn btn-ghost-dark">
                &larr; Back to list
              </Link>
              {item && (role === 'SENIOR_LAWYER' || role === 'JUNIOR_LAWYER') && item.responsible_lawyer?.id === user?.id && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  onClick={() => setShowEditModal(true)}
                >
                  <NavIcon name="edit" /> Edit Case
                </button>
              )}
            </div>
          }
        />

        {error ? (
          <p className="cases-error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading case details…</div>
        ) : !item ? (
          <div className="cases-error">Case not found or access denied.</div>
        ) : (
          <div className="case-detail-container">
            <div className="case-detail-main">
              <section className="case-section" aria-labelledby="section-case-info">
                <h2 id="section-case-info" className="case-section__title">Case Information</h2>
                <div className="case-grid">
                  <DetailField label="Reference" value={item.case_reference} />
                  <DetailField label="Title" value={item.title} />
                  <DetailField label="Case Type" value={item.case_type_label || item.case_type} />
                  <DetailField label="Status" value={
                    <span className={`cases-status is-${String(item.status).toLowerCase()}`}>
                      {item.status_label || item.status}
                    </span>
                  } />
                  <DetailField label="Start Date" value={formatDate(item.start_date)} />
                  <DetailField label="Originating Consultation" value={item.originating_consultation_ref} />
                  <div className="case-form-full-width">
                    <DetailField label="Description" value={item.description} long />
                  </div>
                </div>
              </section>

              {hasCourtInfo ? (
                <section className="case-section" aria-labelledby="section-court-info">
                  <h2 id="section-court-info" className="case-section__title">Court Information</h2>
                  <div className="case-grid">
                    <DetailField label="Court" value={item.court} />
                    <DetailField label="Jurisdiction" value={item.jurisdiction} />
                    <DetailField label="Bench" value={item.bench} />
                    <DetailField label="Location" value={item.location} />
                    <DetailField label="CNR Number" value={item.cnr_number} />
                    <DetailField label="Filing Number" value={item.filing_number} />
                    <DetailField label="Registration Number" value={item.registration_number} />
                    <DetailField label="Official Court Reference" value={item.official_court_reference} />
                  </div>
                </section>
              ) : null}
            </div>

            <div className="case-detail-sidebar">
              <section className="case-section" aria-labelledby="section-client-info">
                <h2 id="section-client-info" className="case-section__title">Client</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <DetailField label="Name" value={item.client?.full_name} />
                  {role !== 'CLIENT' && <DetailField label="Email" value={item.client?.email} />}
                  {role !== 'CLIENT' && <DetailField label="Phone" value={item.client?.phone_number} />}
                </div>
              </section>

              <section className="case-section" aria-labelledby="section-legal-team">
                <h2 id="section-legal-team" className="case-section__title">Legal Team</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <DetailField label="Responsible Lawyer" value={item.responsible_lawyer?.full_name} />
                  <DetailField label="Practice Area" value={item.practice_area?.name} />
                  {item.supporting_paralegal ? (
                    <DetailField label="Supporting Paralegal" value={item.supporting_paralegal?.full_name} />
                  ) : (
                    <div className="case-field">
                      <span className="case-label">Supporting Paralegal</span>
                      <span className="case-value" style={{ color: '#aaa', fontStyle: 'italic' }}>None assigned</span>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      <CaseEditModal
        open={showEditModal}
        caseId={item?.id}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => load()}
      />
    </DashboardLayout>
  );
}

export default CaseDetailPage;
