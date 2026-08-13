import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getTaskDetail,
  updateCaseTask,
  listTaskDocuments,
  uploadTaskDocument,
  getErrorMessage,
} from '../../services/taskService';
import { downloadCaseDocument } from '../../services/caseService';
import './cases.css';

function TaskDetailModal({ open, taskId, caseObj, onClose, onSuccess }) {
  const { user, accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

  const [task, setTask] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Inline upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('OTHER');
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const loadTaskData = useCallback(async () => {
    if (!accessToken || !taskId) return;
    setLoading(true);
    setDocsLoading(true);
    setError('');
    try {
      const taskData = await getTaskDetail(accessToken, taskId);
      setTask(taskData);
      const docsData = await listTaskDocuments(accessToken, taskId);
      setDocuments(Array.isArray(docsData) ? docsData : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load task details.'));
      setTask(null);
    } finally {
      setLoading(false);
      setDocsLoading(false);
    }
  }, [accessToken, taskId]);

  useEffect(() => {
    if (open) {
      setShowUploadForm(false);
      setUploadError('');
      loadTaskData();
    }
  }, [open, loadTaskData]);

  // Keyboard close handler
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const role = user?.role || 'CLIENT';
  const isAssignedUser = task?.assigned_to?.id === user?.id;
  const isLeadLawyer = caseObj?.responsible_lawyer?.id === user?.id;
  const isAdmin = role === 'ADMIN';
  const canUpdateStatus = isAdmin || isLeadLawyer || isAssignedUser;
  const canUploadDocs = isAdmin || isLeadLawyer || isAssignedUser || role === 'SENIOR_LAWYER' || role === 'JUNIOR_LAWYER' || role === 'PARALEGAL';

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const dateObj = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`);
    return dateObj.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '—';
    const dateObj = new Date(dateString);
    return dateObj.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStatusChange = async (newStatus) => {
    if (!task || statusUpdating) return;
    setStatusUpdating(true);
    setError('');
    try {
      const updated = await updateCaseTask(accessToken, task.id, { status: newStatus });
      setTask(updated);
      onSuccess?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update status.'));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleViewDownload = async (doc) => {
    try {
      const blob = await downloadCaseDocument(accessToken, doc.id);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to open document.'));
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      setUploadError('Please enter a document title.');
      return;
    }
    if (!docFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setUploadError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('title', docTitle.trim());
      formData.append('category', docCategory);
      formData.append('file', docFile);

      await uploadTaskDocument(accessToken, task.id, formData);
      
      setDocTitle('');
      setDocFile(null);
      setShowUploadForm(false);
      
      // Reload task & documents list
      loadTaskData();
      onSuccess?.();
    } catch (err) {
      setUploadError(getErrorMessage(err, 'Failed to upload document to task.'));
    } finally {
      setUploading(false);
    }
  };

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
        className="case-modal case-modal--medium"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-modal-title"
      >
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <span className="case-modal__ref">
              {task?.task_id || 'Task'} &bull; {caseObj?.case_reference || task?.case_reference}
            </span>
            <h2 id="task-detail-modal-title" className="case-modal__title">
              {task?.title || 'Task Details'}
            </h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close Task Detail Modal"
          >
            &times;
          </button>
        </header>

        <div className="case-modal__body">
          {error ? (
            <p className="cases-error" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#888280' }}>
              Loading task details…
            </div>
          ) : !task ? (
            <div className="cases-error">Task not found or access denied.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* STATUS BAR & INFO GRID */}
              <div
                style={{
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  background: '#faf9f6',
                  padding: '0.85rem 1.25rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#888280', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                    Status
                  </span>
                  <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className={`cases-status is-${String(task.status).toLowerCase()}`}>
                      {task.status_label || task.status}
                    </span>
                    {canUpdateStatus && (
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={statusUpdating}
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.2rem 0.4rem',
                          borderRadius: 'var(--border-radius-sm)',
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="PENDING">Set Pending</option>
                        <option value="IN_PROGRESS">Set In Progress</option>
                        <option value="COMPLETED">Set Completed</option>
                        <option value="CANCELLED">Set Cancelled</option>
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: '#888280', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                    Due Date
                  </span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-primary)', marginTop: '0.2rem' }}>
                    {formatDate(task.due_date)}
                  </div>
                </div>

                {task.completed_at && (
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#27ae60', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                      Completed On
                    </span>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#27ae60', marginTop: '0.2rem' }}>
                      {formatDateTime(task.completed_at)}
                    </div>
                  </div>
                )}
              </div>

              {/* TASK METADATA GRID */}
              <div className="case-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="case-field">
                  <span className="case-label">Assigned Member</span>
                  <span className="case-value" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                    {task.assigned_to?.full_name || '—'}
                  </span>
                </div>

                <div className="case-field">
                  <span className="case-label">Created By</span>
                  <span className="case-value">{task.created_by?.full_name || '—'}</span>
                </div>

                <div className="case-field">
                  <span className="case-label">Created Date</span>
                  <span className="case-value">{formatDate(task.created_at)}</span>
                </div>
              </div>

              {task.description && (
                <div className="case-field">
                  <span className="case-label">Description</span>
                  <div className="case-value case-value--long" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {task.description}
                  </div>
                </div>
              )}

              {/* TASK DOCUMENTS SECTION */}
              <section className="case-section" style={{ marginTop: '0.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '0.6rem',
                    marginBottom: '1rem',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '1rem', fontFamily: 'serif', color: 'var(--color-primary)' }}>
                    Task Documents ({documents.length})
                  </h3>
                  {canUploadDocs && !showUploadForm && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', height: 'auto', minHeight: 'auto' }}
                      onClick={() => {
                        setDocTitle(task.title ? `Doc for ${task.title}` : '');
                        setShowUploadForm(true);
                      }}
                    >
                      + Attach Document
                    </button>
                  )}
                </div>

                {/* INLINE UPLOAD FORM */}
                {showUploadForm && (
                  <form
                    onSubmit={handleUploadSubmit}
                    style={{
                      background: '#faf9f6',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--border-radius-sm)',
                      padding: '1rem',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                        Attach Document to Task
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowUploadForm(false)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem', color: '#888' }}
                      >
                        &times;
                      </button>
                    </div>

                    {uploadError && (
                      <div className="cases-error" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
                        {uploadError}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <label className="auth-field">
                        <span style={{ fontSize: '0.75rem' }}>Document Title *</span>
                        <input
                          type="text"
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                          placeholder="e.g. Property Deed Scan"
                          required
                          disabled={uploading}
                        />
                      </label>

                      <label className="auth-field">
                        <span style={{ fontSize: '0.75rem' }}>Category</span>
                        <select
                          value={docCategory}
                          onChange={(e) => setDocCategory(e.target.value)}
                          disabled={uploading}
                        >
                          <option value="CLIENT_DOCUMENT">Client Document</option>
                          <option value="LEGAL_DOCUMENT">Legal Document</option>
                          <option value="EVIDENCE">Evidence</option>
                          <option value="COURT_DOCUMENT">Court Document</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </label>
                    </div>

                    <label className="auth-field">
                      <span style={{ fontSize: '0.75rem' }}>File (PDF, DOCX, XLSX, JPG, PNG &le; 10MB) *</span>
                      <input
                        type="file"
                        onChange={(e) => setDocFile(e.target.files[0] || null)}
                        required
                        disabled={uploading}
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                      />
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn btn-ghost-dark"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        onClick={() => setShowUploadForm(false)}
                        disabled={uploading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        disabled={uploading}
                      >
                        {uploading ? 'Uploading…' : 'Upload & Attach'}
                      </button>
                    </div>
                  </form>
                )}

                {/* DOCUMENTS TABLE */}
                {docsLoading ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#888280', fontSize: '0.85rem' }}>
                    Loading task documents…
                  </div>
                ) : documents.length === 0 ? (
                  <div
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      backgroundColor: '#faf9f6',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--border-radius-sm)',
                    }}
                  >
                    <p style={{ fontSize: '0.85rem', color: '#888280', margin: 0 }}>
                      No documents attached to this task.
                    </p>
                  </div>
                ) : (
                  <div className="cases-table-wrap" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: '#fff' }}>
                    <table className="cases-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Document Name</th>
                          <th>Category</th>
                          <th>Uploaded By</th>
                          <th>Date</th>
                          <th>Size</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((doc) => (
                          <tr key={doc.id}>
                            <td style={{ fontWeight: 600 }}>{doc.title}</td>
                            <td>
                              <span className="case-tag-chip" style={{ fontSize: '0.7rem' }}>
                                {doc.category_label || doc.category}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.82rem' }}>{doc.uploaded_by?.full_name || '—'}</td>
                            <td style={{ fontSize: '0.82rem' }}>{formatDate(doc.uploaded_at)}</td>
                            <td style={{ fontSize: '0.82rem' }}>{doc.file_size}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-ghost-dark"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', height: 'auto', minHeight: 'auto' }}
                                onClick={() => handleViewDownload(doc)}
                              >
                                View / Download
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

            </div>
          )}
        </div>

        <footer className="case-modal__footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

export default TaskDetailModal;
