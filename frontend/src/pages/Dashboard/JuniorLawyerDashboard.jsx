import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import JuniorLawyerWorkspace from './JuniorLawyerWorkspace';

function JuniorLawyerDashboard() {
  return (
    <DashboardLayout showContext={false} fillHeight>
      <JuniorLawyerWorkspace />
    </DashboardLayout>
  );
}

export default JuniorLawyerDashboard;
