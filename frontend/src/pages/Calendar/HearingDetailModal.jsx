import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavIcon } from '../../components/dashboard/icons';
import '../../pages/Cases/cases.css';

import { useAuth } from '../../context/AuthContext';

function HearingDetailModal({ open, hearing, onClose }) {
  const backdropPointerDown = useRef(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !hearing) return null;

  const getRolePrefix = (role) => {
    if (role === 'ADMIN') return 'admin';
    if (role === 'SENIOR_LAWYER') return 'senior';
    if (role === 'JUNIOR_LAWYER') return 'junior';
    if (role === 'PARALEGAL') return 'paralegal';
    return 'client';
  };

  const rolePrefix = getRolePrefix(user?.role || 'CLIENT');

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleOpenMatter = () => {
    onClose();
    navigate(`/dashboard/${rolePrefix}/cases/${hearing.case_reference}`);
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
        aria-labelledby="hearing-detail-title"
      >
        <header className="case-modal__header">
          <div className="case-modal__title-group">
            <p className="case-modal__tag">Court Hearing Details</p>
            <h2 id="hearing-detail-title" className="case-modal__title">
              {hearing.case_title || 'Hearing Session'}
            </h2>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close details"
          >
            &times;
          </button>
        </header>
 
        <main className="case-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="case-field">
            <span className="case-label">Case Reference</span>
            <span className="case-value" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
              {hearing.case_reference}
            </span>
          </div>
 
          <div className="case-field">
            <span className="case-label">Court / Forum</span>
            <span className="case-value">{hearing.court_name}</span>
          </div>
 
          {hearing.bench && (
            <div className="case-field">
              <span className="case-label">Bench / Division</span>
              <span className="case-value">{hearing.bench}</span>
            </div>
          )}
 
          <div className="case-field">
            <span className="case-label">Hearing Date</span>
            <span className="case-value" style={{ fontWeight: 600 }}>
              {formatDate(hearing.next_hearing_date)}
            </span>
          </div>
 
          <div className="case-field">
            <span className="case-label">Responsible Lawyer</span>
            <span className="case-value">{hearing.responsible_lawyer_name || '—'}</span>
          </div>
 
          {hearing.notes && (
            <div className="case-field">
              <span className="case-label">Chamber & Filing Notes</span>
              <p
                style={{
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  margin: '0.2rem 0 0 0',
                  color: '#4e4a49',
                  background: '#faf9f6',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {hearing.notes}
              </p>
            </div>
          )}
        </main>
 
        <footer className="case-modal__footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenMatter}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <NavIcon name="cases" /> Open Matter
          </button>
        </footer>
      </div>
    </div>
  );
}

export default HearingDetailModal;
