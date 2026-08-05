import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import WorkspaceCard from '../../components/dashboard/WorkspaceCard';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import './account.css';

function ClientSettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <DashboardLayout showContext={false} activeModule="settings">
      <div className="acct-page lw-fade-in">
        <PageHeader
          eyebrow="Account"
          title="Settings"
          description="Preferences for your LexCore chambers portal."
        />

        <WorkspaceCard className="acct-card" padding="md">
          <p className="section-tag-gold">Signed in as</p>
          <p className="acct-signed-in">{user?.email}</p>
          <div className="acct-settings-actions">
            <Link to="/dashboard/client/profile" className="btn btn-ghost-dark">
              View Profile
            </Link>
            <button type="button" className="btn btn-primary" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </WorkspaceCard>

        <EmptyState
          compact
          eyebrow="Preferences"
          title="You're all set"
          description="Notification and preference controls will appear here when those features are enabled. You are currently signed in securely."
          action={
            <Link to="/dashboard/client" className="btn btn-ghost-dark">
              Back to Dashboard
            </Link>
          }
        />
      </div>
    </DashboardLayout>
  );
}

export default ClientSettingsPage;
