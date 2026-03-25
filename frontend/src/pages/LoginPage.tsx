import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, CssBaseline, TextField, FormControlLabel, Checkbox, Link, Grid, Box, Typography, Paper, InputAdornment, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import logoIgss from '../assets/images/logo-igss.png';

import api from '../api';



const theme = createTheme({
  palette: {
    primary: {
      main: '#0066A1',
      light: '#4A9FD8',
    },
    secondary: {
      main: '#00A859',
    },
    background: {
      default: '#f7f9fc',
    },
  },
  typography: {
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 400,
    }
  },
});



function LoginPage() {

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [showDashboardChoice, setShowDashboardChoice] = useState(false);

  const navigate = useNavigate();



  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {

    if (reason === 'clickaway') {

      return;

    }

    setSnackbarOpen(false);

  };



  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    try {

      const response = await api.post('/auth/login', {

        codigoEmpleado: email,

        password: password,

      });



                  const { token, role, roles: rolesList, nombres, apellidos, isTempPassword, permissions } = response.data;

                  localStorage.setItem('token', token);
                  localStorage.setItem('userRole', role ?? '');
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
              perms.includes('crear-siaf') ||
              perms.includes('autorizar-siaf') ||
              perms.includes('revisar-siaf-direccion-departamental') ||
              perms.includes('crear-expediente') ||
              perms.includes('revisar-expediente-direccion-departamental') ||
              rolesArr.includes('revisar-siaf-direccion-departamental');

            if (isTempPassword) {
              navigate('/change-password');
            } else if (canAccessAdmin && canAccessColaborador) {
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
              navigate('/');
            }

    } catch (error: any) {

      // Mejorar el manejo de errores para mostrar mensajes más específicos

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

    }

  };



  return (

    <ThemeProvider theme={theme}>

      <Grid

        container

        component="main"

        sx={{

          height: '100vh',

          background: `linear-gradient(rgba(240, 242, 245, 0.2), rgba(240, 242, 245, 0.2)), url(${process.env.PUBLIC_URL}/images/OficinasCentrales.jpg)`,

          backgroundSize: 'cover',

          backgroundPosition: 'center',

          backgroundRepeat: 'no-repeat',

          display: 'flex', // Ensure flex properties for centering

          alignItems: 'center',

          justifyContent: 'center',

        }}

      >

        <CssBaseline />

        <Paper

          elevation={10} // Stronger shadow for the main container

          sx={{

            display: 'flex',

            borderRadius: 2, // Rounded corners for the main container

            overflow: 'hidden', // Ensures children respect border-radius

            width: '90%', // Increased width

            maxWidth: 1200, // Increased max width

            height: '85%', // Increased height

            maxHeight: 800, // Increased max height

          }}

        >

          <Grid
            item
            xs={false}
            sm={4}
            md={7}
            sx={{
              background: 'linear-gradient(135deg, #0066A1 0%, #004D7A 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              color: 'white',
            }}
          >

            <Box sx={{ textAlign: 'center', zIndex: 1 }}>

              <img src={logoIgss} alt="IGSS Logo" className="logo-pulse" style={{ width: 150, marginBottom: 20 }} />

              <Typography variant="h4" component="h1" gutterBottom>

                SIGEC-IGSS

              </Typography>

              <Typography variant="h6" sx={{ opacity: 0.95 }}>

                Sistema Integral de Gestión de Expedientes de Compras — IGSS

              </Typography>

            </Box>

            <Box

              sx={{

                position: 'absolute',

                top: 0,

                left: 0,

                width: '100%',

                height: '100%',

                backgroundColor: 'rgba(0, 0, 0, 0.1)',

              }}

            />

          </Grid>

          <Grid

            item

            xs={12}

            sm={8}

            md={5}

            sx={{

              borderRadius: 0, // Remove border-radius from inner Grid

              backgroundColor: 'white', // Explicitly set background to white

              display: 'flex',

              flexDirection: 'column',

              justifyContent: 'center',

              alignItems: 'center',

            }}

          >



                      <Box

                        sx={{

                          py: 4, // Changed from my: 8 to py: 4

                          px: 4, // Changed from mx: 4 to px: 4

                          display: 'flex',

                          flexDirection: 'column',

                          alignItems: 'center',

                          flexGrow: 1, // Allow this box to grow and take available space

                          justifyContent: 'center', // Center content vertically within this box

                        }}

                      >

                        <Typography component="h1" variant="h5" sx={{ mb: 3 }}>

                          Iniciar Sesión

                        </Typography>

                        <Box component="form" noValidate sx={{ mt: 1 }} onSubmit={handleSubmit}>

                          <TextField

                            margin="normal"

                            required

                            fullWidth

                            id="email"

                            label="Código de Empleado"

                            name="email"

                            autoComplete="email"

                            autoFocus

                            value={email}

                            onChange={(e) => setEmail(e.target.value)}

                            InputProps={{

                              startAdornment: (

                                <InputAdornment position="start">

                                  <EmailIcon />

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

                            type="password"

                            id="password"

                            autoComplete="current-password"

                            value={password}

                            onChange={(e) => setPassword(e.target.value)}

                            InputProps={{

                              startAdornment: (

                                <InputAdornment position="start">

                                  <LockIcon />

                                </InputAdornment>

                              ),

                            }}

                          />

                          <FormControlLabel

                            control={<Checkbox value="remember" color="primary" />}

                            label="Recordarme"

                          />

                          <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{
                              mt: 3,
                              mb: 2,
                              py: 1.5,
                              background: 'linear-gradient(135deg, #0066A1 0%, #004D7A 100%)',
                              transition: 'all 0.3s ease-in-out',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #004D7A 0%, #0066A1 100%)',
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 20px rgba(0, 102, 161, 0.3)',
                              },
                              '&:active': {
                                transform: 'scale(0.98)',
                                boxShadow: '0 2px 10px rgba(0, 102, 161, 0.2)',
                              },
                            }}
                          >
                            INICIAR SESIÓN
                          </Button>

                          <Grid container justifyContent="flex-end">

                            <Grid item>

                              <Link

                                href="#"

                                variant="body2"

                                sx={{

                                  color: 'primary.main',

                                  textDecoration: 'none',

                                  '&:hover': {

                                    textDecoration: 'underline',

                                    color: 'primary.light',

                                  },

                                }}

                              >

                                ¿Olvidaste tu contraseña?

                              </Link>

                            </Grid>

                          </Grid>

                        </Box>

                      </Box>          </Grid>

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

      <Dialog open={showDashboardChoice} onClose={() => {}} maxWidth="sm" fullWidth>
        <DialogTitle>¿A qué panel deseas entrar?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Tienes permisos de administración y de colaborador. Elige el panel con el que quieres trabajar ahora.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={() => { setShowDashboardChoice(false); navigate('/admin-dashboard'); }}
                sx={{ py: 2, background: 'linear-gradient(135deg, #0066A1 0%, #004D7A 100%)' }}
              >
                Panel de Administración
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                color="success"
                onClick={() => { setShowDashboardChoice(false); navigate('/colaborador-dashboard'); }}
                sx={{ py: 2, background: 'linear-gradient(135deg, #00A859 0%, #008044 100%)' }}
              >
                Panel de Colaborador (Crear / Autorizar SIAF)
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>
    </ThemeProvider>

  );

}



export default LoginPage;