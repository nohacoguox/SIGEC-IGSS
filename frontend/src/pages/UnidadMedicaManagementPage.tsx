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
  TextField,
  InputAdornment,
} from '@mui/material';
import { Add, Edit, Delete, Search, Clear } from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../api';
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
  codigo?: string | null;
  direccion?: string | null;
  departamento: string | null;
  telefonos?: string;
  municipio?: Municipio | null;
}

const emptyForm = {
  nombre: '',
  codigo: '',
  direccion: '',
  telefonos: '',
  departamentoId: '' as number | '',
  municipioId: '' as number | '',
};

const normalizar = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const UnidadMedicaManagementPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [unidades, setUnidades] = useState<UnidadMedica[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUnidad, setEditingUnidad] = useState<UnidadMedica | null>(null);
  const [formData, setFormData] = useState(emptyForm);
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
    if (formData.departamentoId !== '') {
      fetchMunicipios(Number(formData.departamentoId));
    } else {
      setMunicipios([]);
    }
  }, [formData.departamentoId]);

  const municipiosByDepto = useMemo(() => {
    if (!formData.departamentoId) return [];
    return municipios.filter((m) => m.departamento?.id === formData.departamentoId);
  }, [municipios, formData.departamentoId]);

  const unidadesFiltradas = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return unidades;
    return unidades.filter((u) => {
      const depto = u.departamento ?? u.municipio?.departamento?.nombre ?? '';
      const muni = u.municipio?.nombre ?? '';
      const haystack = normalizar(
        [u.codigo, u.nombre, u.direccion, depto, muni, u.telefonos].filter(Boolean).join(' ')
      );
      return haystack.includes(q);
    });
  }, [unidades, busqueda]);

  const handleOpenDialog = (unidad?: UnidadMedica) => {
    if (unidad) {
      setEditingUnidad(unidad);
      const deptoId = unidad.municipio?.departamento?.id ?? '';
      setFormData({
        nombre: unidad.nombre || '',
        codigo: unidad.codigo || '',
        direccion: unidad.direccion || '',
        telefonos: unidad.telefonos || '',
        departamentoId: deptoId,
        municipioId: unidad.municipio?.id ?? '',
      });
      if (deptoId) fetchMunicipios(Number(deptoId));
      else setMunicipios([]);
    } else {
      setEditingUnidad(null);
      setFormData(emptyForm);
      setMunicipios([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUnidad(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    const nombre = formData.nombre.trim();
    if (!nombre) {
      showError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre,
        codigo: formData.codigo.trim() || null,
        direccion: formData.direccion.trim() || null,
        telefonos: formData.telefonos.trim() || '',
        municipioId: formData.municipioId === '' ? null : formData.municipioId,
      };
      if (editingUnidad) {
        await api.put(`/unidades-medicas/${editingUnidad.id}`, payload);
        showSuccess('Unidad médica actualizada correctamente.');
      } else {
        await api.post('/unidades-medicas', payload);
        showSuccess('Unidad médica creada correctamente.');
      }
      fetchUnidades();
      handleCloseDialog();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (unidad: UnidadMedica) => {
    if (!window.confirm(`¿Eliminar la unidad «${unidad.nombre}»?`)) return;
    try {
      await api.delete(`/unidades-medicas/${unidad.id}`);
      showSuccess('Unidad médica eliminada.');
      fetchUnidades();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Error al eliminar');
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            Gestión de Unidades Médicas
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Cree, edite o elimine unidades. Incluya código de identificación, dirección y ubicación (departamento/municipio).
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>
          Nueva unidad
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Si aún no hay departamentos/municipios, ejecute:{' '}
        <code>npm run seed-departamentos-municipios</code>
      </Alert>

      <TextField
        fullWidth
        size="small"
        placeholder="Buscar por código, nombre, dirección, departamento o municipio…"
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
      {busqueda.trim() && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {unidadesFiltradas.length} de {unidades.length} unidad(es)
        </Typography>
      )}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Código</strong></TableCell>
                <TableCell><strong>Nombre</strong></TableCell>
                <TableCell><strong>Dirección</strong></TableCell>
                <TableCell><strong>Departamento</strong></TableCell>
                <TableCell><strong>Municipio</strong></TableCell>
                <TableCell align="right"><strong>Acciones</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unidades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" py={3}>
                      No hay unidades médicas. Use «Nueva unidad» para agregar una.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : unidadesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" py={3}>
                      Ninguna unidad coincide con «{busqueda.trim()}».
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                unidadesFiltradas.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.codigo || '—'}</TableCell>
                    <TableCell>{u.nombre}</TableCell>
                    <TableCell sx={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.direccion || undefined}>
                      {u.direccion || '—'}
                    </TableCell>
                    <TableCell>{u.departamento ?? u.municipio?.departamento?.nombre ?? '—'}</TableCell>
                    <TableCell>{u.municipio?.nombre ?? '—'}</TableCell>
                    <TableCell align="right">
                      <IconButton color="primary" size="small" onClick={() => handleOpenDialog(u)} title="Editar">
                        <Edit />
                      </IconButton>
                      <IconButton color="error" size="small" onClick={() => handleDelete(u)} title="Eliminar">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUnidad ? 'Editar unidad médica' : 'Nueva unidad médica'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Código de identificación"
              fullWidth
              value={formData.codigo}
              onChange={(e) => setFormData((f) => ({ ...f, codigo: e.target.value }))}
              placeholder="Ej. 210"
              helperText="Opcional. Identificador institucional de la unidad."
            />
            <TextField
              label="Nombre *"
              fullWidth
              required
              value={formData.nombre}
              onChange={(e) => setFormData((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej. Consultorio Palín"
            />
            <TextField
              label="Dirección"
              fullWidth
              multiline
              minRows={2}
              maxRows={5}
              value={formData.direccion}
              onChange={(e) => setFormData((f) => ({ ...f, direccion: e.target.value }))}
              placeholder="Dirección completa de la unidad"
            />
            <TextField
              label="Teléfonos"
              fullWidth
              value={formData.telefonos}
              onChange={(e) => setFormData((f) => ({ ...f, telefonos: e.target.value }))}
              placeholder="Opcional"
            />
            <FormControl fullWidth>
              <InputLabel id="depto-label">Departamento</InputLabel>
              <Select
                labelId="depto-label"
                value={formData.departamentoId}
                label="Departamento"
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    departamentoId: e.target.value === '' ? '' : Number(e.target.value),
                    municipioId: '',
                  }))
                }
              >
                <MenuItem value="">Ninguno</MenuItem>
                {departamentos.map((d) => (
                  <MenuItem key={d.id} value={d.id}>{d.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="muni-label">Municipio</InputLabel>
              <Select
                labelId="muni-label"
                value={formData.municipioId}
                label="Municipio"
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    municipioId: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
                disabled={!formData.departamentoId}
              >
                <MenuItem value="">Ninguno</MenuItem>
                {(formData.departamentoId ? municipiosByDepto : municipios).map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
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
