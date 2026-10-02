import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { hasPermission } from '../utils/permissions';

/**
 * Route guard for the granular Staff permissions. Renders the nested routes
 * only when the logged-in user holds the required module permission
 * (Admins always pass); otherwise it bounces back to the Staff overview.
 */
const PermissionRoute = ({ permission, redirectTo = '/staff' }) => {
  const { user } = useAuthStore();

  if (permission && !hasPermission(user, permission)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
};

export default PermissionRoute;
