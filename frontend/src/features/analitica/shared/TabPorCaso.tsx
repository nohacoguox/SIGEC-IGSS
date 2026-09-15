import React from 'react';
import {
  Alert, Box, Grid, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { AccessTime, AssignmentTurnedIn, Autorenew } from '@mui/icons-material';
import {
  Area, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import {
  axisTick, ChartTooltip, formatTime, gridStroke, panelSx, pieColors, resultadoLabel, tableScrollSx,
} from './charts';
import { KpiCard, SectionBlock } from './ui';

type Tiempos = {
  primeraRespuestaHoras: number | null;
  correccionHoras: number | null;
  respuestaTrasReenvioHoras?: number | null;
  cicloCompletoHoras: number | null;
  muestraPrimeraRespuesta: number;
  muestraCorreccion: number;
  muestraRespuestaTrasReenvio?: number;
  muestraCicloCompleto: number;
} | null | undefined;

type Ciclo = { etiqueta: string; cantidad: number };
type Caso = {
  id: number;
  correlativo: string;
  estado: string;
  resultadoAlCorte: string;
  devoluciones: number;
  correcciones: number;
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
  tiempos: Tiempos;
  ciclos: Ciclo[];
  casos: Caso[];
  trazabilidad: Trazabilidad[];
  gradId: string;
  onSelectCaso?: (id: number) => void;
  /** Etiquetas de columnas del listado (SIAF vs expediente). */
  columnasCaso?: { primaria: string; secundaria: string };
  /** Cabecera de la columna de motivos/observaciones en trazabilidad. */
  columnaMotivos?: string;
};

export default function TabPorCaso({
  casoLabel, itemId, tiempos, ciclos, casos, trazabilidad, gradId, onSelectCaso,
  columnasCaso = { primaria: 'Correlativo', secundaria: 'Estado' },
  columnaMotivos = 'Motivos',
}: Props) {
  const ciclosVisibles = ciclos.filter((c) => c.cantidad > 0);
  const totalCiclos = ciclosVisibles.reduce((t, c) => t + c.cantidad, 0);
  const tiemposSerie = [
    { etapa: 'Respuesta DAF', horas: tiempos?.primeraRespuestaHoras ?? 0 },
    { etapa: 'Corrección', horas: tiempos?.correccionHoras ?? 0 },
    { etapa: 'Tras reenvío', horas: tiempos?.respuestaTrasReenvioHoras ?? 0 },
    { etapa: 'Ciclo completo', horas: tiempos?.cicloCompletoHoras ?? 0 },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <SectionBlock
        title="1. Tiempos promedio del período"
        description="Cuánto tardan, en promedio, las etapas del ciclo. No dependen de un caso seleccionado."
      >
        <Grid container spacing={2.25}>
          <Grid item xs={12} sm={6} md={3}>
            <KpiCard label="Respuesta DAF" value={formatTime(tiempos?.primeraRespuestaHoras)} note={`${tiempos?.muestraPrimeraRespuesta ?? 0} casos`} icon={<AccessTime />} color={IGSS_COLORS.azul} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KpiCard label="Corrección" value={formatTime(tiempos?.correccionHoras)} note={`${tiempos?.muestraCorreccion ?? 0} casos`} icon={<Autorenew />} color="#C47A20" delay={0.05} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KpiCard label="Tras reenvío" value={formatTime(tiempos?.respuestaTrasReenvioHoras)} note={`${tiempos?.muestraRespuestaTrasReenvio ?? 0} casos`} icon={<AccessTime />} color={IGSS_COLORS.azulOscuro} delay={0.1} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KpiCard label="Ciclo completo" value={formatTime(tiempos?.cicloCompletoHoras)} note={`${tiempos?.muestraCicloCompleto ?? 0} casos`} icon={<AssignmentTurnedIn />} color={IGSS_COLORS.verdeOscuro} delay={0.15} />
          </Grid>
          <Grid item xs={12}>
            <Paper elevation={0} sx={panelSx}>
              <Typography fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.25 }}>Comparativo de etapas</Typography>
              <Typography variant="caption" color="text.secondary">Misma información de los indicadores, en gráfico</Typography>
              <Box sx={{ height: 240, mt: 1.5 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={tiemposSerie} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`${gradId}Tiempos`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={IGSS_COLORS.azul} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={IGSS_COLORS.azul} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                    <XAxis dataKey="etapa" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v} h`} tick={axisTick} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="horas" name="Horas" stroke="none" fill={`url(#${gradId}Tiempos)`} />
                    <Line type="monotone" dataKey="horas" name="Promedio" stroke={IGSS_COLORS.azul} strokeWidth={3} dot={{ r: 4, fill: IGSS_COLORS.azulOscuro, strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </SectionBlock>

      <SectionBlock
        title="2. Devoluciones y listado de casos"
        description={`Distribución de ciclos de devolución y listado del período. ${onSelectCaso ? `Haga clic en un ${casoLabel.toLowerCase()} para ver su trazabilidad abajo.` : ''}`}
      >
        <Grid container spacing={2.25}>
          <Grid item xs={12} lg={5} sx={{ minWidth: 0 }}>
            <Paper elevation={0} sx={panelSx}>
              <Typography fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro }}>Devoluciones</Typography>
              <Typography variant="caption" color="text.secondary">Casos agrupados por cantidad de ciclos</Typography>
              {ciclosVisibles.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>Sin ciclos registrados.</Typography>
              ) : (
                <Box sx={{ height: 280, mt: 1, position: 'relative', minWidth: 0, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ciclosVisibles} dataKey="cantidad" nameKey="etiqueta" innerRadius={64} outerRadius={96} paddingAngle={3} stroke={IGSS_COLORS.blanco} strokeWidth={3}>
                        {ciclosVisibles.map((entry) => (
                          <Cell key={entry.etiqueta} fill={pieColors[ciclos.findIndex((c) => c.etiqueta === entry.etiqueta) % pieColors.length]} />
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
          <Grid item xs={12} lg={7} sx={{ minWidth: 0 }}>
            <Paper elevation={0} sx={panelSx}>
              <Typography fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, mb: 1.25 }}>Casos del período</Typography>
              <TableContainer sx={{ ...tableScrollSx, maxHeight: 320 }}>
                <Table size="small" stickyHeader sx={{ minWidth: 520 }}>
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, color: IGSS_COLORS.azulOscuro, borderBottomColor: gridStroke, whiteSpace: 'nowrap', bgcolor: IGSS_COLORS.blanco } }}>
                      <TableCell>{columnasCaso.primaria}</TableCell>
                      <TableCell>{columnasCaso.secundaria}</TableCell>
                      <TableCell>Resultado</TableCell>
                      <TableCell align="right">Devoluciones</TableCell>
                      <TableCell align="right">Correcciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {casos.map((caso) => {
                      const selected = itemId === caso.id;
                      return (
                        <TableRow
                          key={caso.id}
                          hover
                          selected={selected}
                          onClick={onSelectCaso ? () => onSelectCaso(caso.id) : undefined}
                          sx={{
                            cursor: onSelectCaso ? 'pointer' : 'default',
                            bgcolor: selected ? 'rgba(0,91,145,0.06)' : undefined,
                            '& td': { borderBottomColor: gridStroke },
                          }}
                        >
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="body2" fontWeight={700}>{caso.correlativo}</Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{caso.estado}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{resultadoLabel[caso.resultadoAlCorte] || caso.resultadoAlCorte}</TableCell>
                          <TableCell align="right">{caso.devoluciones}</TableCell>
                          <TableCell align="right">{caso.correcciones}</TableCell>
                        </TableRow>
                      );
                    })}
                    {casos.length === 0 && (
                      <TableRow><TableCell colSpan={5}>No hay casos para mostrar.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </SectionBlock>

      <SectionBlock
        title={`3. Trazabilidad del ${casoLabel.toLowerCase()} seleccionado`}
        description="Solo aparece cuando elige un caso en los filtros o en la tabla de arriba."
      >
        {!itemId && (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Seleccione un {casoLabel.toLowerCase()} en los filtros o haga clic en una fila de «Casos del período».
          </Alert>
        )}
        {itemId && trazabilidad.length === 0 && (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Este {casoLabel.toLowerCase()} no tiene ciclos de rechazo/corrección en el período.
          </Alert>
        )}
        {itemId && trazabilidad.length > 0 && (
          <Paper elevation={0} sx={panelSx}>
            <TableContainer sx={tableScrollSx}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: IGSS_COLORS.azulOscuro, borderBottomColor: gridStroke, whiteSpace: 'nowrap' } }}>
                    <TableCell>Rechazo</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell align="right">{columnaMotivos}</TableCell>
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
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(ciclo.fechaRechazo).toLocaleString('es-GT')}</TableCell>
                      <TableCell align="right">{ciclo.motivos}</TableCell>
                      <TableCell align="right">{ciclo.correcciones}</TableCell>
                      <TableCell>{formatTime(ciclo.horasRespuestaDaf)}</TableCell>
                      <TableCell>{formatTime(ciclo.horasCorreccion)}</TableCell>
                      <TableCell>{formatTime(ciclo.horasRespuestaTrasReenvio)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </SectionBlock>
    </motion.div>
  );
}
