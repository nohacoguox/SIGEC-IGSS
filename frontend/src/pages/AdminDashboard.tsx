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
import { motion, AnimatePresence } from 'framer-motion';
import UserManagementContainer from '../components/UserManagementContainer';
import RoleManagementPage from './RoleManagementPage';
import AreaManagementPage from './AreaManagementPage';
import PuestoManagementPage from './PuestoManagementPage';
import UnidadMedicaManagementPage from './UnidadMedicaManagementPage';
import CorrelativoManagementPage from './CorrelativoManagementPage';
import DashboardBackground from '../components/dashboard/DashboardBackground';
import PageHeader from '../components/dashboard/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import { getDrawerSx, navItemSx, sidebarActionSx } from '../components/dashboard/sidebarStyles';
import { IGSS_COLORS } from '../theme/institutionalColors';
import { useThemeMode } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { Assignment as AssignmentIcon } from '@mui/icons-material';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import NumbersIcon from '@mui/icons-material/Numbers';
import api from '../api';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Panel de Administración', subtitle: 'Bienvenido al panel de control del sistema' },
  'user-management': { title: 'Gestión de Usuarios', subtitle: 'Administra los usuarios del sistema' },
  'role-management': { title: 'Gestión de Roles', subtitle: 'Configura roles y permisos' },
  'area-management': { title: 'Gestión de Áreas', subtitle: 'Administra las áreas del sistema' },
  'puesto-management': { title: 'Gestión de Puestos', subtitle: 'Administra los puestos de trabajo' },
  'unidad-medica-management': { title: 'Gestión de Unidades Médicas', subtitle: 'Administra las unidades médicas' },
  'correlativo-management': { title: 'Gestión de Correlativos', subtitle: 'Configure la secuencia automática de correlativos SIAF' },
  reports: { title: 'Reportes', subtitle: 'Genera y visualiza reportes' },
  settings: { title: 'Configuración', subtitle: 'Configura las opciones del sistema' },
};

interface DashboardStats {
  totalUsers: number;
  totalRoles: number;
  totalReports: number;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { mode, toggleTheme, nextModeLabel } = useThemeMode();
  const { hasPermission } = usePermissions();
  const canAccessColaborador = hasPermission('crear-siaf') || hasPermission('listado-siaf') || hasPermission('autorizar-siaf');
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
    localStorage.removeItem('userRoles');
    localStorage.removeItem('userName');
    localStorage.removeItem('permissions');
    navigate('/login');
  };

  const menuItems = [
    { text: 'Dashboard', icon: <BarChartIcon />, id: 'dashboard' },
    { text: 'Reportes', icon: <Assessment />, id: 'reports' },
    { text: 'Configuración', icon: <Settings />, id: 'settings' },
  ];

  const gestionesItems = [
    { text: 'Usuarios', icon: <PeopleIcon />, id: 'user-management', permission: 'gestionar-usuarios' as const },
    { text: 'Roles', icon: <VpnKeyIcon />, id: 'role-management', permission: 'gestionar-roles' as const },
    { text: 'Áreas', icon: <BusinessIcon />, id: 'area-management', permission: 'gestionar-areas' as const },
    { text: 'Puestos', icon: <WorkIcon />, id: 'puesto-management', permission: 'gestionar-puestos' as const },
    { text: 'Unidades Médicas', icon: <BusinessIcon />, id: 'unidad-medica-management', permission: 'gestionar-unidades-medicas' as const },
    { text: 'Correlativos', icon: <NumbersIcon />, id: 'correlativo-management', permission: 'gestionar-correlativos' as const },
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
              <StatCard
                title="Total de Usuarios"
                value={stats.totalUsers}
                icon={<Group />}
                color={IGSS_COLORS.azul}
                delay={0.05}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Total de Roles"
                value={stats.totalRoles}
                icon={<Security />}
                color={IGSS_COLORS.verde}
                delay={0.12}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Informes Generados"
                value={stats.totalReports}
                icon={<Assessment />}
                color={IGSS_COLORS.azulOscuro}
                delay={0.19}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Box
                component={motion.div}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.28 }}
              >
                <Paper
                  sx={{
                    p: 4,
                    mt: 1,
                    borderRadius: 3,
                    border: '1px dashed',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    textAlign: 'center',
                  }}
                  elevation={0}
                >
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      mx: 'auto',
                      mb: 2,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'action.hover',
                      color: 'primary.main',
                    }}
                  >
                    <TimelineOutlinedIcon sx={{ fontSize: 32 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Actividad Reciente
                  </Typography>
                  <Typography color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
                    No hay actividad reciente para mostrar. Las acciones del sistema aparecerán aquí próximamente.
                  </Typography>
                </Paper>
              </Box>
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
        if (!hasPermission('gestionar-unidades-medicas')) {
          return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No tiene permiso para ver esta sección.</Typography>
            </Box>
          );
        }
        return <UnidadMedicaManagementPage />;
      case 'correlativo-management':
        if (!hasPermission('gestionar-correlativos')) {
          return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No tiene permiso para ver esta sección.</Typography>
            </Box>
          );
        }
        return <CorrelativoManagementPage />;
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
        sx={getDrawerSx(mode)}
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
                bgcolor: IGSS_COLORS.verde,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `3px solid ${IGSS_COLORS.blanco}`,
              }}
            >
              <Avatar 
                sx={{ 
                  width: 88, 
                  height: 88,
                  bgcolor: IGSS_COLORS.azul,
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
                color: IGSS_COLORS.blanco,
                backgroundColor: IGSS_COLORS.azulOscuro,
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
                backgroundColor: IGSS_COLORS.azulOscuro,
                color: IGSS_COLORS.blanco,
                border: `1px solid ${IGSS_COLORS.blanco}`,
                '&:hover': {
                  backgroundColor: IGSS_COLORS.azulClaro,
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
                sx={navItemSx(selectedMenuItem === item.id)}
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
                  sx={navItemSx(gestionesOpen)}
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
                    sx={{ ...navItemSx(selectedMenuItem === item.id), pl: 4, py: 1.2 }}
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
              sx={sidebarActionSx('verde')}
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
                  <Typography sx={{ color: IGSS_COLORS.gris, fontSize: '0.75rem' }}>
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
              sx={sidebarActionSx('salir')}
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
      <DashboardBackground>
        <PageHeader
          title={pageTitles[selectedMenuItem]?.title ?? 'Panel'}
          subtitle={pageTitles[selectedMenuItem]?.subtitle ?? ''}
        />
        <AnimatePresence mode="wait">
          <Box
            component={motion.div}
            key={selectedMenuItem}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderContent()}
          </Box>
        </AnimatePresence>
      </DashboardBackground>
    </Box>
  );
};

export default AdminDashboard;