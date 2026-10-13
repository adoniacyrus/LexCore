import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import BookConsultationModal from '../Consultations/BookConsultationModal';
import FilingChecklistPrintModal from './FilingChecklistPrintModal';
import { listFilingGuidances, getErrorMessage } from '../../services/consultationService';
import './filingGuidance.css';

// Custom category icons for legal domains
function CategoryIcon({ title = '' }) {
  const t = title.toLowerCase();
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (t.includes('civil')) {
    return (
      <svg {...common}>
        <path d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
      </svg>
    );
  }
  if (t.includes('criminal')) {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    );
  }
  if (t.includes('family')) {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (t.includes('property') || t.includes('estate') || t.includes('land')) {
    return (
      <svg {...common}>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  }
  if (t.includes('contract') || t.includes('commercial')) {
    return (
      <svg {...common}>
        <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    );
  }
  if (t.includes('employment') || t.includes('workplace') || t.includes('labour')) {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <polyline points="17 11 19 13 23 9" />
      </svg>
    );
  }
  if (t.includes('consumer')) {
    return (
      <svg {...common}>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function FilingGuidancePage() {
  const { accessToken, user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isDashboard = location.pathname.startsWith('/dashboard');

  const [guidances, setGuidances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'checklist' | 'process' | 'prepare'
  const [checkedDocs, setCheckedDocs] = useState({});
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Load guidance from API
  const loadGuidance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listFilingGuidances(accessToken);
      const list = Array.isArray(data) ? data : [];
      setGuidances(list);

      // Determine initial selection from query param or first available
      const paramSlug = searchParams.get('category');
      const paramAreaId = searchParams.get('practice_area');

      let initial = null;
      if (paramSlug) {
        initial = list.find((g) => g.slug === paramSlug || String(g.id) === paramSlug);
      }
      if (!initial && paramAreaId) {
        initial = list.find((g) => String(g.practice_area) === paramAreaId);
      }
      if (!initial && list.length > 0) {
        initial = list[0];
      }

      if (initial) {
        setSelectedSlug(initial.slug);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load petition filing guidance.'));
      setGuidances([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, searchParams]);

  useEffect(() => {
    loadGuidance();
  }, [loadGuidance]);

  // Filtered guidances by search query
  const filteredGuidances = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return guidances;
    return guidances.filter((g) => {
      const title = (g.title || '').toLowerCase();
      const overview = (g.overview || '').toLowerCase();
      const pa = (g.practice_area_detail?.name || '').toLowerCase();
      const petitions = (g.common_petition_types || []).join(' ').toLowerCase();
      return title.includes(q) || overview.includes(q) || pa.includes(q) || petitions.includes(q);
    });
  }, [guidances, searchQuery]);

  // Currently active selected guidance
  const selectedGuidance = useMemo(() => {
    return guidances.find((g) => g.slug === selectedSlug) || guidances[0] || null;
  }, [guidances, selectedSlug]);

  const handleSelectCategory = (slug) => {
    setSelectedSlug(slug);
    setSearchParams({ category: slug }, { replace: true });
    // Reset active tab to overview when category changes
    setActiveTab('overview');
  };

  const toggleDocCheck = (docText) => {
    setCheckedDocs((prev) => {
      const key = `${selectedGuidance?.slug || 'curr'}_${docText}`;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const isDocChecked = (docText) => {
    const key = `${selectedGuidance?.slug || 'curr'}_${docText}`;
    return Boolean(checkedDocs[key]);
  };

  const docsList = selectedGuidance?.documents_required || [];
  const checkedDocsCount = docsList.filter((doc) => isDocChecked(doc)).length;
  const docsProgressPercent =
    docsList.length > 0 ? Math.round((checkedDocsCount / docsList.length) * 100) : 0;

  // Handle Book Consultation action
  const handleProceedToConsultation = () => {
    const practiceAreaId = selectedGuidance?.practice_area || '';
    const subject = selectedGuidance?.title || '';

    if (isAuthenticated && user?.role === 'CLIENT') {
      if (isDashboard) {
        setBookModalOpen(true);
      } else {
        navigate(
          `/dashboard/client/consultations?book=1&practice_area=${practiceAreaId}&subject=${encodeURIComponent(
            subject
          )}`
        );
      }
    } else {
      // Unauthenticated visitor
      navigate(
        `/login?intent=consultation&practice_area=${practiceAreaId}&category=${encodeURIComponent(
          subject
        )}`
      );
    }
  };

  const handlePrint = () => {
    setPrintModalOpen(true);
  };

  const content = (
    <div className={`fg-page ${isDashboard ? 'fg-page--dashboard' : ''} lw-fade-in`}>
      {/* Header */}
      <header className="fg-header">
        <div className="fg-header-badge">Petition Guidance & Matter Intake</div>
        <h1 className="fg-title">Start a Legal Matter</h1>
        <p className="fg-subtitle">
          Review standard petition categories, essential document checklists, court process
          milestones, and preparatory guidance before consulting with our advocates.
        </p>
        <div className="fg-disclaimer-pill">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>General Informational Guidance — Not Legal Advice</span>
        </div>
      </header>

      {error ? (
        <p className="cons-error" role="alert">
          {error}
        </p>
      ) : null}

      {/* Category Selector */}
      <section className="fg-selector-section" aria-label="Select matter category">
        <div className="fg-search-box">
          <svg className="fg-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="fg-search-input"
            placeholder="Search matter categories, petitions, or keywords…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Filter legal matter categories"
          />
        </div>

        {loading ? (
          <p className="cons-table__empty">Loading legal matter guidance categories…</p>
        ) : filteredGuidances.length === 0 ? (
          <p className="cons-hint">No matter categories found matching "{searchQuery}".</p>
        ) : (
          <div className="fg-category-grid" role="tablist" aria-label="Legal Matter Categories">
            {filteredGuidances.map((cat) => {
              const active = cat.slug === selectedGuidance?.slug;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`fg-category-card ${active ? 'is-active' : ''}`}
                  onClick={() => handleSelectCategory(cat.slug)}
                >
                  <div>
                    <div className="fg-cat-header">
                      <div className="fg-cat-icon">
                        <CategoryIcon title={cat.title} />
                      </div>
                      {cat.practice_area_detail?.name ? (
                        <span className="fg-cat-badge">{cat.practice_area_detail.name}</span>
                      ) : null}
                    </div>
                    <h3 className="fg-cat-title">{cat.title}</h3>
                    <p className="fg-cat-desc">{cat.overview}</p>
                  </div>
                  <div className="fg-cat-arrow">
                    <span>{active ? 'Viewing Guide' : 'Explore Guidance'}</span>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Selected Guidance Dossier */}
      {selectedGuidance ? (
        <section className="fg-dossier" aria-labelledby="fg-active-title">
          <header className="fg-dossier-header">
            <div>
              <div className="fg-dossier-meta">
                <span className="fg-dossier-practice">
                  {selectedGuidance.practice_area_detail?.name || 'Legal Matter Category'}
                </span>
                <span className="fg-cat-badge">Standard Procedure</span>
              </div>
              <h2 id="fg-active-title" className="fg-dossier-title">
                {selectedGuidance.title}
              </h2>
            </div>
            <div className="fg-dossier-top-actions">
              <button
                type="button"
                className="fg-print-btn"
                onClick={handlePrint}
                title="Print or save this guidance as PDF"
              >
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>Print Checklist</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleProceedToConsultation}
              >
                Book a Consultation
              </button>
            </div>
          </header>

          {/* Navigation Tabs */}
          <nav className="fg-tabs-nav" aria-label="Guidance sections">
            <button
              type="button"
              className={`fg-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <span>1. What It Involves</span>
            </button>
            <button
              type="button"
              className={`fg-tab-btn ${activeTab === 'checklist' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('checklist')}
            >
              <span>2. Documents to Prepare</span>
              <span className="fg-tab-badge">
                {checkedDocsCount}/{docsList.length}
              </span>
            </button>
            <button
              type="button"
              className={`fg-tab-btn ${activeTab === 'process' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('process')}
            >
              <span>3. General Process</span>
              <span className="fg-tab-badge">
                {(selectedGuidance.process_overview || []).length} Steps
              </span>
            </button>
            <button
              type="button"
              className={`fg-tab-btn ${activeTab === 'prepare' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('prepare')}
            >
              <span>4. Prepare for Lawyer</span>
            </button>
          </nav>

          {/* Tab Body */}
          <div className="fg-tab-body">
            {/* TAB 1: Overview */}
            {activeTab === 'overview' && (
              <div className="lw-fade-in">
                <p className="fg-overview-text">{selectedGuidance.overview}</p>

                <h3 className="fg-section-heading">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Typical Petitions & Applications in this Category</span>
                </h3>

                <div className="fg-petition-types-list">
                  {(selectedGuidance.common_petition_types || []).map((type, idx) => (
                    <div key={idx} className="fg-petition-type-item">
                      <span className="fg-petition-bullet">◆</span>
                      <span>{type}</span>
                    </div>
                  ))}
                </div>

                <div className="fg-checklist-note">
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    Note: Different circumstances require specific pleadings. Your assigned advocate
                    will advise on the appropriate legal petition during your consultation.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: Documents Checklist */}
            {activeTab === 'checklist' && (
              <div className="lw-fade-in">
                <div className="fg-checklist-header">
                  <div className="fg-progress-info">
                    <strong>Document Readiness Checklist</strong>
                    <span>
                      {checkedDocsCount} of {docsList.length} documents identified
                    </span>
                  </div>
                  <div className="fg-progress-bar-wrap" aria-hidden="true">
                    <div
                      className="fg-progress-bar-fill"
                      style={{ width: `${docsProgressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="fg-checklist-items">
                  {docsList.map((doc, idx) => {
                    const checked = isDocChecked(doc);
                    return (
                      <label
                        key={idx}
                        className={`fg-check-item ${checked ? 'is-checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="fg-check-input"
                          checked={checked}
                          onChange={() => toggleDocCheck(doc)}
                        />
                        <span className="fg-check-label">{doc}</span>
                      </label>
                    );
                  })}
                </div>

                <p className="fg-checklist-note">
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    You do not need every single document in hand before your initial consultation.
                    Bringing what you have helps counsel evaluate your matter faster.
                  </span>
                </p>
              </div>
            )}

            {/* TAB 3: Process Roadmap */}
            {activeTab === 'process' && (
              <div className="lw-fade-in">
                <h3 className="fg-section-heading">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                  <span>High-Level Legal Process Stages</span>
                </h3>

                <div className="fg-roadmap">
                  {(selectedGuidance.process_overview || []).map((step, idx) => (
                    <div key={idx} className="fg-step-card">
                      <div className="fg-step-num">{step.step || idx + 1}</div>
                      <div className="fg-step-content">
                        <h4 className="fg-step-title">{step.title}</h4>
                        <p className="fg-step-desc">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="fg-checklist-note">
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    Process timelines vary significantly based on court rosters, jurisdiction, and
                    interim applications. Not every petition goes through every stage.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 4: What to Prepare for Lawyer */}
            {activeTab === 'prepare' && (
              <div className="lw-fade-in">
                <h3 className="fg-section-heading">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  <span>Information to Prepare for Your Consultation</span>
                </h3>

                <div className="fg-prepare-grid">
                  {(selectedGuidance.what_to_prepare || []).map((tip, idx) => (
                    <div key={idx} className="fg-prepare-card">
                      <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>✓</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>

                <div className="fg-checklist-note">
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    Having this information ready helps counsel quickly analyze the strengths,
                    limitation period, and legal remedies available for your situation.
                  </span>
                </div>
              </div>
            )}

            {/* Prominent Legal Disclaimer */}
            <div className="fg-disclaimer-box" role="note">
              <div className="fg-disclaimer-title">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Important General Legal Information Disclaimer</span>
              </div>
              <p className="fg-disclaimer-body">
                {selectedGuidance.disclaimer_text ||
                  selectedGuidance.disclaimer ||
                  'This guidance provides general legal information regarding standard procedures and documentation. It does not constitute tailored legal advice or establish an advocate-client relationship. Please consult our legal counsel to evaluate your specific situation.'}
              </p>
            </div>

            {/* Action Bar */}
            <div className="fg-actions-bar">
              <div>
                <strong>Ready to proceed with your matter?</strong>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#6d5e5a' }}>
                  Our legal team is ready to evaluate your situation and advise on next steps.
                </p>
              </div>

              <div className="fg-actions-cta">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleProceedToConsultation}
                >
                  Submit Consultation Request
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleProceedToConsultation}
                >
                  Book a Consultation
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Embedded Book Consultation Modal for dashboard clients */}
      {isDashboard && (
        <BookConsultationModal
          open={bookModalOpen}
          onClose={() => setBookModalOpen(false)}
          onSubmitted={() => {
            setBookModalOpen(false);
            navigate('/dashboard/client/consultations');
          }}
          initialPracticeAreaId={selectedGuidance?.practice_area}
          initialSubject={selectedGuidance?.title}
        />
      )}

      {/* Formatted Checklist Print & Preview Modal */}
      <FilingChecklistPrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        guidance={selectedGuidance}
        isDocChecked={isDocChecked}
      />
    </div>
  );

  if (isDashboard) {
    return (
      <DashboardLayout showContext={false} activeModule="filing-guidance" fillHeight>
        {content}
      </DashboardLayout>
    );
  }

  return content;
}

export default FilingGuidancePage;
