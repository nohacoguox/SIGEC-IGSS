import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
} from '@mui/material';
import { Timeline, Speed, TrendingUp, CheckCircle, HourglassEmpty } from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Area,
  ComposedChart,
} from 'recharts';
import { motion, type Variants } from 'framer-motion';
import api from '../api';
import { IGSS_COLORS } from '../theme/institutionalColors';

interface EstadisticasData {
  dias: number;
  desde: string;
  promedioRevisionHoras: number | null;
  promedioAutorizacionHoras: number | null;
  promedioCorreccionHoras: number | null;
  cantidadRevisados: number;
  cantidadAutorizados: number;
  cantidadConCorreccion: number;
  porSemana: Array<{
    semana: string;
    promedioRevisionHoras: number;
    promedioAutorizacionHoras: number;
    promedioCorreccionHoras: number;
    cantidadRevisados: number;
    cantidadAutorizados: number;
    cantidadCorrecciones: number;
  }>;
}

function formatHoras(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 24) return `${horas.toFixed(1)} h`;
  const dias = horas / 24;
  return `${dias.toFixed(1)} días`;
}

interface MotivosRechazoData {
  dias: number;
  desde: string;
  motivos: Array<{ clave: string; etiqueta: string; cantidad: number }>;
  sinClasificar: number;
  total: number;
}

interface EstadisticasTesisPiloto {
  muestra: { total: number; meta: number; pendientesParaMeta: number };
  lineaBase: {
    eficiencia: { promedioCiclos: number; devueltosPorcentaje: number; pasaronMes: number };
    calidad: { observacionesPromedio: number; rechazosPor100: number };
    trazabilidad: { cumplePorcentaje: number; minutosBusqueda: number };
    tiempos: { cicloDiasHabiles: number; primeraRespuestaDiasHabiles: number };
  };
  piloto: {
    eficiencia: { promedioCiclos: number | null; devueltosPorcentaje: number | null; pasaronMes: number };
    calidad: { observacionesPromedio: number | null; rechazosPor100: number | null };
    trazabilidad: { cumplePorcentaje: number | null; versionesDistinguiblesPorcentaje: number | null; minutosBusqueda: null; notaMinutosBusqueda: string };
    tiempos: { cicloDiasHabiles: number | null; primeraRespuestaDiasHabiles: number | null };
  };
}

interface EstadisticasSiafProps {
  /** Pestaña a mostrar al cargar (0 = Tiempos SIAF, 1 = Motivos, 2 = Piloto PG2) */
  tabInicial?: 0 | 1 | 2;
  /** Si es true, no se muestran las pestañas y solo el contenido de tabInicial */
  ocultarTabs?: boolean;
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const chartPanelSx = {
  p: { xs: 2, md: 3 },
  borderRadius: 3,
  height: '100%',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: IGSS_COLORS.blanco,
  backgroundImage: `linear-gradient(180deg, ${IGSS_COLORS.fondoClaro}55 0%, ${IGSS_COLORS.blanco} 42%)`,
  boxShadow: '0 8px 28px rgba(50, 90, 114, 0.08)',
  overflow: 'hidden',
  position: 'relative' as const,
};

const EstadisticasSiaf: React.FC<EstadisticasSiafProps> = ({ tabInicial = 0, ocultarTabs = false }) => {
  const [data, setData] = useState<EstadisticasData | null>(null);
  const [motivosData, setMotivosData] = useState<MotivosRechazoData | null>(null);
  const [tesisData, setTesisData] = useState<EstadisticasTesisPiloto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dias, setDias] = useState(90);
  const [tabEstadisticas, setTabEstadisticas] = useState(tabInicial);
  const tabActual = ocultarTabs ? tabInicial : tabEstadisticas;

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/estadisticas/siaf-tiempos', { params: { dias } }).then((res) => res.data),
      api.get('/estadisticas/motivos-rechazo', { params: { dias } }).then((res) => res.data),
      api.get('/estadisticas/tesis-piloto', { params: { dias: Math.max(dias, 365) } }).then((res) => res.data),
    ])
      .then(([siafRes, motivosRes, tesisRes]) => {
        setData(siafRes);
        setMotivosData(motivosRes);
        setTesisData(tesisRes);
      })
      .catch((err) => {
        const msg = err.response?.data?.message;
        const fallback = err.response
          ? (msg || 'Error al cargar estadísticas.')
          : 'No se pudo conectar con el servidor. Verifique que el backend esté en ejecución (puerto 3001).';
        setError(msg || fallback);
      })
      .finally(() => setLoading(false));
  }, [dias]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!data) return null;

  const chartData = data.porSemana.map((s) => {
    const correccionHoras = s.promedioCorreccionHoras ?? 0;
    return {
      semana: new Date(s.semana).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' }),
      revision: Math.round(s.promedioRevisionHoras * 10) / 10,
      autorizacion: Math.round((s.promedioAutorizacionHoras ?? 0) * 10) / 10,
      correccion: Math.round(correccionHoras * 10) / 10,
      correccionMin: Math.round(correccionHoras * 60 * 10) / 10,
      revisados: s.cantidadRevisados,
      autorizados: s.cantidadAutorizados ?? 0,
      correcciones: s.cantidadCorrecciones,
    };
  });

  const kpiCards = [
    {
      title: 'Tiempo hasta autorización',
      value: data.promedioAutorizacionHoras != null ? formatHoras(data.promedioAutorizacionHoras) : '—',
      subtitle: 'Desde generación hasta autorización',
      detail: `${data.cantidadAutorizados ?? 0} SIAF autorizados`,
      icon: <CheckCircle />,
      color: IGSS_COLORS.azulOscuro,
      accent: IGSS_COLORS.azul,
    },
    {
      title: 'Tiempo de revisión (total)',
      value: data.promedioRevisionHoras != null ? formatHoras(data.promedioRevisionHoras) : '—',
      subtitle: 'Hasta autorización o rechazo',
      detail: `${data.cantidadRevisados} revisados`,
      icon: <Speed />,
      color: IGSS_COLORS.azul,
      accent: IGSS_COLORS.azulClaro,
    },
    {
      title: 'Tiempo de corrección',
      value: data.promedioCorreccionHoras != null ? formatHoras(data.promedioCorreccionHoras) : '—',
      subtitle: 'Desde rechazo hasta corrección',
      detail: `${data.cantidadConCorreccion} correcciones`,
      icon: <Timeline />,
      color: IGSS_COLORS.verdeOscuro,
      accent: IGSS_COLORS.verde,
    },
    {
      title: 'Total revisados',
      value: String(data.cantidadRevisados),
      subtitle: 'Autorizados o rechazados',
      icon: <TrendingUp />,
      color: IGSS_COLORS.textoOscuro,
      accent: IGSS_COLORS.grisOscuro,
    },
    {
      title: 'Correcciones',
      value: String(data.cantidadConCorreccion),
      subtitle: 'Tras rechazo',
      icon: <HourglassEmpty />,
      color: IGSS_COLORS.textoOscuro,
      accent: IGSS_COLORS.gris,
    },
  ];

  const fechaDesde = tabActual === 0 ? data.desde : (motivosData?.desde ?? data.desde);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h6" fontWeight="600" color="primary" sx={{ mb: 1 }}>
        Estadísticas
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Período</InputLabel>
          <Select value={dias} label="Período" onChange={(e) => setDias(Number(e.target.value))}>
            <MenuItem value={30}>Últimos 30 días</MenuItem>
            <MenuItem value={90}>Últimos 90 días</MenuItem>
            <MenuItem value={180}>Últimos 6 meses</MenuItem>
            <MenuItem value={365}>Último año</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          Datos desde {new Date(fechaDesde).toLocaleDateString('es-GT', { dateStyle: 'long' })}
        </Typography>
      </Box>

      {!ocultarTabs && (
        <Tabs value={tabEstadisticas} onChange={(_, v) => setTabEstadisticas(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="SIAF — Tiempos de revisión, autorización y corrección" id="estad-tab-0" aria-controls="estad-panel-0" />
          <Tab label="Motivos de rechazo más frecuentes" id="estad-tab-1" aria-controls="estad-panel-1" />
          <Tab label="Piloto PG2 — Variables de investigación" id="estad-tab-2" aria-controls="estad-panel-2" />
        </Tabs>
      )}

      <div role="tabpanel" hidden={tabActual !== 0} id="estad-panel-0" aria-labelledby="estad-tab-0">
        {tabActual === 0 && (
          <Box>
            <Box sx={{ mb: 5 }}>
              <Typography variant="subtitle1" fontWeight="600" color="text.primary" sx={{ mb: 2, display: 'block' }}>
                Resumen del período
              </Typography>
              <Grid container spacing={2.5}>
                {kpiCards.map((kpi, i) => (
                  <Grid item xs={12} sm={6} md={4} lg key={kpi.title} sx={{ minWidth: { lg: 0 } }}>
                    <motion.div custom={i} variants={fadeUp} initial="hidden" animate="show" style={{ height: '100%' }}>
                      <Card
                        elevation={0}
                        sx={{
                          height: '100%',
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: 'divider',
                          overflow: 'hidden',
                          position: 'relative',
                          transition: 'transform .25s ease, box-shadow .25s ease',
                          '&:hover': {
                            transform: 'translateY(-3px)',
                            boxShadow: '0 12px 28px rgba(50, 90, 114, 0.12)',
                          },
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 4,
                            bgcolor: kpi.accent,
                          },
                        }}
                      >
                        <CardContent sx={{ py: 2.25, px: 2.25, '&:last-child': { pb: 2.25 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75, fontWeight: 600 }}>
                                {kpi.title}
                              </Typography>
                              <Typography variant="h5" fontWeight={800} sx={{ color: kpi.color, mb: 0.5, letterSpacing: '-0.02em' }}>
                                {kpi.value}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {kpi.subtitle}
                              </Typography>
                              {kpi.detail != null && (
                                <Typography variant="caption" display="block" sx={{ mt: 0.75, color: kpi.accent, fontWeight: 600 }}>
                                  {kpi.detail}
                                </Typography>
                              )}
                            </Box>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 2,
                                display: 'grid',
                                placeItems: 'center',
                                bgcolor: `${kpi.accent}18`,
                                color: kpi.accent,
                                flexShrink: 0,
                              }}
                            >
                              {kpi.icon}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {chartData.length > 0 && (
              <>
                <Box sx={{ mb: 5 }}>
                  <Typography variant="subtitle1" fontWeight="600" color="text.primary" sx={{ mb: 2, display: 'block' }}>
                    Detalle por semana
                  </Typography>
                  <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: '0 8px 24px rgba(50, 90, 114, 0.06)',
                    }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: IGSS_COLORS.azulOscuro }}>
                          <TableCell sx={{ fontWeight: 700, py: 1.5, color: '#fff' }}>Semana</TableCell>
                          <TableCell sx={{ fontWeight: 700, py: 1.5, color: '#fff' }} align="right">Prom. revisión</TableCell>
                          <TableCell sx={{ fontWeight: 700, py: 1.5, color: '#fff' }} align="right">Prom. autorización</TableCell>
                          <TableCell sx={{ fontWeight: 700, py: 1.5, color: '#fff' }} align="right">Prom. corrección</TableCell>
                          <TableCell sx={{ fontWeight: 700, py: 1.5, color: '#fff' }} align="right">Revisados</TableCell>
                          <TableCell sx={{ fontWeight: 700, py: 1.5, color: '#fff' }} align="right">Autorizados</TableCell>
                          <TableCell sx={{ fontWeight: 700, py: 1.5, color: '#fff' }} align="right">Correcciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {chartData.map((row) => (
                          <TableRow
                            key={row.semana}
                            hover
                            sx={{ '&:nth-of-type(even)': { bgcolor: IGSS_COLORS.fondo } }}
                          >
                            <TableCell sx={{ py: 1.5, fontWeight: 600 }}>{row.semana}</TableCell>
                            <TableCell align="right" sx={{ py: 1.5 }}>{row.revision > 0 ? formatHoras(row.revision) : '—'}</TableCell>
                            <TableCell align="right" sx={{ py: 1.5 }}>{row.autorizacion > 0 ? formatHoras(row.autorizacion) : '—'}</TableCell>
                            <TableCell align="right" sx={{ py: 1.5 }}>{row.correccion > 0 ? formatHoras(row.correccion) : '—'}</TableCell>
                            <TableCell align="right" sx={{ py: 1.5 }}>{row.revisados}</TableCell>
                            <TableCell align="right" sx={{ py: 1.5 }}>{row.autorizados}</TableCell>
                            <TableCell align="right" sx={{ py: 1.5 }}>{row.correcciones}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="600" color="text.primary" sx={{ mb: 2, display: 'block' }}>
                    Visualización por semana
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} lg={7}>
                      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
                        <Paper elevation={0} sx={chartPanelSx}>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, letterSpacing: '-0.01em' }}>
                                Revisión y autorización
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Promedio semanal en horas · comparación directa
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1.25 }}>
                              <LegendPill color={IGSS_COLORS.azulClaro} label="Revisión" />
                              <LegendPill color={IGSS_COLORS.azul} label="Autorización" />
                            </Box>
                          </Box>
                          <Box sx={{ width: '100%', height: 340 }}>
                            <ChartHoras data={chartData} formatHoras={formatHoras} />
                          </Box>
                        </Paper>
                      </motion.div>
                    </Grid>
                    <Grid item xs={12} lg={5}>
                      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
                        <Paper elevation={0} sx={chartPanelSx}>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.verdeOscuro, letterSpacing: '-0.01em' }}>
                                Tiempo de corrección
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Promedio semanal en minutos
                              </Typography>
                            </Box>
                            <LegendPill color={IGSS_COLORS.verde} label="Corrección" />
                          </Box>
                          <Box sx={{ width: '100%', height: 340 }}>
                            <ChartCorreccion data={chartData} />
                          </Box>
                        </Paper>
                      </motion.div>
                    </Grid>
                  </Grid>
                </Box>
              </>
            )}

            {chartData.length === 0 && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                No hay datos de revisión o corrección en el período seleccionado. Las estadísticas se actualizarán cuando existan SIAFs autorizados, rechazados o corregidos.
              </Alert>
            )}
          </Box>
        )}
      </div>

      <div role="tabpanel" hidden={tabActual !== 1} id="estad-panel-1" aria-labelledby="estad-tab-1">
        {tabActual === 1 && motivosData && (
          <Box>
            <Typography variant="subtitle1" fontWeight="600" color="text.primary" sx={{ mb: 1, display: 'block' }}>
              Motivos de rechazo más frecuentes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Rechazos en el período seleccionado clasificados por categoría. Al rechazar un SIAF, Dirección Departamental puede elegir la categoría para que estas estadísticas se actualicen.
            </Typography>
            {motivosData.total === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                No hay rechazos registrados en este período, o aún no se han clasificado motivos. Los rechazos nuevos pueden incluir una categoría al confirmar el rechazo.
              </Alert>
            ) : (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                <Paper elevation={0} sx={{ ...chartPanelSx, p: 3 }}>
                  <Box sx={{ width: '100%', height: Math.max(260, motivosData.motivos.filter((m) => m.cantidad > 0).length * 52) }}>
                    <ChartMotivosRechazo data={motivosData.motivos} />
                  </Box>
                  {motivosData.sinClasificar > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                      {motivosData.sinClasificar} rechazo(s) sin categoría asignada (anteriores a esta funcionalidad).
                    </Typography>
                  )}
                </Paper>
              </motion.div>
            )}
          </Box>
        )}
      </div>

      <div role="tabpanel" hidden={tabActual !== 2} id="estad-panel-2" aria-labelledby="estad-tab-2">
        {tabActual === 2 && tesisData && (
          <Box>
            <Typography variant="subtitle1" fontWeight="700" sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.5 }}>
              Seguimiento del piloto: línea base vs. SIGEC-IGSS
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Los indicadores del piloto se calculan desde expedientes que tienen Número SIAF y O.C. registrados. La línea base corresponde a los instrumentos V1–V4 verificados (n = 25).
            </Typography>
            {tesisData.muestra.total < tesisData.muestra.meta && (
              <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                Muestra piloto actual: {tesisData.muestra.total} de {tesisData.muestra.meta} casos. Faltan {tesisData.muestra.pendientesParaMeta} expedientes identificados para completar la meta metodológica.
              </Alert>
            )}
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={6}>
                <PilotCard
                  title="V1 · Eficiencia"
                  baseline={`Ciclos: ${tesisData.lineaBase.eficiencia.promedioCiclos.toFixed(2)} · Devueltos: ${tesisData.lineaBase.eficiencia.devueltosPorcentaje.toFixed(0)}%`}
                  pilot={`Ciclos: ${formatMetric(tesisData.piloto.eficiencia.promedioCiclos)} · Devueltos: ${formatPercent(tesisData.piloto.eficiencia.devueltosPorcentaje)}`}
                  detail={`Casos que pasaron al mes siguiente: ${tesisData.piloto.eficiencia.pasaronMes}`}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <PilotCard
                  title="V2 · Calidad documental"
                  baseline={`Observaciones: ${tesisData.lineaBase.calidad.observacionesPromedio.toFixed(2)} · Rechazos/100: ${tesisData.lineaBase.calidad.rechazosPor100.toFixed(0)}`}
                  pilot={`Observaciones: ${formatMetric(tesisData.piloto.calidad.observacionesPromedio)} · Rechazos/100: ${formatMetric(tesisData.piloto.calidad.rechazosPor100)}`}
                  detail="Las observaciones se cuentan desde los motivos documentados por DAF."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <PilotCard
                  title="V3 · Trazabilidad"
                  baseline={`Criterio global T1–T5: ${tesisData.lineaBase.trazabilidad.cumplePorcentaje.toFixed(0)}% · Búsqueda: ${tesisData.lineaBase.trazabilidad.minutosBusqueda.toFixed(2)} min`}
                  pilot={`Criterio global T1–T5: ${formatPercent(tesisData.piloto.trazabilidad.cumplePorcentaje)} · Versiones distinguibles: ${formatPercent(tesisData.piloto.trazabilidad.versionesDistinguiblesPorcentaje)}`}
                  detail={tesisData.piloto.trazabilidad.notaMinutosBusqueda}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <PilotCard
                  title="V4 · Tiempos"
                  baseline={`Ciclo: ${tesisData.lineaBase.tiempos.cicloDiasHabiles.toFixed(2)} días hábiles · 1.ª respuesta: ${tesisData.lineaBase.tiempos.primeraRespuestaDiasHabiles.toFixed(2)}`}
                  pilot={`Ciclo: ${formatMetric(tesisData.piloto.tiempos.cicloDiasHabiles)} días hábiles · 1.ª respuesta: ${formatMetric(tesisData.piloto.tiempos.primeraRespuestaDiasHabiles)}`}
                  detail="Se calcula desde el envío a revisión DAF hasta la primera resolución y aprobación."
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </div>
    </Box>
  );
};

function formatMetric(value: number | null): string {
  return value == null ? '—' : value.toFixed(2);
}

function formatPercent(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(0)}%`;
}

function PilotCard({ title, baseline, pilot, detail }: { title: string; baseline: string; pilot: string; detail: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2.25, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, height: '100%' }}>
      <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 1 }}>{title}</Typography>
      <Typography variant="caption" color="text.secondary" display="block">Línea base (n = 25)</Typography>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1.25 }}>{baseline}</Typography>
      <Typography variant="caption" color="text.secondary" display="block">Piloto SIGEC-IGSS</Typography>
      <Typography variant="body2" fontWeight={800} sx={{ color: IGSS_COLORS.verdeOscuro }}>{pilot}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.25 }}>{detail}</Typography>
    </Paper>
  );
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.1,
        py: 0.45,
        borderRadius: 999,
        bgcolor: `${color}18`,
        border: `1px solid ${color}33`,
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" fontWeight={700} sx={{ color: IGSS_COLORS.textoOscuro }}>
        {label}
      </Typography>
    </Box>
  );
}

function ChartTooltipBox({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <Box
      sx={{
        bgcolor: 'rgba(255,255,255,0.97)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 1.75,
        py: 1.25,
        boxShadow: '0 12px 28px rgba(44, 62, 80, 0.16)',
        minWidth: 160,
      }}
    >
      <Typography variant="caption" fontWeight={800} sx={{ display: 'block', mb: 0.75, color: IGSS_COLORS.textoOscuro }}>
        Semana {label}
      </Typography>
      {payload.map((p: any) => (
        <Box key={p.dataKey} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.35 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: p.color || p.fill }} />
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {p.name}
          </Typography>
          <Typography variant="caption" fontWeight={800}>
            {formatter ? formatter(p.value, p.dataKey) : p.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Gráfico: revisión y autorización por semana (horas) */
function ChartHoras({
  data,
  formatHoras,
}: {
  data: Array<{ semana: string; revision: number; autorizacion: number }>;
  formatHoras: (h: number) => string;
}) {
  const tickFormatter = (value: number) => (value >= 1 ? `${value}h` : value > 0 ? `${Math.round(value * 60)}m` : '0');
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 4 }} barGap={6} barCategoryGap="28%">
        <defs>
          <linearGradient id="gradRevision" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={IGSS_COLORS.azulClaro} stopOpacity={1} />
            <stop offset="100%" stopColor={IGSS_COLORS.azulClaro} stopOpacity={0.72} />
          </linearGradient>
          <linearGradient id="gradAutorizacion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={IGSS_COLORS.azul} stopOpacity={1} />
            <stop offset="100%" stopColor={IGSS_COLORS.azulOscuro} stopOpacity={0.9} />
          </linearGradient>
          <linearGradient id="areaAutorizacion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={IGSS_COLORS.azul} stopOpacity={0.18} />
            <stop offset="100%" stopColor={IGSS_COLORS.azul} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 6" stroke="rgba(59,107,133,0.12)" vertical={false} />
        <XAxis
          dataKey="semana"
          tick={{ fontSize: 12, fill: IGSS_COLORS.textoOscuro, fontWeight: 600 }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(59,107,133,0.18)' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7c8a' }}
          tickFormatter={tickFormatter}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: 'rgba(59,107,133,0.06)' }}
          content={
            <ChartTooltipBox
              formatter={(value: number, key: string) =>
                formatHoras(value)
              }
            />
          }
        />
        <Area
          type="monotone"
          dataKey="autorizacion"
          stroke="none"
          fill="url(#areaAutorizacion)"
          isAnimationActive
          animationDuration={1100}
          animationEasing="ease-out"
        />
        <Bar
          dataKey="revision"
          name="Revisión"
          fill="url(#gradRevision)"
          radius={[10, 10, 4, 4]}
          maxBarSize={36}
          isAnimationActive
          animationBegin={80}
          animationDuration={1200}
          animationEasing="ease-out"
        />
        <Bar
          dataKey="autorizacion"
          name="Autorización"
          fill="url(#gradAutorizacion)"
          radius={[10, 10, 4, 4]}
          maxBarSize={36}
          isAnimationActive
          animationBegin={180}
          animationDuration={1300}
          animationEasing="ease-out"
        />
        <Legend content={() => null} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Gráfico: tiempo de corrección por semana (minutos) */
function ChartCorreccion({ data }: { data: Array<{ semana: string; correccionMin: number }> }) {
  const max = Math.max(...data.map((d) => d.correccionMin), 1);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 4 }} barCategoryGap="34%">
        <defs>
          <linearGradient id="gradCorreccion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={IGSS_COLORS.verdeClaro} stopOpacity={1} />
            <stop offset="100%" stopColor={IGSS_COLORS.verdeOscuro} stopOpacity={0.92} />
          </linearGradient>
          <linearGradient id="areaCorreccion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={IGSS_COLORS.verde} stopOpacity={0.2} />
            <stop offset="100%" stopColor={IGSS_COLORS.verde} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 6" stroke="rgba(107,142,56,0.14)" vertical={false} />
        <XAxis
          dataKey="semana"
          tick={{ fontSize: 12, fill: IGSS_COLORS.textoOscuro, fontWeight: 600 }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(107,142,56,0.2)' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7c8a' }}
          tickFormatter={(v) => `${v}m`}
          tickLine={false}
          axisLine={false}
          width={44}
          domain={[0, Math.ceil(max * 1.25)]}
        />
        <Tooltip
          cursor={{ fill: 'rgba(107,142,56,0.07)' }}
          content={
            <ChartTooltipBox formatter={(value: number) => `${Number(value).toFixed(0)} min`} />
          }
        />
        <Area
          type="monotone"
          dataKey="correccionMin"
          stroke="none"
          fill="url(#areaCorreccion)"
          isAnimationActive
          animationDuration={1100}
        />
        <Bar
          dataKey="correccionMin"
          name="Corrección"
          fill="url(#gradCorreccion)"
          radius={[12, 12, 4, 4]}
          maxBarSize={52}
          isAnimationActive
          animationBegin={120}
          animationDuration={1400}
          animationEasing="ease-out"
        >
          {data.map((_, i) => (
            <Cell key={i} fill="url(#gradCorreccion)" />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Gráfico de barras horizontales: motivos de rechazo */
function ChartMotivosRechazo({ data }: { data: Array<{ clave: string; etiqueta: string; cantidad: number }> }) {
  const filtered = data.filter((d) => d.cantidad > 0);
  if (filtered.length === 0) return null;
  const max = Math.max(...filtered.map((d) => d.cantidad), 1);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={filtered} margin={{ top: 8, right: 28, left: 8, bottom: 8 }} barCategoryGap="18%">
        <defs>
          <linearGradient id="gradRechazo" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E57373" stopOpacity={0.95} />
            <stop offset="100%" stopColor={IGSS_COLORS.error} stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 6" stroke="rgba(198,40,40,0.1)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, Math.ceil(max * 1.15)]} />
        <YAxis
          type="category"
          dataKey="etiqueta"
          width={210}
          tick={{ fontSize: 12, fill: IGSS_COLORS.textoOscuro, fontWeight: 600 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(198,40,40,0.06)' }}
          contentStyle={{ borderRadius: 10, border: '1px solid #eee', boxShadow: '0 10px 24px rgba(0,0,0,0.12)' }}
          formatter={(value: number) => [value, 'Rechazos']}
        />
        <Bar
          dataKey="cantidad"
          name="Rechazos"
          fill="url(#gradRechazo)"
          radius={[0, 10, 10, 0]}
          barSize={26}
          isAnimationActive
          animationDuration={1100}
          animationEasing="ease-out"
          label={{ position: 'right', fill: IGSS_COLORS.textoOscuro, fontSize: 12, fontWeight: 700 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default EstadisticasSiaf;
