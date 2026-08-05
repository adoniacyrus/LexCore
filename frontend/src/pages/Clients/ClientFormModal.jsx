import React, { useEffect, useRef, useState } from 'react';
import {
  createClient,
  getErrorMessage,
  updateClient,
} from '../../services/clientService';
import {
  hasFieldErrors,
  mapDjangoFieldErrors,
  validateAdminClientForm,
} from '../../utils/validation';
import './clients.css';

const EMPTY = {
  fullName: '',
  email: '',
  mobile: '',
};

/**
 * Add / Edit Client modal — same identity fields as public registration.
 */
function ClientFormModal({
  open,
  mode = 'create',
  client = null,
  accessToken,
  onClose,
  onSaved,
}) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && client) {
      setForm({
        fullName: client.full_name || '',
        email: client.email || '',
        mobile: client.phone_number || '',
      });
    } else {
      setForm(EMPTY);
    }
    setFieldErrors({});
    setError('');
    setSubmitting(false);
    backdropPointerDown.current = false;
  }, [open, isEdit, client]);

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
    const errors = validateAdminClientForm(form);
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;

    const payload = {
      full_name: form.fullName.trim(),
      email: form.email.trim(),
      phone_number: form.mobile.trim(),
    };

    setSubmitting(true);
    try {
      const result = isEdit
        ? await updateClient(accessToken, client.id, payload)
        : await createClient(accessToken, payload);
      onSaved?.(result);
      onClose?.();
    } catch (err) {
      const mapped = mapDjangoFieldErrors(err, {
        full_name: 'fullName',
        email: 'email',
        phone_number: 'mobile',
      });
      if (mapped.fields && Object.keys(mapped.fields).length) {
        setFieldErrors((prev) => ({ ...prev, ...mapped.fields }));
      }
      setError(
        mapped.formError ||
          getErrorMessage(err, isEdit ? 'Unable to update client.' : 'Unable to create client.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="cli-modal-overlay"
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
        className="cli-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cli-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cli-modal__header">
          <div>
            <p className="section-tag-gold">Client Management</p>
            <h2 id="cli-form-title">{isEdit ? 'Edit Client' : 'Add Client'}</h2>
          </div>
          <button
            type="button"
            className="cli-modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
          >
            ×
          </button>
        </header>

        <form className="auth-form cli-modal__form" onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>Full Name</span>
            <input
              name="fullName"
              type="text"
              value={form.fullName}
              onChange={onChange}
              placeholder="Full legal name"
              autoComplete="name"
              required
            />
            {fieldErrors.fullName ? (
              <span className="invalid-feedback d-block">{fieldErrors.fullName}</span>
            ) : null}
          </label>

          <label className="auth-field">
            <span>Email Address</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="name@example.com"
              autoComplete="email"
              required
            />
            {fieldErrors.email ? (
              <span className="invalid-feedback d-block">{fieldErrors.email}</span>
            ) : null}
          </label>

          <label className="auth-field">
            <span>Phone Number</span>
            <input
              name="mobile"
              type="tel"
              value={form.mobile}
              onChange={onChange}
              placeholder="+91 XXXXX XXXXX"
              autoComplete="tel"
              required
            />
            {fieldErrors.mobile ? (
              <span className="invalid-feedback d-block">{fieldErrors.mobile}</span>
            ) : null}
          </label>

          <p className="cli-modal__note">
            {isEdit
              ? 'Profile changes apply immediately. Use Force Reset Password to issue a new temporary password.'
              : 'A secure temporary password will be generated and emailed to the client. They should change it after first login.'}
          </p>

          {error ? (
            <p className="cli-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="cli-modal__actions">
            <button
              type="button"
              className="btn btn-ghost-dark"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? isEdit
                  ? 'Saving…'
                  : 'Creating…'
                : isEdit
                  ? 'Save Changes'
                  : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ClientFormModal;
