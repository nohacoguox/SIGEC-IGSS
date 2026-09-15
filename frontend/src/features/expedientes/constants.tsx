import React from 'react';
import { alpha } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HourglassTopOutlinedIcon from '@mui/icons-material/HourglassTopOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { IGSS_COLORS } from '../../theme/institutionalColors';

export const TIPOS_DOCUMENTO = [
  'Orden de Compras (Guatecompras)',
  'ACTA',
  'SIAF autorizado',
  'Contrato',
  'Factura',
  'Otro',
];

export const TITULOS_OPCIONES = ['Bien/Producto', 'Servicio'];

/** Lista corta de extensiones: los comodines MIME (image/*) hacen lento el diálogo nativo de Windows. */
export const ARCHIVOS_ACEPTADOS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';

export const estadoConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactElement }> = {
  abierto: {
    label: 'Abierto',
    color: IGSS_COLORS.azul,
    bg: alpha(IGSS_COLORS.azul, 0.12),
    icon: <DescriptionOutlinedIcon />,
  },
  en_proceso: {
    label: 'En revisión',
    color: '#B26A00',
    bg: alpha('#ED6C02', 0.14),
    icon: <HourglassTopOutlinedIcon />,
  },
  aprobado: {
    label: 'Aprobado',
    color: '#1565C0',
    bg: alpha('#1976D2', 0.12),
    icon: <TaskAltIcon />,
  },
  cerrado: {
    label: 'Cerrado',
    color: '#1565C0',
    bg: alpha('#1976D2', 0.12),
    icon: <TaskAltIcon />,
  },
  rechazado: {
    label: 'Rechazado',
    color: IGSS_COLORS.error,
    bg: alpha(IGSS_COLORS.error, 0.12),
    icon: <HighlightOffIcon />,
  },
};
