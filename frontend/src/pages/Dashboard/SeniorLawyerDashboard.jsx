import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import SeniorLawyerWorkspace from './SeniorLawyerWorkspace';

function SeniorLawyerDashboard() {
  return (
    <DashboardLayout showContext={false} fillHeight>
      <SeniorLawyerWorkspace />
    </DashboardLayout>
  );
}

export default SeniorLawyerDashboard;
