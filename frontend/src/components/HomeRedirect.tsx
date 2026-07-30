import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import DashboardChoicePanel from './DashboardChoicePanel';
import { hasScreenAccess } from '../config/appScreens';

const canAccessAdmin = (userRole: string, permissions: string[]) => {
  const r = userRole.toLowerCase();
  return (
    r === 'super administrador' ||
    r === 'administrador' ||
    permissions.includes('gestionar-usuarios') ||
    permissions.includes('gestionar-roles')
  );
};

const canAccessColaborador = (permissions: string[], userRole: string) =>
  hasScreenAccess(permissions, 'listado-siaf') ||
  hasScreenAccess(permissions, 'crear-siaf') ||
  permissions.includes('autorizar-siaf') ||
  permissions.includes('revisar-siaf-direccion-departamental') ||
  permissions.includes('crear-expediente') ||
  permissions.includes('revisar-expediente-direccion-departamental') ||
  hasScreenAccess(permissions, 'estadisticas-tiempos') ||
  hasScreenAccess(permissions, 'estadisticas-motivos') ||
  permissions.includes('actualizar-codigos-productos') ||
  userRole.toLowerCase() === 'revisar-siaf-direccion-departamental';

const HomeRedirect = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') ?? '';
  const userName = localStorage.getItem('userName') ?? '';
  let permissions: string[] = [];
  try {
    const stored = localStorage.getItem('permissions');
    if (stored) permissions = JSON.parse(stored);
  } catch {}

  const admin = canAccessAdmin(userRole, permissions);
  const colaborador = canAccessColaborador(permissions, userRole);

  if (admin && colaborador) {
    return (
      <DashboardChoicePanel
        variant="page"
        userName={userName}
        onSelectAdmin={() => navigate('/admin-dashboard')}
        onSelectColaborador={() => navigate('/colaborador-dashboard')}
      />
    );
  }

  if (admin) return <Navigate to="/admin-dashboard" />;
  if (colaborador) return <Navigate to="/colaborador-dashboard" />;

  return <Navigate to="/login" />;
};

export default HomeRedirect;
