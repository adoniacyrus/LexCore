import React, { useEffect, useState } from 'react';
import { useModals } from '../context/ModalContext';

function Hero() {
  const { openConsultation } = useModals();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleScrollToPractices = (e) => {
    e.preventDefault();
    const element = document.getElementById('practices');
    if (element) {
      const offset = 72;
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <section id="home" className={`hero-bleed ${entered ? 'is-entered' : ''}`}>
      <div className="hero-bleed-media" aria-hidden="true">
        <img
          src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1920&q=80"
          alt=""
          className="hero-bleed-img"
        />
        <div className="hero-bleed-veil" />
      </div>

      <div className="container-custom hero-bleed-inner">
        <p className="hero-brand">LexCore</p>
        <h1 className="hero-headline">
          Trusted legal support,<br />
          <em>every step</em> of the way.
        </h1>
        <p className="hero-lede">
          Strategic counsel with integrity, professionalism, and confidentiality.
        </p>
        <div className="hero-actions">
          <button onClick={openConsultation} className="btn btn-primary btn-arrow">
            Book a Consultation
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
          <a href="#practices" onClick={handleScrollToPractices} className="btn btn-secondary hero-btn-ghost">
            Learn More
          </a>
        </div>
      </div>

      <button
        type="button"
        className="hero-scroll"
        onClick={handleScrollToPractices}
        aria-label="Scroll to practice areas"
      >
        <span />
      </button>

      <style>{`
        .hero-bleed {
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: flex-end;
          padding: 0 0 5.5rem;
          overflow: hidden;
          background: var(--color-dark);
        }

        .hero-bleed-media {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        .hero-bleed-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 30%;
          transform: scale(1.12);
          transition: transform 2.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hero-bleed.is-entered .hero-bleed-img {
          transform: scale(1);
        }

        .hero-bleed-veil {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(105deg, rgba(28, 12, 16, 0.88) 0%, rgba(28, 12, 16, 0.55) 48%, rgba(28, 12, 16, 0.35) 100%),
            linear-gradient(to top, rgba(28, 12, 16, 0.75) 0%, transparent 45%);
        }

        .hero-bleed-inner {
          position: relative;
          z-index: 1;
          max-width: 720px;
          padding-bottom: 0.5rem;
        }

        .hero-brand,
        .hero-headline,
        .hero-lede,
        .hero-actions {
          opacity: 0;
          transform: translateY(32px);
          transition:
            opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hero-bleed.is-entered .hero-brand {
          opacity: 1;
          transform: none;
          transition-delay: 0.15s;
        }
        .hero-bleed.is-entered .hero-headline {
          opacity: 1;
          transform: none;
          transition-delay: 0.32s;
        }
        .hero-bleed.is-entered .hero-lede {
          opacity: 1;
          transform: none;
          transition-delay: 0.48s;
        }
        .hero-bleed.is-entered .hero-actions {
          opacity: 1;
          transform: none;
          transition-delay: 0.6s;
        }

        .hero-brand {
          font-family: var(--font-headings);
          font-size: clamp(3.5rem, 10vw, 6.5rem);
          font-weight: 600;
          color: #FFFFFF;
          line-height: 0.95;
          letter-spacing: -0.03em;
          margin-bottom: 1.25rem;
        }

        .hero-headline {
          font-family: var(--font-headings);
          font-size: clamp(1.45rem, 2.8vw, 2.05rem);
          font-weight: 400;
          color: rgba(255, 255, 255, 0.92);
          line-height: 1.3;
          margin-bottom: 1rem;
          max-width: 28ch;
        }

        .hero-headline em {
          font-style: italic;
          color: var(--color-accent);
          font-weight: 500;
        }

        .hero-lede {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.7);
          max-width: 38ch;
          margin-bottom: 2rem;
          font-weight: 300;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.85rem;
        }

        .hero-btn-ghost {
          color: #FFFFFF;
          border-color: rgba(255, 255, 255, 0.4);
        }
        .hero-btn-ghost:hover {
          border-color: #FFFFFF;
          background: rgba(255, 255, 255, 0.08);
          color: #FFFFFF;
        }

        .hero-scroll {
          position: absolute;
          bottom: 1.75rem;
          left: 50%;
          transform: translateX(-50%);
          width: 22px;
          height: 36px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 12px;
          background: transparent;
          cursor: pointer;
          z-index: 2;
          padding: 0;
          opacity: 0;
          transition: opacity 0.8s ease 1s;
        }

        .hero-bleed.is-entered .hero-scroll {
          opacity: 1;
        }

        .hero-scroll span {
          display: block;
          width: 3px;
          height: 8px;
          background: var(--color-accent);
          border-radius: 2px;
          margin: 8px auto 0;
          animation: hero-scroll-pulse 1.8s var(--ease-out-soft) infinite;
        }

        @keyframes hero-scroll-pulse {
          0% { opacity: 1; transform: translateY(0); }
          70% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 0; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-brand, .hero-headline, .hero-lede, .hero-actions {
            opacity: 1;
            transform: none;
            transition: none;
          }
          .hero-bleed-img {
            transform: none;
            transition: none;
          }
          .hero-scroll span {
            animation: none;
          }
        }

        @media (max-width: 640px) {
          .hero-bleed {
            align-items: center;
            padding: 7rem 0 4rem;
          }
          .hero-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .hero-scroll {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}

export default Hero;
