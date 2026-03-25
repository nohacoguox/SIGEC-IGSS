import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const PrivateRoute = () => {
  const token = localStorage.getItem('token');
  // Simple check for token existence.
  // You might want to add token validation here in the future.
  return token ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoute;
