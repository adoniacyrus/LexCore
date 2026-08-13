import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getDashboardPath } from '../../utils/roleRoutes';
import { NavIcon } from '../../components/dashboard/icons';
import CaseConversionModal from '../Cases/CaseConversionModal';
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
import LawyerConsultationDetailModal from './LawyerConsultationDetailModal';
import './consultations.css';

function LawyerAssignedPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [convertConsultation, setConvertConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null);

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
      const updated = await updateAssignedConsultationStatus(accessToken, item.id, nextStatus);
      if (selected && selected.id === item.id) {
        setSelected(updated);
      }
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
          description="Consultations assigned to you. Click on any row to view full details and convert to a case file."
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
                    <tr
                      key={item.id}
                      className="cons-table__row-clickable"
                      tabIndex={0}
                      onClick={() => setSelected(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelected(item);
                        }
                      }}
                    >
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
                          <button
                            type="button"
                            className="btn btn-ghost-dark cons-table__action"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(item);
                            }}
                          >
                            <NavIcon name="eye" /> Details
                          </button>
                          
                          {actions.map((action) => {
                            if (action.value === 'ACCEPTED') {
                              return (
                                <button
                                  key={action.value}
                                  type="button"
                                  className="btn cons-table__action-complete"
                                  disabled={busyId === item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatus(item, 'ACCEPTED');
                                  }}
                                >
                                  <NavIcon name="check" /> Accept
                                </button>
                              );
                            }
                            if (action.value === 'COMPLETED') {
                              return (
                                <button
                                  key={action.value}
                                  type="button"
                                  className="btn cons-table__action-complete btn-icon-only"
                                  title="Mark Completed"
                                  aria-label="Mark consultation completed"
                                  disabled={busyId === item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatus(item, 'COMPLETED');
                                  }}
                                >
                                  <NavIcon name="check" />
                                </button>
                              );
                            }
                            if (action.value === 'CANCELLED') {
                              return (
                                <button
                                  key={action.value}
                                  type="button"
                                  className="btn cons-table__action-cancel btn-icon-only"
                                  title="Cancel"
                                  aria-label="Cancel consultation"
                                  disabled={busyId === item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatus(item, 'CANCELLED');
                                  }}
                                >
                                  <NavIcon name="close" />
                                </button>
                              );
                            }
                            return (
                              <button
                                key={action.value}
                                type="button"
                                className="btn btn-ghost-dark cons-table__action"
                                disabled={busyId === item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatus(item, action.value);
                                }}
                              >
                                {action.label}
                              </button>
                            );
                          })}

                          {(item.status === 'ACCEPTED' || item.status === 'COMPLETED') && (
                            item.case_id ? (
                              <button
                                type="button"
                                className="cons-table__case-link"
                                title="View Associated Case File"
                                aria-label={`View Case File ${item.case_reference}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const dashboardPath = getDashboardPath(user?.role || 'CLIENT');
                                  navigate(`${dashboardPath}/cases/${item.case_reference || item.case_id}`);
                                }}
                              >
                                <NavIcon name="cases" /> {item.case_reference}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConvertConsultation(item);
                                }}
                              >
                                <NavIcon name="cases" /> Convert
                              </button>
                            )
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

      <LawyerConsultationDetailModal
        open={Boolean(selected)}
        consultation={selected}
        userRole={user?.role}
        onClose={() => setSelected(null)}
        onConvert={(cons) => {
          setSelected(null);
          setConvertConsultation(cons);
        }}
      />

      <CaseConversionModal
        open={Boolean(convertConsultation)}
        consultation={convertConsultation}
        onClose={() => setConvertConsultation(null)}
        onSuccess={() => load()}
      />
    </DashboardLayout>
  );
}

export default LawyerAssignedPage;
