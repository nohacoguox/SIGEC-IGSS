import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AdminDashboard from './pages/AdminDashboard';
import CollaboratorDashboard from './pages/CollaboratorDashboard';
import ActualizarCodigosProductosPage from './pages/ActualizarCodigosProductosPage';
import SiafManagement from './pages/SiafManagement';
import ExpedientesPage from './pages/ExpedientesPage';
import { SiafProvider } from './context/SiafContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import SiafBook from './components/SiafBook';
import PrivateRoute from './components/PrivateRoute';
import HomeRedirect from './components/HomeRedirect';

function App() {
  return (
    <ThemeProvider>
      <CssBaseline />
      <NotificationProvider>
      <Router>
        <SiafProvider>
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Ruta para cambio de contraseña, podría ser semi-privada, pero la dejamos accesible
                ya que el backend debe validar el token de cambio de contraseña si lo hubiera. */}
            <Route path="/change-password" element={<ChangePasswordPage />} />

            {/* Rutas Privadas */}
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              <Route path="/colaborador-dashboard" element={<CollaboratorDashboard />} />
              <Route path="/actualizar-codigos-productos" element={<ActualizarCodigosProductosPage />} />
              <Route path="/siaf-book" element={<SiafManagement />} />
              <Route path="/siaf-book/crear" element={<SiafBook />} />
              <Route path="/siaf-book/corregir/:id" element={<SiafBook />} />
              <Route path="/expedientes" element={<ExpedientesPage />} />
            </Route>

            {/* Redirección por defecto para cualquier ruta no encontrada */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </SiafProvider>
      </Router>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
