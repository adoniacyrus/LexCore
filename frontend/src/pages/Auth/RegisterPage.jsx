import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { register, isAuthenticated } = useAuth();
  const intent = params.get('intent');

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    navigate(intent === 'consultation' ? { pathname: '/', hash: 'contact' } : '/', { replace: true });
  }, [isAuthenticated, intent, navigate]);

  const strength = useMemo(() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 8) score += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
    if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) score += 1;
    return score;
  }, [form.password]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.fullName.trim() || !form.email.trim() || !form.mobile.trim()) {
      setError('Please complete all required fields.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!form.terms) {
      setError('Please accept the Terms & Privacy Policy.');
      return;
    }

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 550));
    register({
      fullName: form.fullName,
      email: form.email,
      mobile: form.mobile,
    });
    setSubmitting(false);
    navigate(intent === 'consultation' ? { pathname: '/', hash: 'contact' } : '/', { replace: true });
  };

  const loginPath = intent === 'consultation' ? '/login?intent=consultation' : '/login';

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
            required
          />
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
            required
          />
        </label>

        <label className="auth-field">
          <span>Mobile Number</span>
          <input
            type="tel"
            name="mobile"
            autoComplete="tel"
            placeholder="+91 XXXXX XXXXX"
            value={form.mobile}
            onChange={onChange}
            required
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <div className="auth-field-row">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={onChange}
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
            <span className={strength >= 1 ? 'is-on' : ''} />
            <span className={strength >= 2 ? 'is-on' : ''} />
            <span className={strength >= 3 ? 'is-on' : ''} />
          </div>
        </label>

        <label className="auth-field auth-field--full">
          <span>Confirm Password</span>
          <input
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter password"
            value={form.confirmPassword}
            onChange={onChange}
            required
          />
        </label>

        <label className="auth-check auth-check--block">
          <input type="checkbox" name="terms" checked={form.terms} onChange={onChange} />
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

        {error ? <p className="auth-error" role="alert">{error}</p> : null}

        <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
          {submitting ? 'Creating Account…' : 'Create Client Account'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to={loginPath}>Login</Link>
      </p>
    </div>
  );
}

export default RegisterPage;
