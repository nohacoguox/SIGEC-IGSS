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
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
        },
        body: {
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
        },
        '#root': {
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflowX: 'hidden',
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        },
      },
    },
    MuiGrid: {
      styleOverrides: {
        item: {
          minWidth: 0,
          maxWidth: '100%',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          maxWidth: '100%',
          boxSizing: 'border-box',
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
    MuiTableContainer: {
      styleOverrides: {
        root: {
          width: '100%',
          maxWidth: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          maxWidth: '100%',
          boxSizing: 'border-box',
        },
      },
    },
    MuiStack: {
      defaultProps: {
        useFlexGap: true,
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
