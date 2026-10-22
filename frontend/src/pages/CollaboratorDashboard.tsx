// frontend/src/pages/CollaboratorDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
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
  Tonality as TonalityIcon,
  Dashboard as DashboardIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Update as UpdateIcon,
  Inbox as InboxIcon,
  TaskAlt as TaskAltIcon,
} from '@mui/icons-material';
import { useThemeMode } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import BandejaRevisionesDaf, { BandejaRevisionesTab } from '../components/BandejaRevisionesDaf';
import AnaliticaExpedientes from '../components/AnaliticaExpedientes';
import AnaliticaDaf from '../components/AnaliticaDaf';
import AnaliticaAnalistaDaf from '../components/AnaliticaAnalistaDaf';
import logoIgss from '../assets/images/logo-igss.png';

type CollaboratorView =
  | 'dashboard'
  | 'bandeja-revisiones-daf'
  | 'estadisticas-daf'
  | 'estadisticas-piloto-pg2'
  | 'estadisticas-analista-daf';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Panel de Control', subtitle: 'Bienvenido al panel de control del colaborador' },
  'bandeja-revisiones-daf': {
    title: 'Bandeja de Revisiones DAF',
    subtitle: 'Revise solicitudes SIAF y expedientes de compras pendientes de su departamento',
  },
  'estadisticas-daf': { title: 'Resultados SIAF', subtitle: 'Vista general, rankings, motivos y detalle de un caso' },
  'estadisticas-piloto-pg2': { title: 'Resultados de expedientes', subtitle: 'Vista general, rankings, motivos y detalle de un caso' },
  'estadisticas-analista-daf': {
    title: 'Mis tiempos DAF',
    subtitle: 'Sus revisiones como analista, clasificadas por unidad médica',
  },
};

// --- Main Component ---
const CollaboratorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { mode, toggleTheme, nextModeLabel } = useThemeMode();
  const [selectedView, setSelectedView] = useState<CollaboratorView>('dashboard');
  const [bandejaTab, setBandejaTab] = useState<BandejaRevisionesTab>('siaf');
  const [estadisticasOpen, setEstadisticasOpen] = useState(false);
  const [libroSiafOpen, setLibroSiafOpen] = useState(false);
  const [expedientesOpen, setExpedientesOpen] = useState(false);
  const [bandejaOpen, setBandejaOpen] = useState(false);

  const puedeBandejaDaf =
    hasPermission('revisar-siaf-direccion-departamental') ||
    hasPermission('revisar-expediente-direccion-departamental');
  // Mis estadísticas (personal) o Estadísticas de mi unidad (jefe/Admin C)
  const puedeEstadisticas =
    hasPermission('estadisticas-tiempos') || hasPermission('ver-estadisticas-unidad');
  const puedeTiemposDaf = hasPermission('estadisticas-analista-daf');
  const muestraMenuEstadisticas = puedeEstadisticas || puedeTiemposDaf;

  const abrirBandeja = (tab: BandejaRevisionesTab) => {
    setBandejaTab(tab);
    setBandejaOpen(true);
    setSelectedView('bandeja-revisiones-daf');
  };

  const isSiafListRoute = location.pathname === '/siaf-book' || location.pathname.startsWith('/siaf-book/corregir');
  const isSiafCreateRoute = location.pathname === '/siaf-book/crear';
  const isSiafUnitFinalizadosRoute = location.pathname === '/siaf-book/unidad-finalizados';
  const isExpedientesListRoute = location.pathname === '/expedientes';
  const isExpedientesUnidadRoute = location.pathname === '/expedientes/unidad';

  // Si tenía estadísticas seleccionado pero no tiene permiso, volver al dashboard
  useEffect(() => {
    if ((selectedView === 'estadisticas-daf' || selectedView === 'estadisticas-piloto-pg2') && !puedeEstadisticas) {
      setSelectedView('dashboard');
    }
    if (selectedView === 'estadisticas-analista-daf' && !puedeTiemposDaf) {
      setSelectedView('dashboard');
    }
    if (selectedView === 'bandeja-revisiones-daf' && !puedeBandejaDaf) {
      setSelectedView('dashboard');
    }
  }, [selectedView, puedeEstadisticas, puedeTiemposDaf, puedeBandejaDaf]);

  // Mantener abierta la sección Estadísticas cuando una de sus vistas está seleccionada
  useEffect(() => {
    if (
      selectedView === 'estadisticas-daf' ||
      selectedView === 'estadisticas-piloto-pg2' ||
      selectedView === 'estadisticas-analista-daf'
    ) {
      setEstadisticasOpen(true);
    }
  }, [selectedView]);

  // Mantener abierta la sección Libro SIAF cuando se está en rutas SIAF
  useEffect(() => {
    if (isSiafListRoute || isSiafCreateRoute || isSiafUnitFinalizadosRoute) {
      setLibroSiafOpen(true);
    }
  }, [isSiafListRoute, isSiafCreateRoute, isSiafUnitFinalizadosRoute]);

  useEffect(() => {
    if (isExpedientesListRoute || isExpedientesUnidadRoute) {
      setExpedientesOpen(true);
    }
  }, [isExpedientesListRoute, isExpedientesUnidadRoute]);

  // Mantener abierta la Bandeja DAF cuando está seleccionada
  useEffect(() => {
    if (selectedView === 'bandeja-revisiones-daf') {
      setBandejaOpen(true);
    }
  }, [selectedView]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userRoles');
    localStorage.removeItem('userName');
    localStorage.removeItem('permissions');
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={getDrawerSx(mode)}
      >
        <Box sx={{ p: 3, textAlign: 'center', mt: 1 }}>
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.75)', letterSpacing: 1.5, display: 'block', mb: 1.5 }}
            >
              SIGEC-IGSS
            </Typography>
            <Box
              component="img"
              src={logoIgss}
              alt="Logo IGSS"
              sx={{
                width: 120,
                height: 'auto',
                mb: 1.5,
                mx: 'auto',
                display: 'block',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
              }}
            />
            <Typography variant="h6" fontWeight="bold" sx={{ color: 'white' }}>
              {localStorage.getItem('userName') || 'Usuario'}
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
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: IGSS_COLORS.blanco,
                border: '1px solid rgba(255,255,255,0.55)',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.22)' },
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
          {hasAnyPermission(['listado-siaf', 'crear-siaf', 'listado-siaf-unidad-finalizados']) && (
            <>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <ListItemButton
                  onClick={() => setLibroSiafOpen(!libroSiafOpen)}
                  sx={navItemSx(libroSiafOpen || isSiafListRoute || isSiafCreateRoute || isSiafUnitFinalizadosRoute)}
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
                  {hasPermission('listado-siaf-unidad-finalizados') && (
                  <ListItemButton
                    onClick={() => navigate('/siaf-book/unidad-finalizados')}
                    selected={isSiafUnitFinalizadosRoute}
                    sx={{ ...navItemSx(isSiafUnitFinalizadosRoute), pl: 4, py: 1.2 }}
                  >
                    <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                      <TaskAltIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                          SIAF de mi unidad
                        </Typography>
                      }
                    />
                  </ListItemButton>
                  )}
                </List>
              </Collapse>
            </>
          )}

          {/* Expedientes */}
          {hasAnyPermission(['crear-expediente', 'listado-expedientes-unidad']) && (
            <>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
              >
                <ListItemButton
                  onClick={() => setExpedientesOpen(!expedientesOpen)}
                  sx={navItemSx(expedientesOpen || isExpedientesListRoute || isExpedientesUnidadRoute)}
                >
                  <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                    <DescriptionIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography fontWeight="600" sx={{ color: 'white' }}>
                        Expedientes
                      </Typography>
                    }
                  />
                  {expedientesOpen ? <ExpandLessIcon sx={{ color: 'white' }} /> : <ExpandMoreIcon sx={{ color: 'white' }} />}
                </ListItemButton>
              </motion.div>
              <Collapse in={expedientesOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {hasPermission('crear-expediente') && (
                    <ListItemButton
                      onClick={() => navigate('/expedientes')}
                      selected={isExpedientesListRoute}
                      sx={{ ...navItemSx(isExpedientesListRoute), pl: 4, py: 1.2 }}
                    >
                      <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                        <FormatListBulletedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                            Expedientes de Compras
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  )}
                  {hasPermission('listado-expedientes-unidad') && (
                    <ListItemButton
                      onClick={() => navigate('/expedientes/unidad')}
                      selected={isExpedientesUnidadRoute}
                      sx={{ ...navItemSx(isExpedientesUnidadRoute), pl: 4, py: 1.2 }}
                    >
                      <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                        <TaskAltIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                            Expedientes de mi unidad
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  )}
                </List>
              </Collapse>
            </>
          )}

          {/* Bandeja de Revisiones DAF */}
          {puedeBandejaDaf && (
            <>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <ListItemButton
                  onClick={() => setBandejaOpen(!bandejaOpen)}
                  sx={navItemSx(bandejaOpen || selectedView === 'bandeja-revisiones-daf')}
                >
                  <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                    <InboxIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography fontWeight="600" sx={{ color: 'white' }}>
                        Bandeja de Revisiones DAF
                      </Typography>
                    }
                  />
                  {bandejaOpen ? <ExpandLessIcon sx={{ color: 'white' }} /> : <ExpandMoreIcon sx={{ color: 'white' }} />}
                </ListItemButton>
              </motion.div>
              <Collapse in={bandejaOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {hasPermission('revisar-siaf-direccion-departamental') && (
                    <ListItemButton
                      onClick={() => abrirBandeja('siaf')}
                      selected={selectedView === 'bandeja-revisiones-daf' && bandejaTab === 'siaf'}
                      sx={{ ...navItemSx(selectedView === 'bandeja-revisiones-daf' && bandejaTab === 'siaf'), pl: 4, py: 1.2 }}
                    >
                      <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                        <BookIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                            SIAF
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  )}
                  {(hasPermission('revisar-expediente-direccion-departamental') ||
                    hasPermission('revisar-siaf-direccion-departamental')) && (
                    <ListItemButton
                      onClick={() => abrirBandeja('expedientes')}
                      selected={selectedView === 'bandeja-revisiones-daf' && bandejaTab === 'expedientes'}
                      sx={{ ...navItemSx(selectedView === 'bandeja-revisiones-daf' && bandejaTab === 'expedientes'), pl: 4, py: 1.2 }}
                    >
                      <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                        <DescriptionIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                            Expedientes
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  )}
                </List>
              </Collapse>
            </>
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

          {/* Estadísticas: resultados (creador/unidad) y/o tiempos del analista DAF */}
          {muestraMenuEstadisticas && (
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
                  {puedeEstadisticas && (
                    <ListItemButton
                      onClick={() => setSelectedView('estadisticas-daf')}
                      selected={selectedView === 'estadisticas-daf'}
                      sx={{ ...navItemSx(selectedView === 'estadisticas-daf'), pl: 4, py: 1.2 }}
                    >
                      <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                        <BarChartIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>Resultados SIAF</Typography>}
                        secondary={<Typography variant="caption" sx={{ color: IGSS_COLORS.gris }}>Cierre mensual y motivos</Typography>}
                      />
                    </ListItemButton>
                  )}
                  {puedeEstadisticas && (
                    <ListItemButton
                      onClick={() => setSelectedView('estadisticas-piloto-pg2')}
                      selected={selectedView === 'estadisticas-piloto-pg2'}
                      sx={{ ...navItemSx(selectedView === 'estadisticas-piloto-pg2'), pl: 4, py: 1.2 }}
                    >
                      <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                        <BarChartIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                            Resultados de expedientes
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ color: IGSS_COLORS.gris }}>
                            Cierre mensual y motivos
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  )}
                  {puedeTiemposDaf && (
                    <ListItemButton
                      onClick={() => setSelectedView('estadisticas-analista-daf')}
                      selected={selectedView === 'estadisticas-analista-daf'}
                      sx={{ ...navItemSx(selectedView === 'estadisticas-analista-daf'), pl: 4, py: 1.2 }}
                    >
                      <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                        <TaskAltIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>
                            Mis tiempos DAF
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ color: IGSS_COLORS.gris }}>
                            Por unidad médica
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  )}
                </List>
              </Collapse>
            </>
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
            sx={{ minWidth: 0, maxWidth: '100%' }}
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
              {hasPermission('listado-siaf-unidad-finalizados') && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="SIAF de mi unidad"
                    description="Director / Administrador: En revisión, Rechazado y Finalizado de su unidad"
                    icon={<TaskAltIcon />}
                    accent={IGSS_COLORS.verdeOscuro}
                    onClick={() => navigate('/siaf-book/unidad-finalizados')}
                    delay={0.09}
                  />
                </Grid>
              )}
              {hasPermission('crear-expediente') && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Expedientes de Compras"
                    description="Cree y administre expedientes de compras y sus documentos"
                    icon={<DescriptionIcon />}
                    accent={IGSS_COLORS.azul}
                    onClick={() => navigate('/expedientes')}
                    delay={0.1}
                  />
                </Grid>
              )}
              {hasPermission('listado-expedientes-unidad') && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Expedientes de mi unidad"
                    description="Director / Administrador: En revisión, Rechazado y Cerrado de su unidad"
                    icon={<TaskAltIcon />}
                    accent={IGSS_COLORS.verdeOscuro}
                    onClick={() => navigate('/expedientes/unidad')}
                    delay={0.11}
                  />
                </Grid>
              )}
              {puedeBandejaDaf && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Bandeja de Revisiones DAF"
                    description="Revise SIAF y expedientes pendientes de su departamento"
                    icon={<InboxIcon />}
                    accent={IGSS_COLORS.azulOscuro}
                    onClick={() =>
                      abrirBandeja(
                        hasPermission('revisar-siaf-direccion-departamental') ? 'siaf' : 'expedientes'
                      )
                    }
                    delay={0.12}
                  />
                </Grid>
              )}
              {hasPermission('actualizar-codigos-productos') && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Actualización de Códigos y Productos"
                    description="Actualiza MINFIN y subproductos desde Excel, y SIBOFA desde el PDF del listado básico"
                    icon={<UpdateIcon />}
                    accent={IGSS_COLORS.azulClaro}
                    onClick={() => navigate('/actualizar-codigos-productos')}
                    delay={0.15}
                  />
                </Grid>
              )}
              {puedeEstadisticas && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Resultados SIAF"
                    description="Vista general, rankings de aprobados/rechazos, motivos y detalle de un caso"
                    icon={<BarChartIcon />}
                    accent={IGSS_COLORS.verde}
                    onClick={() => setSelectedView('estadisticas-daf')}
                    delay={0.2}
                  />
                </Grid>
              )}
              {puedeEstadisticas && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Resultados de expedientes"
                    description="Vista general, rankings de aprobados/rechazos, motivos y detalle de un caso"
                    icon={<BarChartIcon />}
                    accent={IGSS_COLORS.verdeOscuro}
                    onClick={() => setSelectedView('estadisticas-piloto-pg2')}
                    delay={0.25}
                  />
                </Grid>
              )}
              {puedeTiemposDaf && (
                <Grid item xs={12} md={6} lg={4}>
                  <ActionCard
                    title="Mis tiempos DAF"
                    description="Sus revisiones como analista, clasificadas por unidad médica de Escuintla"
                    icon={<TaskAltIcon />}
                    accent={IGSS_COLORS.azulOscuro}
                    onClick={() => setSelectedView('estadisticas-analista-daf')}
                    delay={0.3}
                  />
                </Grid>
              )}
            </Grid>
          )}

          {selectedView === 'bandeja-revisiones-daf' && puedeBandejaDaf && (
            <BandejaRevisionesDaf tabInicial={bandejaTab} onTabChange={setBandejaTab} />
          )}
          {selectedView === 'estadisticas-daf' && puedeEstadisticas && <AnaliticaDaf />}
          {selectedView === 'estadisticas-piloto-pg2' && puedeEstadisticas && <AnaliticaExpedientes />}
          {selectedView === 'estadisticas-analista-daf' && puedeTiemposDaf && <AnaliticaAnalistaDaf />}
          {selectedView === 'estadisticas-daf' && !puedeEstadisticas && (
            <Typography color="text.secondary">No tiene permiso para ver el análisis SIAF.</Typography>
          )}
          {selectedView === 'estadisticas-piloto-pg2' && !puedeEstadisticas && (
            <Typography color="text.secondary">No tiene permiso para ver el análisis de expedientes.</Typography>
          )}
          {selectedView === 'estadisticas-analista-daf' && !puedeTiemposDaf && (
            <Typography color="text.secondary">No tiene permiso para ver sus tiempos DAF.</Typography>
          )}
          </Box>
        </AnimatePresence>
      </DashboardBackground>
    </Box>
  );
};
export default CollaboratorDashboard;