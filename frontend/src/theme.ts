import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#005f9e', // Azul principal del login
      light: '#0077c2', // Azul claro del login
    },
    secondary: {
      main: '#ffc107', // Un ámbar vibrante para contraste y acciones secundarias
    },
    background: {
      default: '#f4f6f8', // Un gris muy claro para el fondo general
      paper: '#ffffff', // Blanco puro para superficies como tarjetas y diálogos
    },
    text: {
      primary: '#212121', // Negro suave para el texto principal
      secondary: '#757575', // Gris para texto secundario y descriptivo
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
          backgroundColor: '#005f9e', // Usar el nuevo color primario para las cabeceras
          '& .MuiTableCell-root': {
            color: 'white',
            fontWeight: 'bold',
          },
        },
      },
    },
  },
});

export default theme;
