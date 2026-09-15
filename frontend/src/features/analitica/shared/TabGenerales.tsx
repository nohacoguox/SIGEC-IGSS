import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { AssignmentTurnedIn, FactCheck, HourglassEmpty, WarningAmber } from '@mui/icons-material';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { axisTick, ChartTooltip, gridStroke, panelSx } from './charts';
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

type Props = {
  casoLabel: string;
  resumen: Resumen;
  cierre: CierreMes[];
  gradId: string;
};

export default function TabGenerales({ casoLabel, resumen, cierre, gradId }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <SectionBlock
        title="1. Resumen del período"
        description={`Totales de ${casoLabel.toLowerCase()} en el rango filtrado. Use esta sección para una lectura rápida del volumen.`}
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
        title="2. Evolución mensual"
        description="Resultado al corte de cada mes: aprobados, rechazos, pendientes y los que siguen en revisión DAF."
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
    </motion.div>
  );
}
