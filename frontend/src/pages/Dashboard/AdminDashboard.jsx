import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import AdminWorkspace from './AdminWorkspace';

function AdminDashboard() {
  return (
    <DashboardLayout showContext={false}>
      <AdminWorkspace />
    </DashboardLayout>
  );
}

export default AdminDashboard;
