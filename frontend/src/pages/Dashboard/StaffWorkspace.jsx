import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import WorkspaceCard from '../../components/dashboard/WorkspaceCard';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../data/dashboard/roleWorkspaces';
import { getDashboardPath } from '../../utils/roleRoutes';
import {
  getErrorMessage,
  listAssignedConsultations,
} from '../../services/consultationService';
import {
  formatPreferredDate,
  practiceAreaLabel,
  STATUS_LABELS,
} from '../Consultations/consultationConstants';
import '../Consultations/consultations.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const LAWYER_ROLES = new Set(['SENIOR_LAWYER', 'JUNIOR_LAWYER']);

/**
 * Staff workspace. Lawyers see assigned consultations; other staff stay minimal.
 */
function StaffWorkspace() {
  const { user, accessToken } = useAuth();
  const firstName = (user?.full_name || 'Counsel').split(' ')[0];
  const roleLabel = getRoleLabel(user?.role);
  const isLawyer = LAWYER_ROLES.has(user?.role);
  const consultationsPath = `${getDashboardPath(user?.role)}/consultations`;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(isLawyer);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isLawyer || !accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await listAssignedConsultations(accessToken);
      setItems(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load assigned consultations.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isLawyer, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isLawyer) {
    return (
      <div className="lw-workspace-home">
        <PageHeader
          eyebrow="LexCore Chambers"
          title={
            <>
              {getGreeting()},{' '}
              <em style={{ color: 'var(--color-primary)', fontStyle: 'italic' }}>{firstName}</em>
            </>
          }
          description={`${roleLabel} workspace.`}
        />
        <WorkspaceCard>
          <p className="section-tag-gold">Workspace Ready</p>
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.65rem' }}>
            Your digital chambers is prepared.
          </h2>
          <p className="auth-sheet-lede" style={{ margin: 0, maxWidth: '52ch' }}>
            Live modules for your role will appear here as they are enabled.
          </p>
        </WorkspaceCard>
      </div>
    );
  }

  return (
    <div className="lw-workspace-home lw-workspace-home--compact">
      <PageHeader
        eyebrow="Advocate Workspace"
        title={
          <>
            {getGreeting()},{' '}
            <em style={{ color: 'var(--color-primary)', fontStyle: 'italic' }}>{firstName}</em>
          </>
        }
        description="Your assigned consultation requests."
        actions={
          <Link to={consultationsPath} className="btn btn-primary">
            View all
          </Link>
        }
      />

      {error ? (
        <p className="cons-error" role="alert">
          {error}
        </p>
      ) : null}

      <WorkspaceCard padding="md">
        {loading ? (
          <p className="lw-muted">Loading assigned consultations…</p>
        ) : items.length === 0 ? (
          <EmptyState
            compact
            eyebrow="Consultations"
            title="No assigned consultations"
            description="When the firm assigns a consultation to you, it will appear here."
          />
        ) : (
          <table className="cons-table" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Client</th>
                <th>Practice Area</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="cons-ref">{item.consultation_id}</td>
                  <td>{item.client?.full_name || '—'}</td>
                  <td>{practiceAreaLabel(item)}</td>
                  <td>{formatPreferredDate(item.preferred_date)}</td>
                  <td>
                    <span className={`cons-status is-${String(item.status).toLowerCase()}`}>
                      {item.status_label || STATUS_LABELS[item.status] || item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </WorkspaceCard>
    </div>
  );
}

export default StaffWorkspace;
