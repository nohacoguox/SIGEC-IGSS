import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography, alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import {
  axisTick, formatTime, gridStroke, panelSx, resultadoLabel, tableScrollSx,
} from './charts';
import { SectionBlock } from './ui';

type EsperaRevisionDaf = {
  horas: number | null;
  abierta: boolean;
  desde: string | null;
  hasta: string | null;
};

type Caso = {
  id: number;
  correlativo: string;
  estado: string;
  resultadoAlCorte: string;
  devoluciones: number;
  correcciones: number;
  horasPendienteRevisionDaf?: number | null;
  esperaRevisionDaf?: EsperaRevisionDaf | null;
};
type Trazabilidad = {
  rechazoNumero: number;
  fechaRechazo: string;
  motivos: number;
  correcciones: number;
  horasRespuestaDaf: number | null;
  horasCorreccion: number | null;
  horasRespuestaTrasReenvio: number | null;
};

type Props = {
  casoLabel: string;
  itemId?: number;
  casos: Caso[];
  trazabilidad: Trazabilidad[];
  onSelectCaso: (id: number) => void;
  onClearCaso?: () => void;
  columnasCaso?: { primaria: string; secundaria: string };
  columnaMotivos?: string;
  cargandoDetalle?: boolean;
  /** Espera DAF del caso seleccionado (prioridad sobre la del listado). */
  esperaRevisionDaf?: EsperaRevisionDaf | null;
};

const COLORS = {
  daf: IGSS_COLORS.azul,
  correccion: '#C47A20',
  reenvio: IGSS_COLORS.verde,
};

/** Convierte horas a la unidad de lectura más clara (min / h / días). */
const toDisplayUnit = (horas: number | null | undefined): number | null => {
  if (horas == null || Number.isNaN(horas)) return null;
  return horas;
};

const formatAxisTick = (horas: number, usarMinutos: boolean) => {
  if (usarMinutos) return `${Math.round(horas * 60)}m`;
  if (horas >= 24) return `${(horas / 24).toFixed(1)}d`;
  if (horas >= 1) return `${horas.toFixed(1)}h`;
  return `${Math.round(horas * 60)}m`;
};

const TimeTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const items = payload.filter((e: any) => e.value != null && e.value > 0);
  if (!items.length) return null;
  return (
    <Box
      sx={{
        bgcolor: 'rgba(255,255,255,0.98)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 1.25,
        py: 1,
        boxShadow: '0 10px 28px rgba(50, 90, 114, 0.14)',
        minWidth: 150,
      }}
    >
      {label && (
        <Typography variant="caption" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, display: 'block', mb: 0.5 }}>
          {label}
        </Typography>
      )}
      {items.map((entry: any) => (
        <Box key={entry.dataKey || entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color || entry.fill, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">{entry.name}</Typography>
          <Typography variant="caption" fontWeight={700} sx={{ ml: 'auto' }}>
            {formatTime(typeof entry.value === 'number' ? entry.value : null)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

const EtapaTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row || row.horas == null) return null;
  return (
    <Box
      sx={{
        bgcolor: 'rgba(255,255,255,0.98)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 1.25,
        py: 1,
        boxShadow: '0 10px 28px rgba(50, 90, 114, 0.14)',
      }}
    >
      <Typography variant="caption" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
        {row.etapa}
      </Typography>
      <Typography variant="body2" fontWeight={800} sx={{ color: row.color }}>
        {formatTime(row.horas)}
      </Typography>
    </Box>
  );
};

/**
 * Listado del período + diálogo emergente con gráfica de tiempos y trazabilidad.
 */
export default function TabPorCaso({
  casoLabel,
  itemId,
  casos,
  trazabilidad,
  onSelectCaso,
  onClearCaso,
  columnasCaso = { primaria: 'Correlativo', secundaria: 'Estado' },
  columnaMotivos = 'Motivos',
  cargandoDetalle = false,
  esperaRevisionDaf: esperaProp,
}: Props) {
  const [busqueda, setBusqueda] = useState('');
  const casoSel = useMemo(() => casos.find((c) => c.id === itemId) || null, [casos, itemId]);
  const abierto = itemId != null;
  const esperaDaf = esperaProp ?? casoSel?.esperaRevisionDaf ?? null;
  const horasEsperaDaf = esperaDaf?.horas ?? casoSel?.horasPendienteRevisionDaf ?? null;

  const casosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return casos;
    return casos.filter(
      (c) =>
        c.correlativo.toLowerCase().includes(q) ||
        c.estado.toLowerCase().includes(q) ||
        (resultadoLabel[c.resultadoAlCorte] || c.resultadoAlCorte || '').toLowerCase().includes(q),
    );
  }, [casos, busqueda]);

  const promedios = useMemo(() => {
    if (!trazabilidad.length) return null;
    const avg = (pick: (t: Trazabilidad) => number | null) => {
      const vals = trazabilidad.map(pick).filter((v): v is number => v != null);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    return {
      respuestaDaf: avg((t) => t.horasRespuestaDaf),
      correccion: avg((t) => t.horasCorreccion),
      trasReenvio: avg((t) => t.horasRespuestaTrasReenvio),
    };
  }, [trazabilidad]);

  /** Barras horizontales por etapa (más legible con 1 ciclo o valores cortos). */
  const etapasData = useMemo(() => {
    const filas = [
      {
        etapa: esperaDaf?.abierta ? 'En cola DAF (ahora)' : 'Espera revisión DAF',
        horas: toDisplayUnit(horasEsperaDaf),
        color: COLORS.daf,
      },
      { etapa: 'Respuesta DAF', horas: toDisplayUnit(promedios?.respuestaDaf ?? null), color: IGSS_COLORS.azulOscuro },
      { etapa: 'Corrección', horas: toDisplayUnit(promedios?.correccion ?? null), color: COLORS.correccion },
      { etapa: 'Tras reenvío', horas: toDisplayUnit(promedios?.trasReenvio ?? null), color: COLORS.reenvio },
    ];
    // Si no hay ciclos ni espera, no graficar.
    if (!filas.some((r) => r.horas != null)) return [];
    return filas.map((r) => ({ ...r, valor: r.horas ?? 0 }));
  }, [promedios, horasEsperaDaf, esperaDaf?.abierta]);

  /** Comparativo por ciclo (si hay más de uno). */
  const ciclosData = useMemo(
    () =>
      trazabilidad.map((c) => ({
        ciclo: `#${c.rechazoNumero}`,
        respuestaDaf: c.horasRespuestaDaf,
        correccion: c.horasCorreccion,
        trasReenvio: c.horasRespuestaTrasReenvio,
      })),
    [trazabilidad],
  );

  const usarMinutos = useMemo(() => {
    const vals = [
      ...trazabilidad.flatMap((t) =>
        [t.horasRespuestaDaf, t.horasCorreccion, t.horasRespuestaTrasReenvio].filter(
          (v): v is number => v != null,
        ),
      ),
      ...(horasEsperaDaf != null ? [horasEsperaDaf] : []),
    ];
    if (!vals.length) return true;
    return Math.max(...vals) < 2;
  }, [trazabilidad, horasEsperaDaf]);

  const chartHeightEtapas = 168;
  const chartHeightCiclos = Math.min(260, 110 + trazabilidad.length * 48);

  const cerrar = () => onClearCaso?.();

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <SectionBlock
        title={`${casoLabel}s del período (${casos.length})`}
        action={
          <TextField
            size="small"
            placeholder="Buscar…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ minWidth: { xs: '100%', sm: 220 } }}
          />
        }
      >
        <Paper elevation={0} sx={panelSx}>
          {casos.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No hay {casoLabel.toLowerCase()}s en este período / alcance. Ajuste los filtros y pulse Aplicar.
            </Alert>
          ) : (
            <TableContainer sx={{ ...tableScrollSx, maxHeight: 520 }}>
              <Table size="medium" stickyHeader sx={{ minWidth: 560 }}>
                <TableHead>
                  <TableRow
                    sx={{
                      '& th': {
                        fontWeight: 700,
                        color: IGSS_COLORS.azulOscuro,
                        borderBottomColor: gridStroke,
                        whiteSpace: 'nowrap',
                        bgcolor: 'background.paper',
                      },
                    }}
                  >
                    <TableCell>{columnasCaso.primaria}</TableCell>
                    <TableCell>{columnasCaso.secundaria}</TableCell>
                    <TableCell>Resultado</TableCell>
                    <TableCell align="right">Espera DAF</TableCell>
                    <TableCell align="right">Devol.</TableCell>
                    <TableCell align="right">Corr.</TableCell>
                    <TableCell align="center">Detalle</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {casosFiltrados.map((caso) => {
                    const activo = caso.id === itemId;
                    const esperaHoras = caso.esperaRevisionDaf?.horas ?? caso.horasPendienteRevisionDaf;
                    const esperaAbierta = caso.esperaRevisionDaf?.abierta;
                    return (
                      <TableRow
                        key={caso.id}
                        hover
                        selected={activo}
                        onClick={() => onSelectCaso(caso.id)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: alpha(IGSS_COLORS.azul, 0.06) },
                          '&.Mui-selected': { bgcolor: alpha(IGSS_COLORS.azul, 0.1) },
                          '& td': { borderBottomColor: gridStroke },
                        }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" fontWeight={800} color={IGSS_COLORS.azulOscuro}>
                            {caso.correlativo}
                          </Typography>
                        </TableCell>
                        <TableCell>{caso.estado}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={resultadoLabel[caso.resultadoAlCorte] || caso.resultadoAlCorte || '—'}
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight={800}
                            sx={{ color: esperaAbierta ? IGSS_COLORS.azul : 'text.primary' }}
                          >
                            {formatTime(esperaHoras)}
                            {esperaAbierta ? ' ·' : ''}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{caso.devoluciones}</TableCell>
                        <TableCell align="right">{caso.correcciones}</TableCell>
                        <TableCell align="center">
                          <VisibilityIcon fontSize="small" sx={{ color: IGSS_COLORS.azulOscuro }} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {casosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>Ningún resultado con «{busqueda}».</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </SectionBlock>

      <Dialog
        open={abierto}
        onClose={cerrar}
        fullWidth
        maxWidth="lg"
        scroll="body"
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            maxHeight: { xs: '96vh', sm: '92vh' },
            m: { xs: 1, sm: 2 },
            width: { xs: 'calc(100% - 16px)', sm: '100%' },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1.5,
            py: 1.5,
            px: 2,
            pr: 1,
            bgcolor: alpha(IGSS_COLORS.azul, 0.04),
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Análisis · {casoLabel}
            </Typography>
            <Typography variant="h6" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, lineHeight: 1.2, fontSize: '1.15rem' }}>
              {casoSel?.correlativo || 'Cargando…'}
            </Typography>
            {casoSel && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                <Chip size="small" label={casoSel.estado} sx={{ fontWeight: 700, height: 24 }} />
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={resultadoLabel[casoSel.resultadoAlCorte] || casoSel.resultadoAlCorte || 'Sin resultado'}
                  sx={{ fontWeight: 700, height: 24 }}
                />
                <Chip size="small" label={`${casoSel.devoluciones} devol.`} sx={{ fontWeight: 600, height: 24 }} />
                <Chip size="small" label={`${casoSel.correcciones} corr.`} sx={{ fontWeight: 600, height: 24 }} />
              </Box>
            )}
          </Box>
          <IconButton aria-label="Cerrar" onClick={cerrar} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent
          sx={{
            px: { xs: 1.5, sm: 2.25 },
            pt: '16px !important',
            pb: 2,
            overflow: 'auto',
          }}
        >
          {cargandoDetalle && (
            <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}>
              <CircularProgress size={36} />
            </Box>
          )}

          {!cargandoDetalle && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              {/* KPIs: espera DAF siempre + etapas de ciclo si existen */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: trazabilidad.length ? 'repeat(2, 1fr)' : '1fr',
                    md: trazabilidad.length ? 'repeat(4, 1fr)' : '1fr',
                  },
                  gap: 1,
                }}
              >
                {[
                  {
                    label: esperaDaf?.abierta ? 'Pendiente revisión DAF (en curso)' : 'Espera revisión DAF',
                    value: horasEsperaDaf,
                    color: COLORS.daf,
                    note: esperaDaf?.desde
                      ? `Desde ${new Date(esperaDaf.desde).toLocaleString('es-GT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : undefined,
                  },
                  ...(promedios
                    ? [
                        { label: 'Respuesta DAF', value: promedios.respuestaDaf, color: IGSS_COLORS.azulOscuro as string, note: undefined as string | undefined },
                        { label: 'Corrección', value: promedios.correccion, color: COLORS.correccion, note: undefined as string | undefined },
                        { label: 'Tras reenvío', value: promedios.trasReenvio, color: COLORS.reenvio, note: undefined as string | undefined },
                      ]
                    : []),
                ].map((kpi) => (
                  <Box
                    key={kpi.label}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.25,
                      px: 1.25,
                      py: 0.85,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderLeft: `3px solid ${kpi.color}`,
                      bgcolor: alpha(kpi.color, 0.04),
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {kpi.label}
                      </Typography>
                      <Typography variant="subtitle1" fontWeight={800} sx={{ color: kpi.color, lineHeight: 1.1 }}>
                        {formatTime(kpi.value)}
                      </Typography>
                    </Box>
                    {kpi.note && (
                      <Typography variant="caption" color="text.secondary">
                        {kpi.note}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>

              {/* Flujo visual del proceso */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 0.25,
                }}
              >
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mr: 0.5 }}>
                  Flujo:
                </Typography>
                {(trazabilidad.length > 0
                  ? [
                      { label: 'Envío a DAF', color: IGSS_COLORS.azulOscuro },
                      { label: `Espera ${formatTime(horasEsperaDaf)}`, color: COLORS.daf },
                      { label: `Corrección ${formatTime(promedios?.correccion)}`, color: COLORS.correccion },
                      { label: `Reenvío ${formatTime(promedios?.trasReenvio)}`, color: COLORS.reenvio },
                    ]
                  : [
                      { label: 'Envío a revisión', color: IGSS_COLORS.azulOscuro },
                      {
                        label: esperaDaf?.abierta
                          ? `En cola DAF ${formatTime(horasEsperaDaf)}`
                          : `Espera DAF ${formatTime(horasEsperaDaf)}`,
                        color: COLORS.daf,
                      },
                      {
                        label: esperaDaf?.abierta ? 'Pendiente de dictamen' : 'Dictamen emitido',
                        color: esperaDaf?.abierta ? '#C47A20' : IGSS_COLORS.verde,
                      },
                    ]
                ).map((step, idx) => (
                  <React.Fragment key={`${step.label}-${idx}`}>
                    {idx > 0 && (
                      <Typography variant="caption" color="text.disabled" fontWeight={700}>
                        →
                      </Typography>
                    )}
                    <Chip
                      size="small"
                      label={step.label}
                      sx={{
                        height: 26,
                        fontWeight: 700,
                        bgcolor: alpha(step.color, 0.1),
                        color: step.color,
                        border: '1px solid',
                        borderColor: alpha(step.color, 0.25),
                      }}
                    />
                  </React.Fragment>
                ))}
              </Box>

              {trazabilidad.length === 0 && horasEsperaDaf == null && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  Este {casoLabel.toLowerCase()} no tiene envíos a revisión ni ciclos de rechazo en el período.
                </Alert>
              )}
              {trazabilidad.length === 0 && horasEsperaDaf != null && (
                <Alert severity={esperaDaf?.abierta ? 'warning' : 'info'} sx={{ borderRadius: 2 }}>
                  {esperaDaf?.abierta
                    ? `Sin ciclos de rechazo aún: lleva ${formatTime(horasEsperaDaf)} en pendiente de revisión DAF (desde el último envío).`
                    : `DAF respondió en ${formatTime(horasEsperaDaf)} desde el último envío. Sin ciclos de rechazo/corrección en el período.`}
                </Alert>
              )}

              {etapasData.length > 0 && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: trazabilidad.length > 1 ? '1fr 1fr' : '1fr',
                    },
                    gap: 1.5,
                    alignItems: 'stretch',
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      minHeight: chartHeightEtapas + 48,
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.5 }}>
                      Tiempos por etapa
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {usarMinutos ? 'Escala en minutos' : 'Escala en horas / días'}
                      {esperaDaf?.abierta ? ' · incluye espera abierta en cola DAF' : ''}
                    </Typography>
                    <Box sx={{ width: '100%', height: chartHeightEtapas }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={etapasData}
                          margin={{ top: 4, right: 28, left: 8, bottom: 4 }}
                          barCategoryGap="28%"
                        >
                          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                          <XAxis
                            type="number"
                            tick={axisTick}
                            tickFormatter={(v) => formatAxisTick(v, usarMinutos)}
                            domain={[0, (dataMax: number) => Math.max(dataMax * 1.15, usarMinutos ? 0.25 : 1)]}
                          />
                          <YAxis
                            type="category"
                            dataKey="etapa"
                            width={128}
                            tick={{ ...axisTick, fontSize: 11, fontWeight: 600 }}
                          />
                          <Tooltip content={<EtapaTooltip />} cursor={{ fill: alpha(IGSS_COLORS.azul, 0.06) }} />
                          <Bar dataKey="valor" name="Tiempo" radius={[0, 6, 6, 0]} maxBarSize={28}>
                            {etapasData.map((row) => (
                              <Cell
                                key={row.etapa}
                                fill={row.horas == null ? alpha(row.color, 0.2) : row.color}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>

                  {trazabilidad.length > 1 && (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        minHeight: chartHeightCiclos + 48,
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.5 }}>
                        Comparativo por rechazo
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Cada ciclo de devolución
                      </Typography>
                      <Box sx={{ width: '100%', height: chartHeightCiclos }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={ciclosData}
                            margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                            barGap={2}
                            barCategoryGap="22%"
                          >
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                            <XAxis dataKey="ciclo" tick={axisTick} />
                            <YAxis
                              tick={axisTick}
                              width={40}
                              tickFormatter={(v) => formatAxisTick(v, usarMinutos)}
                            />
                            <Tooltip content={<TimeTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                            <Bar dataKey="respuestaDaf" name="DAF" fill={COLORS.daf} radius={[3, 3, 0, 0]} maxBarSize={22} />
                            <Bar dataKey="correccion" name="Corrección" fill={COLORS.correccion} radius={[3, 3, 0, 0]} maxBarSize={22} />
                            <Bar dataKey="trasReenvio" name="Reenvío" fill={COLORS.reenvio} radius={[3, 3, 0, 0]} maxBarSize={22} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  )}
                </Box>
              )}

              {/* Tabla compacta sin scroll horizontal forzado */}
              {trazabilidad.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.75 }}>
                    Trazabilidad
                  </Typography>
                  <TableContainer
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                      <TableHead>
                        <TableRow
                          sx={{
                            bgcolor: alpha(IGSS_COLORS.azul, 0.06),
                            '& th': {
                              fontWeight: 700,
                              color: IGSS_COLORS.azulOscuro,
                              borderBottomColor: gridStroke,
                              py: 0.85,
                              fontSize: '0.75rem',
                              lineHeight: 1.25,
                            },
                          }}
                        >
                          <TableCell width="8%">#</TableCell>
                          <TableCell width="22%">Fecha</TableCell>
                          <TableCell align="right" width="10%">{columnaMotivos === 'Observaciones' ? 'Obs.' : columnaMotivos}</TableCell>
                          <TableCell align="right" width="10%">Corr.</TableCell>
                          <TableCell width="16%">DAF</TableCell>
                          <TableCell width="16%">Corrección</TableCell>
                          <TableCell width="18%">Reenvío</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {trazabilidad.map((ciclo) => (
                          <TableRow key={ciclo.rechazoNumero} hover sx={{ '& td': { borderBottomColor: gridStroke, py: 0.85, fontSize: '0.8rem' } }}>
                            <TableCell>#{ciclo.rechazoNumero}</TableCell>
                            <TableCell>
                              {new Date(ciclo.fechaRechazo).toLocaleString('es-GT', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell align="right">{ciclo.motivos}</TableCell>
                            <TableCell align="right">{ciclo.correcciones}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: COLORS.daf }}>{formatTime(ciclo.horasRespuestaDaf)}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: COLORS.correccion }}>{formatTime(ciclo.horasCorreccion)}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: COLORS.reenvio }}>{formatTime(ciclo.horasRespuestaTrasReenvio)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
