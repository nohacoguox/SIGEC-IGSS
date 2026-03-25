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
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Edit } from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../api';
import { useThemeMode } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';

interface Departamento {
  id: number;
  nombre: string;
}

interface Municipio {
  id: number;
  nombre: string;
  departamento?: Departamento;
}

interface UnidadMedica {
  id: number;
  nombre: string;
  departamento: string | null;
  telefonos?: string;
  municipio?: Municipio | null;
}

const UnidadMedicaManagementPage: React.FC = () => {
  const { mode } = useThemeMode();
  const { showSuccess, showError } = useNotification();
  const [unidades, setUnidades] = useState<UnidadMedica[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUnidad, setEditingUnidad] = useState<UnidadMedica | null>(null);
  const [departamentoId, setDepartamentoId] = useState<number | ''>('');
  const [municipioId, setMunicipioId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const fetchUnidades = async () => {
    try {
      const res = await api.get('/unidades-medicas');
      setUnidades(res.data || []);
    } catch (err) {
      console.error('Error al cargar unidades médicas:', err);
      showError('Error al cargar unidades médicas');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartamentos = async () => {
    try {
      const res = await api.get('/departamentos');
      setDepartamentos(res.data || []);
    } catch (err) {
      console.error('Error al cargar departamentos:', err);
    }
  };

  const fetchMunicipios = async (deptoId?: number) => {
    try {
      const url = deptoId ? `/municipios?departamentoId=${deptoId}` : '/municipios';
      const res = await api.get(url);
      setMunicipios(res.data || []);
    } catch (err) {
      console.error('Error al cargar municipios:', err);
    }
  };

  useEffect(() => {
    fetchUnidades();
    fetchDepartamentos();
  }, []);

  useEffect(() => {
    if (departamentoId !== '') {
      fetchMunicipios(departamentoId);
    } else {
      setMunicipios([]);
    }
    setMunicipioId('');
  }, [departamentoId]);

  const municipiosByDepto = useMemo(() => {
    if (!departamentoId) return [];
    return municipios.filter((m) => !departamentoId || m.departamento?.id === departamentoId);
  }, [municipios, departamentoId]);

  const handleOpenDialog = (unidad: UnidadMedica) => {
    setEditingUnidad(unidad);
    const deptoId = unidad.municipio?.departamento?.id ?? '';
    setDepartamentoId(deptoId);
    setMunicipioId(unidad.municipio?.id ?? '');
    setOpenDialog(true);
    if (deptoId) fetchMunicipios(Number(deptoId));
    else setMunicipios([]);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUnidad(null);
    setDepartamentoId('');
    setMunicipioId('');
  };

  const handleSave = async () => {
    if (!editingUnidad) return;
    setSaving(true);
    try {
      await api.put(`/unidades-medicas/${editingUnidad.id}`, {
        municipioId: municipioId === '' ? null : municipioId,
      });
      showSuccess('Unidad médica actualizada. Departamento/municipio asociado correctamente.');
      fetchUnidades();
      handleCloseDialog();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Gestión de Unidades Médicas
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Asocie cada unidad médica a un departamento y municipio. Así, el usuario de Dirección Departamental verá los SIAFs de todas las unidades de su departamento.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Primero ejecute el seed de departamentos y municipios si no lo ha hecho:{' '}
        <code>npm run seed-departamentos-municipios</code>
      </Alert>

      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Nombre</strong></TableCell>
              <TableCell><strong>Departamento</strong></TableCell>
              <TableCell><strong>Municipio</strong></TableCell>
              <TableCell align="right"><strong>Acciones</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {unidades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography color="text.secondary" py={3}>No hay unidades médicas cargadas.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              unidades.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.nombre}</TableCell>
                  <TableCell>{u.departamento ?? u.municipio?.departamento?.nombre ?? '—'}</TableCell>
                  <TableCell>{u.municipio?.nombre ?? '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton color="primary" onClick={() => handleOpenDialog(u)} title="Asignar departamento/municipio">
                      <Edit />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Asignar departamento y municipio</DialogTitle>
        <DialogContent>
          {editingUnidad && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Unidad: <strong>{editingUnidad.nombre}</strong>
            </Typography>
          )}
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel id="depto-label">Departamento</InputLabel>
            <Select
              labelId="depto-label"
              value={departamentoId}
              label="Departamento"
              onChange={(e) => setDepartamentoId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <MenuItem value="">Ninguno</MenuItem>
              {departamentos.map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="muni-label">Municipio</InputLabel>
            <Select
              labelId="muni-label"
              value={municipioId}
              label="Municipio"
              onChange={(e) => setMunicipioId(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!departamentoId}
            >
              <MenuItem value="">Ninguno</MenuItem>
              {(departamentoId ? municipiosByDepto : municipios).map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UnidadMedicaManagementPage;
