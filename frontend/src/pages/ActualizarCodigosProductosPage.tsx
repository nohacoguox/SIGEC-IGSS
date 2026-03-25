// Página para actualizar el catálogo de códigos y descripciones desde un Excel (rol: actualizar-codigos-productos)
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../api';
import { useThemeMode } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';

const ActualizarCodigosProductosPage: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const { showSuccess, showError } = useNotification();
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<{ total: number; ultimaActualizacion: string | null } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const inputFileRef = React.useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/catalogo-productos/stats');
      setStats({ total: res.data.total, ultimaActualizacion: res.data.ultimaActualizacion ?? null });
    } catch {
      setStats({ total: 0, ultimaActualizacion: null });
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('archivo', file);
    setUploading(true);
    try {
      const res = await api.post('/catalogo-productos/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSuccess(res.data?.message || `Catálogo actualizado: ${res.data?.total ?? 0} registros.`);
      await loadStats();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error al importar el archivo.';
      showError(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
      if (inputFileRef.current) inputFileRef.current.value = '';
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 720, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/colaborador-dashboard')} sx={{ mb: 2 }}>
        Volver al panel
      </Button>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Actualización de Códigos y Productos
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Suba el archivo Excel con el catálogo emitido por la entidad. La primera fila debe contener los encabezados
        &quot;Código&quot; y &quot;Descripción&quot;. Al guardar, el catálogo se reemplazará y los códigos estarán disponibles
        en el formulario de Detalle de Bienes o Servicios del Libro SIAF.
      </Typography>

      {loadingStats ? (
        <CircularProgress size={24} sx={{ mb: 2 }} />
      ) : stats !== null && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Registros en catálogo: <strong>{stats.total}</strong>
          {stats.ultimaActualizacion && (
            <> · Última actualización: {new Date(stats.ultimaActualizacion).toLocaleString('es-GT')}</>
          )}
        </Alert>
      )}

      <Card
        elevation={2}
        sx={{
          borderRadius: 2,
          border: '2px dashed',
          borderColor: mode !== 'dark' ? 'grey.300' : 'grey.600',
          bgcolor: mode !== 'dark' ? 'grey.50' : 'grey.900',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <input
            ref={inputFileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <Button
            variant="contained"
            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
            disabled={uploading}
            onClick={() => inputFileRef.current?.click()}
            fullWidth
            sx={{ py: 2 }}
          >
            {uploading ? 'Importando...' : 'Seleccionar archivo Excel'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ActualizarCodigosProductosPage;
