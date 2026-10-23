import React, { useState, useEffect, useMemo } from 'react';
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
  InputAdornment,
} from '@mui/material';
import { Add, Edit, Delete, Search, Clear } from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../api';
import { useNotification } from '../context/NotificationContext';

interface Puesto {
  id: number;
  nombre: string;
  activo: boolean;
}

const PuestoManagementPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPuesto, setEditingPuesto] = useState<Puesto | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    activo: true,
  });

  const puestosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return puestos;
    return puestos.filter((puesto) => puesto.nombre.toLowerCase().includes(q));
  }, [puestos, busqueda]);

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight="bold">
          Lista de Puestos ({busqueda.trim() ? `${puestosFiltrados.length} de ${puestos.length}` : puestos.length})
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Puesto
        </Button>
      </Box>

      <TextField
        fullWidth
        size="small"
        placeholder="Buscar por nombre del puesto…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        sx={{ mb: 2, maxWidth: 520 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" color="action" />
            </InputAdornment>
          ),
          endAdornment: busqueda ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Limpiar búsqueda" onClick={() => setBusqueda('')}>
                <Clear fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <TableContainer component={Paper} elevation={3} sx={{ maxHeight: 600, overflowX: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>Nombre del Puesto</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Estado</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Acciones</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {puestosFiltrados.map((puesto) => (
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
              {puestosFiltrados.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <Typography color="text.secondary">
                      {busqueda.trim()
                        ? 'No se encontraron puestos con esa búsqueda'
                        : 'No hay puestos registrados'}
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
