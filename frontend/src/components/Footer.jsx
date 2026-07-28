import React from 'react';
import { useNavigate } from 'react-router-dom';

function Footer() {
  const navigate = useNavigate();

  const handleScrollTo = (id) => {
    if (id === 'home') {
      navigate('/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      const top = element.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: 'smooth' });
      navigate({ pathname: '/', hash: id }, { replace: true });
    }
  };

  return (
    <footer className="footer-burgundy">
      <div className="container-custom">
        <div className="footer-burgundy-grid">
          <div className="footer-brand-col">
            <div className="footer-brand-logo-text">
              <svg viewBox="0 0 24 24">
                <path d="M12 2a1 1 0 0 1 1 1v1.075c3.541.25 6.368 3.077 6.618 6.618H21a1 1 0 1 1 0 2h-1.382c-.25 3.541-3.077 6.368-6.618 6.618V21a1 1 0 1 1-2 0v-2.69c-3.541-.25-6.368-3.077-6.618-6.618H3a1 1 0 1 1 0-2h1.382c.25-3.541 3.077-6.368 6.618-6.618V3a1 1 0 0 1 1-1zm0 4.09c-2.458.243-4.42 2.204-4.662 4.662h9.324c-.243-2.458-2.204-4.42-4.662-4.662zm-4.662 6.662c.243 2.458 2.204 4.42 4.662 4.662v-4.662H7.338zm6.662 4.662c2.458-.243 4.42-2.204 4.662-4.662h-4.662v4.662z" />
              </svg>
              <h4>LexCore</h4>
            </div>
            <p className="footer-brand-desc">
              Reliable legal services with professionalism, integrity, and confidentiality.
            </p>
          </div>

          <div>
            <h4 className="footer-col-title">Navigate</h4>
            <ul className="footer-ul-links">
              <li>
                <a href="/#home" onClick={(e) => { e.preventDefault(); handleScrollTo('home'); }}>Home</a>
              </li>
              <li>
                <a href="/#practices" onClick={(e) => { e.preventDefault(); handleScrollTo('practices'); }}>Practice Areas</a>
              </li>
              <li>
                <a href="/#about" onClick={(e) => { e.preventDefault(); handleScrollTo('about'); }}>About</a>
              </li>
              <li>
                <a href="/#contact" onClick={(e) => { e.preventDefault(); handleScrollTo('contact'); }}>Contact</a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">Services</h4>
            <ul className="footer-ul-links">
              <li>
                <a href="/#practices" onClick={(e) => { e.preventDefault(); handleScrollTo('practices'); }}>Legal Consultation</a>
              </li>
              <li>
                <a href="/#practices" onClick={(e) => { e.preventDefault(); handleScrollTo('practices'); }}>Hearing Representation</a>
              </li>
              <li>
                <a href="/#practices" onClick={(e) => { e.preventDefault(); handleScrollTo('practices'); }}>Advisory Services</a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">Contact</h4>
            <div className="footer-contact-li">
              <svg viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span>Kanjirappally, Kerala, India</span>
            </div>
            <div className="footer-contact-li">
              <svg viewBox="0 0 24 24">
                <path d="M6.62 10.79a15.149 15.149 0 0 0 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
              <span>+91 123 456 7890</span>
            </div>
            <div className="footer-contact-li">
              <svg viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              <span>contact@lexcore.law</span>
            </div>
          </div>
        </div>

        <div className="footer-copyright-row">
          <div>
            © {new Date().getFullYear()} LexCore Advocates & Legal Consultants
          </div>
          <ul className="footer-copyright-links">
            <li>
              <a href="#privacy" onClick={(e) => { e.preventDefault(); alert('Privacy Policy: All client data is strictly secure.'); }}>
                Privacy
              </a>
            </li>
            <li>
              <a href="#terms" onClick={(e) => { e.preventDefault(); alert('Terms of Use: Subject to bar council guidelines.'); }}>
                Terms
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
