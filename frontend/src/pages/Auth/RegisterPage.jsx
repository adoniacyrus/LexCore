import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPath } from '../../utils/roleRoutes';
import {
  getPasswordStrength,
  hasFieldErrors,
  mapDjangoFieldErrors,
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateMobile,
  validatePassword,
  validateRegistrationForm,
  validateTerms,
} from '../../utils/validation';

const EMPTY_ERRORS = {
  fullName: '',
  email: '',
  mobile: '',
  password: '',
  confirmPassword: '',
  terms: '',
};

function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { register, loginWithGoogle, isAuthenticated, user, loading, getErrorMessage } = useAuth();
  const intent = params.get('intent');

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    terms: false,
  });
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS);
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const setFieldError = (name, message) => {
    setFieldErrors((prev) => ({ ...prev, [name]: message }));
  };

  const markTouched = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const onBlurField = (name, validator) => {
    markTouched(name);
    setFieldError(name, validator());
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;
    const next = { ...form, [name]: nextValue };
    setForm(next);

    if (name === 'password') {
      markTouched('password');
      setFieldError('password', validatePassword(nextValue));
      if (touched.confirmPassword || next.confirmPassword) {
        setFieldError(
          'confirmPassword',
          validateConfirmPassword(nextValue, next.confirmPassword)
        );
      }
      return;
    }

    if (name === 'confirmPassword') {
      markTouched('confirmPassword');
      setFieldError(
        'confirmPassword',
        validateConfirmPassword(next.password, nextValue)
      );
      return;
    }

    if (name === 'terms') {
      markTouched('terms');
      setFieldError('terms', validateTerms(nextValue));
      return;
    }

    if (!touched[name]) return;
    if (name === 'fullName') setFieldError(name, validateFullName(nextValue));
    if (name === 'email') setFieldError(name, validateEmail(nextValue));
    if (name === 'mobile') setFieldError(name, validateMobile(nextValue));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    setTouched({
      fullName: true,
      email: true,
      mobile: true,
      password: true,
      confirmPassword: true,
      terms: true,
    });

    const errors = validateRegistrationForm(form);
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      return;
    }

    setSubmitting(true);
    try {
      const data = await register({
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        phone_number: form.mobile.trim(),
        password: form.password,
        confirm_password: form.confirmPassword,
      });
      const message = data?.message || 'Registration successful.';
      setSuccess(message);
      navigate(intent === 'consultation' ? '/login?intent=consultation' : '/login', {
        replace: true,
        state: { success: message },
      });
    } catch (err) {
      const mapped = mapDjangoFieldErrors(err);
      if (hasFieldErrors(mapped.fields)) {
        setFieldErrors((prev) => ({ ...prev, ...mapped.fields }));
      }
      setError(
        mapped.formError ||
          (hasFieldErrors(mapped.fields)
            ? ''
            : getErrorMessage(err, 'Registration failed. Please try again.'))
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (idToken) => {
    setError('');
    setSuccess('');
    if (!form.terms) {
      setTouched((prev) => ({ ...prev, terms: true }));
      setFieldError('terms', validateTerms(false));
      setError('Please accept the Terms & Privacy Policy to continue with Google.');
      return;
    }

    setSubmitting(true);
    try {
      const me = await loginWithGoogle(idToken, 'register');
      navigate(getDashboardPath(me.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Google registration failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const loginPath = intent === 'consultation' ? '/login?intent=consultation' : '/login';
  const busy = submitting || loading;

  return (
    <div className={`auth-sheet auth-sheet--register ${entered ? 'is-entered' : ''}`}>
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
        <p className="section-tag-gold">Client Registration</p>
        <h2>Create Client Account</h2>
      </header>

      <form className="auth-form auth-form--grid" onSubmit={handleSubmit} noValidate>
        <label className="auth-field">
          <span>Full Name</span>
          <input
            type="text"
            name="fullName"
            autoComplete="name"
            placeholder="Full legal name"
            value={form.fullName}
            onChange={onChange}
            onBlur={(e) => onBlurField('fullName', () => validateFullName(e.target.value))}
            className={fieldErrors.fullName ? 'is-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.fullName)}
            required
          />
          {fieldErrors.fullName ? (
            <div className="invalid-feedback d-block">{fieldErrors.fullName}</div>
          ) : null}
        </label>

        <label className="auth-field">
          <span>Email Address</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="name@email.com"
            value={form.email}
            onChange={onChange}
            onBlur={(e) => onBlurField('email', () => validateEmail(e.target.value))}
            className={fieldErrors.email ? 'is-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.email)}
            required
          />
          {fieldErrors.email ? (
            <div className="invalid-feedback d-block">{fieldErrors.email}</div>
          ) : null}
        </label>

        <label className="auth-field auth-field--full">
          <span>Mobile Number</span>
          <input
            type="tel"
            name="mobile"
            autoComplete="tel"
            placeholder="+91 XXXXX XXXXX"
            value={form.mobile}
            onChange={onChange}
            onBlur={(e) => onBlurField('mobile', () => validateMobile(e.target.value))}
            className={fieldErrors.mobile ? 'is-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.mobile)}
            required
          />
          {fieldErrors.mobile ? (
            <div className="invalid-feedback d-block">{fieldErrors.mobile}</div>
          ) : null}
        </label>

        <label className="auth-field">
          <span>Password</span>
          <div className={`auth-field-row ${fieldErrors.password ? 'is-invalid' : ''}`}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={onChange}
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
          {form.password ? (
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
            value={form.confirmPassword}
            onChange={onChange}
            className={fieldErrors.confirmPassword ? 'is-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            required
          />
          {fieldErrors.confirmPassword ? (
            <div className="invalid-feedback d-block">{fieldErrors.confirmPassword}</div>
          ) : null}
        </label>

        <label className={`auth-check auth-check--block ${fieldErrors.terms ? 'is-invalid' : ''}`}>
          <input
            type="checkbox"
            name="terms"
            checked={form.terms}
            onChange={onChange}
            aria-invalid={Boolean(fieldErrors.terms)}
          />
          <span>
            I accept the{' '}
            <button type="button" className="auth-inline-link" onClick={() => alert('Terms of engagement available upon request.')}>
              Terms
            </button>{' '}
            &{' '}
            <button type="button" className="auth-inline-link" onClick={() => alert('Client data is handled under strict confidentiality.')}>
              Privacy Policy
            </button>
            .
          </span>
        </label>
        {fieldErrors.terms ? (
          <div className="invalid-feedback d-block auth-field--full">{fieldErrors.terms}</div>
        ) : null}

        {success ? <p className="auth-sheet-lede" role="status">{success}</p> : null}
        {error ? <p className="auth-error" role="alert">{error}</p> : null}

        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {submitting ? (
            <>
              <span className="auth-btn-spinner" aria-hidden="true" />
              Creating Account…
            </>
          ) : (
            'Create Client Account'
          )}
        </button>

        <GoogleAuthButton
          intent="register"
          disabled={busy}
          label="Or sign up with Google"
          onCredential={handleGoogleCredential}
          onError={setError}
        />
      </form>

      <p className="auth-switch">
        Already have an account? <Link to={loginPath}>Login</Link>
      </p>
    </div>
  );
}

export default RegisterPage;
