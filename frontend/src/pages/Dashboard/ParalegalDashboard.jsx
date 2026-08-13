import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import ParalegalWorkspace from './ParalegalWorkspace';

function ParalegalDashboard() {
  return (
    <DashboardLayout showContext={false} fillHeight>
      <ParalegalWorkspace />
    </DashboardLayout>
  );
}

export default ParalegalDashboard;
