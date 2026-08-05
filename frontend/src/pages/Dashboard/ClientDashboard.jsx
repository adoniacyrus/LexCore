import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import ClientWorkspace from './ClientWorkspace';

function ClientDashboard() {
  return (
    <DashboardLayout showContext={false}>
      <ClientWorkspace />
    </DashboardLayout>
  );
}

export default ClientDashboard;
