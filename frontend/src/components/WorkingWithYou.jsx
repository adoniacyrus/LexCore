import React from 'react';
import { useModals } from '../context/ModalContext';
import { useReveal } from '../hooks/useReveal';

function WorkingWithYou() {
  const { openConsultation } = useModals();
  const bandRef = useReveal();

  return (
    <section id="contact" className="cta-band">
      <div ref={bandRef} className="cta-band-inner reveal">
        <div className="cta-band-visual">
          <img
            src="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80"
            alt=""
            aria-hidden="true"
          />
          <div className="cta-band-visual-veil" />
          <div className="cta-band-visual-content">
            <p className="cta-band-quote">
              Counsel that stands<br />
              <em>beside you</em>, not above you.
            </p>
            <div className="cta-band-metrics">
              <div>
                <strong>100+</strong>
                <span>Clients</span>
              </div>
              <div>
                <strong>250+</strong>
                <span>Matters</span>
              </div>
              <div>
                <strong>15+</strong>
                <span>Areas</span>
              </div>
            </div>
          </div>
        </div>

        <div className="cta-band-copy">
          <span className="section-tag-gold">Working With You</span>
          <h2 className="cta-band-title">
            Your legal goals,<br />
            our <em>commitment</em>.
          </h2>

          <button onClick={openConsultation} className="btn btn-primary btn-arrow">
            Get in Touch
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>

          <div className="cta-contacts">
            <a href="tel:+911234567890" className="cta-contact-item">
              <svg viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-1.514 2.018a14.617 14.617 0 0 1-7.907-7.907l2.018-1.514c.362-.272.528-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H3.75A2.25 2.25 0 0 0 1.5 4.5v2.25Z" />
              </svg>
              +91 123 456 7890
            </a>
            <a href="mailto:contact@lexcore.law" className="cta-contact-item">
              <svg viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              contact@lexcore.law
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default WorkingWithYou;
