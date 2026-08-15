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
  Tonality as TonalityIcon,
  Dashboard as DashboardIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Update as UpdateIcon,
  Inbox as InboxIcon,
} from '@mui/icons-material';
import { useThemeMode } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import BandejaRevisionesDaf, { BandejaRevisionesTab } from '../components/BandejaRevisionesDaf';
import AnaliticaExpedientes from '../components/AnaliticaExpedientes';
import AnaliticaDaf from '../components/AnaliticaDaf';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Panel de Control', subtitle: 'Bienvenido al panel de control del colaborador' },
  'bandeja-revisiones-daf': {
    title: 'Bandeja de Revisiones DAF',
    subtitle: 'Revise solicitudes SIAF y expedientes de compras pendientes de su departamento',
  },
  'estadisticas-daf': { title: 'Análisis SIAF', subtitle: 'Cierre mensual, trazabilidad y motivos de rechazo' },
  'estadisticas-piloto-pg2': { title: 'Análisis de expedientes', subtitle: 'Cierre mensual, trazabilidad y motivos de rechazo' },
};

// --- Main Component ---
const CollaboratorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { mode, toggleTheme, nextModeLabel } = useThemeMode();
  const [selectedView, setSelectedView] = useState<'dashboard' | 'bandeja-revisiones-daf' | 'estadisticas-daf' | 'estadisticas-piloto-pg2'>('dashboard');
  const [bandejaTab, setBandejaTab] = useState<BandejaRevisionesTab>('siaf');
  const [estadisticasOpen, setEstadisticasOpen] = useState(false);
  const [libroSiafOpen, setLibroSiafOpen] = useState(false);
  const [bandejaOpen, setBandejaOpen] = useState(false);

  const puedeBandejaDaf =
    hasPermission('revisar-siaf-direccion-departamental') ||
    hasPermission('revisar-expediente-direccion-departamental');
  const puedeEstadisticas =
    hasPermission('estadisticas-tiempos') || hasPermission('estadisticas-motivos') || hasPermission('ver-estadisticas');

  const abrirBandeja = (tab: BandejaRevisionesTab) => {
    setBandejaTab(tab);
    setBandejaOpen(true);
    setSelectedView('bandeja-revisiones-daf');
  };

  const isSiafListRoute = location.pathname === '/siaf-book' || location.pathname.startsWith('/siaf-book/corregir');
  const isSiafCreateRoute = location.pathname === '/siaf-book/crear';

  // Si tenía estadísticas seleccionado pero no tiene permiso, volver al dashboard
  useEffect(() => {
    if ((selectedView === 'estadisticas-daf' || selectedView === 'estadisticas-piloto-pg2') && !puedeEstadisticas) {
      setSelectedView('dashboard');
    }
    if (selectedView === 'bandeja-revisiones-daf' && !puedeBandejaDaf) {
      setSelectedView('dashboard');
    }
  }, [selectedView, puedeEstadisticas, puedeBandejaDaf]);

  // Mantener abierta la sección Estadísticas cuando una de sus vistas está seleccionada
  useEffect(() => {
    if (selectedView === 'estadisticas-daf' || selectedView === 'estadisticas-piloto-pg2') {
      setEstadisticasOpen(true);
    }
  }, [selectedView]);

  // Mantener abierta la sección Libro SIAF cuando se está en rutas SIAF
  useEffect(() => {
    if (isSiafListRoute || isSiafCreateRoute) {
      setLibroSiafOpen(true);
    }
  }, [isSiafListRoute, isSiafCreateRoute]);

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

          {/* Expedientes de Compras */}
          {hasPermission('crear-expediente') && (
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
            >
              <ListItemButton
                onClick={() => navigate('/expedientes')}
                sx={navItemSx(location.pathname === '/expedientes')}
              >
                <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                  <DescriptionIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography fontWeight="600" sx={{ color: 'white' }}>
                      Expedientes de Compras
                    </Typography>
                  }
                />
              </ListItemButton>
            </motion.div>
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

          {/* Estadísticas: solo Análisis SIAF y Análisis de expedientes */}
          {puedeEstadisticas && (
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
                  <ListItemButton
                    onClick={() => setSelectedView('estadisticas-daf')}
                    selected={selectedView === 'estadisticas-daf'}
                    sx={{ ...navItemSx(selectedView === 'estadisticas-daf'), pl: 4, py: 1.2 }}
                  >
                    <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                      <BarChartIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography fontSize="0.9rem" fontWeight="500" sx={{ color: 'white' }}>Análisis SIAF</Typography>}
                      secondary={<Typography variant="caption" sx={{ color: IGSS_COLORS.gris }}>Cierre mensual y motivos</Typography>}
                    />
                  </ListItemButton>
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
                          Análisis de expedientes
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: IGSS_COLORS.gris }}>
                          Cierre mensual y motivos
                        </Typography>
                      }
                    />
                  </ListItemButton>
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
                    description="Actualiza el catálogo de códigos y descripciones desde el Excel oficial"
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
                    title="Análisis SIAF"
                    description="Cierre mensual, pendientes de corrección y motivos de rechazo"
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
                    title="Análisis de expedientes"
                    description="Cierre mensual, pendientes de corrección y motivos de rechazo"
                    icon={<BarChartIcon />}
                    accent={IGSS_COLORS.verdeOscuro}
                    onClick={() => setSelectedView('estadisticas-piloto-pg2')}
                    delay={0.25}
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
          {selectedView === 'estadisticas-daf' && !puedeEstadisticas && (
            <Typography color="text.secondary">No tiene permiso para ver el análisis SIAF.</Typography>
          )}
          {selectedView === 'estadisticas-piloto-pg2' && !puedeEstadisticas && (
            <Typography color="text.secondary">No tiene permiso para ver el análisis de expedientes.</Typography>
          )}
          </Box>
        </AnimatePresence>
      </DashboardBackground>
    </Box>
  );
};
export default CollaboratorDashboard;