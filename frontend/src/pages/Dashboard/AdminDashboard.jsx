import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import AdminWorkspace from './AdminWorkspace';

function AdminDashboard() {
  return (
    <DashboardLayout showContext={false} fillHeight>
      <AdminWorkspace />
    </DashboardLayout>
  );
}

export default AdminDashboard;
