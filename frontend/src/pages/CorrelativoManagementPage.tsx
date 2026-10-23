import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControl, Grid, InputLabel, MenuItem, Paper, Select, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import NumbersIcon from '@mui/icons-material/Numbers';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
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

interface AreaCorrelativo {
  id: number;
  nombre: string;
  configId: number | null;
}

type PosicionLetras = 'antes' | 'despues';

function vistaCorrelativo(numero: string, digitos: string, anio: number, prefijo: string, posicion: PosicionLetras) {
  const n = Math.max(1, Number(numero) || 1);
  const d = Math.max(0, Math.min(12, Number(digitos) || 0));
  const padded = d > 0 ? String(n).padStart(d, '0') : String(n);
  const letras = prefijo.trim().toUpperCase();
  if (!letras) return `${padded}/${anio}`;
  return posicion === 'despues' ? `${padded} ${letras}/${anio}` : `${letras} ${padded}/${anio}`;
}

interface SerieCorrelativo extends EstadoCorrelativos {
  id: number;
  nombre: string;
  prefijo: string;
  prefijoPosicion: PosicionLetras;
  areas: { id: number; nombre: string }[];
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

function SectionTitle({ step, title }: { step: string; title: string }) {
  return (
    <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2, color: IGSS_COLORS.azulOscuro }}>
      {step}. {title}
    </Typography>
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
  const [series, setSeries] = useState<SerieCorrelativo[]>([]);
  const [areasCatalogo, setAreasCatalogo] = useState<AreaCorrelativo[]>([]);
  const [serieId, setSerieId] = useState<number | null>(null);
  const serieIdRef = useRef<number | null>(null);
  const [nombre, setNombre] = useState('General');
  const [prefijo, setPrefijo] = useState('');
  const [prefijoPosicion, setPrefijoPosicion] = useState<PosicionLetras>('antes');
  const [areaIds, setAreaIds] = useState<number[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrefijo, setNuevoPrefijo] = useState('');
  const [nuevoPrefijoPosicion, setNuevoPrefijoPosicion] = useState<PosicionLetras>('antes');
  const [creando, setCreando] = useState(false);

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
    if (esSiaf && nombre !== (series.find((serie) => serie.id === serieId)?.nombre || '')) return true;
    if (esSiaf && prefijo.trim().toUpperCase() !== (series.find((serie) => serie.id === serieId)?.prefijo || '')) return true;
    if (esSiaf && prefijoPosicion !== (series.find((serie) => serie.id === serieId)?.prefijoPosicion || 'antes')) return true;
    if (esSiaf) {
      const actuales = (series.find((serie) => serie.id === serieId)?.areas || []).map((area) => area.id).sort().join(',');
      const editadas = [...areaIds].sort().join(',');
      if (actuales !== editadas) return true;
    }
    return false;
  }, [estado, numeroInicio, siguienteNumero, digitos, minutosReserva, baseline, esSiaf, nombre, prefijo, prefijoPosicion, areaIds, series, serieId]);

  const previewLocal = useMemo(() => {
    if (!esSiaf) {
      const n = Math.max(1, Number(siguienteNumero) || 1);
      const d = Math.max(0, Math.min(12, Number(digitos) || 0));
      const padded = d > 0 ? String(n).padStart(d, '0') : String(n);
      return `EXP-${padded}/${anio}`;
    }
    return vistaCorrelativo(siguienteNumero, digitos, anio, prefijo, prefijoPosicion);
  }, [siguienteNumero, digitos, esSiaf, anio, prefijo, prefijoPosicion]);

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

  const aplicarSerie = (serie: SerieCorrelativo) => {
    serieIdRef.current = serie.id;
    setSerieId(serie.id);
    setNombre(serie.nombre);
    setPrefijo(serie.prefijo || '');
    setPrefijoPosicion(serie.prefijoPosicion === 'despues' ? 'despues' : 'antes');
    setAreaIds(serie.areas.map((area) => area.id));
    setEstado(serie);
    applyEstadoToForm(serie);
  };

  const loadEstado = useCallback(async () => {
    setLoading(true);
    setEstado(null);
    try {
      if (tipoCorrelativo === 'siaf') {
        const res = await api.get('/correlativos/series');
        const lista: SerieCorrelativo[] = res.data?.series || [];
        setSeries(lista);
        setAreasCatalogo(res.data?.areas || []);
        const elegida = lista.find((serie) => serie.id === serieIdRef.current) || lista[0];
        if (elegida) {
          serieIdRef.current = elegida.id;
          setSerieId(elegida.id);
          setNombre(elegida.nombre);
          setPrefijo(elegida.prefijo || '');
          setPrefijoPosicion(elegida.prefijoPosicion === 'despues' ? 'despues' : 'antes');
          setAreaIds(elegida.areas.map((area) => area.id));
          setEstado(elegida);
          applyEstadoToForm(elegida);
        } else {
          setEstado(null);
        }
        setLoadError('');
        return;
      }
      const res = await api.get('/correlativos/expedientes/estado');
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
      if (tipoCorrelativo === 'siaf') {
        if (!serieId) throw new Error('Seleccione un correlativo.');
        const res = await api.put(`/correlativos/series/${serieId}`, {
          nombre,
          prefijo,
          prefijoPosicion,
          areaIds,
          numeroInicio: Number(numeroInicio),
          siguienteNumero: Number(siguienteNumero),
          digitos: Number(digitos),
          minutosReserva: Number(minutosReserva),
        });
        const lista: SerieCorrelativo[] = res.data?.series || [];
        setSeries(lista);
        setAreasCatalogo(res.data?.areas || []);
        const elegida = lista.find((serie) => serie.id === serieId) || lista[0];
        if (elegida) {
          serieIdRef.current = elegida.id;
          aplicarSerie(elegida);
        }
        showSuccess('Correlativo SIAF guardado');
        return;
      }
      const endpoint = '/correlativos/expedientes/config';
      const payload: Record<string, number> = {
        numeroInicio: Number(numeroInicio),
        siguienteNumero: Number(siguienteNumero),
        digitos: Number(digitos),
      };
      const res = await api.put(endpoint, payload);
      setEstado(res.data.estado);
      applyEstadoToForm(res.data.estado);
      showSuccess('Configuración de expedientes guardada');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleCrear = async () => {
    setCreando(true);
    try {
      const res = await api.post('/correlativos/series', { nombre: nuevoNombre, prefijo: nuevoPrefijo, prefijoPosicion: nuevoPrefijoPosicion, areaIds: [] });
      const lista: SerieCorrelativo[] = res.data?.series || [];
      setSeries(lista);
      setAreasCatalogo(res.data?.areas || []);
      const creada = lista.find((serie) => serie.nombre.trim().toLowerCase() === nuevoNombre.trim().toLowerCase()) || lista[lista.length - 1];
      if (creada) aplicarSerie(creada);
      setNuevoNombre('');
      setNuevoPrefijo('');
      setNuevoPrefijoPosicion('antes');
      showSuccess('Correlativo creado. Ahora asígnele las áreas y guarde.');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al crear el correlativo');
    } finally {
      setCreando(false);
    }
  };

  const handleEliminar = async () => {
    if (!serieId) return;
    setSaving(true);
    try {
      const res = await api.delete(`/correlativos/series/${serieId}`);
      const lista: SerieCorrelativo[] = res.data?.series || [];
      setSeries(lista);
      setAreasCatalogo(res.data?.areas || []);
      if (lista[0]) aplicarSerie(lista[0]);
      else setEstado(null);
      showSuccess('Correlativo eliminado');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  const handleAplicarInicio = async () => {
    setSaving(true);
    try {
      if (tipoCorrelativo === 'siaf') {
        if (!serieId) return;
        const res = await api.put(`/correlativos/series/${serieId}`, { numeroInicio: Number(numeroInicio) });
        const lista: SerieCorrelativo[] = res.data?.series || [];
        setSeries(lista);
        setAreasCatalogo(res.data?.areas || []);
        const elegida = lista.find((serie) => serie.id === serieId);
        if (elegida) aplicarSerie(elegida);
        showSuccess(`La secuencia ahora inicia desde ${numeroInicio}`);
        return;
      }
      const endpoint = '/correlativos/expedientes/config';
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
      await api.post(`/correlativos/liberar-admin/${reservaId}`);
      await loadEstado();
      showSuccess('Número liberado: ya puede usarlo el siguiente formulario SIAF');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al liberar');
    }
  };

  const descartarCambios = () => {
    const serie = series.find((item) => item.id === serieId);
    if (esSiaf && serie) aplicarSerie(serie);
    else {
      setNumeroInicio(baseline.numeroInicio);
      setSiguienteNumero(baseline.siguienteNumero);
      setDigitos(baseline.digitos);
      setMinutosReserva(baseline.minutosReserva);
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
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

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {loadError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setLoadError('')}>
              {loadError}
            </Alert>
          )}

          {esSiaf && (
            <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 1.5 }}>
                Correlativos SIAF
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {series.map((serie) => (
                  <Chip
                    key={serie.id}
                    label={`${serie.nombre} · ${serie.correlativoSiguientePreview}`}
                    color={serie.id === serieId ? 'primary' : 'default'}
                    variant={serie.id === serieId ? 'filled' : 'outlined'}
                    onClick={() => aplicarSerie(serie)}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Box>

              {serieId && (
                <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                      {nombre || 'Correlativo'}
                    </Typography>
                    <Button color="error" size="small" onClick={handleEliminar} disabled={saving}>
                      Eliminar
                    </Button>
                  </Box>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} md={4}>
                      <TextField size="small" label="Nombre" fullWidth value={nombre} onChange={(e) => setNombre(e.target.value)} />
                    </Grid>
                    <Grid item xs={12} sm={4} md={3}>
                      <TextField size="small" label="Letras" fullWidth value={prefijo} onChange={(e) => setPrefijo(e.target.value)} placeholder="BF" />
                    </Grid>
                    <Grid item xs={12} sm={8} md={5}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="posicion-letras">Posición de las letras</InputLabel>
                        <Select
                          labelId="posicion-letras"
                          label="Posición de las letras"
                          value={prefijoPosicion}
                          onChange={(event) => setPrefijoPosicion(event.target.value as PosicionLetras)}
                        >
                          <MenuItem value="antes">Antes del número</MenuItem>
                          <MenuItem value="despues">Después del número</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  <Typography variant="body2" fontWeight={700} sx={{ mt: 2, mb: 1 }}>
                    Áreas
                  </Typography>
                  {areasCatalogo.length === 0 ? (
                    <Alert severity="warning">No hay áreas activas.</Alert>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {areasCatalogo.map((area) => {
                        const ocupada = area.configId != null && area.configId !== serieId;
                        const marcada = areaIds.includes(area.id);
                        const dueno = series.find((serie) => serie.id === area.configId);
                        return (
                          <Box
                            key={area.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              minHeight: 40,
                              px: 0.5,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: marcada ? 'primary.main' : 'divider',
                              bgcolor: marcada ? 'rgba(0,91,145,0.06)' : 'transparent',
                            }}
                          >
                            <Checkbox
                              size="small"
                              checked={marcada}
                              onChange={(event) => {
                                setAreaIds((current) => event.target.checked
                                  ? [...current, area.id]
                                  : current.filter((id) => id !== area.id));
                              }}
                            />
                            <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                              {area.nombre}
                            </Typography>
                            {ocupada && (
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ pr: 1 }}>
                                {marcada ? `Pasa desde ${dueno?.nombre || 'otro'}` : `En ${dueno?.nombre || 'otro'}`}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              )}

              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" fontWeight={800} sx={{ mb: 1.25, color: IGSS_COLORS.azulOscuro }}>
                  Agregar correlativo
                </Typography>
                <Grid container spacing={1.5} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <TextField size="small" label="Nombre" fullWidth value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Fondo Rotativo" />
                  </Grid>
                  <Grid item xs={12} sm={4} md={2}>
                    <TextField size="small" label="Letras" fullWidth value={nuevoPrefijo} onChange={(e) => setNuevoPrefijo(e.target.value)} placeholder="FR" />
                  </Grid>
                  <Grid item xs={12} sm={8} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="nueva-posicion-letras">Posición</InputLabel>
                      <Select
                        labelId="nueva-posicion-letras"
                        label="Posición"
                        value={nuevoPrefijoPosicion}
                        onChange={(event) => setNuevoPrefijoPosicion(event.target.value as PosicionLetras)}
                      >
                        <MenuItem value="antes">Antes del número</MenuItem>
                        <MenuItem value="despues">Después del número</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Button fullWidth variant="contained" startIcon={<AddIcon />} onClick={handleCrear} disabled={creando || nuevoNombre.trim().length < 2}>
                      Crear
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          )}

          <SectionTitle
            step="1"
            title="Estado actual"
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
                <Typography variant="h4" fontWeight={800} color="primary" sx={{ mt: 0.75, lineHeight: 1.15 }}>
                  {estado?.correlativoSiguientePreview ?? '—'}
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
                <Typography variant="h4" fontWeight={800} sx={{ mt: 0.75, lineHeight: 1.15, color: IGSS_COLORS.verdeOscuro }}>
                  {ultimoCorrelativo}
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
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 0.75, lineHeight: 1.15, color: IGSS_COLORS.azulClaro }}>
                    {estado?.totalReservasActivas ?? 0}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>

          <SectionTitle
            step="2"
            title="Ajustar la secuencia"
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

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={esSiaf ? 3 : 4}>
                <TextField
                  label="Empezar desde"
                  type="number"
                  fullWidth
                  value={numeroInicio}
                  onChange={(e) => setNumeroInicio(e.target.value)}
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
          </Paper>

          {esSiaf && (
            <>
              <SectionTitle
                step="3"
                title="Números bloqueados (reservas)"
              />

              <Paper
                elevation={0}
                sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
              >
                {(estado?.enUso?.length ?? 0) === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Sin reservas
                  </Typography>
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
