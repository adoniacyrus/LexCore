import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateCase, getErrorMessage } from '../../services/caseService';
import { MATTER_CATEGORY_CHOICES, MATTER_STAGE_CHOICES } from './caseConstants';
import './cases.css';

function ChangeMatterClassificationModal({ open, caseObj, onClose, onSuccess }) {
  const { accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Keyboard close handler
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Reset/populate states on open
  useEffect(() => {
    if (!open || !caseObj) return;
    setSelectedCategory(caseObj.matter_category || 'COURT_LITIGATION');
    setSelectedStage(caseObj.matter_stage || 'UNDER_REVIEW');
    setError('');
    setSuccessMsg('');
    setSubmitting(false);
  }, [open, caseObj]);

  if (!open || !caseObj) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCategory || !selectedStage) return;

    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await updateCase(accessToken, caseObj.id, {
        matter_category: selectedCategory,
        matter_stage: selectedStage,
      });
      setSuccessMsg('Classification details updated successfully.');
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 1200);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update matter classification.'));
      setSubmitting(false);
    }
  };

  const currentCategoryLabel = MATTER_CATEGORY_CHOICES.find((opt) => opt.value === caseObj.matter_category)?.label || caseObj.matter_category;
  const currentStageLabel = MATTER_STAGE_CHOICES.find((opt) => opt.value === caseObj.matter_stage)?.label || caseObj.matter_stage;

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
        aria-labelledby="change-matter-classification-title"
      >
        {/* FIXED HEADER */}
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <span className="case-modal__ref">{caseObj.case_reference}</span>
            <h2 id="change-matter-classification-title" className="case-modal__title">Update Classification</h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close Classification Modal"
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
            <p className="cases-success" role="status">
              {successMsg}
            </p>
          ) : null}

          <form id="case-classification-form" onSubmit={handleSubmit} className="case-form-card">
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span className="case-label">Current Category</span>
                <div style={{ marginTop: '0.25rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--color-primary)',
                    backgroundColor: '#f6eff1',
                    border: '1px solid var(--color-border)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px'
                  }}>
                    {currentCategoryLabel}
                  </span>
                </div>
              </div>

              <div>
                <span className="case-label">Current Stage</span>
                <div style={{ marginTop: '0.25rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#495057',
                    backgroundColor: '#e9ecef',
                    border: '1px solid #ced4da',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px'
                  }}>
                    {currentStageLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="case-form-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
              <label className="auth-field">
                <span>New Category *</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  required
                  disabled={submitting}
                >
                  {MATTER_CATEGORY_CHOICES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="auth-field">
                <span>New Stage *</span>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  required
                  disabled={submitting}
                >
                  {MATTER_STAGE_CHOICES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

          </form>
        </div>

        {/* FIXED FOOTER */}
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
            form="case-classification-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Updating…' : 'Update Classification'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ChangeMatterClassificationModal;
