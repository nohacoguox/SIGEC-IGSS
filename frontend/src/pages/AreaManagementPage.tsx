import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../api';
import { useThemeMode } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';

interface Area {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

const AreaManagementPage: React.FC = () => {
  const { mode } = useThemeMode();
  const { showSuccess, showError } = useNotification();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    activo: true,
  });

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const response = await api.get('/areas');
      setAreas(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching areas:', error);
      setLoading(false);
    }
  };

  const handleOpenDialog = (area?: Area) => {
    if (area) {
      setEditingArea(area);
      setFormData({
        nombre: area.nombre,
        descripcion: area.descripcion || '',
        activo: area.activo,
      });
    } else {
      setEditingArea(null);
      setFormData({
        nombre: '',
        descripcion: '',
        activo: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingArea(null);
    setFormData({
      nombre: '',
      descripcion: '',
      activo: true,
    });
  };

  const handleSubmit = async () => {
    const nombre = formData.nombre.trim();
    if (!nombre) {
      showError('El nombre del área es obligatorio.');
      return;
    }
    if (nombre.length > 200) {
      showError('El nombre del área no puede superar 200 caracteres.');
      return;
    }
    const payload = {
      nombre,
      descripcion: formData.descripcion.trim() || '',
      activo: formData.activo,
    };
    try {
      if (editingArea) {
        await api.put(`/areas/${editingArea.id}`, payload);
        showSuccess('Área actualizada correctamente');
      } else {
        await api.post('/areas', payload);
        showSuccess('Área creada correctamente');
      }
      fetchAreas();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving area:', error);
      showError(error.response?.data?.message || 'Error al guardar el área');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de eliminar esta área?')) {
      try {
        await api.delete(`/areas/${id}`);
        showSuccess('Área eliminada correctamente');
        fetchAreas();
      } catch (error: any) {
        console.error('Error deleting area:', error);
        showError(error.response?.data?.message || 'Error al eliminar el área');
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Lista de Áreas
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: mode !== 'dark'
              ? 'linear-gradient(135deg, #0066A1 0%, #004D7A 100%)'
              : 'linear-gradient(135deg, #2E7FB0 0%, #1E5A7A 100%)',
          }}
        >
          Nueva Área
        </Button>
      </Box>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: mode !== 'dark' ? '#f5f5f5' : '#2a2a2a' }}>
                <TableCell><strong>Nombre</strong></TableCell>
                <TableCell><strong>Descripción</strong></TableCell>
                <TableCell align="center"><strong>Estado</strong></TableCell>
                <TableCell align="center"><strong>Acciones</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {areas.map((area) => (
                <TableRow key={area.id} hover>
                  <TableCell>{area.nombre}</TableCell>
                  <TableCell>{area.descripcion || '-'}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={area.activo ? 'Activo' : 'Inactivo'}
                      color={area.activo ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      color="primary"
                      onClick={() => handleOpenDialog(area)}
                      size="small"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDelete(area.id)}
                      size="small"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {areas.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography color="text.secondary">
                      No hay áreas registradas
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Dialog para crear/editar */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingArea ? 'Editar Área' : 'Nueva Área'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nombre del Área"
              fullWidth
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
              helperText="Máximo 200 caracteres. No se permiten nombres duplicados."
              inputProps={{ maxLength: 200 }}
            />
            <TextField
              label="Descripción"
              fullWidth
              multiline
              rows={3}
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                />
              }
              label="Activo"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.nombre.trim()}
          >
            {editingArea ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AreaManagementPage;
