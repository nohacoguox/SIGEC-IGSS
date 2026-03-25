import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, CssBaseline, TextField, Grid, Box, Typography, Paper, Snackbar, Alert } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import LockIcon from '@mui/icons-material/Lock';
import api from '../api';

const PASSWORD_RULES = {
  minLength: 8,
  hasUpper: /[A-Z]/,
  hasNumber: /[0-9]/,
  hasSymbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
};

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < PASSWORD_RULES.minLength) {
    return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  if (!PASSWORD_RULES.hasUpper.test(password)) {
    return { valid: false, message: 'La contraseña debe incluir al menos una letra mayúscula.' };
  }
  if (!PASSWORD_RULES.hasNumber.test(password)) {
    return { valid: false, message: 'La contraseña debe incluir al menos un número.' };
  }
  if (!PASSWORD_RULES.hasSymbol.test(password)) {
    return { valid: false, message: 'La contraseña debe incluir al menos un símbolo (ej. ! @ # $ %).' };
  }
  return { valid: true };
}

const PASSWORD_EXAMPLE = 'Ejemplo: MiClave123!';

const theme = createTheme({
  palette: {
    primary: {
      main: '#005f9e',
      light: '#0077c2',
    },
    secondary: {
      main: '#4caf50',
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
  },
});

function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const navigate = useNavigate();

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setSnackbarMessage('Las contraseñas nuevas no coinciden.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setSnackbarMessage(validation.message ?? 'La contraseña no cumple los requisitos.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
      });

      setSnackbarMessage('Contraseña cambiada exitosamente. Serás redirigido.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      setTimeout(() => {
        const userRole = localStorage.getItem('userRole') ?? '';
        let permissions: string[] = [];
        try {
          const stored = localStorage.getItem('permissions');
          if (stored) permissions = JSON.parse(stored);
        } catch {}
        const isAdmin = userRole === 'super administrador' || userRole === 'administrador';
        const isColaborador =
          userRole === 'colaborador' ||
          permissions.includes('crear-siaf') ||
          permissions.includes('autorizar-siaf') ||
          permissions.includes('crear-expediente') ||
          permissions.includes('revisar-expediente-direccion-departamental');
        if (isAdmin) navigate('/admin-dashboard');
        else if (isColaborador) navigate('/colaborador-dashboard');
        else navigate('/');
      }, 2000);
    } catch (error: any) {
      const msg = error.response?.data?.message;
      setSnackbarMessage(msg || 'Error al cambiar la contraseña. Inténtalo de nuevo.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      console.error('Password change failed:', error);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Grid
        container
        component="main"
        sx={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <CssBaseline />
        <Paper
          elevation={10}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 4,
            borderRadius: 2,
            width: '100%',
            maxWidth: 500,
          }}
        >
          <Avatar sx={{ m: 1, bgcolor: 'primary.main' }}>
            <LockIcon />
          </Avatar>
          <Typography component="h1" variant="h5">
            Cambiar Contraseña
          </Typography>
          <Box component="form" noValidate sx={{ mt: 3 }} onSubmit={handleSubmit}>
            <Typography variant="body2" align="center" sx={{ mb: 2 }}>
              Por tu seguridad, es necesario que cambies tu contraseña temporal.
            </Typography>
            <Typography variant="caption" display="block" sx={{ mb: 1, color: 'text.secondary' }}>
              La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo.
            </Typography>
            <Typography variant="caption" display="block" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
              {PASSWORD_EXAMPLE}
            </Typography>
            <TextField
              margin="normal"
              required
              fullWidth
              name="oldPassword"
              label="Contraseña Antigua"
              type="password"
              id="oldPassword"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="newPassword"
              label="Nueva Contraseña"
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="Mín. 8 caracteres, mayúscula, número y símbolo"
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirmar Nueva Contraseña"
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Cambiar Contraseña
            </Button>
          </Box>
        </Paper>
      </Grid>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default ChangePasswordPage;
