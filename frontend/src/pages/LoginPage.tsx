import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  CssBaseline,
  TextField,
  FormControlLabel,
  Checkbox,
  Link,
  Grid,
  Box,
  Typography,
  Paper,
  InputAdornment,
  Snackbar,
  Alert,
  IconButton,
  Dialog,
  DialogContent,
  Divider,
  Stack,
  CircularProgress,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import DashboardChoicePanel from '../components/DashboardChoicePanel';
import { IGSS_COLORS } from '../theme/institutionalColors';
import logoIgss from '../assets/images/logo-igss.png';
import { hasScreenAccess } from '../config/appScreens';
import api from '../api';

const loginTheme = createTheme({
  palette: {
    primary: {
      main: IGSS_COLORS.azul,
      dark: IGSS_COLORS.azulOscuro,
      light: IGSS_COLORS.azulClaro,
      contrastText: IGSS_COLORS.blanco,
    },
    secondary: {
      main: IGSS_COLORS.verde,
      dark: IGSS_COLORS.verdeOscuro,
      contrastText: IGSS_COLORS.blanco,
    },
    background: {
      default: '#F5F7FA',
    },
    text: {
      primary: IGSS_COLORS.textoOscuro,
      secondary: '#5F6C7B',
    },
  },
  typography: {
    fontFamily: '"Source Sans 3", "Segoe UI", Roboto, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 500, lineHeight: 1.5 },
    button: { fontWeight: 600, letterSpacing: '0.04em' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '&.Mui-focused fieldset': {
              borderColor: IGSS_COLORS.azul,
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontSize: '1rem',
        },
      },
    },
  },
});

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [showDashboardChoice, setShowDashboardChoice] = useState(false);
  const [loggedInUserName, setLoggedInUserName] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryCodigoEmpleado, setRecoveryCodigoEmpleado] = useState('');
  const [recoveryCorreo, setRecoveryCorreo] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  const navigate = useNavigate();

  const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post('/auth/login', {
        codigoEmpleado: email,
        password: password,
      });

      const { token, role, roles: rolesList, nombres, apellidos, isTempPassword, permissions } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('userRole', role ?? '');
      localStorage.setItem('userRoles', JSON.stringify(rolesList ?? (role ? [role] : [])));
      localStorage.setItem('userName', [nombres, apellidos].filter(Boolean).join(' ') || 'Usuario');
      localStorage.setItem('permissions', JSON.stringify(permissions ?? []));

      setSnackbarMessage('Inicio de sesión exitoso.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      const userRole = (role ?? '').toLowerCase();
      const perms = (permissions ?? []) as string[];
      const canAccessAdmin =
        userRole === 'super administrador' ||
        userRole === 'administrador' ||
        perms.includes('gestionar-usuarios') ||
        perms.includes('gestionar-roles');
      const rolesArr = (rolesList ?? []) as string[];
      const canAccessColaborador =
        hasScreenAccess(perms, 'listado-siaf') ||
        hasScreenAccess(perms, 'crear-siaf') ||
        perms.includes('autorizar-siaf') ||
        perms.includes('revisar-siaf-direccion-departamental') ||
        perms.includes('crear-expediente') ||
        perms.includes('revisar-expediente-direccion-departamental') ||
        hasScreenAccess(perms, 'estadisticas-tiempos') ||
        hasScreenAccess(perms, 'estadisticas-motivos') ||
        perms.includes('actualizar-codigos-productos') ||
        rolesArr.includes('revisar-siaf-direccion-departamental');

      if (isTempPassword) {
        navigate('/change-password');
      } else if (canAccessAdmin && canAccessColaborador) {
        setLoggedInUserName([nombres, apellidos].filter(Boolean).join(' ') || 'Usuario');
        setShowDashboardChoice(true);
      } else if (canAccessAdmin) {
        navigate('/admin-dashboard');
      } else if (canAccessColaborador) {
        navigate('/colaborador-dashboard');
      } else if (!canAccessAdmin && !canAccessColaborador) {
        setSnackbarMessage('Tu usuario no tiene permisos para acceder a ningún panel. Contacta al administrador.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      } else {
        navigate('/inicio');
      }
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        setSnackbarMessage('Credenciales incorrectas. Inténtalo de nuevo.');
      } else if (error.response?.data?.detail) {
        setSnackbarMessage(`Error: ${error.response.data.detail}`);
      } else if (error.response?.data?.message) {
        setSnackbarMessage(error.response.data.message);
      } else if (error.code === 'ERR_NETWORK' || !error.response) {
        setSnackbarMessage('No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.');
      } else {
        setSnackbarMessage('Error en el servidor. Por favor, contacta al soporte.');
      }
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      console.error('Login failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordRecovery = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoverySubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', {
        codigoEmpleado: recoveryCodigoEmpleado,
        correoInstitucional: recoveryCorreo,
      });
      setSnackbarMessage(
        `${data.message} Revisa tu correo, cierra este mensaje e inicia sesión desde cero con la contraseña temporal.`,
      );
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setRecoveryOpen(false);
      setRecoveryCodigoEmpleado('');
      setRecoveryCorreo('');
    } catch (error: any) {
      setSnackbarMessage(
        error.response?.data?.message ??
          'No se pudo procesar la solicitud. Verifica los datos e inténtalo nuevamente.',
      );
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setRecoverySubmitting(false);
    }
  };

  return (
    <ThemeProvider theme={loginTheme}>
      <Grid
        container
        component="main"
        sx={{
          minHeight: '100vh',
          background: `linear-gradient(rgba(255, 255, 255, 0.25), rgba(245, 247, 250, 0.4)), url(${process.env.PUBLIC_URL}/images/OficinasCentrales.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <CssBaseline />
        <Paper
          elevation={6}
          sx={{
            display: 'flex',
            borderRadius: 3,
            overflow: 'hidden',
            width: '100%',
            maxWidth: 1100,
            minHeight: { xs: 'auto', sm: 560 },
            border: `1px solid ${IGSS_COLORS.gris}`,
          }}
        >
          {/* Panel institucional */}
          <Grid
            item
            xs={false}
            sm={5}
            md={6}
            sx={{
              bgcolor: IGSS_COLORS.azul,
              display: { xs: 'none', sm: 'flex' },
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: 4,
              py: 5,
              color: IGSS_COLORS.blanco,
              position: 'relative',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 5,
                bgcolor: IGSS_COLORS.verde,
              }}
            />
            <img
              src={logoIgss}
              alt="Logo IGSS"
              className="logo-pulse"
              style={{ width: 130, marginBottom: 24 }}
            />
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: IGSS_COLORS.blanco }}>
              SIGEC-IGSS
            </Typography>
            <Typography
              variant="h6"
              sx={{ textAlign: 'center', maxWidth: 360, color: IGSS_COLORS.gris, fontWeight: 400 }}
            >
              Sistema Integral de Gestión de Expedientes de Compras
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: IGSS_COLORS.gris, letterSpacing: 1 }}>
              Instituto Guatemalteco de Seguridad Social
            </Typography>
          </Grid>

          {/* Formulario */}
          <Grid
            item
            xs={12}
            sm={7}
            md={6}
            sx={{
              bgcolor: IGSS_COLORS.blanco,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                py: { xs: 4, sm: 5 },
                px: { xs: 3, sm: 5 },
                width: '100%',
                maxWidth: 400,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
              }}
            >
              <Typography component="h2" variant="h5" sx={{ mb: 0.5, color: IGSS_COLORS.azul }}>
                Iniciar sesión
              </Typography>
              <Box sx={{ width: 48, height: 3, bgcolor: IGSS_COLORS.verde, borderRadius: 1, mb: 3 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Ingresa tus credenciales institucionales para acceder al sistema.
              </Typography>

              <Box component="form" noValidate onSubmit={handleSubmit}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Código de empleado"
                  name="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <BadgeOutlinedIcon sx={{ color: IGSS_COLORS.azul }} />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon sx={{ color: IGSS_COLORS.azul }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          onClick={() => setShowPassword((prev) => !prev)}
                          onMouseDown={(e) => e.preventDefault()}
                          edge="end"
                          size="small"
                          sx={{ color: IGSS_COLORS.azul }}
                        >
                          {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    // Edge/IE agregan su propio icono de revelar contraseña.
                    '& input::-ms-reveal, & input::-ms-clear': { display: 'none' },
                  }}
                />

                <FormControlLabel
                  control={<Checkbox value="remember" color="primary" size="small" />}
                  label={<Typography variant="body2">Recordarme en este equipo</Typography>}
                  sx={{ mt: 0.5 }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={submitting}
                  sx={{
                    mt: 2,
                    mb: 2,
                    py: 1.4,
                    bgcolor: IGSS_COLORS.azul,
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: IGSS_COLORS.azulOscuro,
                      boxShadow: '0 4px 14px rgba(59, 107, 133, 0.25)',
                    },
                    '&:disabled': {
                      bgcolor: IGSS_COLORS.gris,
                      color: IGSS_COLORS.textoOscuro,
                    },
                  }}
                >
                  {submitting ? 'Ingresando…' : 'Iniciar sesión'}
                </Button>

                <Box sx={{ textAlign: 'right' }}>
                  <Link
                    href="#"
                    variant="body2"
                    onClick={(event) => {
                      event.preventDefault();
                      setRecoveryOpen(true);
                    }}
                    sx={{
                      color: IGSS_COLORS.azul,
                      fontWeight: 500,
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline', color: IGSS_COLORS.azulOscuro },
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Paper>
      </Grid>

      <Snackbar
        key={snackbarMessage}
        open={snackbarOpen}
        autoHideDuration={8000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }} elevation={6}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <Dialog
        open={recoveryOpen}
        onClose={() => !recoverySubmitting && setRecoveryOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            border: `1px solid ${IGSS_COLORS.gris}`,
            boxShadow: '0 18px 48px rgba(50, 90, 114, 0.22)',
          },
        }}
      >
        <Box component="form" onSubmit={handlePasswordRecovery}>
          <Box
            sx={{
              position: 'relative',
              bgcolor: IGSS_COLORS.azul,
              color: IGSS_COLORS.blanco,
              px: 3,
              pt: 3,
              pb: 2.5,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 4,
                bgcolor: IGSS_COLORS.verde,
              }}
            />
            <IconButton
              aria-label="Cerrar"
              onClick={() => setRecoveryOpen(false)}
              disabled={recoverySubmitting}
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                color: IGSS_COLORS.blanco,
                bgcolor: 'rgba(255,255,255,0.12)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
              }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>

            <Stack direction="row" spacing={2} alignItems="center" sx={{ pr: 5 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MarkEmailReadOutlinedIcon sx={{ fontSize: 30 }} />
              </Box>
              <Box>
                <Typography variant="overline" sx={{ letterSpacing: 1.2, opacity: 0.85, lineHeight: 1 }}>
                  Acceso seguro
                </Typography>
                <Typography variant="h5" sx={{ color: IGSS_COLORS.blanco, mt: 0.4 }}>
                  Recuperar contraseña
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.6, color: IGSS_COLORS.gris, maxWidth: 390 }}>
                  Solicita aquí la temporal; luego inicia sesión desde la pantalla principal.
                </Typography>
              </Box>
            </Stack>
          </Box>

          <DialogContent sx={{ px: 3, pt: 3, pb: 1.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mb: 2.5 }}>
              {[
                { step: '1', label: 'Solicitar aquí' },
                { step: '2', label: 'Revisar tu correo' },
                { step: '3', label: 'Ingresar desde el login' },
              ].map((item) => (
                <Box
                  key={item.step}
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.2,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: IGSS_COLORS.fondoClaro,
                    border: `1px solid ${IGSS_COLORS.gris}`,
                  }}
                >
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: IGSS_COLORS.azul,
                      color: IGSS_COLORS.blanco,
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.step}
                  </Box>
                  <Typography variant="caption" sx={{ color: IGSS_COLORS.textoOscuro, fontWeight: 600 }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              En esta ventana solo confirmas tu identidad. Después cierras, revisas tu correo institucional
              y vuelves a iniciar sesión desde cero con la contraseña temporal. El sistema te pedirá
              crear una nueva.
            </Typography>

            <TextField
              autoFocus
              required
              fullWidth
              margin="normal"
              label="Código de empleado"
              value={recoveryCodigoEmpleado}
              onChange={(event) => setRecoveryCodigoEmpleado(event.target.value)}
              autoComplete="username"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BadgeOutlinedIcon sx={{ color: IGSS_COLORS.azul }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              required
              fullWidth
              margin="normal"
              label="Correo institucional registrado"
              type="email"
              value={recoveryCorreo}
              onChange={(event) => setRecoveryCorreo(event.target.value)}
              autoComplete="email"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlinedIcon sx={{ color: IGSS_COLORS.azul }} />
                  </InputAdornment>
                ),
              }}
            />

            <Alert
              severity="info"
              icon={<ShieldOutlinedIcon fontSize="inherit" />}
              sx={{
                mt: 2,
                mb: 1,
                borderRadius: 2,
                bgcolor: 'rgba(59, 107, 133, 0.08)',
                color: IGSS_COLORS.textoOscuro,
                border: `1px solid rgba(59, 107, 133, 0.18)`,
                '& .MuiAlert-icon': { color: IGSS_COLORS.azul },
              }}
            >
              No ingreses la contraseña temporal aquí. Úsala en la pantalla principal de inicio de sesión;
              luego el sistema te solicitará cambiarla.
            </Alert>
          </DialogContent>

          <Divider />

          <Box
            sx={{
              px: 3,
              py: 2.2,
              display: 'flex',
              gap: 1.5,
              justifyContent: 'flex-end',
              bgcolor: IGSS_COLORS.fondo,
            }}
          >
            <Button
              onClick={() => setRecoveryOpen(false)}
              disabled={recoverySubmitting}
              variant="outlined"
              sx={{
                borderColor: IGSS_COLORS.grisOscuro,
                color: IGSS_COLORS.azul,
                px: 2.2,
                '&:hover': {
                  borderColor: IGSS_COLORS.azul,
                  bgcolor: 'rgba(59, 107, 133, 0.06)',
                },
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={recoverySubmitting}
              endIcon={
                recoverySubmitting
                  ? <CircularProgress size={16} color="inherit" />
                  : <ArrowForwardRoundedIcon />
              }
              sx={{
                px: 2.4,
                bgcolor: IGSS_COLORS.azul,
                boxShadow: '0 6px 16px rgba(59, 107, 133, 0.28)',
                '&:hover': {
                  bgcolor: IGSS_COLORS.azulOscuro,
                  boxShadow: '0 8px 20px rgba(50, 90, 114, 0.32)',
                },
              }}
            >
              {recoverySubmitting ? 'Enviando…' : 'Enviar contraseña temporal'}
            </Button>
          </Box>
        </Box>
      </Dialog>

      <DashboardChoicePanel
        variant="dialog"
        open={showDashboardChoice}
        userName={loggedInUserName}
        onSelectAdmin={() => { setShowDashboardChoice(false); navigate('/admin-dashboard'); }}
        onSelectColaborador={() => { setShowDashboardChoice(false); navigate('/colaborador-dashboard'); }}
      />
    </ThemeProvider>
  );
}

export default LoginPage;
