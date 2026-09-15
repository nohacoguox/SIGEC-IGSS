import React from 'react';
import { Box, Typography } from '@mui/material';
import { IGSS_COLORS } from '../../../theme/institutionalColors';

export const formatTime = (value: number | null | undefined) => {
  if (value == null) return '—';
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 24) return `${value.toFixed(1)} h`;
  return `${(value / 24).toFixed(1)} días`;
};

export const panelSx = {
  p: 2.75,
  height: '100%',
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: IGSS_COLORS.blanco,
  boxShadow: '0 8px 24px rgba(50, 90, 114, 0.06)',
};

export const axisTick = { fill: '#6B7C8A', fontSize: 11, fontWeight: 500 };
export const gridStroke = 'rgba(50, 90, 114, 0.08)';
export const pieColors = [IGSS_COLORS.verde, IGSS_COLORS.azul, '#C47A20', IGSS_COLORS.error];

export const resultadoLabel: Record<string, string> = {
  aprobado: 'Aprobado',
  rechazado_al_cierre: 'Rechazado al cierre',
  pendiente_correccion: 'Pendiente de corregir',
  pendiente_revision_daf: 'Pendiente revisión DAF',
  sin_movimiento: 'Sin movimiento',
};

export const ChartTooltip = ({ active, payload, label }: any) => {
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

export const analyticsTabsSx = {
  minHeight: 42,
  '& .MuiTab-root': { minHeight: 42, textTransform: 'none', fontWeight: 700, fontSize: '0.92rem' },
  '& .Mui-selected': { color: `${IGSS_COLORS.azulOscuro} !important` },
  '& .MuiTabs-indicator': { height: 3, borderRadius: 2, bgcolor: IGSS_COLORS.azul },
};

export const analyticsPageSx = {
  maxWidth: 1280,
  mx: 'auto',
  pb: 2,
  background: `linear-gradient(180deg, ${IGSS_COLORS.fondoClaro} 0%, ${IGSS_COLORS.fondo} 48%, transparent 100%)`,
  borderRadius: 3,
  px: { xs: 0.5, md: 1 },
  pt: 0.5,
};
