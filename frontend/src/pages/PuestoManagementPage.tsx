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

interface Puesto {
  id: number;
  nombre: string;
  activo: boolean;
}

const PuestoManagementPage: React.FC = () => {
  const { mode } = useThemeMode();
  const { showSuccess, showError } = useNotification();
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPuesto, setEditingPuesto] = useState<Puesto | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    activo: true,
  });

  useEffect(() => {
    fetchPuestos();
  }, []);

  const fetchPuestos = async () => {
    try {
      const response = await api.get('/puestos/all');
      setPuestos(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching puestos:', error);
      setLoading(false);
    }
  };

  const handleOpenDialog = (puesto?: Puesto) => {
    if (puesto) {
      setEditingPuesto(puesto);
      setFormData({
        nombre: puesto.nombre,
        activo: puesto.activo,
      });
    } else {
      setEditingPuesto(null);
      setFormData({
        nombre: '',
        activo: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingPuesto(null);
    setFormData({
      nombre: '',
      activo: true,
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingPuesto) {
        await api.put(`/puestos/${editingPuesto.id}`, formData);
        showSuccess('Puesto actualizado correctamente');
      } else {
        await api.post('/puestos', formData);
        showSuccess('Puesto creado correctamente');
      }
      fetchPuestos();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving puesto:', error);
      showError(error.response?.data?.message || 'Error al guardar el puesto');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de eliminar este puesto?')) {
      try {
        await api.delete(`/puestos/${id}`);
        showSuccess('Puesto eliminado correctamente');
        fetchPuestos();
      } catch (error: any) {
        console.error('Error deleting puesto:', error);
        showError(error.response?.data?.message || 'Error al eliminar el puesto');
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Lista de Puestos ({puestos.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: mode !== 'dark'
              ? 'linear-gradient(135deg, #00A859 0%, #008044 100%)'
              : 'linear-gradient(135deg, #2FA86B 0%, #1E6B47 100%)',
          }}
        >
          Nuevo Puesto
        </Button>
      </Box>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <TableContainer component={Paper} elevation={3} sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: mode !== 'dark' ? '#f5f5f5' : '#2a2a2a' }}>
                  <strong>Nombre del Puesto</strong>
                </TableCell>
                <TableCell align="center" sx={{ bgcolor: mode !== 'dark' ? '#f5f5f5' : '#2a2a2a' }}>
                  <strong>Estado</strong>
                </TableCell>
                <TableCell align="center" sx={{ bgcolor: mode !== 'dark' ? '#f5f5f5' : '#2a2a2a' }}>
                  <strong>Acciones</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {puestos.map((puesto) => (
                <TableRow key={puesto.id} hover>
                  <TableCell>{puesto.nombre}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={puesto.activo ? 'Activo' : 'Inactivo'}
                      color={puesto.activo ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      color="primary"
                      onClick={() => handleOpenDialog(puesto)}
                      size="small"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDelete(puesto.id)}
                      size="small"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {puestos.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <Typography color="text.secondary">
                      No hay puestos registrados
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
          {editingPuesto ? 'Editar Puesto' : 'Nuevo Puesto'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nombre del Puesto"
              fullWidth
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
              helperText="Ingrese el nombre completo del puesto"
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
            {editingPuesto ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PuestoManagementPage;
