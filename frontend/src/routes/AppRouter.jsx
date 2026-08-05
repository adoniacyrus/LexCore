import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ModalProvider } from '../context/ModalContext';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import LandingPage from '../pages/Landing/LandingPage';
import LoginPage from '../pages/Auth/LoginPage';
import RegisterPage from '../pages/Auth/RegisterPage';
import ForgotPasswordPage from '../pages/Auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/Auth/ResetPasswordPage';
import AdminDashboard from '../pages/Dashboard/AdminDashboard';
import SeniorLawyerDashboard from '../pages/Dashboard/SeniorLawyerDashboard';
import JuniorLawyerDashboard from '../pages/Dashboard/JuniorLawyerDashboard';
import ParalegalDashboard from '../pages/Dashboard/ParalegalDashboard';
import ClientDashboard from '../pages/Dashboard/ClientDashboard';
import EmployeeListPage from '../pages/Employees/EmployeeListPage';
import BookConsultationPage from '../pages/Consultations/BookConsultationPage';
import MyConsultationsPage from '../pages/Consultations/MyConsultationsPage';
import ClientAccountPage from '../pages/Account/ClientAccountPage';
import ProtectedRoute from './ProtectedRoute';
import RoleProtectedRoute from './RoleProtectedRoute';

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
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
            </Route>

            <Route
              path="/dashboard/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/employees"
              element={
                <RoleProtectedRoute roles={['ADMIN']}>
                  <EmployeeListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/senior"
              element={
                <ProtectedRoute>
                  <SeniorLawyerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/junior"
              element={
                <ProtectedRoute>
                  <JuniorLawyerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/paralegal"
              element={
                <ProtectedRoute>
                  <ParalegalDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/client"
              element={
                <ProtectedRoute>
                  <ClientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/client/consultations"
              element={
                <RoleProtectedRoute roles={['CLIENT']}>
                  <MyConsultationsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/client/consultations/book"
              element={
                <RoleProtectedRoute roles={['CLIENT']}>
                  <BookConsultationPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/client/account"
              element={
                <RoleProtectedRoute roles={['CLIENT']}>
                  <ClientAccountPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/client/profile"
              element={<Navigate to="/dashboard/client/account" replace />}
            />
            <Route
              path="/dashboard/client/settings"
              element={<Navigate to="/dashboard/client/account" replace />}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default AppRouter;
