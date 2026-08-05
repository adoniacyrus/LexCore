import React from 'react';
import PageHeader from '../../components/dashboard/PageHeader';
import WorkspaceCard from '../../components/dashboard/WorkspaceCard';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../data/dashboard/roleWorkspaces';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/**
 * Minimal workspace for staff roles until their modules ship.
 * No placeholder statistics or fake matter cards.
 */
function StaffWorkspace() {
  const { user } = useAuth();
  const firstName = (user?.full_name || 'Counsel').split(' ')[0];
  const roleLabel = getRoleLabel(user?.role);

  return (
    <div className="lw-workspace-home">
      <PageHeader
        eyebrow="LexCore Chambers"
        title={
          <>
            {getGreeting()},{' '}
            <em style={{ color: 'var(--color-primary)', fontStyle: 'italic' }}>{firstName}</em>
          </>
        }
        description={`${roleLabel} workspace — live modules will appear here as they are enabled.`}
      />

      <WorkspaceCard>
        <p className="section-tag-gold">Workspace Ready</p>
        <h2 style={{ fontSize: '1.35rem', marginBottom: '0.65rem' }}>
          Your digital chambers is prepared.
        </h2>
        <p className="auth-sheet-lede" style={{ margin: 0, maxWidth: '52ch' }}>
          Cases, hearings, documents, and tasks will connect here when those modules go live.
          No provisional statistics are shown in the meantime.
        </p>
      </WorkspaceCard>
    </div>
  );
}

export default StaffWorkspace;
