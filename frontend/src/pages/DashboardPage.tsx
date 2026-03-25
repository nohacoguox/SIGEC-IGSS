import React from 'react';
import { AppBar, Toolbar, Typography, Container, Grid, Paper, Box } from '@mui/material';

function DashboardPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            SIGEC-IGSS
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Container component="main" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Bienvenido a SIGEC-IGSS
        </Typography>
        <Typography variant="body1" gutterBottom>
          Una solución moderna para la gestión de trámites y servicios del IGSS.
        </Typography>
        
        <Grid container spacing={3} sx={{ mt: 3 }}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>Trámites Frecuentes</Typography>
              <Typography>Aquí se mostrará una lista de los trámites más comunes que los usuarios pueden realizar.</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>Noticias y Anuncios</Typography>
              <Typography>Aquí se mostrarán las últimas noticias y anuncios importantes del IGSS.</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          backgroundColor: (theme) =>
            theme.palette.mode === 'light' ? theme.palette.grey[200] : theme.palette.grey[800],
        }}
      >
        <Container maxWidth="sm">
          <Typography variant="body1" align="center">
            © {new Date().getFullYear()} Instituto Guatemalteco de Seguridad Social (IGSS)
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

export default DashboardPage;