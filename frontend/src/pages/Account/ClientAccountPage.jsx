import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
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
 * Read-only client Account page — details from AuthContext /me payload only.
 */
function ClientAccountPage() {
  const { user } = useAuth();

  const fields = [
    { label: 'Full Name', value: user?.full_name },
    { label: 'Email Address', value: user?.email },
    { label: 'Phone Number', value: user?.phone_number?.trim() || null, optional: true },
    { label: 'Client ID', value: formatClientId(user?.id) },
    { label: 'Member Since', value: formatMemberSince(user?.created_at), optional: true },
    {
      label: 'Account Status',
      value: 'Active',
      tone: 'active',
    },
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
            <p className="acct-page__desc">
              Your LexCore chambers profile and security controls.
            </p>
          </div>
        </header>

        <section className="acct-hero" aria-label="Account summary">
          <span className="acct-hero__avatar" aria-hidden="true">
            {initials}
          </span>
          <div className="acct-hero__meta">
            <h2 className="acct-hero__name">{user?.full_name || 'Client'}</h2>
            <p className="acct-hero__email">{user?.email}</p>
          </div>
          <span className="acct-status is-active">Active</span>
        </section>

        <section className="acct-section" aria-labelledby="acct-details-heading">
          <div className="acct-section__head">
            <h2 id="acct-details-heading">Account Details</h2>
            <p>Information on file with LexCore Chambers.</p>
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
        </section>

        <section className="acct-section" aria-labelledby="acct-security-heading">
          <div className="acct-section__head">
            <h2 id="acct-security-heading">Security</h2>
            <p>Manage how you sign in to the client portal.</p>
          </div>
          <div className="acct-security">
            <div className="acct-security__copy">
              <p className="acct-security__title">Change Password</p>
              <p className="acct-security__desc">
                Request a secure reset link for {user?.email || 'your account'}.
              </p>
            </div>
            <Link to="/forgot-password" className="btn btn-primary">
              Change Password
            </Link>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default ClientAccountPage;
