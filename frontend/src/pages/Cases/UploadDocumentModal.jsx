import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadCaseDocument, getErrorMessage } from '../../services/caseService';
import './cases.css';

const CATEGORY_CHOICES = [
  { value: 'CLIENT_DOCUMENT', label: 'Client Document' },
  { value: 'LEGAL_DOCUMENT', label: 'Legal Document' },
  { value: 'EVIDENCE', label: 'Evidence' },
  { value: 'COURT_DOCUMENT', label: 'Court Document' },
  { value: 'OTHER', label: 'Other' },
];

function UploadDocumentModal({ open, caseObj, onClose, onSuccess }) {
  const { accessToken } = useAuth();
  const backdropPointerDown = useRef(false);
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('LEGAL_DOCUMENT');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

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

  // Reset form states on open
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setCategory('LEGAL_DOCUMENT');
    setDescription('');
    setSelectedFile(null);
    setError('');
    setSuccessMsg('');
    setSubmitting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [open]);

  if (!open || !caseObj) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Auto-fill title from filename if title is empty
      if (!title.trim()) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a document title.');
      return;
    }
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('category', category);
    formData.append('file', selectedFile);
    if (description.trim()) {
      formData.append('description', description.trim());
    }

    try {
      await uploadCaseDocument(accessToken, caseObj.id, formData);
      setSuccessMsg('Document uploaded successfully.');
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 1200);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to upload document.'));
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
        aria-labelledby="upload-doc-title"
      >
        {/* FIXED HEADER */}
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <span className="case-modal__ref">{caseObj.case_reference}</span>
            <h2 id="upload-doc-title" className="case-modal__title">Upload Document</h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close Upload Modal"
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

          <form id="upload-doc-form" onSubmit={handleSubmit} className="case-form-card">
            
            <div className="case-form-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
              <label className="auth-field">
                <span>Choose File *</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  required
                  disabled={submitting}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  style={{ padding: '0.4rem 0.5rem', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.82rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#888280', marginTop: '0.2rem' }}>
                  Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 10MB)
                </span>
              </label>

              <label className="auth-field">
                <span>Document Title *</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Enter Title or Name"
                  disabled={submitting}
                />
              </label>

              <label className="auth-field">
                <span>Category *</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  disabled={submitting}
                >
                  {CATEGORY_CHOICES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="auth-field">
                <span>Description (Optional)</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide context or summary notes..."
                  disabled={submitting}
                />
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
            form="upload-doc-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Uploading Document…' : 'Upload Document'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default UploadDocumentModal;
