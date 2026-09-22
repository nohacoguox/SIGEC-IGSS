import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Grid, Paper, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import NumbersIcon from '@mui/icons-material/Numbers';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
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
  minutosReserva?: number;
  correlativoSiguientePreview: string;
  ultimoUsado: { correlativo: string; numero: number | null } | string | null;
  enUso: ReservaEnUso[];
  totalReservasActivas: number;
}

function SectionTitle({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
        {step}. {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, maxWidth: 720 }}>
        {description}
      </Typography>
    </Box>
  );
}

const CorrelativoManagementPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [tipoCorrelativo, setTipoCorrelativo] = useState<'siaf' | 'expedientes'>('siaf');
  const [estado, setEstado] = useState<EstadoCorrelativos | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numeroInicio, setNumeroInicio] = useState('1');
  const [siguienteNumero, setSiguienteNumero] = useState('1');
  const [digitos, setDigitos] = useState('0');
  const [minutosReserva, setMinutosReserva] = useState('120');
  const [loadError, setLoadError] = useState('');
  const [baseline, setBaseline] = useState({ numeroInicio: '1', siguienteNumero: '1', digitos: '0', minutosReserva: '120' });

  const esSiaf = tipoCorrelativo === 'siaf';
  const anio = new Date().getFullYear();

  const ultimoCorrelativo = estado?.ultimoUsado
    ? typeof estado.ultimoUsado === 'string'
      ? estado.ultimoUsado
      : estado.ultimoUsado.correlativo
    : '—';

  const dirty = useMemo(() => {
    if (!estado) return false;
    if (numeroInicio !== baseline.numeroInicio) return true;
    if (siguienteNumero !== baseline.siguienteNumero) return true;
    if (digitos !== baseline.digitos) return true;
    if (esSiaf && minutosReserva !== baseline.minutosReserva) return true;
    return false;
  }, [estado, numeroInicio, siguienteNumero, digitos, minutosReserva, baseline, esSiaf]);

  const previewLocal = useMemo(() => {
    const n = Math.max(1, Number(siguienteNumero) || 1);
    const d = Math.max(0, Math.min(12, Number(digitos) || 0));
    const padded = d > 0 ? String(n).padStart(d, '0') : String(n);
    return esSiaf ? `${padded}/${anio}` : `EXP-${padded}/${anio}`;
  }, [siguienteNumero, digitos, esSiaf, anio]);

  const applyEstadoToForm = (data: EstadoCorrelativos) => {
    const next = {
      numeroInicio: String(data.numeroInicio),
      siguienteNumero: String(data.siguienteNumero),
      digitos: String(data.digitos),
      minutosReserva: String(data.minutosReserva ?? 120),
    };
    setNumeroInicio(next.numeroInicio);
    setSiguienteNumero(next.siguienteNumero);
    setDigitos(next.digitos);
    setMinutosReserva(next.minutosReserva);
    setBaseline(next);
  };

  const loadEstado = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = tipoCorrelativo === 'siaf'
        ? '/correlativos/estado'
        : '/correlativos/expedientes/estado';
      const res = await api.get(endpoint);
      const data: EstadoCorrelativos = res.data;
      setEstado(data);
      applyEstadoToForm(data);
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
  }, [showError, tipoCorrelativo]);

  useEffect(() => {
    loadEstado();
  }, [loadEstado]);

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const endpoint = tipoCorrelativo === 'siaf'
        ? '/correlativos/config'
        : '/correlativos/expedientes/config';
      const payload: Record<string, number> = {
        numeroInicio: Number(numeroInicio),
        siguienteNumero: Number(siguienteNumero),
        digitos: Number(digitos),
      };
      if (tipoCorrelativo === 'siaf') payload.minutosReserva = Number(minutosReserva);
      const res = await api.put(endpoint, payload);
      setEstado(res.data.estado);
      applyEstadoToForm(res.data.estado);
      showSuccess(`Configuración de ${tipoCorrelativo === 'siaf' ? 'SIAF' : 'expedientes'} guardada`);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAplicarInicio = async () => {
    setSaving(true);
    try {
      const endpoint = tipoCorrelativo === 'siaf'
        ? '/correlativos/config'
        : '/correlativos/expedientes/config';
      const res = await api.put(endpoint, {
        numeroInicio: Number(numeroInicio),
      });
      setEstado(res.data.estado);
      applyEstadoToForm(res.data.estado);
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
      applyEstadoToForm(res.data.estado);
      showSuccess('Número liberado: ya puede usarlo el siguiente formulario SIAF');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al liberar');
    }
  };

  const descartarCambios = () => {
    setNumeroInicio(baseline.numeroInicio);
    setSiguienteNumero(baseline.siguienteNumero);
    setDigitos(baseline.digitos);
    setMinutosReserva(baseline.minutosReserva);
  };

  if (loading && !estado) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
      <Alert
        severity="info"
        icon={<InfoOutlinedIcon />}
        sx={{
          borderRadius: 2,
          bgcolor: (t) => (t.palette.mode === 'dark' ? undefined : 'rgba(0,91,145,0.06)'),
          color: (t) => (t.palette.mode === 'dark' ? undefined : IGSS_COLORS.textoOscuro),
          '& .MuiAlert-icon': {
            color: (t) => (t.palette.mode === 'dark' ? undefined : IGSS_COLORS.azul),
          },
        }}
      >
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.35 }}>
          Qué controla esta pantalla
        </Typography>
        <Typography variant="body2">
          El <strong>correlativo</strong> es el número automático que recibe cada SIAF o expediente
          (ej. <strong>1/{anio}</strong> o <strong>EXP-0001/{anio}</strong>).
          Elija el tipo abajo, revise el estado y ajuste la secuencia solo si necesita reiniciar o adelantar la numeración.
        </Typography>
      </Alert>

      <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Box
          sx={{
            px: { xs: 1.5, sm: 2 },
            pt: 0.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
            bgcolor: 'rgba(0,91,145,0.03)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Tabs
            value={tipoCorrelativo}
            onChange={(_, value: 'siaf' | 'expedientes') => setTipoCorrelativo(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 52,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 52 },
              '& .Mui-selected': { color: `${IGSS_COLORS.azulOscuro} !important` },
              '& .MuiTabs-indicator': { height: 3, bgcolor: IGSS_COLORS.azul },
            }}
          >
            <Tab
              value="siaf"
              icon={<FactCheckOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label="SIAF"
            />
            <Tab
              value="expedientes"
              icon={<DescriptionOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label="Expedientes de compras"
            />
          </Tabs>
          <Button
            startIcon={<RefreshIcon />}
            variant="outlined"
            size="small"
            onClick={loadEstado}
            disabled={loading}
            sx={{ mb: 1, mr: 1 }}
          >
            Actualizar
          </Button>
        </Box>

        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="body2" color="text.secondary">
            {esSiaf
              ? 'Numeración de solicitudes SIAF. Al abrir «Crear SIAF» se reserva un número hasta guardar o cancelar.'
              : 'Numeración interna de expedientes de compras. Se asigna automáticamente al crear el expediente.'}
          </Typography>
        </Box>

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {loadError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setLoadError('')}>
              {loadError}
            </Alert>
          )}

          <SectionTitle
            step="1"
            title="Estado actual"
            description="Lectura rápida: qué número sigue, cuál fue el último y cuántos están bloqueados en formularios abiertos."
          />

          <Grid container spacing={2} sx={{ mb: 3.25 }}>
            <Grid item xs={12} sm={esSiaf ? 4 : 6}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.25,
                  height: '100%',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderTop: `4px solid ${IGSS_COLORS.azul}`,
                }}
              >
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Próximo a asignar
                </Typography>
                <Typography variant="h4" fontWeight={800} color="primary" sx={{ my: 0.75, lineHeight: 1.15 }}>
                  {estado?.correlativoSiguientePreview ?? '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Será el siguiente {esSiaf ? 'SIAF' : 'expediente'} nuevo
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={esSiaf ? 4 : 6}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.25,
                  height: '100%',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderTop: `4px solid ${IGSS_COLORS.verde}`,
                }}
              >
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Último guardado
                </Typography>
                <Typography variant="h4" fontWeight={800} sx={{ my: 0.75, lineHeight: 1.15, color: IGSS_COLORS.verdeOscuro }}>
                  {ultimoCorrelativo}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {estado?.ultimoUsado
                    ? esSiaf ? 'Ya existe en solicitudes SIAF' : 'Ya existe en expedientes'
                    : esSiaf ? 'Aún no hay SIAF guardados' : 'Aún no hay expedientes creados'}
                </Typography>
              </Paper>
            </Grid>
            {esSiaf && (
              <Grid item xs={12} sm={4}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.25,
                    height: '100%',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderTop: `4px solid ${IGSS_COLORS.azulClaro}`,
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    Reservados ahora
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ my: 0.75, lineHeight: 1.15, color: IGSS_COLORS.azulClaro }}>
                    {estado?.totalReservasActivas ?? 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Formularios abiertos sin guardar (sección 3)
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>

          <SectionTitle
            step="2"
            title="Ajustar la secuencia"
            description="Use esto solo si necesita reiniciar, saltar números o cambiar el formato. La vista previa se actualiza al editar."
          />

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: esSiaf ? 3.25 : 0,
              borderRadius: 2,
              border: '1px solid',
              borderColor: dirty ? IGSS_COLORS.azul : 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', mb: 1.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NumbersIcon sx={{ color: IGSS_COLORS.azul }} />
                <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                  Parámetros
                </Typography>
                {dirty && <Chip size="small" color="warning" label="Cambios sin guardar" sx={{ fontWeight: 700 }} />}
              </Box>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: 'rgba(0,91,145,0.06)',
                  border: '1px dashed',
                  borderColor: 'rgba(0,91,145,0.25)',
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">
                  Vista previa del próximo
                </Typography>
                <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, fontSize: '1.1rem' }}>
                  {previewLocal}
                </Typography>
              </Box>
            </Box>

            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              {esSiaf ? (
                <>
                  Formato SIAF: <strong>número/año</strong>. Si alguien cancela el formulario, el número se libera para otro usuario.
                </>
              ) : (
                <>
                  Formato expediente: <strong>EXP-número/año</strong>. El sistema lo asigna al guardar el expediente (sin reserva temporal).
                </>
              )}
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={esSiaf ? 3 : 4}>
                <TextField
                  label="Empezar desde"
                  type="number"
                  fullWidth
                  value={numeroInicio}
                  onChange={(e) => setNumeroInicio(e.target.value)}
                  helperText="Piso mínimo permitido (ej. 1 o 100)"
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={esSiaf ? 3 : 4}>
                <TextField
                  label="Siguiente número"
                  type="number"
                  fullWidth
                  value={siguienteNumero}
                  onChange={(e) => setSiguienteNumero(e.target.value)}
                  helperText="El que se asignará ahora"
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={esSiaf ? 3 : 4}>
                <TextField
                  label="Ceros a la izquierda"
                  type="number"
                  fullWidth
                  value={digitos}
                  onChange={(e) => setDigitos(e.target.value)}
                  helperText={digitos === '0' || digitos === '' ? `Sin padding → 1/${anio}` : `Con ${digitos} dígitos → ${String(1).padStart(Number(digitos) || 0, '0')}/${anio}`}
                  inputProps={{ min: 0, max: 12 }}
                />
              </Grid>
              {esSiaf && (
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Minutos de reserva"
                    type="number"
                    fullWidth
                    value={minutosReserva}
                    onChange={(e) => setMinutosReserva(e.target.value)}
                    helperText="Si no guardan, se libera solo"
                    inputProps={{ min: 5, max: 1440 }}
                  />
                </Grid>
              )}
            </Grid>

            <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleGuardar}
                disabled={saving || !dirty}
              >
                Guardar configuración
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleAplicarInicio}
                disabled={saving || numeroInicio === baseline.numeroInicio}
              >
                Solo aplicar «Empezar desde»
              </Button>
              <Button variant="text" color="inherit" onClick={descartarCambios} disabled={!dirty || saving}>
                Descartar cambios
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
              «Solo aplicar empezar desde» reinicia la secuencia al piso indicado sin tocar dígitos ni minutos de reserva.
            </Typography>
          </Paper>

          {esSiaf && (
            <>
              <SectionTitle
                step="3"
                title="Números bloqueados (reservas)"
                description="Si un colaborador abrió «Crear SIAF» y abandonó el formulario, puede liberar el número aquí para que otro lo use."
              />

              <Paper
                elevation={0}
                sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
              >
                {(estado?.enUso?.length ?? 0) === 0 ? (
                  <Alert severity="success" sx={{ borderRadius: 2 }}>
                    Ningún correlativo está reservado ahora. Puede seguir creando SIAF con normalidad.
                  </Alert>
                ) : (
                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: IGSS_COLORS.azulOscuro, '& th': { color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' } }}>
                          <TableCell>Correlativo</TableCell>
                          <TableCell>Usuario</TableCell>
                          <TableCell>Reservado</TableCell>
                          <TableCell>Expira</TableCell>
                          <TableCell align="right">Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {estado!.enUso.map((r) => (
                          <TableRow key={r.reservaId} hover>
                            <TableCell>
                              <Chip label={r.correlativo} color="primary" size="small" sx={{ fontWeight: 700 }} />
                            </TableCell>
                            <TableCell>{r.usuarioNombre}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(r.reservadoEn).toLocaleString('es-GT')}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(r.expiraEn).toLocaleString('es-GT')}</TableCell>
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
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default CorrelativoManagementPage;
