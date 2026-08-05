import React, { useEffect, useRef, useState } from 'react';
import { changePassword, getErrorMessage } from '../../services/authService';
import {
  hasFieldErrors,
  mapDjangoFieldErrors,
  validateChangePasswordForm,
} from '../../utils/validation';
import './account.css';

const EMPTY = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function ChangePasswordModal({ open, accessToken, onClose, onSuccess }) {
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setFieldErrors({});
    setError('');
    setSubmitting(false);
    backdropPointerDown.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errors = validateChangePasswordForm(form);
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;

    setSubmitting(true);
    try {
      const data = await changePassword(accessToken, {
        current_password: form.currentPassword,
        new_password: form.newPassword,
        confirm_password: form.confirmPassword,
      });
      onSuccess?.(data?.message || 'Password updated successfully.');
      onClose?.();
    } catch (err) {
      const mapped = mapDjangoFieldErrors(err, {
        current_password: 'currentPassword',
        new_password: 'newPassword',
        confirm_password: 'confirmPassword',
      });
      if (mapped.fields && Object.keys(mapped.fields).length) {
        setFieldErrors((prev) => ({ ...prev, ...mapped.fields }));
      }
      setError(mapped.formError || getErrorMessage(err, 'Unable to update password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="acct-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        backdropPointerDown.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (!submitting && backdropPointerDown.current && e.target === e.currentTarget) {
          onClose?.();
        }
        backdropPointerDown.current = false;
      }}
    >
      <div
        className="acct-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="acct-change-pw-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="acct-modal__header">
          <div>
            <p className="section-tag-gold">Security</p>
            <h2 id="acct-change-pw-title">Change Password</h2>
          </div>
          <button
            type="button"
            className="acct-modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
          >
            ×
          </button>
        </header>

        <form className="auth-form acct-modal__form" onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>Current Password</span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={onChange}
              required
            />
            {fieldErrors.currentPassword ? (
              <span className="invalid-feedback d-block">{fieldErrors.currentPassword}</span>
            ) : null}
          </label>

          <label className="auth-field">
            <span>New Password</span>
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={onChange}
              required
            />
            {fieldErrors.newPassword ? (
              <span className="invalid-feedback d-block">{fieldErrors.newPassword}</span>
            ) : null}
          </label>

          <label className="auth-field">
            <span>Confirm New Password</span>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={onChange}
              required
            />
            {fieldErrors.confirmPassword ? (
              <span className="invalid-feedback d-block">{fieldErrors.confirmPassword}</span>
            ) : null}
          </label>

          {error ? (
            <p className="acct-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="acct-modal__actions">
            <button
              type="button"
              className="btn btn-ghost-dark"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordModal;
