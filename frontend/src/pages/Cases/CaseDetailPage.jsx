import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  getCaseDetail,
  getErrorMessage,
  listCaseDocuments,
  downloadCaseDocument,
} from '../../services/caseService';
import { listCaseTasks } from '../../services/taskService';
import { getDashboardPath } from '../../utils/roleRoutes';
import { NavIcon } from '../../components/dashboard/icons';
import CaseEditModal from './CaseEditModal';
import ManageCaseTeamModal from './ManageCaseTeamModal';
import ChangeCaseStatusModal from './ChangeCaseStatusModal';
import ChangeMatterClassificationModal from './ChangeMatterClassificationModal';
import UploadDocumentModal from './UploadDocumentModal';
import DeleteDocumentConfirmModal from './DeleteDocumentConfirmModal';
import CreateTaskModal from './CreateTaskModal';
import TaskDetailModal from './TaskDetailModal';
import AddCourtProceedingModal from './AddCourtProceedingModal';
import EditAppointmentFeeModal from './EditAppointmentFeeModal';
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
  const { caseReference, id } = useParams();
  const targetRef = caseReference || id;
  const { user, accessToken } = useAuth();
  const [item, setItem] = useState(null);
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDocToDelete, setSelectedDocToDelete] = useState(null);
  const [showFeeModal, setShowFeeModal] = useState(false);
  
  // Tasks Modals & State
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskFilter, setTaskFilter] = useState('ALL');

  // Documents State
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Proceedings Modals & Refs
  const [showProceedingModal, setShowProceedingModal] = useState(false);
  const proceedingsRef = useRef(null);

  const load = useCallback(async () => {
    if (!accessToken || !targetRef) return;
    setLoading(true);
    setDocsLoading(true);
    setTasksLoading(true);
    setError('');
    try {
      const data = await getCaseDetail(accessToken, targetRef);
      setItem(data);

      const docs = await listCaseDocuments(accessToken, targetRef);
      setDocuments(Array.isArray(docs) ? docs : []);

      if (user?.role !== 'CLIENT') {
        const tasksData = await listCaseTasks(accessToken, targetRef);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load case details.'));
    } finally {
      setLoading(false);
      setDocsLoading(false);
      setTasksLoading(false);
    }
  }, [accessToken, targetRef, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('scroll') === 'proceedings' && proceedingsRef.current) {
      setTimeout(() => {
        proceedingsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [item]);

  const role = user?.role || 'CLIENT';
  const dashboardPath = getDashboardPath(role);
  const listPath = `${dashboardPath}/cases`;

  const handleViewDownload = async (doc) => {
    try {
      const blob = await downloadCaseDocument(accessToken, doc.id);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to open document.'));
    }
  };

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

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (taskFilter === 'MY_TASKS') return t.assigned_to?.id === user?.id;
    if (taskFilter === 'PENDING') return t.status === 'PENDING';
    if (taskFilter === 'IN_PROGRESS') return t.status === 'IN_PROGRESS';
    if (taskFilter === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  const pendingCount = tasks.filter(t => t.status === 'PENDING').length;
  const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;

  const canCreateTask = role === 'ADMIN' || item?.responsible_lawyer?.id === user?.id || item?.supervising_lawyer?.id === user?.id;
  const canEditFee = role === 'ADMIN' || item?.responsible_lawyer?.id === user?.id;

  return (
    <DashboardLayout showContext={false} activeModule="cases">
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
          <div style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Loading case details…</div>
        ) : !item ? (
          <div className="cases-error">Case not found or access denied.</div>
        ) : (
          <div className="case-detail-container">
            <div className="case-detail-main">
              {/* Classification Badges */}
              <div className="matter-classification-header-card">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="case-label" style={{ marginBottom: '0.15rem' }}>Matter Category</span>
                  <span className="matter-badge category-badge" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    color: 'var(--color-primary)',
                    backgroundColor: '#f6eff1',
                    border: '1px solid rgba(107, 30, 43, 0.15)',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '12px'
                  }}>
                    {item.matter_category_label || item.matter_category}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="case-label" style={{ marginBottom: '0.15rem' }}>Matter Stage</span>
                  <span className="matter-badge stage-badge" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    color: '#855b1b',
                    backgroundColor: '#faf5ec',
                    border: '1px solid rgba(133, 91, 27, 0.15)',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '12px'
                  }}>
                    {item.matter_stage_label || item.matter_stage}
                  </span>
                </div>
                {(role === 'ADMIN' || item.responsible_lawyer?.id === user?.id) && (
                  <button
                    type="button"
                    className="btn btn-ghost-dark btn-sm"
                    style={{
                      marginLeft: 'auto',
                      alignSelf: 'center'
                    }}
                    onClick={() => setShowClassificationModal(true)}
                  >
                    Update Classification
                  </button>
                )}
              </div>

              <section className="case-section" aria-labelledby="section-case-info">
                <h2 id="section-case-info" className="case-section__title">Case Information</h2>
                <div className="case-grid">
                  <DetailField label="Reference" value={item.case_reference} />
                  <DetailField label="Title" value={item.title} />
                  <DetailField label="Case Type" value={item.case_type_label || item.case_type} />
                  <DetailField label="Status" value={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={`cases-status is-${String(item.status).toLowerCase()}`}>
                        {item.status_label || item.status}
                      </span>
                      {role === 'ADMIN' && (
                        <button
                          type="button"
                          className="btn btn-ghost-dark"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', height: 'auto', minHeight: 'auto' }}
                          onClick={() => setShowStatusModal(true)}
                        >
                          Change Status
                        </button>
                      )}
                    </div>
                  } />
                  <DetailField label="Start Date" value={formatDate(item.start_date)} />
                  <DetailField label="Originating Consultation" value={item.originating_consultation_ref} />
                  {item.description && (
                    <div className="case-form-full-width">
                      <DetailField label="Description" value={item.description} long />
                    </div>
                  )}
                </div>

                {hasCourtInfo && (
                  <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--color-border)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: '0.65rem' }}>
                      Official Court Filings
                    </span>
                    <div className="case-grid">
                      <DetailField label="Court" value={item.court} />
                      <DetailField label="Jurisdiction" value={item.jurisdiction} />
                      <DetailField label="Bench" value={item.bench} />
                      <DetailField label="Location" value={item.location} />
                      <DetailField label="CNR Number" value={item.cnr_number} />
                      <DetailField label="Filing Number" value={item.filing_number} />
                      <DetailField label="Registration Number" value={item.registration_number} />
                      <DetailField label="Court Reference" value={item.official_court_reference} />
                    </div>
                  </div>
                )}
              </section>

              {/* TASKS & WORK SECTION (Internal Legal Team Only) */}
              {role !== 'CLIENT' && (
                <section className="case-section" aria-labelledby="section-tasks-work">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <h2 id="section-tasks-work" className="case-section__title" style={{ margin: 0, border: 'none', padding: 0 }}>
                        Tasks & Work
                      </h2>
                      <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.72rem' }}>
                        <span style={{ background: '#faf9f6', border: '1px solid var(--color-border)', padding: '0.15rem 0.45rem', borderRadius: '10px', fontWeight: 600 }}>
                          {tasks.length} total
                        </span>
                        <span style={{ background: '#fdf6e2', color: '#8a6d3b', border: '1px solid #f9ebc7', padding: '0.15rem 0.45rem', borderRadius: '10px', fontWeight: 600 }}>
                          {pendingCount} pending
                        </span>
                        <span style={{ background: '#eaf4fc', color: '#31708f', border: '1px solid #d9edf7', padding: '0.15rem 0.45rem', borderRadius: '10px', fontWeight: 600 }}>
                          {inProgressCount} in progress
                        </span>
                        <span style={{ background: '#e8f8f5', color: '#27ae60', border: '1px solid #d4efdf', padding: '0.15rem 0.45rem', borderRadius: '10px', fontWeight: 600 }}>
                          {completedCount} completed
                        </span>
                      </div>
                    </div>

                    {canCreateTask && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowCreateTaskModal(true)}
                      >
                        + Add Task
                      </button>
                    )}
                  </div>

                  {/* TASK FILTER TABS */}
                  <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                    {[
                      { key: 'ALL', label: 'All Tasks' },
                      { key: 'MY_TASKS', label: 'My Tasks' },
                      { key: 'PENDING', label: 'Pending' },
                      { key: 'IN_PROGRESS', label: 'In Progress' },
                      { key: 'COMPLETED', label: 'Completed' },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setTaskFilter(tab.key)}
                        style={{
                          fontSize: '0.74rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '10px',
                          border: '1px solid var(--color-border)',
                          background: taskFilter === tab.key ? 'var(--color-primary)' : '#FAF9F6',
                          color: taskFilter === tab.key ? '#fff' : 'var(--color-text)',
                          fontWeight: taskFilter === tab.key ? 600 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {tasksLoading ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#888280', fontSize: '0.85rem' }}>Loading tasks…</div>
                  ) : filteredTasks.length === 0 ? (
                    <div style={{ padding: '1.25rem 1rem', textAlign: 'center', backgroundColor: '#faf9f6', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)' }}>
                      <p style={{ fontSize: '0.85rem', color: '#888280', marginBottom: canCreateTask ? '0.65rem' : 0 }}>
                        {taskFilter !== 'ALL' ? 'No tasks match selected filter.' : 'No tasks assigned to this case yet.'}
                      </p>
                      {canCreateTask && taskFilter === 'ALL' && (
                        <button
                          type="button"
                          className="btn btn-ghost-dark btn-sm"
                          onClick={() => setShowCreateTaskModal(true)}
                        >
                          Add Task
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="cases-table-wrap" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: '#fff' }}>
                      <table className="cases-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Task Reference & Title</th>
                            <th>Assigned Member</th>
                            <th>Due Date</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTasks.map((t) => (
                            <tr
                              key={t.id}
                              className="cases-table__row-clickable"
                              onClick={() => {
                                setSelectedTaskId(t.id);
                                setShowTaskDetailModal(true);
                              }}
                            >
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.72rem', color: '#888280', fontWeight: 600 }}>{t.task_id}</span>
                                  <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{t.title}</span>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{t.assigned_to?.full_name || '—'}</span>
                                  <span style={{ fontSize: '0.72rem', color: '#888280' }}>{t.assigned_to?.email || ''}</span>
                                </div>
                              </td>
                              <td style={{ fontSize: '0.85rem' }}>{formatDate(t.due_date)}</td>
                              <td>
                                <span className={`cases-status is-${String(t.status).toLowerCase()}`}>
                                  {t.status_label || t.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost-dark"
                                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', height: 'auto', minHeight: 'auto' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTaskId(t.id);
                                    setShowTaskDetailModal(true);
                                  }}
                                >
                                  View Task
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* CASE DOCUMENTS SECTION (Common Repository) */}
              <section className="case-section" aria-labelledby="section-case-documents">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                  <h2 id="section-case-documents" className="case-section__title" style={{ margin: 0, border: 'none', padding: 0 }}>Documents & Evidence</h2>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowUploadModal(true)}
                  >
                    + Upload Document
                  </button>
                </div>

                {docsLoading ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#888280', fontSize: '0.85rem' }}>Loading documents…</div>
                ) : documents.length === 0 ? (
                  <div style={{ padding: '1.25rem 1rem', textAlign: 'center', backgroundColor: '#faf9f6', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)' }}>
                    <p style={{ fontSize: '0.85rem', color: '#888280', marginBottom: '0.65rem' }}>No documents have been uploaded for this case.</p>
                    <button
                      type="button"
                      className="btn btn-ghost-dark btn-sm"
                      onClick={() => setShowUploadModal(true)}
                    >
                      Upload Document
                    </button>
                  </div>
                ) : (
                  <div className="cases-table-wrap" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: '#fff' }}>
                    <table className="cases-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Document Name</th>
                          <th>Category</th>
                          <th>Uploaded By</th>
                          <th>Uploaded Date</th>
                          <th>Size</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((doc) => {
                          const canDelete = role === 'ADMIN' || 
                                            role === 'SENIOR_LAWYER' || 
                                            role === 'JUNIOR_LAWYER' || 
                                            role === 'PARALEGAL' || 
                                            (role === 'CLIENT' && doc.uploaded_by?.id === user?.id);

                          return (
                            <tr key={doc.id}>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{doc.title}</span>
                                    {doc.task && (
                                      <span
                                        className="case-tag-chip"
                                        style={{
                                          fontSize: '0.68rem',
                                          backgroundColor: '#faf3e0',
                                          color: '#966e00',
                                          border: '1px solid #f3e5ab',
                                          padding: '0.1rem 0.4rem',
                                          borderRadius: '8px',
                                        }}
                                        title={`Originated from task: ${doc.task.title}`}
                                      >
                                        Task: {doc.task.title}
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: '#888280' }}>{doc.file ? doc.file.split('/').pop() : ''}</span>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{doc.category_label || doc.category}</span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.8rem' }}>{doc.uploaded_by?.full_name || '—'}</span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.8rem' }}>{formatDate(doc.uploaded_at?.split('T')[0])}</span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.8rem', color: '#666' }}>{doc.file_size}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost-dark"
                                    style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', height: 'auto', minHeight: 'auto' }}
                                    onClick={() => handleViewDownload(doc)}
                                  >
                                    View
                                  </button>
                                  {canDelete && (
                                    <button
                                      type="button"
                                      className="btn btn-ghost-dark"
                                      style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', height: 'auto', minHeight: 'auto', color: '#c0392b', borderColor: '#f8d7da' }}
                                      onClick={() => {
                                        setSelectedDocToDelete(doc);
                                        setShowDeleteModal(true);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* COURT PROCEEDINGS SECTION */}
              <section className="case-section" aria-labelledby="section-proceedings" ref={proceedingsRef}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h2 id="section-proceedings" className="case-section__title" style={{ margin: 0 }}>Court Proceedings</h2>
                  {(role === 'ADMIN' || role === 'SENIOR_LAWYER' || role === 'JUNIOR_LAWYER') && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowProceedingModal(true)}
                    >
                      + Record Proceeding
                    </button>
                  )}
                </div>

                {!item.proceedings || item.proceedings.length === 0 ? (
                  <div style={{ padding: '1.25rem 1rem', textAlign: 'center', backgroundColor: '#faf9f6', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)' }}>
                    <p style={{ fontSize: '0.85rem', color: '#888280', marginBottom: '0.65rem' }}>No proceedings have been recorded for this case.</p>
                    {(role === 'ADMIN' || role === 'SENIOR_LAWYER' || role === 'JUNIOR_LAWYER') && (
                      <button
                        type="button"
                        className="btn btn-ghost-dark btn-sm"
                        onClick={() => setShowProceedingModal(true)}
                      >
                        Record Proceeding
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="cases-table-wrap" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: '#fff' }}>
                    <table className="cases-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Event Date</th>
                          <th>Event Type</th>
                          <th>Court / Forum</th>
                          <th>Next Hearing</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.proceedings.map((proc) => (
                          <tr key={proc.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatDate(proc.event_date)}</span>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{proc.event_type}</span>
                            </td>
                            <td style={{ whiteSpace: 'normal', minWidth: '130px' }}>
                              <span style={{ fontSize: '0.8rem' }}>{proc.court_name} {proc.bench && `(${proc.bench})`}</span>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: proc.next_hearing_date ? 600 : 400 }}>
                                {formatDate(proc.next_hearing_date)}
                              </span>
                            </td>
                            <td style={{ whiteSpace: 'normal', minWidth: '150px' }}>
                              <span style={{ fontSize: '0.78rem', color: '#555', display: 'block', wordBreak: 'break-word' }}>
                                {proc.notes || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            {/* SIDEBAR */}
            <div className="case-detail-sidebar">
              <section className="case-section" aria-labelledby="section-client-info">
                <h2 id="section-client-info" className="case-section__title">Client</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <DetailField label="Name" value={item.client?.full_name} />
                  {role !== 'CLIENT' && <DetailField label="Email" value={item.client?.email} />}
                  {role !== 'CLIENT' && <DetailField label="Phone" value={item.client?.phone_number} />}
                  <DetailField label="Practice Area" value={item.practice_area?.name} />
                </div>
              </section>

              {/* APPOINTMENT FEE SECTION */}
              <section className="case-section" aria-labelledby="section-appointment-fee">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h2 id="section-appointment-fee" className="case-section__title" style={{ margin: 0 }}>Appointment Fee</h2>
                  {canEditFee && (
                    <button
                      type="button"
                      className="btn btn-ghost-dark"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', height: 'auto', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      onClick={() => setShowFeeModal(true)}
                    >
                      <NavIcon name="edit" /> Edit Fee
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {item.appointment_fee !== null && item.appointment_fee !== undefined
                      ? `₹${Number(item.appointment_fee).toLocaleString('en-IN')}`
                      : <span style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.95rem' }}>Not configured</span>}
                  </div>
                  {role === 'CLIENT' ? (
                    <p style={{ fontSize: '0.78rem', color: '#666', margin: 0 }}>
                      Fee charged when scheduling an appointment regarding this case.
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.78rem', color: '#888280', margin: 0 }}>
                      {item.responsible_lawyer?.full_name ? `Configured by lead counsel ${item.responsible_lawyer.full_name}.` : 'Set by lead counsel.'}
                    </p>
                  )}
                </div>
              </section>

              {/* UPCOMING HEARING CARD */}
              <section className="case-section" aria-labelledby="section-upcoming-hearing">
                <h2 id="section-upcoming-hearing" className="case-section__title">Upcoming Hearing</h2>
                {item.upcoming_hearing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      {formatDate(item.upcoming_hearing.next_hearing_date)}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.upcoming_hearing.court_name}</div>
                    {item.upcoming_hearing.bench && (
                      <div style={{ fontSize: '0.78rem', color: '#888280' }}>{item.upcoming_hearing.bench}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    No hearing scheduled
                  </div>
                )}
              </section>

              <section className="case-section" aria-labelledby="section-legal-team">
                <h2 id="section-legal-team" className="case-section__title">Legal Team</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="case-field">
                    <span className="case-label">Lead Counsel</span>
                    <span className="case-value" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      {item.responsible_lawyer?.full_name || '—'}
                    </span>
                  </div>

                  {item.supervising_lawyer && (
                    <div className="case-field">
                      <span className="case-label">Supervising Counsel</span>
                      <span className="case-value" style={{ fontWeight: 600 }}>
                        {item.supervising_lawyer.full_name}
                      </span>
                    </div>
                  )}

                  <div className="case-field">
                    <span className="case-label">Assistant Lawyers</span>
                    {Array.isArray(item.assistant_lawyers) && item.assistant_lawyers.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                        {item.assistant_lawyers.map(al => (
                          <div key={al.id} style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="case-value" style={{ fontWeight: 500 }}>{al.full_name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="case-value" style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.85rem' }}>
                        None assigned
                      </span>
                    )}
                  </div>

                  <div className="case-field">
                    <span className="case-label">Supporting Paralegal</span>
                    <span className="case-value" style={{ fontWeight: 500 }}>
                      {item.supporting_paralegal?.full_name || 'None assigned'}
                    </span>
                  </div>

                  {(role === 'ADMIN' || item.responsible_lawyer?.id === user?.id) && (
                    <button
                      type="button"
                      className="btn btn-ghost-dark"
                      style={{ marginTop: '0.75rem', width: '100%', fontSize: '0.82rem', padding: '0.45rem 0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                      onClick={() => setShowTeamModal(true)}
                    >
                      <NavIcon name="edit" /> Manage Team
                    </button>
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

      <ManageCaseTeamModal
        open={showTeamModal}
        caseObj={item}
        onClose={() => setShowTeamModal(false)}
        onSuccess={() => load()}
      />

      <ChangeCaseStatusModal
        open={showStatusModal}
        caseObj={item}
        onClose={() => setShowStatusModal(false)}
        onSuccess={() => load()}
      />

      <ChangeMatterClassificationModal
        open={showClassificationModal}
        caseObj={item}
        onClose={() => setShowClassificationModal(false)}
        onSuccess={() => load()}
      />

      <UploadDocumentModal
        open={showUploadModal}
        caseObj={item}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => load()}
      />

      <DeleteDocumentConfirmModal
        open={showDeleteModal}
        documentObj={selectedDocToDelete}
        caseObj={item}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedDocToDelete(null);
        }}
        onSuccess={() => load()}
      />

      <CreateTaskModal
        open={showCreateTaskModal}
        caseObj={item}
        onClose={() => setShowCreateTaskModal(false)}
        onSuccess={() => load()}
      />

      <TaskDetailModal
        open={showTaskDetailModal}
        taskId={selectedTaskId}
        caseObj={item}
        onClose={() => {
          setShowTaskDetailModal(false);
          setSelectedTaskId(null);
        }}
        onSuccess={() => load()}
      />

      <AddCourtProceedingModal
        open={showProceedingModal}
        caseObj={item}
        onClose={() => setShowProceedingModal(false)}
        onSuccess={() => load()}
      />

      <EditAppointmentFeeModal
        open={showFeeModal}
        caseObj={item}
        onClose={() => setShowFeeModal(false)}
        onSuccess={() => load()}
      />
    </DashboardLayout>
  );
}

export default CaseDetailPage;
