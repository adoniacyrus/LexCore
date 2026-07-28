import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const panelCopy = {
  login: {
    eyebrow: 'Client Chambers',
    title: ['Counsel that stands', 'beside you.'],
    seal: 'Encrypted · Confidential · Privileged',
  },
  register: {
    eyebrow: 'New Client Intake',
    title: ['Begin your', 'engagement.'],
    seal: '',
  },
};

function AuthLayout() {
  const { pathname } = useLocation();
  const mode = pathname.includes('register') ? 'register' : 'login';
  const copy = panelCopy[mode];

  return (
    <div className={`auth-stage auth-stage--${mode}`}>
      <aside className="auth-panel">
        <div className="auth-panel-media" aria-hidden="true">
          <img
            src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1400&q=80"
            alt=""
          />
        </div>
        <div className="auth-panel-veil" aria-hidden="true" />
        <div className="auth-panel-content">
          <Link to="/" className="auth-panel-brand">
            <span className="auth-panel-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 2a1 1 0 0 1 1 1v1.075c3.541.25 6.368 3.077 6.618 6.618H21a1 1 0 1 1 0 2h-1.382c-.25 3.541-3.077 6.368-6.618 6.618V21a1 1 0 1 1-2 0v-2.69c-3.541-.25-6.368-3.077-6.618-6.618H3a1 1 0 1 1 0-2h1.382c.25-3.541 3.077-6.368 6.618-6.618V3a1 1 0 0 1 1-1zm0 4.09c-2.458.243-4.42 2.204-4.662 4.662h9.324c-.243-2.458-2.204-4.42-4.662-4.662zm-4.662 6.662c.243 2.458 2.204 4.42 4.662 4.662v-4.662H7.338zm6.662 4.662c2.458-.243 4.42-2.204 4.662-4.662h-4.662v4.662z" />
              </svg>
            </span>
            LexCore
          </Link>

          <div className="auth-panel-copy">
            <p className="auth-panel-eyebrow">{copy.eyebrow}</p>
            <h1 className="auth-panel-title">
              {copy.title.map((line, i) => (
                <span key={line} className={i === copy.title.length - 1 ? 'is-accent' : undefined}>
                  {line}
                </span>
              ))}
            </h1>
          </div>

          {copy.seal ? <p className="auth-panel-seal">{copy.seal}</p> : <span aria-hidden="true" />}
        </div>
        <div className="auth-panel-watermark" aria-hidden="true">LexCore</div>
      </aside>

      <div className="auth-seam" aria-hidden="true">
        <span>Secure Portal</span>
      </div>

      <main className="auth-form-pane">
        <Outlet />
      </main>
    </div>
  );
}

export default AuthLayout;
