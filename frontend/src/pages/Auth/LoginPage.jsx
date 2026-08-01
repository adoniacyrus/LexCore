import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPath } from '../../utils/roleRoutes';
import {
  hasFieldErrors,
  mapDjangoFieldErrors,
  validateEmail,
  validateLoginForm,
  validateLoginPassword,
} from '../../utils/validation';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { login, loginWithGoogle, isAuthenticated, user, loading, getErrorMessage } = useAuth();
  const intent = params.get('intent');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({ email: false, password: false });
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

  const setFieldError = (name, message) => {
    setFieldErrors((prev) => ({ ...prev, [name]: message }));
  };

  const handleEmailBlur = () => {
    setTouched((prev) => ({ ...prev, email: true }));
    setFieldError('email', validateEmail(email));
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (touched.password || value.length > 0) {
      setTouched((prev) => ({ ...prev, password: true }));
      setFieldError('password', validateLoginPassword(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const nextTouched = { email: true, password: true };
    setTouched(nextTouched);

    const errors = validateLoginForm({ email, password });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      return;
    }

    setSubmitting(true);
    try {
      const me = await login(email.trim(), password);
      navigate(getDashboardPath(me.role), { replace: true });
    } catch (err) {
      const mapped = mapDjangoFieldErrors(err);
      if (hasFieldErrors(mapped.fields)) {
        setFieldErrors((prev) => ({ ...prev, ...mapped.fields }));
      }
      setError(
        mapped.formError ||
          getErrorMessage(err, 'Login failed. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (idToken) => {
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const me = await loginWithGoogle(idToken, 'login');
      navigate(getDashboardPath(me.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Google login failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const registerPath = intent === 'consultation' ? '/register?intent=consultation' : '/register';
  const busy = submitting || loading;

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
            onChange={(e) => {
              setEmail(e.target.value);
              if (touched.email) setFieldError('email', validateEmail(e.target.value));
            }}
            onBlur={handleEmailBlur}
            className={fieldErrors.email ? 'is-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.email)}
            required
          />
          {fieldErrors.email ? (
            <div className="invalid-feedback d-block">{fieldErrors.email}</div>
          ) : null}
        </label>

        <label className="auth-field">
          <span>Password</span>
          <div className={`auth-field-row ${fieldErrors.password ? 'is-invalid' : ''}`}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              className={fieldErrors.password ? 'is-invalid' : ''}
              aria-invalid={Boolean(fieldErrors.password)}
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
          {fieldErrors.password ? (
            <div className="invalid-feedback d-block">{fieldErrors.password}</div>
          ) : null}
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

        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {submitting ? (
            <>
              <span className="auth-btn-spinner" aria-hidden="true" />
              Verifying…
            </>
          ) : (
            'Login'
          )}
        </button>

        <GoogleAuthButton
          intent="login"
          disabled={busy}
          label="Or continue with Google"
          onCredential={handleGoogleCredential}
          onError={setError}
        />
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
