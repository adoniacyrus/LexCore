import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage, resetPassword } from '../../services/authService';
import {
  getPasswordStrength,
  hasFieldErrors,
  mapDjangoFieldErrors,
  validateConfirmPassword,
  validatePassword,
  validateResetPasswordForm,
} from '../../utils/validation';

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { uid, token } = useParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [entered, setEntered] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const linkInvalid = !uid || !token;

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (linkInvalid) {
      setError('Invalid or incomplete reset link.');
      return;
    }

    const errors = validateResetPasswordForm({ password, confirmPassword });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;

    setSubmitting(true);
    try {
      const data = await resetPassword({
        uid,
        token,
        password,
        confirm_password: confirmPassword,
      });
      navigate('/login', {
        replace: true,
        state: { success: data?.message || 'Password has been reset successfully.' },
      });
    } catch (err) {
      const mapped = mapDjangoFieldErrors(err, {
        uid: '_form',
        token: '_form',
        confirm_password: 'confirmPassword',
      });
      if (hasFieldErrors(mapped.fields)) {
        setFieldErrors((prev) => ({ ...prev, ...mapped.fields }));
      }
      setError(mapped.formError || getErrorMessage(err, 'Unable to reset password.'));
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
        <h2>Reset Password</h2>
        <p className="auth-sheet-lede">Choose a new password for your LexCore account.</p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-field">
          <span>New Password</span>
          <div className={`auth-field-row ${fieldErrors.password ? 'is-invalid' : ''}`}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => {
                const value = e.target.value;
                setPassword(value);
                setFieldErrors((prev) => ({
                  ...prev,
                  password: validatePassword(value),
                  confirmPassword: confirmPassword
                    ? validateConfirmPassword(value, confirmPassword)
                    : prev.confirmPassword,
                }));
              }}
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
          <div className="auth-strength" aria-hidden="true">
            <span className={strength.score >= 1 ? 'is-on' : ''} />
            <span className={strength.score >= 2 ? 'is-on' : ''} />
            <span className={strength.score >= 3 ? 'is-on' : ''} />
          </div>
          {password ? (
            <ul className="auth-strength-checklist">
              <li className={strength.checks.minLength ? 'is-met' : ''}>At least 8 characters</li>
              <li className={strength.checks.hasUpper ? 'is-met' : ''}>Uppercase letter</li>
              <li className={strength.checks.hasLower ? 'is-met' : ''}>Lowercase letter</li>
              <li className={strength.checks.hasNumber ? 'is-met' : ''}>A number</li>
              <li className={strength.checks.hasSpecial ? 'is-met' : ''}>A special character</li>
            </ul>
          ) : null}
          {fieldErrors.password ? (
            <div className="invalid-feedback d-block">{fieldErrors.password}</div>
          ) : null}
        </label>

        <label className="auth-field">
          <span>Confirm Password</span>
          <input
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => {
              const value = e.target.value;
              setConfirmPassword(value);
              setFieldErrors((prev) => ({
                ...prev,
                confirmPassword: validateConfirmPassword(password, value),
              }));
            }}
            className={fieldErrors.confirmPassword ? 'is-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            required
          />
          {fieldErrors.confirmPassword ? (
            <div className="invalid-feedback d-block">{fieldErrors.confirmPassword}</div>
          ) : null}
        </label>

        {error ? <p className="auth-error" role="alert">{error}</p> : null}

        <button type="submit" className="btn btn-primary auth-submit" disabled={submitting || linkInvalid}>
          {submitting ? (
            <>
              <span className="auth-btn-spinner" aria-hidden="true" />
              Resetting…
            </>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>

      <p className="auth-switch">
        Back to <Link to="/login">Login</Link>
      </p>
    </div>
  );
}

export default ResetPasswordPage;
