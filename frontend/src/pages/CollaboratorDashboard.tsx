// frontend/src/pages/CollaboratorDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Collapse,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AssignmentInd as AssignmentIndIcon,
  AssignmentLate as AssignmentLateIcon,
  BarChart as BarChartIcon,
  Book as BookIcon,
  Brightness4 as Brightness4Icon,
  Brightness7 as Brightness7Icon,
  Description as DescriptionIcon,
  ExitToApp as ExitToAppIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Tonality as TonalityIcon,
  Dashboard as DashboardIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';
import { useThemeMode } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import RevisarDireccionDepartamental from '../components/RevisarDireccionDepartamental';
import RevisarExpedientesDD from '../components/RevisarExpedientesDD';
import EstadisticasSiaf from '../components/EstadisticasSiaf';

const drawerWidth = 280;

// --- Main Component ---
const CollaboratorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { mode, toggleTheme, nextModeLabel } = useThemeMode();
  const [selectedView, setSelectedView] = useState<'dashboard' | 'direccion-departamental' | 'estadisticas-tiempos' | 'estadisticas-motivos' | 'revision-expedientes-dd'>('dashboard');
  const [estadisticasOpen, setEstadisticasOpen] = useState(false);

  // Si tenía estadísticas seleccionado pero no tiene permiso, volver al dashboard
  useEffect(() => {
    if ((selectedView === 'estadisticas-tiempos' || selectedView === 'estadisticas-motivos') && !hasPermission('ver-estadisticas')) {
      setSelectedView('dashboard');
    }
  }, [selectedView, hasPermission]);

  // Mantener abierta la sección Estadísticas cuando una de sus vistas está seleccionada
  useEffect(() => {
    if (selectedView === 'estadisticas-tiempos' || selectedView === 'estadisticas-motivos') {
      setEstadisticasOpen(true);
    }
  }, [selectedView]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('permissions');
    navigate('/');
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
        <Box sx={{ pt: 2, px: 2, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', letterSpacing: 1, display: 'block', mb: 1 }}>
            SIGEC-IGSS
          </Typography>
        </Box>
        <Box sx={{ p: 3, textAlign: 'center', pt: 0 }}>
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
            <Box
              sx={{
                width: 100,
                height: 100,
                mb: 2,
                mx: 'auto',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
              }}
            >
              <Avatar
                sx={{
                  width: 90,
                  height: 90,
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '2.5rem',
                }}
              >
                <PersonIcon sx={{ fontSize: 48 }} />
              </Avatar>
            </Box>
            <Typography variant="h6" fontWeight="bold" sx={{ color: 'white', mb: 0.5 }}>
              {localStorage.getItem('userName') || 'Usuario'}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.9)',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                borderRadius: 2,
                px: 2,
                py: 0.5,
                display: 'inline-block',
                fontSize: '0.75rem',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {localStorage.getItem('userRole') || 'colaborador'}
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
              {mode === 'light' ? <TonalityIcon /> : mode === 'gray' ? <Brightness4Icon /> : <Brightness7Icon />}
              <Typography sx={{ ml: 1 }}>{nextModeLabel}</Typography>
            </IconButton>
          </Tooltip>
        </Box>
        <List sx={{ px: 2, mt: 1 }}>
          {/* Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <ListItemButton
              onClick={() => setSelectedView('dashboard')}
              selected={selectedView === 'dashboard'}
              sx={{
                borderRadius: 2,
                mb: 1.5,
                py: 1.5,
                backgroundColor: selectedView === 'dashboard' 
                  ? 'rgba(255, 255, 255, 0.25)' 
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
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Typography fontWeight="600" sx={{ color: 'white' }}>
                    Dashboard
                  </Typography>
                } 
              />
            </ListItemButton>
          </motion.div>

          {/* Libro de SIAF */}
          {hasPermission('crear-siaf') && (
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <ListItemButton
                onClick={() => navigate('/siaf-book')}
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
                  <BookIcon />
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Typography fontWeight="600" sx={{ color: 'white' }}>
                      Libro de SIAF
                    </Typography>
                  } 
                />
              </ListItemButton>
            </motion.div>
          )}

          {hasPermission('revisar-siaf-direccion-departamental') && (
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.43 }}
            >
              <ListItemButton
                onClick={() => setSelectedView('direccion-departamental')}
                selected={selectedView === 'direccion-departamental'}
                sx={{
                  borderRadius: 2,
                  mb: 1.5,
                  py: 1.5,
                  backgroundColor: selectedView === 'direccion-departamental' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    transform: 'translateX(8px)',
                    transition: 'all 0.3s ease',
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                  <AssignmentIndIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography fontWeight="600" sx={{ color: 'white' }}>
                      Revisión Dirección Departamental
                    </Typography>
                  }
                />
              </ListItemButton>
            </motion.div>
          )}

          {hasPermission('actualizar-codigos-productos') && (
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
            >
              <ListItemButton
                onClick={() => navigate('/actualizar-codigos-productos')}
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
                  <UpdateIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography fontWeight="600" sx={{ color: 'white' }}>
                      Actualización de Códigos y Productos
                    </Typography>
                  }
                />
              </ListItemButton>
            </motion.div>
          )}

          {/* Estadísticas: menú colapsable con sub-items (como Gestiones) */}
          {hasPermission('ver-estadisticas') && (
            <>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.48 }}
              >
                <ListItemButton
                  onClick={() => setEstadisticasOpen(!estadisticasOpen)}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    py: 1.5,
                    backgroundColor: estadisticasOpen ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      transform: 'translateX(8px)',
                      transition: 'all 0.3s ease',
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                    <BarChartIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography fontWeight="600" sx={{ color: 'white' }}>
                        Estadísticas
                      </Typography>
                    }
                  />
                  {estadisticasOpen ? <ExpandLessIcon sx={{ color: 'white' }} /> : <ExpandMoreIcon sx={{ color: 'white' }} />}
                </ListItemButton>
              </motion.div>
              <Collapse in={estadisticasOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItemButton
                    onClick={() => setSelectedView('estadisticas-tiempos')}
                    selected={selectedView === 'estadisticas-tiempos'}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      py: 1.2,
                      pl: 4,
                      backgroundColor: selectedView === 'estadisticas-tiempos' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        transform: 'translateX(8px)',
                        transition: 'all 0.3s ease',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                        '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                      <ScheduleIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                          Tiempos SIAF
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          Revisión y corrección
                        </Typography>
                      }
                    />
                  </ListItemButton>
                  <ListItemButton
                    onClick={() => setSelectedView('estadisticas-motivos')}
                    selected={selectedView === 'estadisticas-motivos'}
                    sx={{
                      borderRadius: 2,
                      mb: 1.5,
                      py: 1.2,
                      pl: 4,
                      backgroundColor: selectedView === 'estadisticas-motivos' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        transform: 'translateX(8px)',
                        transition: 'all 0.3s ease',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                        '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                      <AssignmentLateIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                          Motivos de rechazo
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </List>
              </Collapse>
            </>
          )}

          {/* Creación de Expediente — solo con permiso crear-expediente */}
          {hasPermission('crear-expediente') && (
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <ListItemButton
                onClick={() => navigate('/expedientes')}
                sx={{
                  borderRadius: 2,
                  mb: 1.5,
                  py: 1.5,
                  backgroundColor: selectedView === 'revision-expedientes-dd' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    transform: 'translateX(8px)',
                    transition: 'all 0.3s ease',
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                  <DescriptionIcon />
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Typography fontWeight="600" sx={{ color: 'white' }}>
                      Creación de Expediente
                    </Typography>
                  } 
                />
              </ListItemButton>
            </motion.div>
          )}
          {/* Revisión Expedientes (DD): mismo analista que revisa SIAF en DD */}
          {(hasPermission('revisar-expediente-direccion-departamental') || hasPermission('revisar-siaf-direccion-departamental')) && (
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.52 }}
            >
              <ListItemButton
                onClick={() => setSelectedView('revision-expedientes-dd')}
                selected={selectedView === 'revision-expedientes-dd'}
                sx={{
                  borderRadius: 2,
                  mb: 1.5,
                  py: 1.5,
                  backgroundColor: selectedView === 'revision-expedientes-dd' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    transform: 'translateX(8px)',
                    transition: 'all 0.3s ease',
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                  <AssignmentIndIcon />
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Typography fontWeight="600" sx={{ color: 'white' }}>
                      Revisión Expedientes (DD)
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      Aprobar o rechazar
                    </Typography>
                  }
                />
              </ListItemButton>
            </motion.div>
          )}
        </List>
        <Box sx={{ flexGrow: 1 }} />
        {(() => {
          const userRole = (localStorage.getItem('userRole') || '').toLowerCase();
          let perms: string[] = [];
          try {
            const s = localStorage.getItem('permissions');
            if (s) perms = JSON.parse(s);
          } catch {}
          const hasAdminAccess =
            userRole === 'super administrador' ||
            userRole === 'administrador' ||
            perms.includes('gestionar-usuarios') ||
            perms.includes('gestionar-roles');
          return hasAdminAccess;
        })() && (
          <List sx={{ px: 2, pb: 1 }}>
            <ListItemButton
              onClick={() => navigate('/admin-dashboard')}
              sx={{
                borderRadius: 2,
                py: 1.2,
                backgroundColor: 'rgba(0, 102, 161, 0.3)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 102, 161, 0.5)',
                  transform: 'translateX(8px)',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'white' }}>
                <AdminPanelSettingsIcon />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography fontWeight="600" sx={{ color: 'white', fontSize: '0.9rem' }}>
                    Ir al panel de administración
                  </Typography>
                }
              />
            </ListItemButton>
          </List>
        )}
        <List sx={{ px: 2, pb: 2 }}>
           <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.8 }}>
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
                <ListItemIcon sx={{ color: 'white' }}><ExitToAppIcon /></ListItemIcon>
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
        <Toolbar />
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
              {selectedView === 'dashboard' && 'Panel de Control'}
              {selectedView === 'direccion-departamental' && 'Revisión Dirección Departamental'}
              {selectedView === 'estadisticas-tiempos' && 'Tiempos SIAF'}
              {selectedView === 'estadisticas-motivos' && 'Motivos de rechazo'}
              {selectedView === 'revision-expedientes-dd' && 'Revisión Expedientes (DD)'}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              {selectedView === 'dashboard' && 'Bienvenido al panel de control del colaborador'}
              {selectedView === 'direccion-departamental' && 'Autoriza o rechaza SIAFs pendientes de su departamento (todos los municipios)'}
              {selectedView === 'estadisticas-tiempos' && 'Revisión, autorización y corrección de SIAFs'}
              {selectedView === 'estadisticas-motivos' && 'Rechazos clasificados por categoría'}
              {selectedView === 'revision-expedientes-dd' && 'Aprobar o rechazar expedientes enviados a revisión'}
            </Typography>
          </Box>

          {selectedView === 'dashboard' && (
            <Grid container spacing={3}>
              {hasPermission('crear-siaf') && (
                <Grid item xs={12} md={6} lg={4}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      sx={{
                        cursor: 'pointer',
                        height: '100%',
                        background: mode !== 'dark'
                          ? 'linear-gradient(135deg, #0066A1 0%, #004D7A 100%)'
                          : 'linear-gradient(135deg, #2E7FB0 0%, #1E5A7A 100%)',
                        color: 'white',
                        '&:hover': {
                          boxShadow: '0 12px 40px rgba(0, 102, 161, 0.3)',
                        },
                      }}
                      onClick={() => navigate('/siaf-book')}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <BookIcon sx={{ fontSize: 48, mr: 2 }} />
                          <Typography variant="h5" fontWeight="bold">
                            Libro de SIAF
                          </Typography>
                        </Box>
                        <Typography variant="body1" sx={{ opacity: 0.9 }}>
                          Gestiona y crea solicitudes de compra de bienes y servicios
                        </Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              )}

              {hasPermission('revisar-siaf-direccion-departamental') && (
                <Grid item xs={12} md={6} lg={4}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      sx={{
                        cursor: 'pointer',
                        height: '100%',
                        background: mode !== 'dark'
                          ? 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)'
                          : 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)',
                        color: 'white',
                        '&:hover': {
                          boxShadow: '0 12px 40px rgba(21, 101, 192, 0.3)',
                        },
                      }}
                      onClick={() => setSelectedView('direccion-departamental')}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <AssignmentIndIcon sx={{ fontSize: 48, mr: 2 }} />
                          <Typography variant="h5" fontWeight="bold">
                            Revisión Dirección Departamental
                          </Typography>
                        </Box>
                        <Typography variant="body1" sx={{ opacity: 0.9 }}>
                          Autoriza o rechaza SIAFs pendientes de su departamento (todos los municipios)
                        </Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              )}

              {hasPermission('actualizar-codigos-productos') && (
                <Grid item xs={12} md={6} lg={4}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      sx={{
                        cursor: 'pointer',
                        height: '100%',
                        background: mode !== 'dark'
                          ? 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)'
                          : 'linear-gradient(135deg, #9C27B0 0%, #6A1B9A 100%)',
                        color: 'white',
                        '&:hover': {
                          boxShadow: '0 12px 40px rgba(123, 31, 162, 0.3)',
                        },
                      }}
                      onClick={() => navigate('/actualizar-codigos-productos')}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <UpdateIcon sx={{ fontSize: 48, mr: 2 }} />
                          <Typography variant="h5" fontWeight="bold">
                            Actualización de Códigos y Productos
                          </Typography>
                        </Box>
                        <Typography variant="body1" sx={{ opacity: 0.9 }}>
                          Actualiza el catálogo de códigos y descripciones desde el Excel oficial
                        </Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              )}

              {hasPermission('ver-estadisticas') && (
                <>
                  <Grid item xs={12} md={6} lg={4}>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        sx={{
                          cursor: 'pointer',
                          height: '100%',
                          background: mode !== 'dark'
                            ? 'linear-gradient(135deg, #00838F 0%, #006064 100%)'
                            : 'linear-gradient(135deg, #00ACC1 0%, #00838F 100%)',
                          color: 'white',
                          '&:hover': { boxShadow: '0 12px 40px rgba(0, 131, 143, 0.3)' },
                        }}
                        onClick={() => setSelectedView('estadisticas-tiempos')}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <ScheduleIcon sx={{ fontSize: 48, mr: 2 }} />
                            <Typography variant="h5" fontWeight="bold">Tiempos SIAF</Typography>
                          </Box>
                          <Typography variant="body1" sx={{ opacity: 0.9 }}>
                            Revisión, autorización y corrección (gráficos y métricas)
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                  <Grid item xs={12} md={6} lg={4}>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        sx={{
                          cursor: 'pointer',
                          height: '100%',
                          background: mode !== 'dark'
                            ? 'linear-gradient(135deg, #C62828 0%, #B71C1C 100%)'
                            : 'linear-gradient(135deg, #E53935 0%, #C62828 100%)',
                          color: 'white',
                          '&:hover': { boxShadow: '0 12px 40px rgba(198, 40, 40, 0.3)' },
                        }}
                        onClick={() => setSelectedView('estadisticas-motivos')}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <AssignmentLateIcon sx={{ fontSize: 48, mr: 2 }} />
                            <Typography variant="h5" fontWeight="bold">Motivos de rechazo</Typography>
                          </Box>
                          <Typography variant="body1" sx={{ opacity: 0.9 }}>
                            Rechazos clasificados por categoría
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                </>
              )}

              {hasPermission('crear-expediente') && (
                <Grid item xs={12} md={6} lg={4}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      sx={{
                        cursor: 'pointer',
                        height: '100%',
                        background: mode !== 'dark'
                          ? 'linear-gradient(135deg, #F57C00 0%, #E65100 100%)'
                          : 'linear-gradient(135deg, #FB8C00 0%, #EF6C00 100%)',
                        color: 'white',
                        '&:hover': {
                          boxShadow: '0 12px 40px rgba(245, 124, 0, 0.3)',
                        },
                      }}
                      onClick={() => navigate('/expedientes')}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <DescriptionIcon sx={{ fontSize: 48, mr: 2 }} />
                          <Typography variant="h5" fontWeight="bold">
                            Creación de Expediente
                          </Typography>
                        </Box>
                        <Typography variant="body1" sx={{ opacity: 0.9 }}>
                          Crea y administra expedientes de manera eficiente
                        </Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              )}
              {(hasPermission('revisar-expediente-direccion-departamental') || hasPermission('revisar-siaf-direccion-departamental')) && (
                <Grid item xs={12} md={6} lg={4}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      sx={{
                        cursor: 'pointer',
                        height: '100%',
                        background: mode !== 'dark'
                          ? 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)'
                          : 'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)',
                        color: 'white',
                        '&:hover': { boxShadow: '0 12px 40px rgba(46, 125, 50, 0.3)' },
                      }}
                      onClick={() => setSelectedView('revision-expedientes-dd')}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <AssignmentIndIcon sx={{ fontSize: 48, mr: 2 }} />
                          <Typography variant="h5" fontWeight="bold">
                            Revisión Expedientes (DD)
                          </Typography>
                        </Box>
                        <Typography variant="body1" sx={{ opacity: 0.9 }}>
                          Aprobar o rechazar expedientes enviados a revisión
                        </Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              )}
            </Grid>
          )}

          {selectedView === 'direccion-departamental' && <RevisarDireccionDepartamental />}
              {selectedView === 'revision-expedientes-dd' && (hasPermission('revisar-expediente-direccion-departamental') || hasPermission('revisar-siaf-direccion-departamental')) && <RevisarExpedientesDD />}
          {selectedView === 'estadisticas-tiempos' && hasPermission('ver-estadisticas') && <EstadisticasSiaf tabInicial={0} ocultarTabs />}
          {selectedView === 'estadisticas-motivos' && hasPermission('ver-estadisticas') && <EstadisticasSiaf tabInicial={1} ocultarTabs />}
          {(selectedView === 'estadisticas-tiempos' || selectedView === 'estadisticas-motivos') && !hasPermission('ver-estadisticas') && (
            <Typography color="text.secondary">No tiene permiso para ver estadísticas.</Typography>
          )}
        </motion.div>
      </Box>
    </Box>
  );
};
export default CollaboratorDashboard;