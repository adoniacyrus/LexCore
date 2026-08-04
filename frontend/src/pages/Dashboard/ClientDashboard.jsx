import React, { useRef } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import WorkspaceHome from './WorkspaceHome';

function ClientDashboard() {
  const quickActionsRef = useRef(null);

  return (
    <DashboardLayout
      onQuickActions={() =>
        quickActionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    >
      <WorkspaceHome quickActionsRef={quickActionsRef} />
    </DashboardLayout>
  );
}

export default ClientDashboard;
