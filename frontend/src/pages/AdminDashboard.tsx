import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Drawer, 
  List, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Grid, 
  Card, 
  CardContent, 
  Paper, 
  CircularProgress,
  Avatar,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PeopleIcon from '@mui/icons-material/People';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import WorkIcon from '@mui/icons-material/Work';
import BusinessIcon from '@mui/icons-material/Business';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { Settings, Group, Security, Assessment, ExitToApp, Brightness4, Brightness7, Tonality } from '@mui/icons-material';
import BarChartIcon from '@mui/icons-material/BarChart';
import { motion } from 'framer-motion';
import UserManagementContainer from '../components/UserManagementContainer';
import RoleManagementPage from './RoleManagementPage';
import AreaManagementPage from './AreaManagementPage';
import PuestoManagementPage from './PuestoManagementPage';
import UnidadMedicaManagementPage from './UnidadMedicaManagementPage';
import { useThemeMode } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { Assignment as AssignmentIcon } from '@mui/icons-material';
import api from '../api';

const drawerWidth = 280;

interface DashboardStats {
  totalUsers: number;
  totalRoles: number;
  totalReports: number;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { mode, toggleTheme, nextModeLabel } = useThemeMode();
  const { hasPermission } = usePermissions();
  const canAccessColaborador = hasPermission('crear-siaf') || hasPermission('autorizar-siaf');
  const [selectedMenuItem, setSelectedMenuItem] = useState('dashboard');
  const [gestionesOpen, setGestionesOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalRoles: 0,
    totalReports: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleMenuItemClick = (item: string) => {
    setSelectedMenuItem(item);
  };

  const handleGestionesClick = () => {
    setGestionesOpen(!gestionesOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('permissions');
    navigate('/');
  };

  const menuItems = [
    { text: 'Dashboard', icon: <BarChartIcon />, id: 'dashboard' },
    { text: 'Reportes', icon: <Assessment />, id: 'reports' },
    { text: 'Configuración', icon: <Settings />, id: 'settings' },
  ];

  const gestionesItems = [
    { text: 'Gestión de Usuarios', icon: <PeopleIcon />, id: 'user-management', permission: 'gestionar-usuarios' as const },
    { text: 'Gestión de Roles', icon: <VpnKeyIcon />, id: 'role-management', permission: 'gestionar-roles' as const },
    { text: 'Gestión de Áreas', icon: <BusinessIcon />, id: 'area-management', permission: 'gestionar-areas' as const },
    { text: 'Gestión de Puestos', icon: <WorkIcon />, id: 'puesto-management', permission: 'gestionar-puestos' as const },
    { text: 'Gestión de Unidades Médicas', icon: <BusinessIcon />, id: 'unidad-medica-management', permission: 'gestionar-areas' as const },
  ];

  const gestionesItemsFiltered = gestionesItems.filter((item) => hasPermission(item.permission));
  const hasAnyGestionPermission = gestionesItemsFiltered.length > 0;

  // Obtener estadísticas del dashboard
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/dashboard/stats');
        setStats(response.data);
      } catch (err: any) {
        console.error('Error al obtener estadísticas:', err);
        setError('Error al cargar las estadísticas del dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (selectedMenuItem === 'dashboard') {
      fetchDashboardStats();
    }
  }, [selectedMenuItem]);

  const renderContent = () => {
    switch (selectedMenuItem) {
      case 'dashboard':
        if (loading) {
          return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <CircularProgress />
            </Box>
          );
        }

        if (error) {
          return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <Typography color="error">{error}</Typography>
            </Box>
          );
        }

        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  sx={{
                    background: mode !== 'dark'
                      ? 'linear-gradient(135deg, #0066A1 0%, #004D7A 100%)'
                      : 'linear-gradient(135deg, #2E7FB0 0%, #1E5A7A 100%)',
                    color: 'white',
                    height: '100%',
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                          Total de Usuarios
                        </Typography>
                        <Typography variant="h3" fontWeight="bold">
                          {stats.totalUsers}
                        </Typography>
                      </div>
                      <Group sx={{ fontSize: 60, opacity: 0.3 }} />
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
            <Grid item xs={12} md={4}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  sx={{
                    background: mode !== 'dark'
                      ? 'linear-gradient(135deg, #00A859 0%, #008044 100%)'
                      : 'linear-gradient(135deg, #2FA86B 0%, #1E6B47 100%)',
                    color: 'white',
                    height: '100%',
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                          Total de Roles
                        </Typography>
                        <Typography variant="h3" fontWeight="bold">
                          {stats.totalRoles}
                        </Typography>
                      </div>
                      <Security sx={{ fontSize: 60, opacity: 0.3 }} />
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
            <Grid item xs={12} md={4}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  sx={{
                    background: mode !== 'dark'
                      ? 'linear-gradient(135deg, #F57C00 0%, #E65100 100%)'
                      : 'linear-gradient(135deg, #FB8C00 0%, #EF6C00 100%)',
                    color: 'white',
                    height: '100%',
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                          Informes Generados
                        </Typography>
                        <Typography variant="h3" fontWeight="bold">
                          {stats.totalReports}
                        </Typography>
                      </div>
                      <Assessment sx={{ fontSize: 60, opacity: 0.3 }} />
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 3, mt: 2, borderRadius: 3 }} elevation={2}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Actividad Reciente
                </Typography>
                <Typography color="text.secondary">
                  No hay actividad reciente para mostrar.
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        );
      case 'user-management':
        if (!hasPermission('gestionar-usuarios')) {
          return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No tiene permiso para ver esta sección.</Typography>
            </Box>
          );
        }
        return <UserManagementContainer />;
      case 'role-management':
        if (!hasPermission('gestionar-roles')) {
          return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No tiene permiso para ver esta sección.</Typography>
            </Box>
          );
        }
        return <RoleManagementPage />;
      case 'area-management':
        if (!hasPermission('gestionar-areas')) {
          return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No tiene permiso para ver esta sección.</Typography>
            </Box>
          );
        }
        return <AreaManagementPage />;
      case 'puesto-management':
        if (!hasPermission('gestionar-puestos')) {
          return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No tiene permiso para ver esta sección.</Typography>
            </Box>
          );
        }
        return <PuestoManagementPage />;
      case 'unidad-medica-management':
        if (!hasPermission('gestionar-areas')) {
          return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No tiene permiso para ver esta sección.</Typography>
            </Box>
          );
        }
        return <UnidadMedicaManagementPage />;
      case 'reports':
        return <Typography variant="h4">Contenido de Reportes</Typography>;
      case 'settings':
        return <Typography variant="h4">Contenido de Configuración</Typography>;
      default:
        return <Typography variant="h4">Dashboard</Typography>;
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            background: mode !== 'dark' 
              ? 'linear-gradient(180deg, #0066A1 0%, #004D7A 100%)'
              : 'linear-gradient(180deg, #1E1E1E 0%, #121212 100%)',
            color: '#FFFFFF',
            borderRight: 'none',
            boxShadow: '4px 0 20px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        {/* User Profile Section */}
        <Box sx={{ p: 3, textAlign: 'center', mt: 2 }}>
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            transition={{ duration: 0.5 }}
          >
            <Box
              sx={{
                width: 100,
                height: 100,
                mb: 2,
                mx: 'auto',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00A859 0%, #008044 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0, 168, 89, 0.3)',
              }}
            >
              <Avatar 
                sx={{ 
                  width: 90, 
                  height: 90,
                  border: '3px solid white',
                  bgcolor: '#0066A1',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                }} 
              >
                {(localStorage.getItem('userName') || 'A')[0].toUpperCase()}
              </Avatar>
            </Box>
            <Typography variant="h6" fontWeight="bold" sx={{ color: 'white', mb: 0.5 }}>
              {localStorage.getItem('userName') || 'Administrador'}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 2,
                px: 2,
                py: 0.5,
                display: 'inline-block',
              }}
            >
              {localStorage.getItem('userRole') || 'super administrador'}
            </Typography>
          </motion.div>
        </Box>

        {/* Theme Toggle Button */}
        <Box sx={{ px: 2, mb: 2 }}>
          <Tooltip title={nextModeLabel}>
            <IconButton
              onClick={toggleTheme}
              sx={{
                width: '100%',
                borderRadius: 2,
                py: 1.5,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              {mode === 'light' ? <Tonality /> : mode === 'gray' ? <Brightness4 /> : <Brightness7 />}
              <Typography sx={{ ml: 1 }}>{nextModeLabel}</Typography>
            </IconButton>
          </Tooltip>
        </Box>

        {/* Menu Items */}
        <List sx={{ px: 2, mt: 1 }}>
          {menuItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
            >
              <ListItemButton
                onClick={() => handleMenuItemClick(item.id)}
                selected={selectedMenuItem === item.id}
                sx={{
                  borderRadius: 2,
                  mb: 1.5,
                  py: 1.5,
                  backgroundColor: selectedMenuItem === item.id 
                    ? 'rgba(255, 255, 255, 0.2)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    transform: 'translateX(8px)',
                    transition: 'all 0.3s ease',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Typography fontWeight="600" sx={{ color: 'white' }}>
                      {item.text}
                    </Typography>
                  } 
                />
              </ListItemButton>
            </motion.div>
          ))}

          {/* Gestiones Menu with Submenu (solo si tiene al menos un permiso de gestión) */}
          {hasAnyGestionPermission && (
            <>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <ListItemButton
                  onClick={handleGestionesClick}
                  sx={{
                    borderRadius: 2,
                    mb: 1.5,
                    py: 1.5,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    '&:hover': { 
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      transform: 'translateX(8px)',
                      transition: 'all 0.3s ease',
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                    <ManageAccountsIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary={
                      <Typography fontWeight="600" sx={{ color: 'white' }}>
                        Gestiones
                      </Typography>
                    } 
                  />
                  {gestionesOpen ? <ExpandLess sx={{ color: 'white' }} /> : <ExpandMore sx={{ color: 'white' }} />}
                </ListItemButton>
              </motion.div>

              {/* Submenu Items (solo los permitidos) */}
              <Collapse in={gestionesOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {gestionesItemsFiltered.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <ListItemButton
                    onClick={() => handleMenuItemClick(item.id)}
                    selected={selectedMenuItem === item.id}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      py: 1.2,
                      pl: 4,
                      backgroundColor: selectedMenuItem === item.id 
                        ? 'rgba(255, 255, 255, 0.2)' 
                        : 'rgba(255, 255, 255, 0.05)',
                      '&:hover': { 
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        transform: 'translateX(8px)',
                        transition: 'all 0.3s ease',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                          {item.text}
                        </Typography>
                      } 
                    />
                  </ListItemButton>
                </motion.div>
                  ))}
                </List>
              </Collapse>
            </>
          )}
        </List>

        <Box sx={{ flexGrow: 1 }} />

        {/* Ir al panel de colaborador (si tiene permisos) */}
        {canAccessColaborador && (
          <List sx={{ px: 2, pb: 1 }}>
            <ListItemButton
              onClick={() => navigate('/colaborador-dashboard')}
              sx={{
                borderRadius: 2,
                py: 1.2,
                backgroundColor: 'rgba(0, 168, 89, 0.25)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 168, 89, 0.4)',
                  transform: 'translateX(8px)',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'white' }}>
                <AssignmentIcon />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography fontWeight="600" sx={{ color: 'white', fontSize: '0.9rem' }}>
                    Ir al panel de colaborador
                  </Typography>
                }
                secondary={
                  <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>
                    Crear / Autorizar SIAF
                  </Typography>
                }
              />
            </ListItemButton>
          </List>
        )}

        {/* Logout Button */}
        <List sx={{ px: 2, pb: 2 }}>
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <ListItemButton
              onClick={handleLogout}
              sx={{ 
                borderRadius: 2, 
                py: 1.5,
                backgroundColor: 'rgba(211, 47, 47, 0.2)',
                '&:hover': { 
                  backgroundColor: 'rgba(211, 47, 47, 0.4)',
                  transform: 'translateX(8px)',
                  transition: 'all 0.3s ease',
                } 
              }}
            >
              <ListItemIcon sx={{ color: 'white' }}>
                <ExitToApp />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Typography fontWeight="600" sx={{ color: 'white' }}>
                    Cerrar Sesión
                  </Typography>
                } 
              />
            </ListItemButton>
          </motion.div>
        </List>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h3" 
              component="h1" 
              fontWeight="bold" 
              sx={{ 
                background: mode !== 'dark'
                  ? 'linear-gradient(135deg, #0066A1 0%, #00A859 100%)'
                  : 'linear-gradient(135deg, #4A9FD8 0%, #4DC98A 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
            >
              {selectedMenuItem === 'dashboard' && 'Panel de Administración'}
              {selectedMenuItem === 'user-management' && 'Gestión de Usuarios'}
              {selectedMenuItem === 'role-management' && 'Gestión de Roles'}
              {selectedMenuItem === 'area-management' && 'Gestión de Áreas'}
              {selectedMenuItem === 'puesto-management' && 'Gestión de Puestos'}
              {selectedMenuItem === 'reports' && 'Reportes'}
              {selectedMenuItem === 'settings' && 'Configuración'}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              {selectedMenuItem === 'dashboard' && 'Bienvenido al panel de control del sistema'}
              {selectedMenuItem === 'user-management' && 'Administra los usuarios del sistema'}
              {selectedMenuItem === 'role-management' && 'Configura roles y permisos'}
              {selectedMenuItem === 'area-management' && 'Administra las áreas del sistema'}
              {selectedMenuItem === 'puesto-management' && 'Administra los puestos de trabajo'}
              {selectedMenuItem === 'reports' && 'Genera y visualiza reportes'}
              {selectedMenuItem === 'settings' && 'Configura las opciones del sistema'}
            </Typography>
          </Box>
          {renderContent()}
        </motion.div>
      </Box>
    </Box>
  );
};

export default AdminDashboard;