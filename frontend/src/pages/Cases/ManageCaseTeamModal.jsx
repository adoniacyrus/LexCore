import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  listActiveLawyers,
  listActiveParalegals,
  updateCaseTeam,
  getErrorMessage,
} from '../../services/caseService';
import './cases.css';

function ManageCaseTeamModal({ open, caseObj, onClose, onSuccess }) {
  const { user, accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

  const [lawyers, setLawyers] = useState([]);
  const [paralegals, setParalegals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedLawyer, setSelectedLawyer] = useState('');
  const [selectedSupervising, setSelectedSupervising] = useState('');
  const [selectedParalegal, setSelectedParalegal] = useState('');
  const [selectedAssistantLawyers, setSelectedAssistantLawyers] = useState([]);
  
  // Reassignment confirmation screen
  const [showConfirm, setShowConfirm] = useState(false);

  const role = user?.role || 'CLIENT';

  // Keyboard close handler
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Load dropdown lists on modal open
  useEffect(() => {
    if (!open || !accessToken || !caseObj) return;

    setError('');
    setSuccessMsg(null);
    setSubmitting(false);
    setShowConfirm(false);
    setLoading(true);

    setSelectedLawyer(caseObj.responsible_lawyer?.id || '');
    setSelectedSupervising(caseObj.supervising_lawyer?.id || '');
    setSelectedParalegal(caseObj.supporting_paralegal?.id || '');
    setSelectedAssistantLawyers(
      Array.isArray(caseObj.assistant_lawyers)
        ? caseObj.assistant_lawyers.map(al => al.id)
        : []
    );

    const loadDropdownData = async () => {
      try {
        const promises = [
          listActiveParalegals(accessToken),
          listActiveLawyers(accessToken)
        ];

        const [paralegalsData, lawyersData] = await Promise.all(promises);
        setParalegals(Array.isArray(paralegalsData) ? paralegalsData : []);
        setLawyers(Array.isArray(lawyersData) ? lawyersData : []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to retrieve active employees.'));
      } finally {
        setLoading(false);
      }
    };
    loadDropdownData();
  }, [open, accessToken, caseObj]);

  if (!open || !caseObj) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedLawyer && role === 'ADMIN') {
      setError('Please assign a responsible lawyer.');
      return;
    }

    // Validation 1: Supervising Counsel must be Senior Lawyer
    if (selectedSupervising) {
      const supervisingLawyerObj = lawyers.find(l => l.id === parseInt(selectedSupervising, 10));
      if (supervisingLawyerObj && supervisingLawyerObj.role !== 'SENIOR_LAWYER') {
        setError("Only Senior Advocates can act as Supervising Lawyers.");
        return;
      }
    }

    // Validation 2: Case led by Junior Lawyer cannot have Senior Lawyer as Assistant Lawyer
    const currentLeadLawyerId = role === 'ADMIN' ? parseInt(selectedLawyer, 10) : caseObj.responsible_lawyer?.id;
    const leadLawyerObj = lawyers.find(l => l.id === currentLeadLawyerId);
    if (leadLawyerObj && leadLawyerObj.role === 'JUNIOR_LAWYER') {
      const hasSeniorAssistant = selectedAssistantLawyers.some(id => {
        const al = lawyers.find(l => l.id === id);
        return al && al.role === 'SENIOR_LAWYER';
      });
      if (hasSeniorAssistant) {
        setError("Senior Advocates cannot be assigned as Assistant Lawyers to a Junior-led matter. Assign them as Supervising Lawyer instead.");
        return;
      }
    }

    const isLawyerChanged = role === 'ADMIN' && parseInt(selectedLawyer, 10) !== (caseObj.responsible_lawyer?.id || 0);

    if (isLawyerChanged) {
      setShowConfirm(true);
    } else {
      executeSubmit();
    }
  };

  const executeSubmit = async () => {
    setError('');
    setSuccessMsg(null);
    setSubmitting(true);

    const payload = {};
    if (role === 'ADMIN') {
      payload.responsible_lawyer = parseInt(selectedLawyer, 10);
    }
    payload.supervising_lawyer = selectedSupervising ? parseInt(selectedSupervising, 10) : null;
    payload.supporting_paralegal = selectedParalegal ? parseInt(selectedParalegal, 10) : null;
    payload.assistant_lawyers = selectedAssistantLawyers;

    try {
      const data = await updateCaseTeam(accessToken, caseObj.id, payload);
      
      const isLawyerChanged = role === 'ADMIN' && parseInt(selectedLawyer, 10) !== (caseObj.responsible_lawyer?.id || 0);
      if (isLawyerChanged) {
        const newLawyerName = data.responsible_lawyer?.full_name || 'The selected advocate';
        setSuccessMsg({
          title: 'Case reassigned successfully.',
          description: `${newLawyerName} is now the responsible lawyer.`,
        });
      } else {
        setSuccessMsg({
          title: 'Case team updated successfully.',
          description: '',
        });
      }

      setShowConfirm(false);
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 2000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update case team.'));
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const getLawyerLabel = (lawyer) => {
    const paNames = lawyer.practice_areas?.map((pa) => pa.name).join(', ') || 'No practice area';
    return `${lawyer.full_name} (${lawyer.role_label} — Practice Areas: ${paNames})`;
  };

  const activeNewLawyerObj = lawyers.find(l => l.id === parseInt(selectedLawyer, 10));

  // Filter assistant selection candidates
  const currentLeadLawyerId = role === 'ADMIN' ? parseInt(selectedLawyer, 10) : caseObj.responsible_lawyer?.id;
  const leadLawyerObj = lawyers.find(l => l.id === currentLeadLawyerId);
  const availableLawyersForAssistants = lawyers.filter(l => {
    if (l.id === currentLeadLawyerId) return false;
    if (selectedAssistantLawyers.includes(l.id)) return false;
    if (selectedSupervising && l.id === parseInt(selectedSupervising, 10)) return false;
    // If Lead is Junior, Assistants must be Junior only
    if (leadLawyerObj && leadLawyerObj.role === 'JUNIOR_LAWYER') {
      if (l.role === 'SENIOR_LAWYER') return false;
    }
    return true;
  });

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
        className="case-modal case-modal--small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-case-team-title"
      >
        {/* FIXED HEADER */}
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <span className="case-modal__ref">{caseObj.case_reference}</span>
            <h2 id="manage-case-team-title" className="case-modal__title">Manage Case Team</h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close Case Team Modal"
            disabled={submitting}
          >
            &times;
          </button>
        </header>

        {/* SCROLLABLE BODY */}
        <div className="case-modal__body" style={{ minHeight: 'auto' }}>
          {error ? (
            <p className="cases-error" role="alert">
              {error}
            </p>
          ) : null}

          {successMsg ? (
            <div className="cases-success" role="status" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 600 }}>{successMsg.title}</div>
              {successMsg.description && (
                <div style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>{successMsg.description}</div>
              )}
            </div>
          ) : null}

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text)' }}>
              Loading active lawyers and paralegals list...
            </div>
          ) : showConfirm ? (
            <div className="case-confirm-container" style={{ padding: '0.5rem 0' }}>
              <h3 style={{ color: '#c0392b', fontSize: '1.1rem', fontWeight: 600, marginTop: 0, marginBottom: '0.75rem', fontFamily: 'serif' }}>Reassign Case?</h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#faf9f6', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#888280', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Current Lawyer</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#666', marginTop: '0.15rem' }}>
                    {caseObj.responsible_lawyer?.full_name || '—'}
                  </div>
                </div>
                <div style={{ fontSize: '1.2rem', color: '#888' }}>➔</div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>New Lawyer</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)', marginTop: '0.15rem' }}>
                    {activeNewLawyerObj?.full_name || '—'}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c0392b', marginBottom: '0.5rem' }}>
                Warning:
              </p>
              <ul style={{ fontSize: '0.82rem', color: '#555', paddingLeft: '1.2rem', margin: '0 0 1.25rem 0', lineHeight: '1.6' }}>
                <li>The current responsible lawyer will lose Case ownership access.</li>
              </ul>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c0392b', margin: 0 }}>
                Are you sure you want to continue?
              </p>
            </div>
          ) : (
            <form id="case-team-form" onSubmit={handleSubmit} className="case-form-card">
              
              <h3 className="case-section__title" style={{ marginTop: 0, fontSize: '1rem', border: 'none', padding: 0 }}>Litigation Team Assignment</h3>
              <p style={{ fontSize: '0.82rem', color: '#888280', marginBottom: '1.25rem' }}>
                Update litigation advocates and paralegal supports. Reassignments immediately update advocate dashboard workspaces.
              </p>

              <div className="case-form-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                {role === 'ADMIN' ? (
                  <label className="auth-field">
                    <span>Responsible Lawyer *</span>
                    <select
                      value={selectedLawyer}
                      onChange={(e) => setSelectedLawyer(e.target.value)}
                      required
                      disabled={submitting}
                    >
                      <option value="" disabled>-- Select Responsible Lawyer --</option>
                      {lawyers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {getLawyerLabel(l)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="auth-field">
                    <span>Responsible Lawyer</span>
                    <div style={{ marginTop: '0.25rem', padding: '0.6rem 0.75rem', background: '#faf9f6', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.88rem' }}>
                        {caseObj.responsible_lawyer?.full_name || '—'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#888280', marginTop: '0.15rem' }}>
                        Lead / Responsible Lawyer
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#c0392b', marginTop: '0.1rem', fontWeight: 500 }}>
                        Admin-only reassignment
                      </div>
                    </div>
                  </div>
                )}

                {/* SUPERVISING COUNSEL SELECTOR */}
                <label className="auth-field">
                  <span>Supervising Counsel</span>
                  <select
                    value={selectedSupervising}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedSupervising(val);
                      if (val) {
                        setSelectedAssistantLawyers(prev => prev.filter(id => id !== parseInt(val, 10)));
                      }
                    }}
                    disabled={submitting}
                  >
                    <option value="">No Supervising Counsel Assigned</option>
                    {lawyers
                      .filter((l) => l.role === 'SENIOR_LAWYER')
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {getLawyerLabel(l)}
                        </option>
                      ))}
                  </select>
                </label>

                {/* ASSISTANT LAWYERS MULTI-SELECTOR */}
                <label className="auth-field">
                  <span>Assistant Lawyers</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val && !selectedAssistantLawyers.includes(val)) {
                        setSelectedAssistantLawyers(prev => [...prev, val]);
                      }
                    }}
                    disabled={submitting}
                  >
                    <option value="">-- Add Assistant Lawyer... --</option>
                    {availableLawyersForAssistants.map((l) => (
                      <option key={l.id} value={l.id}>
                        {getLawyerLabel(l)}
                      </option>
                    ))}
                  </select>

                  {selectedAssistantLawyers.length > 0 ? (
                    <div style={{ marginTop: '0.6rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#888280', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                        Selected:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {selectedAssistantLawyers.map(id => {
                          const lawyerObj = lawyers.find(l => l.id === id) || { full_name: 'Advocate' };
                          return (
                            <div
                              key={id}
                              className="case-tag-chip"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                background: '#faf9f6',
                                border: '1px solid var(--color-border)',
                                borderRadius: '12px',
                                padding: '0.2rem 0.6rem',
                                fontSize: '0.8rem',
                                fontWeight: 500
                              }}
                            >
                              <span>{lawyerObj.full_name}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedAssistantLawyers(prev => prev.filter(x => x !== id))}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  marginLeft: '0.4rem',
                                  cursor: 'pointer',
                                  color: '#c0392b',
                                  fontWeight: 'bold',
                                  fontSize: '0.85rem',
                                  padding: 0
                                }}
                                title="Remove Lawyer"
                              >
                                &times;
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: '#888280', marginTop: '0.35rem' }}>
                      No assistant advocates assigned to this case.
                    </div>
                  )}
                </label>

                <label className="auth-field">
                  <span>Supporting Paralegal</span>
                  <select
                    value={selectedParalegal}
                    onChange={(e) => setSelectedParalegal(e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">No Paralegal Assigned</option>
                    {paralegals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.email})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

            </form>
          )}
        </div>

        {/* FIXED FOOTER */}
        <footer className="case-modal__footer">
          {showConfirm ? (
            <>
              <button
                type="button"
                className="btn btn-ghost-dark"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: '#c0392b', borderColor: '#c0392b' }}
                onClick={executeSubmit}
                disabled={submitting}
              >
                {submitting ? 'Reassigning Case…' : 'Confirm Reassignment'}
              </button>
            </>
          ) : (
            <>
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
                form="case-team-form"
                className="btn btn-primary"
                disabled={submitting || loading}
              >
                {submitting ? 'Saving Changes…' : 'Save Changes'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

export default ManageCaseTeamModal;
