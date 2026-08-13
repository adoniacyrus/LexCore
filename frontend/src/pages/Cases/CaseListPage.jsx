import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import { listCases, getErrorMessage } from '../../services/caseService';
import { getDashboardPath } from '../../utils/roleRoutes';
import './cases.css';

const STATUS_CHOICES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function CaseListPage() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Admin filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [lawyerFilter, setLawyerFilter] = useState('');
  const [practiceAreaFilter, setPracticeAreaFilter] = useState('');

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

  // Extract unique filter options from actual loaded items
  const uniqueStatuses = Array.from(new Set(items.map((item) => item.status).filter(Boolean)));
  const uniqueLawyers = Array.from(
    new Map(
      items
        .map((item) => item.responsible_lawyer)
        .filter(Boolean)
        .map((l) => [l.id, l])
    ).values()
  );
  const uniquePracticeAreas = Array.from(
    new Map(
      items
        .map((item) => item.practice_area)
        .filter(Boolean)
        .map((pa) => [pa.id, pa])
    ).values()
  );

  // Filter items
  const filteredItems = items.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (lawyerFilter && item.responsible_lawyer?.id !== parseInt(lawyerFilter, 10)) return false;
    if (practiceAreaFilter && item.practice_area?.id !== parseInt(practiceAreaFilter, 10)) return false;
    return true;
  });

  return (
    <DashboardLayout showContext={false} activeModule="cases" fillHeight>
      <div className="cases-page cases-page--fill lw-fade-in">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />

        {error ? (
          <p className="cases-error" role="alert">
            {error}
          </p>
        ) : null}

        {role === 'ADMIN' && items.length > 0 && (
          <div className="cases-filters-panel" style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#faf9f6', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filters:</span>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 500 }}>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.3rem 0.5rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--color-border)', outline: 'none' }}>
                <option value="">All Statuses</option>
                {uniqueStatuses.map(status => {
                  const label = STATUS_CHOICES.find(opt => opt.value === status)?.label || status;
                  return <option key={status} value={status}>{label}</option>;
                })}
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 500 }}>
              Lawyer
              <select value={lawyerFilter} onChange={(e) => setLawyerFilter(e.target.value)} style={{ padding: '0.3rem 0.5rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--color-border)', outline: 'none' }}>
                <option value="">All Lawyers</option>
                {uniqueLawyers.map(lawyer => (
                  <option key={lawyer.id} value={lawyer.id}>{lawyer.full_name}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 500 }}>
              Practice Area
              <select value={practiceAreaFilter} onChange={(e) => setPracticeAreaFilter(e.target.value)} style={{ padding: '0.3rem 0.5rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--color-border)', outline: 'none' }}>
                <option value="">All Practice Areas</option>
                {uniquePracticeAreas.map(pa => (
                  <option key={pa.id} value={pa.id}>{pa.name}</option>
                ))}
              </select>
            </label>

            {(statusFilter || lawyerFilter || practiceAreaFilter) && (
              <button 
                type="button" 
                className="btn btn-ghost-dark" 
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', height: 'auto', minHeight: 'auto' }}
                onClick={() => {
                  setStatusFilter('');
                  setLawyerFilter('');
                  setPracticeAreaFilter('');
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

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
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#faf9f6', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)' }}>
              <p style={{ fontWeight: 500, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>No cases match selected filters.</p>
              <button type="button" className="btn btn-ghost-dark" onClick={() => { setStatusFilter(''); setLawyerFilter(''); setPracticeAreaFilter(''); }}>Reset Filters</button>
            </div>
          ) : (
            <table className="cases-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Practice Area</th>
                  {role !== 'CLIENT' && <th>Client</th>}
                  {role !== 'SENIOR_LAWYER' && role !== 'JUNIOR_LAWYER' && <th>Lawyer</th>}
                  {role !== 'PARALEGAL' && <th>Supporting Paralegal</th>}
                  <th>Status</th>
                  <th>Start Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
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
                      <td>
                        {item.responsible_lawyer?.full_name || '—'}
                        {Array.isArray(item.assistant_lawyers) && item.assistant_lawyers.length > 0 && (
                          <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.78rem', marginLeft: '0.25rem' }}>
                            {` + ${item.assistant_lawyers.length}`}
                          </span>
                        )}
                      </td>
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
