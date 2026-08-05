import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import ChangePasswordModal from './ChangePasswordModal';
import './account.css';

function formatClientId(id) {
  if (id == null) return null;
  return `CL-${String(id).padStart(4, '0')}`;
}

function formatMemberSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Compact read-only client Account page with in-portal password change.
 */
function ClientAccountPage() {
  const { user, accessToken } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!success) return undefined;
    const id = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(id);
  }, [success]);

  const fields = [
    { label: 'Full Name', value: user?.full_name },
    { label: 'Email Address', value: user?.email },
    { label: 'Phone Number', value: user?.phone_number?.trim() || null },
    { label: 'Client ID', value: formatClientId(user?.id) },
    { label: 'Member Since', value: formatMemberSince(user?.created_at) },
    { label: 'Account Status', value: 'Active', tone: 'active' },
  ].filter((field) => field.value);

  const initials = (user?.full_name || 'C')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <DashboardLayout showContext={false} activeModule="account">
      <div className="acct-page lw-fade-in">
        <header className="acct-page__header">
          <div>
            <p className="section-tag-gold">Client Portal</p>
            <h1 className="acct-page__title">Account</h1>
          </div>
        </header>

        {success ? (
          <p className="acct-success" role="status">
            {success}
          </p>
        ) : null}

        <section className="acct-panel" aria-label="Account">
          <div className="acct-hero">
            <span className="acct-hero__avatar" aria-hidden="true">
              {initials}
            </span>
            <div className="acct-hero__meta">
              <h2 className="acct-hero__name">{user?.full_name || 'Client'}</h2>
              <p className="acct-hero__email">{user?.email}</p>
            </div>
            <span className="acct-status is-active">Active</span>
          </div>

          <div className="acct-grid">
            {fields.map((field) => (
              <article key={field.label} className="acct-info-card">
                <p className="acct-info-card__label">{field.label}</p>
                <p
                  className={`acct-info-card__value${
                    field.tone === 'active' ? ' is-active' : ''
                  }`}
                >
                  {field.value}
                </p>
              </article>
            ))}
          </div>

          <div className="acct-security">
            <div className="acct-security__copy">
              <p className="acct-security__title">Change Password</p>
              <p className="acct-security__desc">
                Update your sign-in password for this account.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setPasswordOpen(true)}
            >
              Change Password
            </button>
          </div>
        </section>
      </div>

      <ChangePasswordModal
        open={passwordOpen}
        accessToken={accessToken}
        onClose={() => setPasswordOpen(false)}
        onSuccess={(message) => setSuccess(message)}
      />
    </DashboardLayout>
  );
}

export default ClientAccountPage;
