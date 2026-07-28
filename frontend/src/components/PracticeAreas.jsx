import React, { useEffect, useState, useCallback } from 'react';
import { useModals } from '../context/ModalContext';
import { useReveal } from '../hooks/useReveal';

const practices = [
  {
    title: 'Civil Law',
    desc: 'Litigation, contractual disputes, and advisory counsel for individuals and institutions.',
    points: ['Dispute resolution', 'Contract counsel', 'Court representation'],
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.35} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
      </svg>
    ),
  },
  {
    title: 'Corporate Law',
    desc: 'Formation, governance, mergers, and commercial agreements that keep businesses deal-ready.',
    points: ['Company formation', 'M&A support', 'Commercial contracts'],
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.35} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12" />
      </svg>
    ),
  },
  {
    title: 'Criminal Law',
    desc: 'Focused defense representation and strategic counsel at every stage of proceedings.',
    points: ['Defense strategy', 'Bail & hearings', 'Legal counsel'],
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.35} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875V16.5m16.5 3.75a.75.75 0 0 0 .75-.75h-3a1.875 1.875 0 0 1-1.875-1.875V16.5M3.75 16.5h16.5" />
      </svg>
    ),
  },
  {
    title: 'Family Law',
    desc: 'Sensitive guidance through divorce, custody, maintenance, and family disputes.',
    points: ['Divorce & custody', 'Maintenance', 'Mediation support'],
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.35} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A9.342 9.342 0 0 1 12.062 21H12a9.34 9.34 0 0 1-2.937-.883v-.109c0-1.113.285-2.16.786-3.07M9 19.128a9.38 9.38 0 0 1-2.625.372 9.337 9.337 0 0 1-4.121-.952 4.125 4.125 0 0 1 7.533-2.493M12 6.75a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </svg>
    ),
  },
  {
    title: 'Property Law',
    desc: 'Title verification, transactions, and dispute resolution for residential and commercial property.',
    points: ['Title diligence', 'Sale & purchase', 'Property disputes'],
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.35} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
      </svg>
    ),
  },
  {
    title: 'Tax & Compliance',
    desc: 'Advisory, filings, and regulatory support that keep individuals and companies on solid ground.',
    points: ['Tax advisory', 'Filings', 'Regulatory compliance'],
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.35} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

const CYCLE_MS = 4500;

function PracticeAreas() {
  const { openConsultation } = useModals();
  const sectionRef = useReveal();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [panelKey, setPanelKey] = useState(0);

  const select = useCallback((index) => {
    setActive(index);
    setPanelKey((k) => k + 1);
  }, []);

  const step = useCallback((dir) => {
    setActive((prev) => {
      const next = (prev + dir + practices.length) % practices.length;
      setPanelKey((k) => k + 1);
      return next;
    });
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => step(1), CYCLE_MS);
    return () => clearInterval(id);
  }, [paused, step]);

  const current = practices[active];

  return (
    <section
      id="practices"
      className="practice-viewport"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div ref={sectionRef} className="container-custom practice-shell reveal">
        <header className="practice-header">
          <div className="practice-header-left">
            <span className="section-tag-gold">Practice Areas</span>
            <h2 className="practice-title">Legal expertise</h2>
          </div>
          <div className="practice-nav-controls">
            <button type="button" className="practice-nav-btn" onClick={() => step(-1)} aria-label="Previous practice">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="practice-nav-count">
              <em>0{active + 1}</em> / 0{practices.length}
            </span>
            <button type="button" className="practice-nav-btn" onClick={() => step(1)} aria-label="Next practice">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </header>

        <div className="practice-dossier">
          <div className="practice-index" role="tablist" aria-label="Practice areas">
            {practices.map((practice, idx) => (
              <button
                key={practice.title}
                type="button"
                role="tab"
                aria-selected={active === idx}
                className={`practice-index-item ${active === idx ? 'is-active' : ''}`}
                onClick={() => select(idx)}
                onMouseEnter={() => select(idx)}
                onFocus={() => select(idx)}
              >
                <span className="practice-index-num">0{idx + 1}</span>
                <span className="practice-index-label">{practice.title}</span>
                <span className="practice-index-rail" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="practice-stage" role="tabpanel">
            <div className={`practice-timer ${paused ? 'is-paused' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 36 36">
                <circle className="practice-timer-track" cx="18" cy="18" r="15.5" />
                <circle
                  key={panelKey}
                  className="practice-timer-bar"
                  cx="18"
                  cy="18"
                  r="15.5"
                  style={{ animationDuration: `${CYCLE_MS}ms` }}
                />
              </svg>
            </div>

            <div key={panelKey} className="practice-panel">
              <div className="practice-panel-ornament" aria-hidden="true" />
              <div className="practice-panel-top">
                <span className="practice-panel-num">0{active + 1}</span>
                <div className="practice-panel-icon">{current.icon}</div>
              </div>
              <h3 className="practice-panel-title">{current.title}</h3>
              <p className="practice-panel-desc">{current.desc}</p>
              <ul className="practice-panel-points">
                {current.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <button type="button" className="btn btn-primary btn-arrow practice-panel-cta" onClick={openConsultation}>
                Discuss this matter
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PracticeAreas;
