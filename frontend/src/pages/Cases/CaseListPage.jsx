import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import { listCases, getErrorMessage } from '../../services/caseService';
import { getDashboardPath } from '../../utils/roleRoutes';
import './cases.css';

function CaseListPage() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await listCases(accessToken);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load cases.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const role = user?.role || 'CLIENT';
  const dashboardPath = getDashboardPath(role);

  // Setup headers and description based on role
  let eyebrow = 'Client Chambers';
  let title = 'My Cases';
  let description = 'Track the progress of your active legal cases with LexCore.';

  if (role === 'ADMIN') {
    eyebrow = 'Firm Administration';
    title = 'Cases';
    description = 'Monitor all legal cases, assignments, and court progress across the firm.';
  } else if (role === 'SENIOR_LAWYER' || role === 'JUNIOR_LAWYER') {
    eyebrow = 'Advocate Workspace';
    title = 'My Cases';
    description = 'Manage matters where you are assigned as the responsible lawyer.';
  } else if (role === 'PARALEGAL') {
    eyebrow = 'Paralegal Workspace';
    title = 'Supporting Cases';
    description = 'View and support cases assigned to you by advocates.';
  }

  const handleRowClick = (caseId) => {
    navigate(`${dashboardPath}/cases/${caseId}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <DashboardLayout showContext={false} activeModule="cases" fillHeight>
      <div className="cases-page cases-page--fill lw-fade-in">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />

        {error ? (
          <p className="cases-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="cases-table-wrap">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Loading cases…</div>
          ) : items.length === 0 ? (
            <EmptyState
              eyebrow="Cases"
              title="No cases found"
              description={
                role === 'SENIOR_LAWYER' || role === 'JUNIOR_LAWYER'
                  ? 'To start a case, go to your Assigned Consultations page, open a completed/accepted consultation request, and select "Convert to Case".'
                  : 'Active legal matters will appear here once they are initiated by your lawyer.'
              }
            />
          ) : (
            <table className="cases-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Practice Area</th>
                  {role !== 'CLIENT' && <th>Client</th>}
                  {role !== 'SENIOR_LAWYER' && role !== 'JUNIOR_LAWYER' && <th>Responsible Lawyer</th>}
                  {role !== 'PARALEGAL' && <th>Supporting Paralegal</th>}
                  <th>Status</th>
                  <th>Start Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="cases-table__row-clickable"
                    tabIndex={0}
                    onClick={() => handleRowClick(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(item.id);
                      }
                    }}
                  >
                    <td className="cases-ref">{item.case_reference}</td>
                    <td>{item.title}</td>
                    <td>{item.case_type_label || item.case_type}</td>
                    <td>{item.practice_area?.name || '—'}</td>
                    {role !== 'CLIENT' && <td>{item.client?.full_name || '—'}</td>}
                    {role !== 'SENIOR_LAWYER' && role !== 'JUNIOR_LAWYER' && (
                      <td>{item.responsible_lawyer?.full_name || '—'}</td>
                    )}
                    {role !== 'PARALEGAL' && <td>{item.supporting_paralegal?.full_name || '—'}</td>}
                    <td>
                      <span className={`cases-status is-${String(item.status).toLowerCase()}`}>
                        {item.status_label || item.status}
                      </span>
                    </td>
                    <td>{formatDate(item.start_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default CaseListPage;
