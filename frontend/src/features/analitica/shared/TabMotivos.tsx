import React, { useState } from 'react';
import {
  Box, Button, Collapse, Grid, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { ExpandLess, ExpandMore, FactCheck, HourglassEmpty, WarningAmber } from '@mui/icons-material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { axisTick, ChartTooltip, gridStroke, panelSx, tableScrollSx } from './charts';
import { KpiCard, SectionBlock } from './ui';

type Motivo = { motivo: string; cantidad: number };

type Props = {
  motivos: Motivo[];
  gradId: string;
};

export default function TabMotivos({ motivos, gradId }: Props) {
  const [verTabla, setVerTabla] = useState(false);
  const totalMotivos = motivos.reduce((t, m) => t + m.cantidad, 0);
  const conPct = motivos.map((m) => ({
    ...m,
    porcentaje: totalMotivos ? Number(((m.cantidad / totalMotivos) * 100).toFixed(1)) : 0,
  }));
  const chartHeight = Math.min(520, Math.max(280, motivos.length * 44));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <SectionBlock
        title="1. Indicadores de motivos"
        description="Cuántos rechazos se documentaron y cuál es el motivo dominante."
      >
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
              note={motivos[0] ? `${motivos[0].cantidad} · ${conPct[0]?.porcentaje ?? 0}%` : undefined}
              icon={<HourglassEmpty />}
              color="#C47A20"
              delay={0.1}
            />
          </Grid>
        </Grid>
      </SectionBlock>

      <SectionBlock
        title="2. Ranking visual"
        description="Barras ordenadas por frecuencia. La tabla numérica es opcional para no duplicar la misma información."
        action={
          motivos.length > 0 ? (
            <Button
              size="small"
              variant="outlined"
              endIcon={verTabla ? <ExpandLess /> : <ExpandMore />}
              onClick={() => setVerTabla((v) => !v)}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {verTabla ? 'Ocultar tabla' : 'Ver tabla de detalle'}
            </Button>
          ) : undefined
        }
      >
        <Paper elevation={0} sx={panelSx}>
          {motivos.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No hay motivos registrados en el período.</Typography>
          ) : (
            <Box sx={{ height: chartHeight, maxHeight: 520, overflowY: motivos.length > 12 ? 'auto' : 'visible' }}>
              <Box sx={{ height: chartHeight, minHeight: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conPct} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id={`${gradId}Motivos`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#9C2C2C" stopOpacity={0.9} />
                        <stop offset="100%" stopColor={IGSS_COLORS.error} stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                    <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="motivo"
                      width={200}
                      tick={{ ...axisTick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => (v.length > 32 ? `${v.slice(0, 32)}…` : v)}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="cantidad"
                      name="Cantidad"
                      fill={`url(#${gradId}Motivos)`}
                      radius={[0, 8, 8, 0]}
                      barSize={20}
                      label={{ position: 'right', fill: IGSS_COLORS.textoOscuro, fontSize: 12, fontWeight: 700 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          )}
        </Paper>

        <Collapse in={verTabla && motivos.length > 0}>
          <Paper elevation={0} sx={{ ...panelSx, mt: 2 }}>
            <Typography fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, mb: 1.25 }}>Detalle numérico</Typography>
            <TableContainer sx={tableScrollSx}>
              <Table size="small" sx={{ minWidth: 420 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: IGSS_COLORS.azulOscuro, borderBottomColor: gridStroke, whiteSpace: 'nowrap' } }}>
                    <TableCell>Motivo</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell align="right">Participación</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {conPct.map((m) => (
                    <TableRow key={m.motivo} hover sx={{ '& td': { borderBottomColor: gridStroke } }}>
                      <TableCell sx={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.motivo}>{m.motivo}</TableCell>
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
            </TableContainer>
          </Paper>
        </Collapse>
      </SectionBlock>
    </motion.div>
  );
}
