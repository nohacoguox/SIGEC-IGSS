import React from 'react';
import { alpha } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import HourglassIcon from '@mui/icons-material/HourglassTopOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { IGSS_COLORS } from '../../../theme/institutionalColors';

/** Colores y textos por estado, para chips y tarjetas de resumen. */
export const estadoConfig: Record<string, { color: string; bg: string; icon: React.ReactElement }> = {
  Borrador: { color: IGSS_COLORS.azul, bg: alpha(IGSS_COLORS.azul, 0.12), icon: <DescriptionIcon /> },
  'En Revisión': { color: '#B26A00', bg: alpha('#ED6C02', 0.14), icon: <HourglassIcon /> },
  Finalizado: { color: '#1565C0', bg: alpha('#1976D2', 0.12), icon: <TaskAltIcon /> },
  Rechazado: { color: IGSS_COLORS.error, bg: alpha(IGSS_COLORS.error, 0.12), icon: <HighlightOffIcon /> },
};

export const SIAF_ESTADOS = ['Borrador', 'En Revisión', 'Finalizado', 'Rechazado'] as const;
