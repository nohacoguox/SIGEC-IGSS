import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Grid,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import NumbersIcon from '@mui/icons-material/Numbers';
import api from '../api';
import { useNotification } from '../context/NotificationContext';
import { IGSS_COLORS } from '../theme/institutionalColors';

interface ReservaEnUso {
  reservaId: number;
  numero: number;
  correlativo: string;
  usuarioId: number;
  usuarioNombre: string;
  reservadoEn: string;
  expiraEn: string;
}

interface EstadoCorrelativos {
  siguienteNumero: number;
  numeroInicio: number;
  digitos: number;
  minutosReserva: number;
  correlativoSiguientePreview: string;
  ultimoUsado: { correlativo: string; numero: number | null } | null;
  enUso: ReservaEnUso[];
  totalReservasActivas: number;
}

const CorrelativoManagementPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [estado, setEstado] = useState<EstadoCorrelativos | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numeroInicio, setNumeroInicio] = useState('1');
  const [siguienteNumero, setSiguienteNumero] = useState('1');
  const [digitos, setDigitos] = useState('0');
  const [minutosReserva, setMinutosReserva] = useState('120');
  const [loadError, setLoadError] = useState('');

  const loadEstado = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/correlativos/estado');
      const data: EstadoCorrelativos = res.data;
      setEstado(data);
      setNumeroInicio(String(data.numeroInicio));
      setSiguienteNumero(String(data.siguienteNumero));
      setDigitos(String(data.digitos));
      setMinutosReserva(String(data.minutosReserva));
      setLoadError('');
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.message;
      let msg = apiMsg || 'Error al cargar correlativos';
      if (status === 404) {
        msg = 'El backend no tiene el módulo de correlativos. Reinicie el backend (cierre npm start e inicie de nuevo).';
      } else if (status === 403) {
        msg = 'No tiene permiso para gestionar correlativos. Cierre sesión y vuelva a entrar.';
      } else if (apiMsg && /does not exist|relation|tabla/i.test(apiMsg)) {
        msg = `${apiMsg} Reinicie el backend para crear las tablas.`;
      } else if (!err?.response) {
        msg = 'No se pudo conectar con el backend (puerto 3001). Verifique que esté en ejecución.';
      }
      setLoadError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadEstado();
  }, [loadEstado]);

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const res = await api.put('/correlativos/config', {
        numeroInicio: Number(numeroInicio),
        siguienteNumero: Number(siguienteNumero),
        digitos: Number(digitos),
        minutosReserva: Number(minutosReserva),
      });
      setEstado(res.data.estado);
      showSuccess('Configuración de correlativos actualizada');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAplicarInicio = async () => {
    setSaving(true);
    try {
      const res = await api.put('/correlativos/config', {
        numeroInicio: Number(numeroInicio),
      });
      setEstado(res.data.estado);
      setSiguienteNumero(String(res.data.estado.siguienteNumero));
      showSuccess(`La secuencia ahora inicia desde ${numeroInicio}`);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al aplicar inicio');
    } finally {
      setSaving(false);
    }
  };

  const handleLiberar = async (reservaId: number) => {
    try {
      const res = await api.post(`/correlativos/liberar-admin/${reservaId}`);
      setEstado(res.data.estado);
      setSiguienteNumero(String(res.data.estado.siguienteNumero));
      showSuccess('Correlativo liberado y disponible para el siguiente SIAF');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al liberar');
    }
  };

  if (loading && !estado) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            Correlativos SIAF
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Defina desde qué número inicia la secuencia. Al crear un SIAF el sistema asigna automáticamente el siguiente libre.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadEstado} disabled={loading}>
          Actualizar
        </Button>
      </Box>

      {loadError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setLoadError('')}>
          {loadError}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%', borderTop: `4px solid ${IGSS_COLORS.azul}` }} elevation={2}>
            <Typography variant="overline" color="text.secondary">Próximo a asignar</Typography>
            <Typography variant="h3" fontWeight={800} color="primary" sx={{ my: 1 }}>
              {estado?.correlativoSiguientePreview ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Número interno: {estado?.siguienteNumero ?? '—'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%', borderTop: `4px solid ${IGSS_COLORS.verde}` }} elevation={2}>
            <Typography variant="overline" color="text.secondary">Último usado (SIAF guardado)</Typography>
            <Typography variant="h3" fontWeight={800} sx={{ my: 1, color: IGSS_COLORS.verdeOscuro }}>
              {estado?.ultimoUsado?.correlativo ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {estado?.ultimoUsado ? 'Registrado en solicitudes' : 'Aún no hay SIAF guardados'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%', borderTop: `4px solid ${IGSS_COLORS.azulClaro}` }} elevation={2}>
            <Typography variant="overline" color="text.secondary">En uso ahora (reservados)</Typography>
            <Typography variant="h3" fontWeight={800} sx={{ my: 1, color: IGSS_COLORS.azulClaro }}>
              {estado?.totalReservasActivas ?? 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Formularios abiertos que aún no guardaron
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mb: 3 }} elevation={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <NumbersIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Configurar secuencia</Typography>
        </Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          Formato del correlativo: <strong>número/año</strong> (ej. <strong>1/{new Date().getFullYear()}</strong>).
          Al fijar el inicio, el siguiente SIAF tomará ese número del año en curso.
          Si alguien cancela el formulario, el correlativo se libera para el próximo usuario.
          Al cambiar de año, la numeración reinicia automáticamente.
        </Alert>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Iniciar desde"
              type="number"
              fullWidth
              value={numeroInicio}
              onChange={(e) => setNumeroInicio(e.target.value)}
              helperText="Piso mínimo de la secuencia"
              inputProps={{ min: 1 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Siguiente número"
              type="number"
              fullWidth
              value={siguienteNumero}
              onChange={(e) => setSiguienteNumero(e.target.value)}
              helperText="Candidato actual a asignar"
              inputProps={{ min: 1 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Dígitos (ceros a la izq.)"
              type="number"
              fullWidth
              value={digitos}
              onChange={(e) => setDigitos(e.target.value)}
              helperText={`Ej. con 0 → 1/${new Date().getFullYear()}. Con 4 → 0001/${new Date().getFullYear()}`}
              inputProps={{ min: 0, max: 12 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Minutos de reserva"
              type="number"
              fullWidth
              value={minutosReserva}
              onChange={(e) => setMinutosReserva(e.target.value)}
              helperText="Si no guarda, se libera solo"
              inputProps={{ min: 5, max: 1440 }}
            />
          </Grid>
        </Grid>
        <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleGuardar}
            disabled={saving}
          >
            Guardar configuración
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleAplicarInicio}
            disabled={saving}
          >
            Aplicar solo «Iniciar desde»
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }} elevation={2}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          Correlativos en uso (reservas activas)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mientras un usuario tiene abierto «Crear SIAF», el correlativo queda bloqueado. Puede liberarlo manualmente si el proceso se abandonó.
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Correlativo</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell>Reservado</TableCell>
                <TableCell>Expira</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(estado?.enUso?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">Ningún correlativo está reservado en este momento.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                estado!.enUso.map((r) => (
                  <TableRow key={r.reservaId} hover>
                    <TableCell>
                      <Chip label={r.correlativo} color="primary" size="small" sx={{ fontWeight: 700 }} />
                    </TableCell>
                    <TableCell>{r.usuarioNombre}</TableCell>
                    <TableCell>{new Date(r.reservadoEn).toLocaleString('es-GT')}</TableCell>
                    <TableCell>{new Date(r.expiraEn).toLocaleString('es-GT')}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<LockOpenIcon />}
                        onClick={() => handleLiberar(r.reservaId)}
                      >
                        Liberar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default CorrelativoManagementPage;
