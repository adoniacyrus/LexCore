import React, { useRef } from 'react';

function formatDate(date = new Date()) {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function FilingChecklistPrintModal({
  open,
  onClose,
  guidance,
  isDocChecked = () => false,
}) {
  const iframeRef = useRef(null);

  if (!open || !guidance) return null;

  const todayStr = formatDate();
  const docsList = guidance.documents_required || [];
  const readyCount = docsList.filter((d) => isDocChecked(d)).length;
  const processSteps = guidance.process_overview || [];
  const commonPetitions = guidance.common_petition_types || [];
  const prepTips = guidance.what_to_prepare || [];
  const practiceAreaName = guidance.practice_area_detail?.name || 'General Legal Practice';

  const handlePrint = () => {
    // Construct clean, isolated print document HTML
    const printHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>LexCore - ${guidance.title} - Filing Guidance & Checklist</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 16mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      background-color: #ffffff !important;
      color: #1a1516 !important;
      color-scheme: light !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-size: 10pt;
      line-height: 1.45;
      margin: 0;
      padding: 0;
    }
    .print-sheet {
      width: 100%;
      background: #ffffff;
      color: #1a1516;
    }
    .print-header {
      border-bottom: 2px solid #6b1e2b;
      padding-bottom: 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .print-brand {
      font-size: 16pt;
      font-weight: 700;
      color: #6b1e2b;
      letter-spacing: -0.02em;
      margin: 0 0 2px;
      font-family: Georgia, serif;
    }
    .print-tagline {
      font-size: 8pt;
      color: #7a6e6b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0;
    }
    .print-meta {
      text-align: right;
      font-size: 8.5pt;
      color: #554b48;
    }
    .print-title-banner {
      background: #fbf8f7;
      border: 1px solid #ebdcd5;
      border-left: 5px solid #6b1e2b;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .print-doc-title {
      font-size: 13.5pt;
      font-weight: 700;
      color: #1c0c10;
      margin: 0 0 2px;
      font-family: Georgia, serif;
    }
    .print-doc-subtitle {
      font-size: 9pt;
      color: #6b1e2b;
      font-weight: 600;
      margin: 0;
    }
    .print-section {
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .print-section-title {
      font-size: 10pt;
      font-weight: 700;
      color: #6b1e2b;
      border-bottom: 1px solid #e7ded9;
      padding-bottom: 3px;
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .print-overview-text {
      font-size: 9pt;
      line-height: 1.5;
      color: #332b29;
      margin: 0 0 8px;
    }
    .print-petitions-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }
    .print-petition-tag {
      background: #f8f5f4;
      border: 1px solid #e2d7d2;
      padding: 4px 8px;
      font-size: 8pt;
      border-radius: 3px;
      color: #2e2625;
    }
    .print-checklist-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-top: 4px;
    }
    .print-checklist-table th {
      background: #f4ede9;
      color: #4a3d3a;
      text-align: left;
      padding: 5px 8px;
      font-weight: 600;
      border: 1px solid #dcd1cb;
    }
    .print-checklist-table td {
      padding: 5px 8px;
      border: 1px solid #e2d7d2;
      vertical-align: top;
    }
    .print-check-box {
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      width: 32px;
    }
    .print-check-box.checked {
      color: #2e7d32;
    }
    .print-check-box.pending {
      color: #888888;
    }
    .print-step-item {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 8.5pt;
    }
    .print-step-badge {
      font-weight: 700;
      color: #6b1e2b;
      min-width: 55px;
      flex-shrink: 0;
    }
    .print-step-desc {
      color: #332b29;
    }
    .print-prepare-list {
      margin: 0;
      padding-left: 18px;
      font-size: 8.5pt;
      color: #332b29;
    }
    .print-prepare-list li {
      margin-bottom: 3px;
    }
    .print-disclaimer-box {
      background: #fffdfa;
      border: 1px solid #eedec3;
      border-left: 3px solid #c49a45;
      padding: 7px 10px;
      font-size: 7.5pt;
      line-height: 1.4;
      color: #665022;
      margin-top: 10px;
      page-break-inside: avoid;
    }
    .print-footer {
      border-top: 1px solid #dcd1cb;
      padding-top: 6px;
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #7a6e6b;
    }
  </style>
</head>
<body>
  <div class="print-sheet">
    <div class="print-header">
      <div>
        <h1 class="print-brand">LexCore</h1>
        <p class="print-tagline">Advocates & Legal Consultants • New Delhi</p>
      </div>
      <div class="print-meta">
        <div><strong>Date:</strong> ${todayStr}</div>
        <div><strong>Category:</strong> ${guidance.title}</div>
        <div><strong>Practice Area:</strong> ${practiceAreaName}</div>
      </div>
    </div>

    <div class="print-title-banner">
      <h2 class="print-doc-title">Petition Filing Guidance & Preparation Checklist</h2>
      <p class="print-doc-subtitle">Matter: ${guidance.title} • Readiness Status: ${readyCount} of ${docsList.length} Documents Prepared</p>
    </div>

    <!-- 1. Matter Overview -->
    <div class="print-section">
      <h3 class="print-section-title">1. Matter Scope & Typical Petitions</h3>
      <p class="print-overview-text">${guidance.overview}</p>
      ${
        commonPetitions.length > 0
          ? `
        <div class="print-petitions-grid">
          ${commonPetitions
            .map((p) => `<span class="print-petition-tag">• ${p}</span>`)
            .join('')}
        </div>
      `
          : ''
      }
    </div>

    <!-- 2. Documents Checklist -->
    <div class="print-section">
      <h3 class="print-section-title">2. Required Information & Documents Checklist</h3>
      <table class="print-checklist-table">
        <thead>
          <tr>
            <th style="width: 70px; text-align: center;">Status</th>
            <th>Required Document / Record</th>
            <th style="width: 160px;">Client Notes / Copies in Hand</th>
          </tr>
        </thead>
        <tbody>
          ${docsList
            .map((doc) => {
              const checked = isDocChecked(doc);
              return `
              <tr>
                <td class="print-check-box ${checked ? 'checked' : 'pending'}">
                  ${checked ? '☑ Ready' : '☐ Pending'}
                </td>
                <td><strong>${doc}</strong></td>
                <td>&nbsp;</td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    </div>

    <!-- 3. General Legal Process -->
    ${
      processSteps.length > 0
        ? `
      <div class="print-section">
        <h3 class="print-section-title">3. General Court & Procedural Stages</h3>
        ${processSteps
          .map(
            (st) => `
          <div class="print-step-item">
            <span class="print-step-badge">Stage ${st.step || '•'}:</span>
            <div class="print-step-desc">
              <strong>${st.title}</strong> — ${st.description}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `
        : ''
    }

    <!-- 4. What to Prepare -->
    ${
      prepTips.length > 0
        ? `
      <div class="print-section">
        <h3 class="print-section-title">4. Key Details to Prepare for Legal Counsel</h3>
        <ul class="print-prepare-list">
          ${prepTips.map((tip) => `<li>${tip}</li>`).join('')}
        </ul>
      </div>
    `
        : ''
    }

    <!-- Disclaimer -->
    <div class="print-disclaimer-box">
      <strong>Important Informational Notice:</strong> ${
        guidance.disclaimer_text ||
        guidance.disclaimer ||
        'This checklist is provided for informational preparation purposes only and does not constitute formal legal advice or create an advocate-client relationship. Court procedures and limitation periods vary based on specific facts and jurisdiction. Bring this checklist and available records to your scheduled consultation.'
      }
    </div>

    <div class="print-footer">
      <span>LexCore Chambers • contact@lexcore.law • +91 123 456 7890</span>
      <span>Client Portal Intake Reference • Confidential Document</span>
    </div>
  </div>
</body>
</html>
    `;

    // Inject into hidden iframe and print from iframe context
    let iframe = iframeRef.current;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      iframeRef.current = iframe;
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();

    // Trigger print after iframe renders
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Iframe print error', e);
      }
    }, 250);
  };

  return (
    <div className="cons-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="cons-modal"
        role="dialog"
        aria-modal="true"
        style={{
          maxWidth: '860px',
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          background: '#f8f5f3',
          border: '1px solid #dfd4ce',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <header
          style={{
            padding: '1rem 1.5rem',
            background: '#ffffff',
            borderBottom: '1px solid #ebdcd5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--color-accent, #c49a45)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Document Preview
            </span>
            <h2 style={{ fontSize: '1.25rem', margin: '2px 0 0', color: 'var(--color-dark, #1c0c10)' }}>
              Print Checklist — {guidance.title}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.55rem 1.15rem', fontSize: '0.875rem' }}
              onClick={handlePrint}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print Document
            </button>
            <button
              type="button"
              className="cons-modal__close"
              onClick={onClose}
              aria-label="Close"
              style={{ position: 'static' }}
            >
              ×
            </button>
          </div>
        </header>

        {/* Modal Scrollable Preview Paper Sheet */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <div
            style={{
              background: '#ffffff',
              color: '#1a1516',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2d7d2',
              borderRadius: '6px',
              padding: '2rem 2.25rem',
              maxWidth: '780px',
              margin: '0 auto',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
            }}
          >
            {/* Paper Header */}
            <div
              style={{
                borderBottom: '2px solid #6b1e2b',
                paddingBottom: '12px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 700,
                    color: '#6b1e2b',
                    margin: '0 0 2px',
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  LexCore
                </h1>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: '#7a6e6b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    margin: 0,
                  }}
                >
                  Advocates & Legal Consultants • New Delhi
                </p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#554b48' }}>
                <div>
                  <strong>Date:</strong> {todayStr}
                </div>
                <div>
                  <strong>Category:</strong> {guidance.title}
                </div>
                <div>
                  <strong>Practice Area:</strong> {practiceAreaName}
                </div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div
              style={{
                background: '#fbf8f7',
                border: '1px solid #ebdcd5',
                borderLeft: '5px solid #6b1e2b',
                padding: '12px 16px',
                marginBottom: '18px',
              }}
            >
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#1c0c10',
                  margin: '0 0 4px',
                  fontFamily: 'Georgia, serif',
                }}
              >
                Petition Filing Guidance & Preparation Checklist
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b1e2b', fontWeight: 600, margin: 0 }}>
                Matter: {guidance.title} • Readiness Status: {readyCount} of {docsList.length}{' '}
                Documents Identified
              </p>
            </div>

            {/* Section 1: Overview & Petitions */}
            <div style={{ marginBottom: '18px' }}>
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#6b1e2b',
                  borderBottom: '1px solid #e7ded9',
                  paddingBottom: '4px',
                  margin: '0 0 8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                1. Matter Scope & Typical Petitions
              </h3>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.55, color: '#332b29', margin: '0 0 10px' }}>
                {guidance.overview}
              </p>
              {commonPetitions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {commonPetitions.map((pet, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: '#f8f5f4',
                        border: '1px solid #e2d7d2',
                        padding: '4px 8px',
                        fontSize: '0.8rem',
                        borderRadius: '3px',
                        color: '#2e2625',
                      }}
                    >
                      • {pet}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Document Checklist Table */}
            <div style={{ marginBottom: '18px' }}>
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#6b1e2b',
                  borderBottom: '1px solid #e7ded9',
                  paddingBottom: '4px',
                  margin: '0 0 8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                2. Required Information & Documents Checklist
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f4ede9', color: '#4a3d3a' }}>
                    <th style={{ padding: '6px 8px', border: '1px solid #dcd1cb', width: '80px', textAlign: 'center' }}>
                      Status
                    </th>
                    <th style={{ padding: '6px 8px', border: '1px solid #dcd1cb' }}>
                      Required Document / Record
                    </th>
                    <th style={{ padding: '6px 8px', border: '1px solid #dcd1cb', width: '160px' }}>
                      Client Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {docsList.map((doc, idx) => {
                    const checked = isDocChecked(doc);
                    return (
                      <tr key={idx}>
                        <td
                          style={{
                            padding: '6px 8px',
                            border: '1px solid #e2d7d2',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: checked ? '#2e7d32' : '#888888',
                          }}
                        >
                          {checked ? '☑ Ready' : '☐ Pending'}
                        </td>
                        <td style={{ padding: '6px 8px', border: '1px solid #e2d7d2', color: '#1c0c10' }}>
                          <strong>{doc}</strong>
                        </td>
                        <td style={{ padding: '6px 8px', border: '1px solid #e2d7d2' }}>&nbsp;</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Section 3: General Process */}
            {processSteps.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#6b1e2b',
                    borderBottom: '1px solid #e7ded9',
                    paddingBottom: '4px',
                    margin: '0 0 8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  3. General Court & Procedural Stages
                </h3>
                {processSteps.map((st, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 700, color: '#6b1e2b', minWidth: '60px', flexShrink: 0 }}>
                      Stage {st.step || idx + 1}:
                    </span>
                    <div style={{ color: '#332b29' }}>
                      <strong>{st.title}</strong> — {st.description}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Section 4: What to Prepare */}
            {prepTips.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#6b1e2b',
                    borderBottom: '1px solid #e7ded9',
                    paddingBottom: '4px',
                    margin: '0 0 8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  4. Key Details to Prepare for Legal Counsel
                </h3>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.875rem', color: '#332b29' }}>
                  {prepTips.map((tip, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Disclaimer Box */}
            <div
              style={{
                background: '#fffdfa',
                border: '1px solid #eedec3',
                borderLeft: '4px solid #c49a45',
                padding: '8px 12px',
                fontSize: '0.8rem',
                lineHeight: 1.45,
                color: '#665022',
                marginTop: '14px',
              }}
            >
              <strong>Important Informational Notice:</strong>{' '}
              {guidance.disclaimer_text ||
                guidance.disclaimer ||
                'This checklist is provided for informational preparation purposes only and does not constitute formal legal advice or create an advocate-client relationship. Court procedures and limitation periods vary based on specific facts and jurisdiction. Bring this checklist and available records to your scheduled consultation.'}
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: '1px solid #dcd1cb',
                paddingTop: '8px',
                marginTop: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
                color: '#7a6e6b',
              }}
            >
              <span>LexCore Chambers • contact@lexcore.law • +91 123 456 7890</span>
              <span>Client Portal Intake Reference • Confidential Document</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <footer
          style={{
            padding: '1rem 1.5rem',
            background: '#ffffff',
            borderTop: '1px solid #ebdcd5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            flexShrink: 0,
          }}
        >
          <button type="button" className="btn btn-ghost-dark" onClick={onClose}>
            Close Preview
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            Print Document
          </button>
        </footer>
      </div>
    </div>
  );
}

export default FilingChecklistPrintModal;
