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
import ClientListPage from '../pages/Clients/ClientListPage';
import ClientDetailPage from '../pages/Clients/ClientDetailPage';
import BookConsultationPage from '../pages/Consultations/BookConsultationPage';
import MyConsultationsPage from '../pages/Consultations/MyConsultationsPage';
import AdminConsultationQueuePage from '../pages/Consultations/AdminConsultationQueuePage';
import AdminPracticeAreasPage from '../pages/Consultations/AdminPracticeAreasPage';
import LawyerAssignedPage from '../pages/Consultations/LawyerAssignedPage';
import ClientAccountPage from '../pages/Account/ClientAccountPage';
import ProtectedRoute from './ProtectedRoute';
import RoleProtectedRoute from './RoleProtectedRoute';
import CaseListPage from '../pages/Cases/CaseListPage';
import CaseDetailPage from '../pages/Cases/CaseDetailPage';
import CaseConvertPage from '../pages/Cases/CaseConvertPage';
import CaseEditPage from '../pages/Cases/CaseEditPage';

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
              path="/dashboard/admin/clients"
              element={
                <RoleProtectedRoute roles={['ADMIN']}>
                  <ClientListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/clients/:clientReference"
              element={
                <RoleProtectedRoute roles={['ADMIN']}>
                  <ClientDetailPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/consultations"
              element={
                <RoleProtectedRoute roles={['ADMIN']}>
                  <AdminConsultationQueuePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/practice-areas"
              element={
                <RoleProtectedRoute roles={['ADMIN']}>
                  <AdminPracticeAreasPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/cases"
              element={
                <RoleProtectedRoute roles={['ADMIN']}>
                  <CaseListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin/cases/:caseReference"
              element={
                <RoleProtectedRoute roles={['ADMIN']}>
                  <CaseDetailPage />
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
              path="/dashboard/senior/consultations"
              element={
                <RoleProtectedRoute roles={['SENIOR_LAWYER']}>
                  <LawyerAssignedPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/senior/cases"
              element={
                <RoleProtectedRoute roles={['SENIOR_LAWYER']}>
                  <CaseListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/senior/cases/:caseReference"
              element={
                <RoleProtectedRoute roles={['SENIOR_LAWYER']}>
                  <CaseDetailPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/senior/cases/convert/:consultationReference"
              element={
                <RoleProtectedRoute roles={['SENIOR_LAWYER']}>
                  <CaseConvertPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/senior/cases/edit/:caseReference"
              element={
                <RoleProtectedRoute roles={['SENIOR_LAWYER']}>
                  <CaseEditPage />
                </RoleProtectedRoute>
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
              path="/dashboard/junior/consultations"
              element={
                <RoleProtectedRoute roles={['JUNIOR_LAWYER']}>
                  <LawyerAssignedPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/junior/cases"
              element={
                <RoleProtectedRoute roles={['JUNIOR_LAWYER']}>
                  <CaseListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/junior/cases/:caseReference"
              element={
                <RoleProtectedRoute roles={['JUNIOR_LAWYER']}>
                  <CaseDetailPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/junior/cases/convert/:consultationReference"
              element={
                <RoleProtectedRoute roles={['JUNIOR_LAWYER']}>
                  <CaseConvertPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/junior/cases/edit/:caseReference"
              element={
                <RoleProtectedRoute roles={['JUNIOR_LAWYER']}>
                  <CaseEditPage />
                </RoleProtectedRoute>
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
              path="/dashboard/paralegal/cases"
              element={
                <RoleProtectedRoute roles={['PARALEGAL']}>
                  <CaseListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/paralegal/cases/:caseReference"
              element={
                <RoleProtectedRoute roles={['PARALEGAL']}>
                  <CaseDetailPage />
                </RoleProtectedRoute>
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
              path="/dashboard/client/cases"
              element={
                <RoleProtectedRoute roles={['CLIENT']}>
                  <CaseListPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/client/cases/:caseReference"
              element={
                <RoleProtectedRoute roles={['CLIENT']}>
                  <CaseDetailPage />
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
