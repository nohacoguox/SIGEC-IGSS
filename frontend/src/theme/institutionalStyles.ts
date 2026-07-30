import type { SxProps, Theme } from '@mui/material';
import { IGSS_COLORS } from './institutionalColors';

/** Encabezados de tabla — azul institucional sólido */
export const tableHeaderCellStyle = {
  backgroundColor: IGSS_COLORS.azul,
  color: IGSS_COLORS.blanco,
};

export const tableHeaderRowStyle = {
  backgroundColor: IGSS_COLORS.azul,
};

export const tableHeaderCellSx: SxProps<Theme> = {
  fontWeight: 700,
  fontSize: '0.9375rem',
  py: 2,
  borderBottom: 'none',
  color: IGSS_COLORS.blanco,
};

/** Título principal de página (sin degradados) */
export const pageTitleSx: SxProps<Theme> = {
  color: IGSS_COLORS.azul,
  fontWeight: 700,
  mb: 0.5,
};

/** Botón primario institucional */
export const primaryButtonSx: SxProps<Theme> = {
  borderRadius: 2,
  py: 1.5,
  px: 3,
  textTransform: 'none',
  fontWeight: 600,
  bgcolor: IGSS_COLORS.azul,
  boxShadow: 2,
  '&:hover': {
    bgcolor: IGSS_COLORS.azulOscuro,
  },
};

/** Botón secundario con acento verde */
export const secondaryAccentButtonSx: SxProps<Theme> = {
  bgcolor: IGSS_COLORS.verde,
  '&:hover': {
    bgcolor: IGSS_COLORS.verdeOscuro,
  },
};

/** Encabezado de sección en formularios (SIAF, etc.) */
export const sectionHeaderSx = (color: string): SxProps<Theme> => ({
  bgcolor: color,
  color: IGSS_COLORS.blanco,
  px: 3,
  py: 2,
  borderRadius: '12px 12px 0 0',
});
