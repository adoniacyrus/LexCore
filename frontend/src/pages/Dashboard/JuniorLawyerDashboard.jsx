import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import StaffWorkspace from './StaffWorkspace';

function JuniorLawyerDashboard() {
  return (
    <DashboardLayout showContext={false}>
      <StaffWorkspace />
    </DashboardLayout>
  );
}

export default JuniorLawyerDashboard;
