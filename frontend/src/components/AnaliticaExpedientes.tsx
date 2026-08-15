import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Card, CardContent, CircularProgress, Grid, Paper, Tab, Tabs, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { AccessTime, AssignmentTurnedIn, Autorenew, FactCheck, HourglassEmpty, WarningAmber } from '@mui/icons-material';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import api from '../api';
import { IGSS_COLORS } from '../theme/institutionalColors';
import AnalyticsFilterPanel, { AnalyticsFilter } from './AnalyticsFilterPanel';

type CierreMes = {
  mes: string;
  etiqueta: string;
  activos: number;
  aprobados: number;
  rechazadosAlCierre: number;
  pendientesCorreccion: number;
  pendientesRevisionDaf: number;
};

type Analytics = {
  desde: string;
  hasta: string;
  general?: {
    resumen: {
      total: number;
      aprobados: number;
      rechazadosAlCierre: number;
      pendientesCorreccion: number;
      pendientesRevisionDaf: number;
    };
    cierreMensual: CierreMes[];
  };
  porExpediente?: {
    tiempos: {
      primeraRespuestaHoras: number | null;
      correccionHoras: number | null;
      respuestaTrasReenvioHoras: number | null;
      cicloCompletoHoras: number | null;
      muestraPrimeraRespuesta: number;
      muestraCorreccion: number;
      muestraRespuestaTrasReenvio: number;
      muestraCicloCompleto: number;
    };
    ciclos: Array<{ etiqueta: string; cantidad: number }>;
    motivos: Array<{ motivo: string; cantidad: number }>;
    casos: Array<{
      id: number;
      numeroExpediente: string;
      titulo: string;
      resultadoAlCorte: string;
      devoluciones: number;
      correcciones: number;
      aprobado: boolean;
    }>;
    trazabilidad: Array<{
      rechazoNumero: number;
      fechaRechazo: string;
      observaciones: number;
      correcciones: number;
      reenviado: boolean;
      fechaReenvio: string | null;
      horasRespuestaDaf: number | null;
      horasCorreccion: number | null;
      horasRespuestaTrasReenvio: number | null;
    }>;
  };
  resumen: {
    total: number;
    aprobados: number;
    pendientesCorreccion?: number;
    pendientesRevisionDaf?: number;
    rechazadosAlCierre?: number;
  };
  tiempos: {
    primeraRespuestaHoras: number | null;
    correccionHoras: number | null;
    respuestaTrasReenvioHoras?: number | null;
    cicloCompletoHoras: number | null;
    muestraPrimeraRespuesta: number;
    muestraCorreccion: number;
    muestraRespuestaTrasReenvio?: number;
    muestraCicloCompleto: number;
  };
  ciclos: Array<{ etiqueta: string; cantidad: number }>;
  motivos: Array<{ motivo: string; cantidad: number }>;
  cierreMensual?: CierreMes[];
  trazabilidad?: Analytics['porExpediente'] extends infer P ? P extends { trazabilidad: infer T } ? T : never : never;
};

const formatTime = (value: number | null | undefined) => {
  if (value == null) return '—';
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 24) return `${value.toFixed(1)} h`;
  return `${(value / 24).toFixed(1)} días`;
};

const panelSx = {
  p: 2.75,
  height: '100%',
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: IGSS_COLORS.blanco,
  boxShadow: '0 8px 24px rgba(50, 90, 114, 0.06)',
};

const axisTick = { fill: '#6B7C8A', fontSize: 11, fontWeight: 500 };
const gridStroke = 'rgba(50, 90, 114, 0.08)';
const pieColors = [IGSS_COLORS.verde, IGSS_COLORS.azul, '#C47A20', IGSS_COLORS.error];

const resultadoLabel: Record<string, string> = {
  aprobado: 'Aprobado',
  rechazado_al_cierre: 'Rechazado al cierre',
  pendiente_correccion: 'Pendiente de corregir',
  pendiente_revision_daf: 'Pendiente revisión DAF',
  sin_movimiento: 'Sin movimiento',
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      bgcolor: 'rgba(255,255,255,0.97)',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2,
      px: 1.5,
      py: 1.25,
      boxShadow: '0 10px 28px rgba(50, 90, 114, 0.14)',
      minWidth: 160,
    }}>
      {label && (
        <Typography variant="caption" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, display: 'block', mb: 0.75 }}>
          {label}
        </Typography>
      )}
      {payload.map((entry: any) => (
        <Box key={entry.dataKey || entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.35 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color || entry.fill }} />
          <Typography variant="caption" color="text.secondary">{entry.name}</Typography>
          <Typography variant="caption" fontWeight={700} sx={{ ml: 'auto', color: IGSS_COLORS.textoOscuro }}>
            {typeof entry.value === 'number' ? entry.value : entry.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

const KpiCard = ({
  label, value, note, icon, color, delay = 0,
}: {
  label: string; value: React.ReactNode; note?: string; icon: React.ReactNode; color: string; delay?: number;
}) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay }} style={{ height: '100%' }}>
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        position: 'relative',
        bgcolor: IGSS_COLORS.blanco,
        transition: 'transform .22s ease, box-shadow .22s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 14px 30px rgba(50, 90, 114, 0.12)',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          bgcolor: color,
        },
      }}
    >
      <CardContent sx={{ py: 2.25, px: 2.25, '&:last-child': { pb: 2.25 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.2 }}>
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color, mt: 0.75, lineHeight: 1.1 }}>
              {value}
            </Typography>
            {note && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                {note}
              </Typography>
            )}
          </Box>
          <Box sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: `${color}14`,
            color,
            flexShrink: 0,
          }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

const AnaliticaExpedientes: React.FC = () => {
  const [filters, setFilters] = useState<AnalyticsFilter>({ dias: 90, agrupacion: 'mes', alcance: 'personal' });
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get('/estadisticas/expedientes-analitica', {
      params: {
        dias: filters.dias,
        desde: filters.desde,
        hasta: filters.hasta,
        agrupacion: 'mes',
        expedienteId: tab === 1 ? filters.itemId : undefined,
        alcance: filters.alcance,
        unidad: filters.unidad,
        usuarioId: filters.usuarioId,
      },
    })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'No se pudo cargar el análisis de expedientes.'))
      .finally(() => setLoading(false));
  }, [filters, tab]);

  const cambiarTab = (_e: React.SyntheticEvent, next: number) => {
    setTab(next);
    if (next !== 1 && filters.itemId != null) {
      setFilters((prev) => ({ ...prev, itemId: undefined }));
    }
  };

  if (loading) return <Box display="grid" sx={{ placeItems: 'center', minHeight: 360 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const cierre = data.general?.cierreMensual ?? data.cierreMensual ?? [];
  const resumen = data.general?.resumen ?? {
    total: data.resumen.total,
    aprobados: data.resumen.aprobados,
    rechazadosAlCierre: data.resumen.rechazadosAlCierre ?? 0,
    pendientesCorreccion: data.resumen.pendientesCorreccion ?? 0,
    pendientesRevisionDaf: data.resumen.pendientesRevisionDaf ?? 0,
  };
  const tiempos = data.porExpediente?.tiempos ?? data.tiempos;
  const ciclos = data.porExpediente?.ciclos ?? data.ciclos;
  const motivos = data.porExpediente?.motivos ?? data.motivos;
  const trazabilidad = data.porExpediente?.trazabilidad ?? data.trazabilidad ?? [];
  const casos = data.porExpediente?.casos ?? [];
  const ciclosVisibles = ciclos.filter((c) => c.cantidad > 0);
  const totalCiclos = ciclosVisibles.reduce((t, c) => t + c.cantidad, 0);
  const totalMotivos = motivos.reduce((t, m) => t + m.cantidad, 0);
  const motivosConPorcentaje = motivos.map((m) => ({
    ...m,
    porcentaje: totalMotivos ? Number(((m.cantidad / totalMotivos) * 100).toFixed(1)) : 0,
  }));
  const tiemposSerie = [
    { etapa: 'Respuesta DAF', horas: tiempos.primeraRespuestaHoras ?? 0 },
    { etapa: 'Corrección', horas: tiempos.correccionHoras ?? 0 },
    { etapa: 'Tras reenvío', horas: tiempos.respuestaTrasReenvioHoras ?? 0 },
    { etapa: 'Ciclo completo', horas: tiempos.cicloCompletoHoras ?? 0 },
  ];

  return (
    <Box sx={{
      maxWidth: 1280,
      mx: 'auto',
      pb: 2,
      background: `linear-gradient(180deg, ${IGSS_COLORS.fondoClaro} 0%, ${IGSS_COLORS.fondo} 48%, transparent 100%)`,
      borderRadius: 3,
      px: { xs: 0.5, md: 1 },
      pt: 0.5,
    }}>
      <Box sx={{ mb: 2.25 }}>
        <Typography variant="h5" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, letterSpacing: -0.3 }}>
          Análisis de expedientes
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          Cierre mensual, trazabilidad y motivos de rechazo.
        </Typography>
      </Box>

      <AnalyticsFilterPanel
        tipo="expediente"
        value={filters}
        onApply={setFilters}
        mostrarCasoEspecifico={tab === 1}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 2, flexWrap: 'wrap' }}>
        <Tabs
          value={tab}
          onChange={cambiarTab}
          sx={{
            minHeight: 42,
            '& .MuiTab-root': { minHeight: 42, textTransform: 'none', fontWeight: 700, fontSize: '0.92rem' },
            '& .Mui-selected': { color: `${IGSS_COLORS.azulOscuro} !important` },
            '& .MuiTabs-indicator': { height: 3, borderRadius: 2, bgcolor: IGSS_COLORS.azul },
          }}
        >
          <Tab label="Generales" />
          <Tab label="Por expediente" />
          <Tab label="Motivos de rechazo" />
        </Tabs>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {new Date(data.desde).toLocaleDateString('es-GT', { dateStyle: 'medium' })} — {new Date(data.hasta).toLocaleDateString('es-GT', { dateStyle: 'medium' })}
        </Typography>
      </Box>

      {tab === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <Grid container spacing={2.25} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6} lg={3}>
              <KpiCard label="Expedientes" value={resumen.total} note="Casos del período" icon={<FactCheck />} color={IGSS_COLORS.azulOscuro} />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <KpiCard label="Aprobados" value={resumen.aprobados} note="Con dictamen favorable" icon={<AssignmentTurnedIn />} color={IGSS_COLORS.verdeOscuro} delay={0.05} />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <KpiCard label="Rechazados al cierre" value={resumen.rechazadosAlCierre} note="Sin aprobación al corte" icon={<WarningAmber />} color={IGSS_COLORS.error} delay={0.1} />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <KpiCard label="Pendientes de corregir" value={resumen.pendientesCorreccion} note={`${resumen.pendientesRevisionDaf} en revisión DAF`} icon={<HourglassEmpty />} color="#C47A20" delay={0.15} />
            </Grid>
          </Grid>

          <Grid container spacing={2.25}>
            <Grid item xs={12} lg={8}>
              <Paper elevation={0} sx={panelSx}>
                <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.25 }}>Cierre mensual</Typography>
                <Typography variant="caption" color="text.secondary">Resultado al corte de cada mes</Typography>
                <Box sx={{ height: 340, mt: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={cierre} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradAprobados" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={IGSS_COLORS.verde} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={IGSS_COLORS.verde} stopOpacity={0.55} />
                        </linearGradient>
                        <linearGradient id="gradRechazo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={IGSS_COLORS.error} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={IGSS_COLORS.error} stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                      <XAxis dataKey="etiqueta" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
                      <Bar dataKey="aprobados" name="Aprobados" fill="url(#gradAprobados)" radius={[6, 6, 0, 0]} barSize={18} />
                      <Bar dataKey="rechazadosAlCierre" name="Rechazados al cierre" fill="url(#gradRechazo)" radius={[6, 6, 0, 0]} barSize={18} />
                      <Bar dataKey="pendientesCorreccion" name="Pendientes de corregir" fill="#C47A20" radius={[6, 6, 0, 0]} barSize={18} />
                      <Line type="monotone" dataKey="pendientesRevisionDaf" name="En revisión DAF" stroke={IGSS_COLORS.azul} strokeWidth={2.5} dot={{ r: 3.5, fill: IGSS_COLORS.azul }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Paper elevation={0} sx={{ ...panelSx, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box>
                  <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>Pendientes de corrección</Typography>
                  <Typography variant="caption" color="text.secondary">Rechazados sin corrección</Typography>
                </Box>
                <Typography variant="h1" fontWeight={800} sx={{ color: '#C47A20', my: 2, fontSize: { xs: '3rem', md: '3.6rem' }, lineHeight: 1 }}>
                  {resumen.pendientesCorreccion}
                </Typography>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: IGSS_COLORS.fondoClaro }}>
                  <Typography variant="body2" color="text.secondary">
                    {resumen.pendientesRevisionDaf} expediente(s) en revisión DAF
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </motion.div>
      )}

      {tab === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {!filters.itemId && (
            <Alert severity="info" sx={{ mb: 2.25, borderRadius: 2 }}>Seleccione un expediente para ver su trazabilidad.</Alert>
          )}

          <Grid container spacing={2.25} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Respuesta DAF" value={formatTime(tiempos.primeraRespuestaHoras)} note={`${tiempos.muestraPrimeraRespuesta} casos`} icon={<AccessTime />} color={IGSS_COLORS.azul} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Corrección" value={formatTime(tiempos.correccionHoras)} note={`${tiempos.muestraCorreccion} casos`} icon={<Autorenew />} color="#C47A20" delay={0.05} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Tras reenvío" value={formatTime(tiempos.respuestaTrasReenvioHoras)} note={`${tiempos.muestraRespuestaTrasReenvio ?? 0} casos`} icon={<AccessTime />} color={IGSS_COLORS.azulOscuro} delay={0.1} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Ciclo completo" value={formatTime(tiempos.cicloCompletoHoras)} note={`${tiempos.muestraCicloCompleto} casos`} icon={<AssignmentTurnedIn />} color={IGSS_COLORS.verdeOscuro} delay={0.15} />
            </Grid>
          </Grid>

          {filters.itemId && trazabilidad.length > 0 && (
            <Paper elevation={0} sx={{ ...panelSx, mb: 2.5 }}>
              <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 1.5 }}>Trazabilidad</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: IGSS_COLORS.azulOscuro, borderBottomColor: gridStroke } }}>
                    <TableCell>Rechazo</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell align="right">Motivos</TableCell>
                    <TableCell align="right">Correcciones</TableCell>
                    <TableCell>Respuesta DAF</TableCell>
                    <TableCell>Corrección</TableCell>
                    <TableCell>Tras reenvío</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trazabilidad.map((ciclo) => (
                    <TableRow key={ciclo.rechazoNumero} hover sx={{ '& td': { borderBottomColor: gridStroke } }}>
                      <TableCell>#{ciclo.rechazoNumero}</TableCell>
                      <TableCell>{new Date(ciclo.fechaRechazo).toLocaleString('es-GT')}</TableCell>
                      <TableCell align="right">{ciclo.observaciones}</TableCell>
                      <TableCell align="right">{ciclo.correcciones}</TableCell>
                      <TableCell>{formatTime(ciclo.horasRespuestaDaf)}</TableCell>
                      <TableCell>{formatTime(ciclo.horasCorreccion)}</TableCell>
                      <TableCell>{formatTime(ciclo.horasRespuestaTrasReenvio)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          <Grid container spacing={2.25}>
            <Grid item xs={12} lg={5}>
              <Paper elevation={0} sx={panelSx}>
                <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>Devoluciones</Typography>
                {ciclosVisibles.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>Sin ciclos registrados.</Typography>
                ) : (
                  <Box sx={{ height: 300, mt: 1, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={ciclosVisibles} dataKey="cantidad" nameKey="etiqueta" innerRadius={68} outerRadius={100} paddingAngle={3} stroke={IGSS_COLORS.blanco} strokeWidth={3}>
                          {ciclosVisibles.map((entry) => (
                            <Cell key={entry.etiqueta} fill={pieColors[ciclos.findIndex((c) => c.etiqueta === entry.etiqueta)]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', pb: 4 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, lineHeight: 1 }}>{totalCiclos}</Typography>
                        <Typography variant="caption" color="text.secondary">casos</Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} lg={7}>
              <Paper elevation={0} sx={panelSx}>
                <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 1.5 }}>Casos del período</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, color: IGSS_COLORS.azulOscuro, borderBottomColor: gridStroke } }}>
                      <TableCell>Expediente</TableCell>
                      <TableCell>Título</TableCell>
                      <TableCell>Resultado</TableCell>
                      <TableCell align="right">Devoluciones</TableCell>
                      <TableCell align="right">Correcciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {casos.map((caso) => (
                      <TableRow key={caso.id} hover sx={{ '& td': { borderBottomColor: gridStroke } }}>
                        <TableCell><Typography variant="body2" fontWeight={700}>{caso.numeroExpediente}</Typography></TableCell>
                        <TableCell>{caso.titulo}</TableCell>
                        <TableCell>{resultadoLabel[caso.resultadoAlCorte] || caso.resultadoAlCorte}</TableCell>
                        <TableCell align="right">{caso.devoluciones}</TableCell>
                        <TableCell align="right">{caso.correcciones}</TableCell>
                      </TableRow>
                    ))}
                    {casos.length === 0 && (
                      <TableRow><TableCell colSpan={5}>No hay casos para mostrar.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper elevation={0} sx={panelSx}>
                <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>Tiempos promedio</Typography>
                <Box sx={{ height: 260, mt: 1.5 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={tiemposSerie} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradTiempos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={IGSS_COLORS.azul} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={IGSS_COLORS.azul} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                      <XAxis dataKey="etapa" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `${v} h`} tick={axisTick} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="horas" name="Horas" stroke="none" fill="url(#gradTiempos)" />
                      <Line type="monotone" dataKey="horas" name="Promedio" stroke={IGSS_COLORS.azul} strokeWidth={3} dot={{ r: 4, fill: IGSS_COLORS.azulOscuro, strokeWidth: 0 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </motion.div>
      )}

      {tab === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <Grid container spacing={2.25}>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Motivos registrados" value={totalMotivos} icon={<WarningAmber />} color={IGSS_COLORS.error} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard label="Tipos de motivo" value={motivos.length} icon={<FactCheck />} color={IGSS_COLORS.azulOscuro} delay={0.05} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <KpiCard
                label="Más frecuente"
                value={motivos[0]?.motivo ?? '—'}
                note={motivos[0] ? `${motivos[0].cantidad} · ${motivosConPorcentaje[0]?.porcentaje ?? 0}%` : undefined}
                icon={<HourglassEmpty />}
                color="#C47A20"
                delay={0.1}
              />
            </Grid>
            <Grid item xs={12}>
              <Paper elevation={0} sx={panelSx}>
                <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>Motivos de rechazo</Typography>
                <Typography variant="caption" color="text.secondary">Frecuencia en el período seleccionado</Typography>
                {motivos.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>No hay motivos registrados.</Typography>
                ) : (
                  <Box sx={{ height: Math.max(340, motivos.length * 52), mt: 2 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={motivosConPorcentaje} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
                        <defs>
                          <linearGradient id="gradMotivos" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#9C2C2C" stopOpacity={0.9} />
                            <stop offset="100%" stopColor={IGSS_COLORS.error} stopOpacity={1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                        <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="motivo" width={210} tick={{ ...axisTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar
                          dataKey="cantidad"
                          name="Cantidad"
                          fill="url(#gradMotivos)"
                          radius={[0, 8, 8, 0]}
                          barSize={22}
                          label={{ position: 'right', fill: IGSS_COLORS.textoOscuro, fontSize: 12, fontWeight: 700 }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </Paper>
            </Grid>
            {motivos.length > 0 && (
              <Grid item xs={12}>
                <Paper elevation={0} sx={panelSx}>
                  <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 1.5 }}>Detalle</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, color: IGSS_COLORS.azulOscuro, borderBottomColor: gridStroke } }}>
                        <TableCell>Motivo</TableCell>
                        <TableCell align="right">Cantidad</TableCell>
                        <TableCell align="right">Participación</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {motivosConPorcentaje.map((m) => (
                        <TableRow key={m.motivo} hover sx={{ '& td': { borderBottomColor: gridStroke } }}>
                          <TableCell>{m.motivo}</TableCell>
                          <TableCell align="right">{m.cantidad}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 56, height: 6, borderRadius: 99, bgcolor: IGSS_COLORS.fondoClaro, overflow: 'hidden' }}>
                                <Box sx={{ width: `${m.porcentaje}%`, height: '100%', bgcolor: IGSS_COLORS.error }} />
                              </Box>
                              <Typography variant="body2" fontWeight={700}>{m.porcentaje}%</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Grid>
            )}
          </Grid>
        </motion.div>
      )}
    </Box>
  );
};

export default AnaliticaExpedientes;
