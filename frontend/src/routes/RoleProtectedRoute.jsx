import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardPath } from '../utils/roleRoutes';

/**
 * Requires authentication and one of the allowed roles.
 * Unauthorized authenticated users are sent to their own dashboard.
 */
function RoleProtectedRoute({ children, roles = [] }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles.length && !roles.includes(user?.role)) {
    return <Navigate to={getDashboardPath(user?.role)} replace />;
  }

  return children;
}

export default RoleProtectedRoute;
