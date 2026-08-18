import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createCaseTask, getErrorMessage } from '../../services/taskService';
import './cases.css';

function CreateTaskModal({ open, caseObj, onClose, onSuccess }) {
  const { accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('PENDING');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Keyboard close handler
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Reset form on open
  useEffect(() => {
    if (!open || !caseObj) return;
    setTitle('');
    setDescription('');
    setAssignedToId('');
    setDueDate('');
    setStatus('PENDING');
    setError('');
    setSubmitting(false);

    // Auto-select lead lawyer as default assigned_to if available
    if (caseObj.responsible_lawyer?.id) {
      setAssignedToId(String(caseObj.responsible_lawyer.id));
    }
  }, [open, caseObj]);

  if (!open || !caseObj) return null;

  // Build eligible case team list
  const teamMembers = [];
  if (caseObj.responsible_lawyer) {
    teamMembers.push({
      id: caseObj.responsible_lawyer.id,
      name: caseObj.responsible_lawyer.full_name,
      roleLabel: 'Lead Counsel',
    });
  }
  if (caseObj.supervising_lawyer) {
    teamMembers.push({
      id: caseObj.supervising_lawyer.id,
      name: caseObj.supervising_lawyer.full_name,
      roleLabel: 'Supervising Counsel',
    });
  }
  if (Array.isArray(caseObj.assistant_lawyers)) {
    caseObj.assistant_lawyers.forEach((al) => {
      teamMembers.push({
        id: al.id,
        name: al.full_name,
        roleLabel: al.role === 'SENIOR_LAWYER' ? 'Assistant Lawyer (Senior)' : 'Assistant Lawyer (Junior)',
      });
    });
  }
  if (caseObj.supporting_paralegal) {
    teamMembers.push({
      id: caseObj.supporting_paralegal.id,
      name: caseObj.supporting_paralegal.full_name,
      roleLabel: 'Supporting Paralegal',
    });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a task title.');
      return;
    }
    if (!assignedToId) {
      setError('Please select a case team member to assign the task.');
      return;
    }
    if (!dueDate) {
      setError('Please select a due date.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        assigned_to_id: parseInt(assignedToId, 10),
        due_date: dueDate,
        status,
      };
      await createCaseTask(accessToken, caseObj.id, payload);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create task.'));
      setSubmitting(false);
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
        className="case-modal case-modal--small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-modal-title"
      >
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <span className="case-modal__ref">{caseObj.case_reference}</span>
            <h2 id="create-task-modal-title" className="case-modal__title">Create Case Task</h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close Create Task Modal"
            disabled={submitting}
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

          <form id="create-task-form" onSubmit={handleSubmit} className="case-form-card">
            <div className="case-form-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
              <label className="auth-field">
                <span>Task Title *</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Collect property deed / Research precedent law"
                  required
                  disabled={submitting}
                />
              </label>

              <label className="auth-field">
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide instructions or background context for this work item..."
                  rows={3}
                  disabled={submitting}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'inherit',
                    fontSize: '0.88rem',
                  }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label className="auth-field">
                  <span>Assign To *</span>
                  <select
                    value={assignedToId}
                    onChange={(e) => setAssignedToId(e.target.value)}
                    required
                    disabled={submitting}
                  >
                    <option value="" disabled>-- Select Case Team Member --</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.roleLabel})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="auth-field">
                  <span>Due Date *</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </label>
              </div>

              <label className="auth-field">
                <span>Initial Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={submitting}
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </label>
            </div>
          </form>
        </div>

        <footer className="case-modal__footer">
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
            form="create-task-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Creating Task…' : 'Create Task'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default CreateTaskModal;
