import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { IGSS_COLORS } from '../../../theme/institutionalColors';

export const KpiCard = ({
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
        bgcolor: 'background.paper',
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
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.2 }}>
              {label}
            </Typography>
            <Typography
              variant="h4"
              fontWeight={800}
              title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
              sx={{
                color,
                mt: 0.75,
                lineHeight: 1.15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
                fontSize: typeof value === 'string' && String(value).length > 28 ? '1.15rem' : undefined,
              }}
            >
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

/** Encabezado de bloque: agrupa KPIs / gráficos / tablas para leer por secciones. */
export function SectionBlock({
  title,
  description,
  action,
  children,
  sx,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  sx?: object;
}) {
  return (
    <Box sx={{ mb: 3.25, ...sx }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          flexWrap: 'wrap',
          mb: 1.75,
          pb: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ minWidth: 0, maxWidth: 720 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, lineHeight: 1.3 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {description}
            </Typography>
          )}
        </Box>
        {action}
      </Box>
      {children}
    </Box>
  );
}

/** Guía corta bajo las pestañas principales. */
export const TAB_GUIDES = [
  'Volumen y cierre del período: cuántos casos hay y cómo terminaron cada mes.',
  'Tiempos promedio, devoluciones y detalle de un caso concreto.',
  'Por qué se rechazan: motivos más frecuentes en el período.',
  'Quién tramitó más casos, aprobaciones y devoluciones en su unidad.',
] as const;
