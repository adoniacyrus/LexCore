import React from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import WorkspaceCard from '../../components/dashboard/WorkspaceCard';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../data/dashboard/roleWorkspaces';
import DashboardLayout from '../../layouts/DashboardLayout';
import './account.css';

function ClientProfilePage() {
  const { user } = useAuth();

  return (
    <DashboardLayout showContext={false} activeModule="profile">
      <div className="acct-page lw-fade-in">
        <PageHeader
          eyebrow="Account"
          title="My Profile"
          description="Your LexCore client account details."
          actions={
            <Link to="/dashboard/client/settings" className="btn btn-ghost-dark">
              Settings
            </Link>
          }
        />

        <WorkspaceCard className="acct-card" padding="md">
          <dl className="acct-dl">
            <div>
              <dt>Full name</dt>
              <dd>{user?.full_name || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email || '—'}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{user?.phone_number || '—'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{getRoleLabel(user?.role)}</dd>
            </div>
          </dl>
        </WorkspaceCard>

        <EmptyState
          compact
          eyebrow="Account status"
          title="No profile updates required"
          description="Your account is active. Profile editing will be available in a future release. Contact the firm if your details need correction."
          action={
            <Link to="/dashboard/client/consultations?book=1" className="btn btn-primary">
              Book a Consultation
            </Link>
          }
        />
      </div>
    </DashboardLayout>
  );
}

export default ClientProfilePage;
