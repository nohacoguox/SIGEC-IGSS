import React, { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, FormControl, Grid,
  InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography, alpha,
} from '@mui/material';
import {
  AccessTime, Apartment, AssignmentTurnedIn, DateRange, HourglassEmpty, RestartAlt,
} from '@mui/icons-material';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import api from '../../../api';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { axisTick, ChartTooltip, formatTime, gridStroke, panelSx, tableScrollSx } from '../shared/charts';
import { KpiCard, SectionBlock } from '../shared/ui';

type FilaUnidad = {
  unidad: string;
  revisados: number;
  aprobados: number;
  rechazados: number;
  pendientesCola: number;
  promedioHorasRespuesta: number | null;
  promedioHorasEnCola: number | null;
};

type Decision = {
  tipoCaso: 'siaf' | 'expediente';
  id: number;
  correlativo: string;
  unidad: string;
  accion: 'aprobacion' | 'rechazo';
  fechaDecision: string;
  horasRespuesta: number | null;
};

type Payload = {
  desde: string;
  hasta: string;
  departamento: string | null;
  unidadFiltro: string | null;
  resumen: {
    revisados: number;
    aprobados: number;
    rechazados: number;
    pendientesCola: number;
    promedioHorasRespuesta: number | null;
    promedioHorasEnCola: number | null;
    muestraRespuesta: number;
  };
  porUnidad: FilaUnidad[];
  unidadesDisponibles: string[];
  recientes: Decision[];
};

const fechaLocal = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const PRESETS = [
  { dias: 28, etiqueta: '4 semanas' },
  { dias: 90, etiqueta: '3 meses' },
  { dias: 180, etiqueta: '6 meses' },
  { dias: 365, etiqueta: '1 año' },
];

const AnaliticaAnalistaDaf: React.FC = () => {
  const [preset, setPreset] = useState<number | 'personalizado'>(90);
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return fechaLocal(d);
  });
  const [hasta, setHasta] = useState(() => fechaLocal(new Date()));
  const [unidad, setUnidad] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true);
    setError(null);
    api
      .get('/estadisticas/analista-daf', {
        params: {
          desde,
          hasta,
          unidad: unidad || undefined,
        },
      })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'No se pudieron cargar sus tiempos DAF.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarPreset = (p: number | 'personalizado') => {
    setPreset(p);
    if (p !== 'personalizado') {
      const d = new Date();
      d.setDate(d.getDate() - p);
      setDesde(fechaLocal(d));
      setHasta(fechaLocal(new Date()));
    }
  };

  const restablecer = () => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    const desdeReset = fechaLocal(d);
    const hastaReset = fechaLocal(new Date());
    setPreset(90);
    setDesde(desdeReset);
    setHasta(hastaReset);
    setUnidad(null);
    setLoading(true);
    setError(null);
    api
      .get('/estadisticas/analista-daf', {
        params: { desde: desdeReset, hasta: hastaReset },
      })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'No se pudieron cargar sus tiempos DAF.'))
      .finally(() => setLoading(false));
  };

  const chartData = (data?.porUnidad || [])
    .filter((u) => u.revisados > 0 || u.pendientesCola > 0)
    .map((u) => ({
      unidad: u.unidad.length > 28 ? `${u.unidad.slice(0, 26)}…` : u.unidad,
      unidadFull: u.unidad,
      revisados: u.revisados,
      pendientes: u.pendientesCola,
      horas: Number((u.promedioHorasRespuesta ?? 0).toFixed(2)),
    }));

  return (
    <Box sx={{ width: '100%', maxWidth: 1440, mx: 'auto', pb: 2 }}>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h5" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
          Mis tiempos DAF
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          mb: 2,
          p: 1.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
          <Chip
            size="small"
            label="Analista DAF"
            sx={{ fontWeight: 800, bgcolor: alpha(IGSS_COLORS.azul, 0.12), color: IGSS_COLORS.azulOscuro }}
          />
          {data?.departamento && (
            <Chip
              size="small"
              label={`Depto. ${data.departamento}`}
              sx={{ fontWeight: 700, bgcolor: alpha('#C47A20', 0.12), color: '#8A5A12' }}
            />
          )}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Rango</InputLabel>
            <Select
              value={preset}
              label="Rango"
              onChange={(e) =>
                aplicarPreset(e.target.value === 'personalizado' ? 'personalizado' : Number(e.target.value))
              }
            >
              {PRESETS.map((p) => (
                <MenuItem key={p.dias} value={p.dias}>
                  Últimos {p.etiqueta}
                </MenuItem>
              ))}
              <MenuItem value="personalizado">Personalizado</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="date"
            label="Desde"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPreset('personalizado');
            }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label="Hasta"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPreset('personalizado');
            }}
            InputLabelProps={{ shrink: true }}
          />
          <Autocomplete
            size="small"
            options={data?.unidadesDisponibles || []}
            value={unidad}
            onChange={(_e, v) => setUnidad(v)}
            sx={{ minWidth: 280, flex: '1 1 240px' }}
            noOptionsText={
              data?.departamento
                ? `Sin unidades cargadas para ${data.departamento}`
                : 'Cargue el período para ver las unidades'
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Unidad médica"
                placeholder={
                  data?.departamento
                    ? `Todas las de ${data.departamento}`
                    : 'Todas las unidades del departamento'
                }
              />
            )}
          />
          <Button variant="contained" size="small" startIcon={<DateRange />} onClick={cargar}>
            Aplicar
          </Button>
          <Button variant="text" size="small" color="inherit" startIcon={<RestartAlt />} onClick={restablecer}>
            Restablecer
          </Button>
        </Stack>
      </Paper>

      {loading && (
        <Box display="grid" sx={{ placeItems: 'center', minHeight: 240 }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && data && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <SectionBlock
            title="Su desempeño en el período"
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard
                  label="Prom. su respuesta"
                  value={formatTime(data.resumen.promedioHorasRespuesta)}
                  note={`${data.resumen.muestraRespuesta} decisiones con tiempo`}
                  icon={<AccessTime />}
                  color={IGSS_COLORS.azul}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard
                  label="Revisados por usted"
                  value={data.resumen.revisados}
                  note={`${data.resumen.aprobados} aprob. · ${data.resumen.rechazados} rech.`}
                  icon={<AssignmentTurnedIn />}
                  color={IGSS_COLORS.verdeOscuro}
                  delay={0.05}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard
                  label="En cola DAF"
                  value={data.resumen.pendientesCola}
                  note={`Prom. espera ${formatTime(data.resumen.promedioHorasEnCola)}`}
                  icon={<HourglassEmpty />}
                  color="#C47A20"
                  delay={0.1}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard
                  label="Unidades del depto"
                  value={data.unidadesDisponibles.length}
                  note={
                    data.unidadFiltro
                      ? `Filtro: ${data.unidadFiltro}`
                      : `${data.porUnidad.filter((u) => u.revisados > 0 || u.pendientesCola > 0).length} con actividad`
                  }
                  icon={<Apartment />}
                  color={IGSS_COLORS.azulOscuro}
                  delay={0.15}
                />
              </Grid>
            </Grid>
          </SectionBlock>

          <SectionBlock
            title="Por unidad médica"
          >
            {chartData.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                No hay datos para el período / unidad seleccionados.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} lg={5}>
                  <Paper elevation={0} sx={{ ...panelSx, height: 320 }}>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 1 }}>
                      Revisados vs en cola
                    </Typography>
                    <Box sx={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} tick={axisTick} />
                          <YAxis type="category" dataKey="unidad" width={120} tick={{ ...axisTick, fontSize: 10 }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="revisados" name="Revisados" fill={IGSS_COLORS.azul} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="pendientes" name="En cola" fill="#C47A20" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} lg={7}>
                  <Paper elevation={0} sx={panelSx}>
                    <TableContainer sx={{ ...tableScrollSx, maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow
                            sx={{
                              '& th': {
                                fontWeight: 700,
                                color: IGSS_COLORS.azulOscuro,
                                bgcolor: alpha(IGSS_COLORS.azul, 0.05),
                              },
                            }}
                          >
                            <TableCell>Unidad</TableCell>
                            <TableCell align="right">Revisados</TableCell>
                            <TableCell align="right">Aprob.</TableCell>
                            <TableCell align="right">Rech.</TableCell>
                            <TableCell align="right">En cola</TableCell>
                            <TableCell align="right">Prom. respuesta</TableCell>
                            <TableCell align="right">Prom. cola</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {data.porUnidad.map((u) => (
                            <TableRow
                              key={u.unidad}
                              hover
                              onClick={() => setUnidad(u.unidad)}
                              sx={{ cursor: 'pointer' }}
                            >
                              <TableCell>
                                <Typography variant="body2" fontWeight={700} noWrap title={u.unidad}>
                                  {u.unidad}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{u.revisados}</TableCell>
                              <TableCell align="right">{u.aprobados}</TableCell>
                              <TableCell align="right">{u.rechazados}</TableCell>
                              <TableCell align="right">{u.pendientesCola}</TableCell>
                              <TableCell align="right">{formatTime(u.promedioHorasRespuesta)}</TableCell>
                              <TableCell align="right">{formatTime(u.promedioHorasEnCola)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Clic en una fila para filtrar por esa unidad y pulse Aplicar.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </SectionBlock>

          <SectionBlock title="Sus últimas decisiones">
            <Paper elevation={0} sx={panelSx}>
              {data.recientes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aún no hay decisiones suyas en este período.
                </Typography>
              ) : (
                <TableContainer sx={tableScrollSx}>
                  <Table size="small">
                    <TableHead>
                      <TableRow
                        sx={{
                          '& th': { fontWeight: 700, color: IGSS_COLORS.azulOscuro },
                        }}
                      >
                        <TableCell>Tipo</TableCell>
                        <TableCell>Correlativo</TableCell>
                        <TableCell>Unidad</TableCell>
                        <TableCell>Acción</TableCell>
                        <TableCell>Fecha</TableCell>
                        <TableCell align="right">Tiempo respuesta</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.recientes.map((r) => (
                        <TableRow key={`${r.tipoCaso}-${r.id}-${r.fechaDecision}`} hover>
                          <TableCell>{r.tipoCaso === 'siaf' ? 'SIAF' : 'Expediente'}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {r.correlativo}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>
                            <Typography variant="body2" noWrap title={r.unidad}>
                              {r.unidad}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={r.accion === 'aprobacion' ? 'Aprobado' : 'Rechazado'}
                              color={r.accion === 'aprobacion' ? 'success' : 'error'}
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(r.fechaDecision).toLocaleString('es-GT', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: IGSS_COLORS.azul }}>
                            {formatTime(r.horasRespuesta)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </SectionBlock>
        </motion.div>
      )}
    </Box>
  );
};

export default AnaliticaAnalistaDaf;
