import React, { useState, useEffect } from 'react';
import { useModals } from '../context/ModalContext';

function Navbar() {
  const { openPortal, openConsultation } = useModals();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const handleScrollTo = (id) => {
    setIsMobileMenuOpen(false);
    if (id === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      const top = element.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <header className={`header-nav ${isScrolled || isMobileMenuOpen ? 'is-scrolled' : ''}`}>
      <div className="container-custom nav-container">
        <a
          href="#home"
          onClick={(e) => { e.preventDefault(); handleScrollTo('home'); }}
          className="nav-logo-box"
        >
          <div className="nav-logo-icon-container">
            <svg viewBox="0 0 24 24">
              <path d="M12 2a1 1 0 0 1 1 1v1.075c3.541.25 6.368 3.077 6.618 6.618H21a1 1 0 1 1 0 2h-1.382c-.25 3.541-3.077 6.368-6.618 6.618V21a1 1 0 1 1-2 0v-2.69c-3.541-.25-6.368-3.077-6.618-6.618H3a1 1 0 1 1 0-2h1.382c.25-3.541 3.077-6.368 6.618-6.618V3a1 1 0 0 1 1-1zm0 4.09c-2.458.243-4.42 2.204-4.662 4.662h9.324c-.243-2.458-2.204-4.42-4.662-4.662zm-4.662 6.662c.243 2.458 2.204 4.42 4.662 4.662v-4.662H7.338zm6.662 4.662c2.458-.243 4.42-2.204 4.662-4.662h-4.662v4.662z" />
            </svg>
          </div>
          <div className="nav-logo-text-chambers">
            <span className="nav-logo-main">LexCore</span>
            <span className="nav-logo-sub">Advocates & Legal Consultants</span>
          </div>
        </a>

        <nav aria-label="Primary">
          <ul className={`nav-menu ${isMobileMenuOpen ? 'active' : ''}`}>
            <li>
              <a href="#home" className="nav-link-custom" onClick={(e) => { e.preventDefault(); handleScrollTo('home'); }}>
                Home
              </a>
            </li>
            <li>
              <a href="#practices" className="nav-link-custom" onClick={(e) => { e.preventDefault(); handleScrollTo('practices'); }}>
                Practice Areas
              </a>
            </li>
            <li>
              <a href="#about" className="nav-link-custom" onClick={(e) => { e.preventDefault(); handleScrollTo('about'); }}>
                About
              </a>
            </li>
            <li>
              <a href="#contact" className="nav-link-custom" onClick={(e) => { e.preventDefault(); handleScrollTo('contact'); }}>
                Contact
              </a>
            </li>
            <li className="nav-menu-mobile-actions">
              <button
                type="button"
                onClick={() => { setIsMobileMenuOpen(false); openPortal(); }}
                className="btn btn-nav-login"
                style={{ width: '100%' }}
                aria-label="Login to secure portal"
              >
                <svg className="nav-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Login
              </button>
              <button
                type="button"
                onClick={() => { setIsMobileMenuOpen(false); openConsultation(); }}
                className="btn btn-primary btn-nav-consult"
                style={{ width: '100%' }}
              >
                Book Consultation
              </button>
            </li>
          </ul>
        </nav>

        <div className="nav-actions">
          <button
            type="button"
            onClick={openPortal}
            className="btn btn-nav-login"
            aria-label="Login to secure portal"
          >
            <svg className="nav-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Login
          </button>
          <button
            type="button"
            onClick={openConsultation}
            className="btn btn-primary btn-nav-consult"
          >
            Book Consultation
          </button>
        </div>

        <button
          type="button"
          className={`mobile-nav-toggle ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={() => setIsMobileMenuOpen((v) => !v)}
          aria-label="Toggle Navigation"
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}

export default Navbar;
