import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  getErrorMessage,
  listAssignedConsultations,
  updateAssignedConsultationStatus,
} from '../../services/consultationService';
import {
  LAWYER_STATUS_ACTIONS,
  formatPreferredDate,
  practiceAreaLabel,
  STATUS_LABELS,
} from './consultationConstants';
import './consultations.css';

function LawyerAssignedPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await listAssignedConsultations(accessToken);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load assigned consultations.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (item, nextStatus) => {
    setBusyId(item.id);
    setError('');
    try {
      await updateAssignedConsultationStatus(accessToken, item.id, nextStatus);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update consultation status.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout showContext={false} activeModule="assigned-consultations" fillHeight>
      <div className="cons-page cons-page--fill lw-fade-in">
        <PageHeader
          eyebrow="Advocate Workspace"
          title="Assigned Consultations"
          description="Consultations assigned to you. Accept, complete, or cancel within your authority."
        />

        {error ? (
          <p className="cons-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="cons-table-wrap">
          {loading ? (
            <div className="cons-empty">Loading assigned consultations…</div>
          ) : items.length === 0 ? (
            <EmptyState
              eyebrow="Consultations"
              title="No assigned consultations"
              description="When the firm assigns a consultation to you, it will appear here."
            />
          ) : (
            <table className="cons-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Client</th>
                  <th>Practice Area</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const actions = LAWYER_STATUS_ACTIONS[item.status] || [];
                  return (
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
                      <td>
                        <div className="cons-inline-actions">
                          {actions.length === 0 ? (
                            <span className="cons-detail__submitted">No further actions</span>
                          ) : (
                            actions.map((action) => (
                              <button
                                key={action.value}
                                type="button"
                                className="btn btn-ghost-dark cons-table__action"
                                disabled={busyId === item.id}
                                onClick={() => handleStatus(item, action.value)}
                              >
                                {action.label}
                              </button>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default LawyerAssignedPage;
