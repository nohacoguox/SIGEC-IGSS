import { createTheme } from '@mui/material/styles';
import { IGSS_COLORS } from './theme/institutionalColors';

const theme = createTheme({
  palette: {
    primary: {
      main: IGSS_COLORS.azul,
      light: IGSS_COLORS.azulClaro,
      dark: IGSS_COLORS.azulOscuro,
      contrastText: IGSS_COLORS.blanco,
    },
    secondary: {
      main: IGSS_COLORS.verde,
      light: IGSS_COLORS.verdeClaro,
      dark: IGSS_COLORS.verdeOscuro,
      contrastText: IGSS_COLORS.blanco,
    },
    background: {
      default: IGSS_COLORS.fondo,
      paper: IGSS_COLORS.blanco,
    },
    text: {
      primary: IGSS_COLORS.textoOscuro,
      secondary: '#5F6C7B',
    },
    success: {
      main: IGSS_COLORS.verde,
    },
    info: {
      main: IGSS_COLORS.azulClaro,
    },
    error: {
      main: IGSS_COLORS.error,
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
      defaultProps: {
        elevation: 1,
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          overflow: 'hidden',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: IGSS_COLORS.azul,
          '& .MuiTableCell-root': {
            color: IGSS_COLORS.blanco,
            fontWeight: 'bold',
          },
        },
      },
    },
  },
});

export default theme;
