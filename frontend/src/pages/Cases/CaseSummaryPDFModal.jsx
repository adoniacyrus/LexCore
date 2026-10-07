import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { downloadCaseSummaryPDF, getErrorMessage } from '../../services/caseService';
import './cases.css';

function CaseSummaryPDFModal({ open, caseObj, onClose }) {
  const { accessToken } = useAuth();
  const backdropPointerDown = useRef(false);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);

  // Keyboard close handler
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !downloading) onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, downloading, onClose]);

  // Load PDF Blob when modal opens
  useEffect(() => {
    let active = true;
    let createdUrl = null;

    if (!open || !caseObj) {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
      return;
    }

    const loadPdf = async () => {
      setLoading(true);
      setError('');
      try {
        const targetId = caseObj.case_reference || caseObj.id;
        const blob = await downloadCaseSummaryPDF(accessToken, targetId, false);
        if (!active) return;
        createdUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setPdfUrl(createdUrl);
      } catch (err) {
        if (!active) return;
        setError(getErrorMessage(err, 'Failed to generate case summary document.'));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, caseObj, accessToken]);

  if (!open || !caseObj) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const targetId = caseObj.case_reference || caseObj.id;
      const blob = await downloadCaseSummaryPDF(accessToken, targetId, true);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `LexCore_Case_${caseObj.case_reference}_Summary.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to download case summary PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
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
        if (e.target === e.currentTarget && backdropPointerDown.current && !downloading) {
          onClose?.();
        }
        backdropPointerDown.current = false;
      }}
    >
      <div
        className="case-modal case-modal--large"
        style={{ maxWidth: '960px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-summary-pdf-title"
      >
        <header className="case-modal__header" style={{ alignItems: 'center' }}>
          <div className="case-modal__title-group">
            <span className="case-modal__ref">{caseObj.case_reference}</span>
            <h2 id="case-summary-pdf-title" className="case-modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Case Summary & Activity Dossier</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: '#f6eff1',
                  color: 'var(--color-primary)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(107,30,43,0.15)',
                }}
              >
                Official PDF
              </span>
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', marginRight: '0.5rem' }}>
            {pdfUrl && (
              <button
                type="button"
                className="btn btn-ghost-dark btn-sm"
                onClick={handleOpenInNewTab}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title="Open PDF in new browser tab"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                New Tab
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleDownload}
              disabled={downloading || loading}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {downloading ? 'Downloading…' : 'Download PDF'}
            </button>
          </div>
          <button
            type="button"
            className="case-modal__close"
            onClick={onClose}
            aria-label="Close Case Summary PDF Modal"
          >
            &times;
          </button>
        </header>

        <div
          className="case-modal__body"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '0.75rem 1.25rem',
            overflow: 'hidden',
            backgroundColor: '#f8fafc',
          }}
        >
          {loading && (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', margin: 'auto' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  border: '3px solid rgba(107,30,43,0.15)',
                  borderTopColor: 'var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem',
                }}
              />
              <p style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
                Compiling Official Case Summary…
              </p>
              <p style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
                Generating comprehensive document including matter history, fees collected, proceedings, tasks, and audit logs.
              </p>
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: '2rem', textAlign: 'center', margin: 'auto' }}>
              <p className="cases-error" style={{ marginBottom: '1rem' }}>{error}</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setError('');
                  setLoading(true);
                  downloadCaseSummaryPDF(accessToken, caseObj.case_reference || caseObj.id, false)
                    .then((blob) => {
                      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
                      setPdfUrl(url);
                      setLoading(false);
                    })
                    .catch((err) => {
                      setError(getErrorMessage(err, 'Failed to generate PDF.'));
                      setLoading(false);
                    });
                }}
              >
                Retry Generation
              </button>
            </div>
          )}

          {pdfUrl && !loading && !error && (
            <div style={{ flex: 1, minHeight: '520px', height: '68vh', width: '100%', position: 'relative' }}>
              <iframe
                src={pdfUrl}
                title={`Case Summary - ${caseObj.case_reference}`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  backgroundColor: '#fff',
                }}
              />
            </div>
          )}
        </div>

        <footer
          className="case-modal__footer"
          style={{
            padding: '0.65rem 1.25rem',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Includes matter overview, assigned advocates, registry, financial ledger, proceedings & audit trail.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost-dark btn-sm"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleDownload}
              disabled={downloading || loading}
            >
              {downloading ? 'Downloading…' : 'Download PDF'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default CaseSummaryPDFModal;
