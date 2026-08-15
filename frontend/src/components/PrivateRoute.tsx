import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const AUTH_KEYS = ['token', 'userRole', 'userRoles', 'userName', 'permissions'] as const;

function clearAuthStorage() {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
}

/** Comprueba que el JWT exista y no esté vencido (sin depender de librerías extra). */
function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const PrivateRoute = () => {
  const token = localStorage.getItem('token');

  if (!isTokenValid(token)) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
