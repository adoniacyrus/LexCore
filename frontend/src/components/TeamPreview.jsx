import React, { useState } from 'react';

const team = [
  {
    id: 'arthur_vance',
    name: 'Arthur Vance',
    role: 'Managing Partner',
    initials: 'AV',
    spec: 'Commercial Litigation & Appellate Advocacy',
    exp: 28,
    quote: '"Courage in the courtroom, diligence in chambers."',
    bio: {
      education: 'J.D., Harvard Law School (Magna Cum Laude) | B.A. in Philosophy, Yale University',
      admissions: 'Supreme Court of the United States | Federal Bar Association | State Bar Association',
      matters: 'Lead counsel defending global energy conglomerate in $1.4B environmental tort litigation. Successfully argued landmark antitrust appeal in the Seventh Circuit.',
      publications: 'Editor of the Federal Litigation Review; Author of "Fiduciary Jurisprudence in Modern Corporate Structuring" (Oxford Press).',
    },
  },
  {
    id: 'eleanor_sterling',
    name: 'Eleanor Sterling',
    role: 'Senior Advocate',
    initials: 'ES',
    spec: 'Corporate Governance & Merger Advisory',
    exp: 19,
    quote: '"Precedent guides us; precision defines us."',
    bio: {
      education: 'LL.M., Oxford University (First Class Honors) | J.D., Columbia Law School',
      admissions: 'State Chancery Court | Securities & Exchange Commission Bar',
      matters: 'Structured cross-border merger of global logistics networks valued at $950M. Advisor to multinational boards on compliance auditing.',
      publications: 'Regular contributor to The Corporate Counsel Journal; Author of "Governance & Sovereign Risk Management" (2024).',
    },
  },
  {
    id: 'david_thorne',
    name: 'David Thorne',
    role: 'Junior Advocate',
    initials: 'DT',
    spec: 'Civil Rights & Labor Litigation',
    exp: 7,
    quote: '"A case is won in the details of discovery."',
    bio: {
      education: 'J.D., Stanford Law School | B.A. in Political Science, University of Chicago',
      admissions: 'State District Court | Federal Court of Claims',
      matters: 'Co-counsel in high-profile collective wage action representing 14,000 logistics workers. Successfully negotiated executive departures.',
      publications: 'Author of "The Gig Economy: Labor Rights in Transition" (Stanford Law Journal, 2023).',
    },
  },
  {
    id: 'clara_moreau',
    name: 'Clara Moreau',
    role: 'Lead Paralegal',
    initials: 'CM',
    spec: 'Litigation Records & Intake Coordination',
    exp: 6,
    quote: '"Efficiency is the backbone of exceptional advocacy."',
    bio: {
      education: 'B.S. in Legal Studies, Georgetown University | Certified Paralegal (NALA)',
      admissions: 'Notary Public | Association of Professional Paralegals',
      matters: 'Managed digital discovery database of over 1.2M files for multi-district class action defense. Oversees all LexCore portal ingestion pipelines.',
      publications: 'Contributing author to Legal Operations Quarterly on "Optimizing Portal Workflows for High-Stakes Litigation".',
    },
  },
];

function TeamPreview() {
  const [activeBio, setActiveBio] = useState(null);

  const openBio = (lawyer) => {
    setActiveBio(lawyer);
  };

  const closeBio = () => {
    setActiveBio(null);
  };

  return (
    <section id="team" style={{ backgroundColor: 'var(--bg-warm-ivory)', borderTop: '1px solid var(--color-border)' }}>
      <div className="container-custom">
        <span className="section-tag">Our Legal Council</span>
        <h2 className="section-title">
          Distinguished advocates committed to absolute representation.
        </h2>
        <p className="section-desc">
          Our attorneys combine rigorous intellectual scholarship with formidable courtroom experience to deliver elite legal counsel.
        </p>

        <div className="team-grid">
          {team.map((lawyer) => (
            <div key={lawyer.id} className="team-card">
              <div className="team-image-box">
                <div className="team-image-placeholder">
                  <div className="team-image-placeholder-initials">{lawyer.initials}</div>
                </div>
                <div className="team-image-overlay">
                  <div className="team-quote">{lawyer.quote}</div>
                </div>
              </div>

              <div className="team-meta">
                <span className="team-role">{lawyer.role}</span>
                <h3 className="team-name">{lawyer.name}</h3>
                <p className="team-spec">{lawyer.spec}</p>
                <div className="team-exp">
                  <span>Tenure at Firm</span>
                  <span className="team-exp-val">{lawyer.exp} Years</span>
                </div>
                <button 
                  onClick={() => openBio(lawyer)} 
                  className="team-link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  View Bio
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Attorney Bio Details Modal (Conditional) */}
      {activeBio && (
        <div className="modal-overlay active" onClick={closeBio}>
          <div className="modal-container-custom" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeBio} aria-label="Close Bio Modal">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontFamily: 'var(--font-headings)', fontSize: '2.5rem', fontWeight: 'bold' }}>
                {activeBio.initials}
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-accent)', letterSpacing: '0.15em', fontWeight: 600 }}>
                  {activeBio.role}
                </span>
                <h3 style={{ fontFamily: 'var(--font-headings)', fontSize: '2.2rem', color: 'var(--color-dark)', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                  {activeBio.name}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {activeBio.spec} • {activeBio.exp} Years Practice
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Education & Credentials
                </h4>
                <p style={{ fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: '1.5' }}>
                  {activeBio.bio.education}
                </p>
              </div>

              <div>
                <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Bar Admissions
                </h4>
                <p style={{ fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: '1.5' }}>
                  {activeBio.bio.admissions}
                </p>
              </div>

              <div>
                <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Representative Legal Matters
                </h4>
                <p style={{ fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: '1.6' }}>
                  {activeBio.bio.matters}
                </p>
              </div>

              <div>
                <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Select Publications & Speaking
                </h4>
                <p style={{ fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: '1.5', margin: 0 }}>
                  {activeBio.bio.publications}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={closeBio}>
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default TeamPreview;
