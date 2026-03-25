import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper } from '@mui/material';
import { AdminPanelSettings, Assignment } from '@mui/icons-material';

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
  permissions.includes('crear-siaf') ||
  permissions.includes('autorizar-siaf') ||
  permissions.includes('revisar-siaf-direccion-departamental') ||
  permissions.includes('crear-expediente') ||
  permissions.includes('revisar-expediente-direccion-departamental') ||
  userRole.toLowerCase() === 'revisar-siaf-direccion-departamental';

const HomeRedirect = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') ?? '';
  let permissions: string[] = [];
  try {
    const stored = localStorage.getItem('permissions');
    if (stored) permissions = JSON.parse(stored);
  } catch {}

  const admin = canAccessAdmin(userRole, permissions);
  const colaborador = canAccessColaborador(permissions, userRole);

  if (admin && colaborador) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default', p: 2 }}>
        <Paper elevation={3} sx={{ p: 4, maxWidth: 420, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom fontWeight="bold">
            ¿A qué panel deseas entrar?
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Tienes permisos de administración y de colaborador. Elige el panel con el que quieres trabajar.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<AdminPanelSettings />}
              onClick={() => navigate('/admin-dashboard')}
              sx={{ py: 1.5, background: 'linear-gradient(135deg, #0066A1 0%, #004D7A 100%)' }}
            >
              Panel de Administración
            </Button>
            <Button
              fullWidth
              variant="contained"
              size="large"
              color="success"
              startIcon={<Assignment />}
              onClick={() => navigate('/colaborador-dashboard')}
              sx={{ py: 1.5, background: 'linear-gradient(135deg, #00A859 0%, #008044 100%)' }}
            >
              Panel de Colaborador (Crear / Autorizar SIAF)
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  if (admin) return <Navigate to="/admin-dashboard" />;
  if (colaborador) return <Navigate to="/colaborador-dashboard" />;

  return <Navigate to="/login" />;
};

export default HomeRedirect;
