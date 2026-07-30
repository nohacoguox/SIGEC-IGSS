// frontend/src/pages/CollaboratorDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Avatar,
  Box,
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
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardBackground from '../components/dashboard/DashboardBackground';
import PageHeader from '../components/dashboard/PageHeader';
import ActionCard from '../components/dashboard/ActionCard';
import { getDrawerSx, navItemSx, sidebarActionSx } from '../components/dashboard/sidebarStyles';
import { IGSS_COLORS } from '../theme/institutionalColors';
import {
  AssignmentInd as AssignmentIndIcon,
  AssignmentLate as AssignmentLateIcon,
  BarChart as BarChartIcon,
  Add as AddIcon,
  Book as BookIcon,
  FormatListBulleted as FormatListBulletedIcon,
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

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Panel de Control', subtitle: 'Bienvenido al panel de control del colaborador' },
  'direccion-departamental': { title: 'Revisión Dirección Departamental', subtitle: 'Autoriza o rechaza SIAFs pendientes de su departamento (todos los municipios)' },
  'estadisticas-tiempos': { title: 'Tiempos SIAF', subtitle: 'Revisión, autorización y corrección de SIAFs' },
  'estadisticas-motivos': { title: 'Motivos de rechazo', subtitle: 'Rechazos clasificados por categoría' },
  'revision-expedientes-dd': { title: 'Revisión Expedientes (DD)', subtitle: 'Aprobar o rechazar expedientes enviados a revisión' },
};

// --- Main Component ---
const CollaboratorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { mode, toggleTheme, nextModeLabel } = useThemeMode();
  const [selectedView, setSelectedView] = useState<'dashboard' | 'direccion-departamental' | 'estadisticas-tiempos' | 'estadisticas-motivos' | 'revision-expedientes-dd'>('dashboard');
  const [estadisticasOpen, setEstadisticasOpen] = useState(false);
  const [libroSiafOpen, setLibroSiafOpen] = useState(false);

  const isSiafListRoute = location.pathname === '/siaf-book' || location.pathname.startsWith('/siaf-book/corregir');
  const isSiafCreateRoute = location.pathname === '/siaf-book/crear';

  // Si tenía estadísticas seleccionado pero no tiene permiso, volver al dashboard
  useEffect(() => {
    if ((selectedView === 'estadisticas-tiempos' || selectedView === 'estadisticas-motivos') &&
      !hasPermission('estadisticas-tiempos') && !hasPermission('estadisticas-motivos')) {
      setSelectedView('dashboard');
    }
  }, [selectedView, hasPermission]);

  // Mantener abierta la sección Estadísticas cuando una de sus vistas está seleccionada
  useEffect(() => {
    if (selectedView === 'estadisticas-tiempos' || selectedView === 'estadisticas-motivos') {
      setEstadisticasOpen(true);
    }
  }, [selectedView]);

  // Mantener abierta la sección Libro SIAF cuando se está en rutas SIAF
  useEffect(() => {
    if (isSiafListRoute || isSiafCreateRoute) {
      setLibroSiafOpen(true);
    }
  }, [isSiafListRoute, isSiafCreateRoute]);

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
        sx={getDrawerSx(mode)}
      >
        <Box sx={{ pt: 2, px: 2, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: IGSS_COLORS.gris, letterSpacing: 1, display: 'block', mb: 1 }}>
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
                  color: IGSS_COLORS.blanco,
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
                color: IGSS_COLORS.blanco,
                backgroundColor: IGSS_COLORS.azulOscuro,
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
                backgroundColor: IGSS_COLORS.azulOscuro,
                color: IGSS_COLORS.blanco,
                border: `1px solid ${IGSS_COLORS.blanco}`,
                '&:hover': { backgroundColor: IGSS_COLORS.azulClaro },
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
              sx={navItemSx(selectedView === 'dashboard')}
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

          {/* Libro SIAF */}
          {hasAnyPermission(['listado-siaf', 'crear-siaf']) && (
            <>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <ListItemButton
                  onClick={() => setLibroSiafOpen(!libroSiafOpen)}
                  sx={navItemSx(libroSiafOpen || isSiafListRoute || isSiafCreateRoute)}
                >
                  <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                    <BookIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography fontWeight="600" sx={{ color: 'white' }}>
                        Libro SIAF
                      </Typography>
                    }
                  />
                  {libroSiafOpen ? <ExpandLessIcon sx={{ color: 'white' }} /> : <ExpandMoreIcon sx={{ color: 'white' }} />}
                </ListItemButton>
              </motion.div>
              <Collapse in={libroSiafOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {hasPermission('listado-siaf') && (
                  <ListItemButton
                    onClick={() => navigate('/siaf-book')}
                    selected={isSiafListRoute}
                    sx={{ ...navItemSx(isSiafListRoute), pl: 4, py: 1.2 }}
                  >
                    <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                      <FormatListBulletedIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                          Listado de SIAF
                        </Typography>
                      }
                    />
                  </ListItemButton>
                  )}
                  {hasPermission('crear-siaf') && (
                  <ListItemButton
                    onClick={() => navigate('/siaf-book/crear')}
                    selected={isSiafCreateRoute}
                    sx={{ ...navItemSx(isSiafCreateRoute), pl: 4, py: 1.2 }}
                  >
                    <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                      <AddIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                          Crear SIAF
                        </Typography>
                      }
                    />
                  </ListItemButton>
                  )}
                </List>
              </Collapse>
            </>
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
                sx={navItemSx(selectedView === 'direccion-departamental')}
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
                sx={navItemSx(false)}
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
          {hasAnyPermission(['estadisticas-tiempos', 'estadisticas-motivos']) && (
            <>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.48 }}
              >
                <ListItemButton
                  onClick={() => setEstadisticasOpen(!estadisticasOpen)}
                  sx={navItemSx(estadisticasOpen)}
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
                  {hasPermission('estadisticas-tiempos') && (
                  <ListItemButton
                    onClick={() => setSelectedView('estadisticas-tiempos')}
                    selected={selectedView === 'estadisticas-tiempos'}
                    sx={{ ...navItemSx(selectedView === 'estadisticas-tiempos'), pl: 4, py: 1.2 }}
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
                        <Typography variant="caption" sx={{ color: IGSS_COLORS.gris }}>
                          Revisión y corrección
                        </Typography>
                      }
                    />
                  </ListItemButton>
                  )}
                  {hasPermission('estadisticas-motivos') && (
                  <ListItemButton
                    onClick={() => setSelectedView('estadisticas-motivos')}
                    selected={selectedView === 'estadisticas-motivos'}
                    sx={{ ...navItemSx(selectedView === 'estadisticas-motivos'), pl: 4, py: 1.2 }}
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
                  )}
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
                sx={navItemSx(false)}
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
                sx={navItemSx(selectedView === 'revision-expedientes-dd')}
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
              sx={sidebarActionSx('azul')}
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
                sx={sidebarActionSx('salir')}
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
      <DashboardBackground>
        <PageHeader
          title={pageTitles[selectedView]?.title ?? 'Panel'}
          subtitle={pageTitles[selectedView]?.subtitle ?? ''}
        />
        <AnimatePresence mode="wait">
          <Box
            component={motion.div}
            key={selectedView}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
          {selectedView === 'dashboard' && (
            <Grid container spacing={3}>
              {hasPermission('listado-siaf') && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Listado de SIAF"
                    description="Consulte y administre sus solicitudes SIAF"
                    icon={<FormatListBulletedIcon />}
                    accent={IGSS_COLORS.azul}
                    onClick={() => navigate('/siaf-book')}
                    delay={0.05}
                  />
                </Grid>
              )}
              {hasPermission('crear-siaf') && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Crear SIAF"
                    description="Crear una nueva solicitud de compra"
                    icon={<AddIcon />}
                    accent={IGSS_COLORS.azulOscuro}
                    onClick={() => navigate('/siaf-book/crear')}
                    delay={0.08}
                  />
                </Grid>
              )}
              {hasPermission('revisar-siaf-direccion-departamental') && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Revisión Dirección Departamental"
                    description="Autoriza o rechaza SIAFs pendientes de su departamento (todos los municipios)"
                    icon={<AssignmentIndIcon />}
                    accent={IGSS_COLORS.azulOscuro}
                    onClick={() => setSelectedView('direccion-departamental')}
                    delay={0.1}
                  />
                </Grid>
              )}
              {hasPermission('actualizar-codigos-productos') && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Actualización de Códigos y Productos"
                    description="Actualiza el catálogo de códigos y descripciones desde el Excel oficial"
                    icon={<UpdateIcon />}
                    accent={IGSS_COLORS.azulClaro}
                    onClick={() => navigate('/actualizar-codigos-productos')}
                    delay={0.15}
                  />
                </Grid>
              )}
              {hasPermission('estadisticas-tiempos') && (
                  <Grid item xs={12} md={6} lg={4}>
                    <ActionCard
                      title="Tiempos SIAF"
                      description="Revisión, autorización y corrección (gráficos y métricas)"
                      icon={<ScheduleIcon />}
                      accent={IGSS_COLORS.verde}
                      onClick={() => setSelectedView('estadisticas-tiempos')}
                      delay={0.2}
                    />
                  </Grid>
              )}
              {hasPermission('estadisticas-motivos') && (
                  <Grid item xs={12} md={6} lg={4}>
                    <ActionCard
                      title="Motivos de rechazo"
                      description="Rechazos clasificados por categoría"
                      icon={<AssignmentLateIcon />}
                      accent={IGSS_COLORS.verdeOscuro}
                      onClick={() => setSelectedView('estadisticas-motivos')}
                      delay={0.25}
                    />
                  </Grid>
              )}
              {hasPermission('crear-expediente') && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Creación de Expediente"
                    description="Crea y administra expedientes de manera eficiente"
                    icon={<DescriptionIcon />}
                    accent={IGSS_COLORS.azul}
                    onClick={() => navigate('/expedientes')}
                    delay={0.3}
                  />
                </Grid>
              )}
              {(hasPermission('revisar-expediente-direccion-departamental') || hasPermission('revisar-siaf-direccion-departamental')) && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Revisión Expedientes (DD)"
                    description="Aprobar o rechazar expedientes enviados a revisión"
                    icon={<AssignmentIndIcon />}
                    accent={IGSS_COLORS.verde}
                    onClick={() => setSelectedView('revision-expedientes-dd')}
                    delay={0.35}
                  />
                </Grid>
              )}
            </Grid>
          )}

          {selectedView === 'direccion-departamental' && <RevisarDireccionDepartamental />}
          {selectedView === 'revision-expedientes-dd' && (hasPermission('revisar-expediente-direccion-departamental') || hasPermission('revisar-siaf-direccion-departamental')) && <RevisarExpedientesDD />}
          {selectedView === 'estadisticas-tiempos' && hasPermission('estadisticas-tiempos') && <EstadisticasSiaf tabInicial={0} ocultarTabs />}
          {selectedView === 'estadisticas-motivos' && hasPermission('estadisticas-motivos') && <EstadisticasSiaf tabInicial={1} ocultarTabs />}
          {selectedView === 'estadisticas-tiempos' && !hasPermission('estadisticas-tiempos') && (
            <Typography color="text.secondary">No tiene permiso para ver estadísticas de tiempos.</Typography>
          )}
          {selectedView === 'estadisticas-motivos' && !hasPermission('estadisticas-motivos') && (
            <Typography color="text.secondary">No tiene permiso para ver motivos de rechazo.</Typography>
          )}
          </Box>
        </AnimatePresence>
      </DashboardBackground>
    </Box>
  );
};
export default CollaboratorDashboard;