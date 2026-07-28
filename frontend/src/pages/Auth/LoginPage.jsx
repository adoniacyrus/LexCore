import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPath } from '../../utils/roleRoutes';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { login, isAuthenticated, user, loading, getErrorMessage } = useAuth();
  const intent = params.get('intent');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(location.state?.success || '');
  const [submitting, setSubmitting] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;
    navigate(getDashboardPath(user.role), { replace: true });
  }, [isAuthenticated, user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const me = await login(email.trim(), password);
      navigate(getDashboardPath(me.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const registerPath = intent === 'consultation' ? '/register?intent=consultation' : '/register';

  return (
    <div className={`auth-sheet ${entered ? 'is-entered' : ''}`}>
      <Link to="/" className="auth-back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Website
      </Link>

      <div className="auth-sheet-brand">
        <div className="auth-sheet-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 2a1 1 0 0 1 1 1v1.075c3.541.25 6.368 3.077 6.618 6.618H21a1 1 0 1 1 0 2h-1.382c-.25 3.541-3.077 6.368-6.618 6.618V21a1 1 0 1 1-2 0v-2.69c-3.541-.25-6.368-3.077-6.618-6.618H3a1 1 0 1 1 0-2h1.382c.25-3.541 3.077-6.368 6.618-6.618V3a1 1 0 0 1 1-1zm0 4.09c-2.458.243-4.42 2.204-4.662 4.662h9.324c-.243-2.458-2.204-4.42-4.662-4.662zm-4.662 6.662c.243 2.458 2.204 4.42 4.662 4.662v-4.662H7.338zm6.662 4.662c2.458-.243 4.42-2.204 4.662-4.662h-4.662v4.662z" />
          </svg>
        </div>
        <div>
          <p className="auth-sheet-firm">LexCore</p>
          <p className="auth-sheet-firm-sub">Advocates & Legal Consultants</p>
        </div>
      </div>

      <header className="auth-sheet-header">
        <p className="section-tag-gold">Encrypted Access</p>
        <h2>Secure Portal Access</h2>
        <p className="auth-sheet-lede">
          {intent === 'consultation'
            ? 'Sign in to request a confidential consultation.'
            : 'Access your matters through the secure client portal.'}
        </p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="name@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <div className="auth-field-row">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="auth-field-action"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <div className="auth-form-meta">
          <label className="auth-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Remember Me</span>
          </label>
          <button type="button" className="auth-text-link" onClick={() => alert('Password reset will be emailed to registered clients.')}>
            Forgot Password
          </button>
        </div>

        {success ? <p className="auth-sheet-lede" role="status">{success}</p> : null}
        {error ? <p className="auth-error" role="alert">{error}</p> : null}

        <button type="submit" className="btn btn-primary auth-submit" disabled={submitting || loading}>
          {submitting ? 'Verifying…' : 'Login'}
        </button>
      </form>

      <div className="auth-divider" role="separator">
        <span>New Client?</span>
      </div>

      <Link to={registerPath} className="btn btn-ghost-dark auth-secondary-cta">
        Create Client Account
      </Link>
    </div>
  );
}

export default LoginPage;
