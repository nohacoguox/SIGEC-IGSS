import { SxProps, Theme } from '@mui/material';
import { ThemeMode } from '../../context/ThemeContext';
import { IGSS_COLORS } from '../../theme/institutionalColors';

export const drawerWidth = 280;

const drawerPaperStyles = (mode: ThemeMode) => ({
  width: drawerWidth,
  boxSizing: 'border-box' as const,
  background: mode !== 'dark' ? IGSS_COLORS.azul : '#2A3F4D',
  color: IGSS_COLORS.blanco,
  borderRight: 'none',
  boxShadow: '2px 0 12px rgba(50, 90, 114, 0.2)',
});

export const getDrawerSx = (mode: ThemeMode): SxProps<Theme> => ({
  width: drawerWidth,
  flexShrink: 0,
  '& .MuiDrawer-paper': drawerPaperStyles(mode),
});

export const navItemSx = (selected: boolean): SxProps<Theme> => ({
  borderRadius: 2,
  mb: 1,
  py: 1.4,
  position: 'relative',
  backgroundColor: selected ? IGSS_COLORS.azulClaro : 'transparent',
  border: selected ? `1px solid ${IGSS_COLORS.blanco}` : '1px solid transparent',
  transition: 'background-color 0.2s ease',
  '&::before': selected
    ? {
        content: '""',
        position: 'absolute',
        left: 0,
        top: '18%',
        bottom: '18%',
        width: 4,
        borderRadius: '0 3px 3px 0',
        bgcolor: IGSS_COLORS.blanco,
      }
    : {},
  '&:hover': {
    backgroundColor: IGSS_COLORS.azulClaro,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  '&.Mui-selected': {
    backgroundColor: IGSS_COLORS.azulClaro,
    '&:hover': { backgroundColor: IGSS_COLORS.azulClaro },
  },
});

/** Estilo para botones de acción en el pie del sidebar (colaborador / admin). */
export const sidebarActionSx = (variant: 'verde' | 'azul' | 'salir'): SxProps<Theme> => {
  const colors = {
    verde: { bg: IGSS_COLORS.verde, hover: IGSS_COLORS.verdeOscuro },
    azul: { bg: IGSS_COLORS.azulOscuro, hover: IGSS_COLORS.azulClaro },
    salir: { bg: '#8B4545', hover: '#A05252' },
  };
  const c = colors[variant];
  return {
    borderRadius: 2,
    py: 1.2,
    backgroundColor: c.bg,
    border: `1px solid ${IGSS_COLORS.blanco}`,
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: c.hover,
    },
  };
};
