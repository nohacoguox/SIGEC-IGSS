import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { AccessTime, AssignmentTurnedIn, Autorenew, FactCheck, HourglassEmpty, WarningAmber } from '@mui/icons-material';
import {
  Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { axisTick, ChartTooltip, formatTime, gridStroke, panelSx } from './charts';
import { KpiCard, SectionBlock } from './ui';

type Resumen = {
  total: number;
  aprobados: number;
  rechazadosAlCierre: number;
  pendientesCorreccion: number;
  pendientesRevisionDaf: number;
};

type CierreMes = {
  etiqueta: string;
  aprobados: number;
  rechazadosAlCierre: number;
  pendientesCorreccion: number;
  pendientesRevisionDaf: number;
};

type Tiempos = {
  primeraRespuestaHoras: number | null;
  correccionHoras: number | null;
  respuestaTrasReenvioHoras?: number | null;
  cicloCompletoHoras: number | null;
  pendienteRevisionDafHoras?: number | null;
  pendienteRevisionDafAbiertaHoras?: number | null;
  muestraPrimeraRespuesta: number;
  muestraCorreccion: number;
  muestraRespuestaTrasReenvio?: number;
  muestraCicloCompleto: number;
  muestraPendienteRevisionDaf?: number;
  muestraPendienteRevisionDafAbierta?: number;
} | null | undefined;

type Props = {
  casoLabel: string;
  resumen: Resumen;
  cierre: CierreMes[];
  gradId: string;
  /** Promedios del período (antes estaban mezclados en «Un caso»). */
  tiempos?: Tiempos;
};

export default function TabGenerales({ casoLabel, resumen, cierre, gradId, tiempos }: Props) {
  const tiemposSerie = tiempos
    ? [
        { etapa: 'Cola DAF (abierta)', horas: tiempos.pendienteRevisionDafAbiertaHoras ?? 0 },
        { etapa: 'Espera DAF', horas: tiempos.pendienteRevisionDafHoras ?? tiempos.primeraRespuestaHoras ?? 0 },
        { etapa: 'Respuesta DAF', horas: tiempos.primeraRespuestaHoras ?? 0 },
        { etapa: 'Corrección', horas: tiempos.correccionHoras ?? 0 },
        { etapa: 'Tras reenvío', horas: tiempos.respuestaTrasReenvioHoras ?? 0 },
        { etapa: 'Ciclo completo', horas: tiempos.cicloCompletoHoras ?? 0 },
      ]
    : [];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <SectionBlock
        title="Números del período"
        description={`Lectura rápida de ${casoLabel.toLowerCase()}: total, aprobados, rechazos y pendientes.`}
      >
        <Grid container spacing={2.25}>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard label={casoLabel} value={resumen.total} note="Casos del período" icon={<FactCheck />} color={IGSS_COLORS.azulOscuro} />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard label="Aprobados" value={resumen.aprobados} note="Con dictamen favorable" icon={<AssignmentTurnedIn />} color={IGSS_COLORS.verdeOscuro} delay={0.05} />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard label="Rechazados al cierre" value={resumen.rechazadosAlCierre} note="Sin aprobación al corte" icon={<WarningAmber />} color={IGSS_COLORS.error} delay={0.1} />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard
              label="Pendientes de corregir"
              value={resumen.pendientesCorreccion}
              note={`${resumen.pendientesRevisionDaf} en revisión DAF`}
              icon={<HourglassEmpty />}
              color="#C47A20"
              delay={0.15}
            />
          </Grid>
        </Grid>
      </SectionBlock>

      <SectionBlock
        title="Evolución mes a mes"
        description="Gráfica de cómo terminaron los casos cada mes: aprobados, rechazos, pendientes y revisión DAF."
      >
        <Paper elevation={0} sx={panelSx}>
          {cierre.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Sin datos de cierre para el período.</Typography>
          ) : (
            <Box sx={{ height: { xs: 300, md: 360 }, mt: 0.5 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cierre} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`${gradId}Aprob`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={IGSS_COLORS.verde} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={IGSS_COLORS.verde} stopOpacity={0.55} />
                    </linearGradient>
                    <linearGradient id={`${gradId}Rech`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={IGSS_COLORS.error} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={IGSS_COLORS.error} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="etiqueta" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
                  <Bar dataKey="aprobados" name="Aprobados" fill={`url(#${gradId}Aprob)`} radius={[6, 6, 0, 0]} barSize={18} />
                  <Bar dataKey="rechazadosAlCierre" name="Rechazados al cierre" fill={`url(#${gradId}Rech)`} radius={[6, 6, 0, 0]} barSize={18} />
                  <Bar dataKey="pendientesCorreccion" name="Pendientes de corregir" fill="#C47A20" radius={[6, 6, 0, 0]} barSize={18} />
                  <Line type="monotone" dataKey="pendientesRevisionDaf" name="En revisión DAF" stroke={IGSS_COLORS.azul} strokeWidth={2.5} dot={{ r: 3.5, fill: IGSS_COLORS.azul }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      </SectionBlock>

      {tiempos && (
        <SectionBlock
          title="Tiempos promedio del período"
          description="Cuánto tardan, en promedio, las etapas del ciclo en todos los casos del filtro (no de un caso solo)."
        >
          <Grid container spacing={2.25}>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                label="Pendiente revisión DAF"
                value={formatTime(tiempos.pendienteRevisionDafAbiertaHoras ?? tiempos.pendienteRevisionDafHoras)}
                note={
                  tiempos.muestraPendienteRevisionDafAbierta
                    ? `${tiempos.muestraPendienteRevisionDafAbierta} en cola ahora`
                    : `${tiempos.muestraPendienteRevisionDaf ?? 0} medidos`
                }
                icon={<HourglassEmpty />}
                color={IGSS_COLORS.azul}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                label="Respuesta DAF"
                value={formatTime(tiempos.primeraRespuestaHoras)}
                note={`${tiempos.muestraPrimeraRespuesta} casos`}
                icon={<AccessTime />}
                color={IGSS_COLORS.azulOscuro}
                delay={0.04}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                label="Corrección"
                value={formatTime(tiempos.correccionHoras)}
                note={`${tiempos.muestraCorreccion} casos`}
                icon={<Autorenew />}
                color="#C47A20"
                delay={0.08}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                label="Tras reenvío"
                value={formatTime(tiempos.respuestaTrasReenvioHoras)}
                note={`${tiempos.muestraRespuestaTrasReenvio ?? 0} casos`}
                icon={<AccessTime />}
                color="#5B7C99"
                delay={0.12}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                label="Ciclo completo"
                value={formatTime(tiempos.cicloCompletoHoras)}
                note={`${tiempos.muestraCicloCompleto} casos`}
                icon={<AssignmentTurnedIn />}
                color={IGSS_COLORS.verdeOscuro}
                delay={0.16}
              />
            </Grid>
            <Grid item xs={12}>
              <Paper elevation={0} sx={panelSx}>
                <Typography fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.25 }}>
                  Comparativo de etapas
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Misma información de los indicadores, en gráfico
                </Typography>
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
                      <Line
                        type="monotone"
                        dataKey="horas"
                        name="Promedio"
                        stroke={IGSS_COLORS.azul}
                        strokeWidth={3}
                        dot={{ r: 4, fill: IGSS_COLORS.azulOscuro, strokeWidth: 0 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </SectionBlock>
      )}
    </motion.div>
  );
}
