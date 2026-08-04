import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword, getErrorMessage } from '../../services/authService';
import {
  hasFieldErrors,
  mapDjangoFieldErrors,
  validateEmail,
  validateForgotPasswordForm,
} from '../../utils/validation';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '' });
  const [touched, setTouched] = useState({ email: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setTouched({ email: true });

    const errors = validateForgotPasswordForm({ email });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;

    setSubmitting(true);
    try {
      const data = await forgotPassword({ email: email.trim() });
      setSuccess(data?.message || 'If an account exists, a password reset link has been sent.');
    } catch (err) {
      const mapped = mapDjangoFieldErrors(err);
      if (hasFieldErrors(mapped.fields)) {
        setFieldErrors((prev) => ({ ...prev, ...mapped.fields }));
      }
      setError(mapped.formError || getErrorMessage(err, 'Unable to send reset link.'));
    } finally {
      setSubmitting(false);
    }
  };

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
        <p className="section-tag-gold">Account Recovery</p>
        <h2>Forgot Password</h2>
        <p className="auth-sheet-lede">
          Enter your registered email and we will send a secure reset link if an account exists.
        </p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-field">
          <span>Email Address</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="name@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (touched.email) {
                setFieldErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
              }
            }}
            onBlur={() => {
              setTouched({ email: true });
              setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
            }}
            className={fieldErrors.email ? 'is-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.email)}
            required
          />
          {fieldErrors.email ? (
            <div className="invalid-feedback d-block">{fieldErrors.email}</div>
          ) : null}
        </label>

        {success ? <p className="auth-sheet-lede" role="status">{success}</p> : null}
        {error ? <p className="auth-error" role="alert">{error}</p> : null}

        <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
          {submitting ? (
            <>
              <span className="auth-btn-spinner" aria-hidden="true" />
              Sending…
            </>
          ) : (
            'Send Reset Link'
          )}
        </button>
      </form>

      <p className="auth-switch">
        Remembered your password? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}

export default ForgotPasswordPage;
