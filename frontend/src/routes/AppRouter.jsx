import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ModalProvider } from '../context/ModalContext';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import LandingPage from '../pages/Landing/LandingPage';
import LoginPage from '../pages/Auth/LoginPage';
import RegisterPage from '../pages/Auth/RegisterPage';
import AdminDashboard from '../pages/Dashboard/AdminDashboard';
import SeniorLawyerDashboard from '../pages/Dashboard/SeniorLawyerDashboard';
import JuniorLawyerDashboard from '../pages/Dashboard/JuniorLawyerDashboard';
import ParalegalDashboard from '../pages/Dashboard/ParalegalDashboard';
import ClientDashboard from '../pages/Dashboard/ClientDashboard';

function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModalProvider>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<LandingPage />} />
            </Route>

            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Temporary preview routes — remove when portal auth routing is ready */}
            <Route path="/dashboard/admin" element={<AdminDashboard />} />
            <Route path="/dashboard/senior" element={<SeniorLawyerDashboard />} />
            <Route path="/dashboard/junior" element={<JuniorLawyerDashboard />} />
            <Route path="/dashboard/paralegal" element={<ParalegalDashboard />} />
            <Route path="/dashboard/client" element={<ClientDashboard />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default AppRouter;
