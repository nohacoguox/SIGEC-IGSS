import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider, PaletteMode } from '@mui/material';
import { esES } from '@mui/material/locale';

export type ThemeMode = 'light' | 'dark' | 'gray';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  nextModeLabel: string;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleTheme: () => {},
  nextModeLabel: 'Modo Oscuro',
});

export const useThemeMode = () => useContext(ThemeContext);

const THEME_ORDER: ThemeMode[] = ['light', 'gray', 'dark'];

function getNextMode(current: ThemeMode): ThemeMode {
  const i = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(i + 1) % THEME_ORDER.length];
}

const NEXT_MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Modo Gris',
  gray: 'Modo Oscuro',
  dark: 'Modo Claro',
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const savedMode = localStorage.getItem('themeMode');
    return (savedMode === 'light' || savedMode === 'dark' || savedMode === 'gray' ? savedMode : 'light') as ThemeMode;
  });

  const toggleTheme = () => {
    setMode((prevMode) => {
      const newMode = getNextMode(prevMode);
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  const muiPaletteMode: PaletteMode = mode === 'dark' ? 'dark' : 'light';

  const theme = useMemo(
    () =>
      createTheme(
        {
          palette: {
            mode: muiPaletteMode,
            primary: {
              main: mode === 'dark' ? '#4A9FD8' : '#0066A1',
              light: mode === 'dark' ? '#6BB3E0' : '#3385B5',
              dark: mode === 'dark' ? '#2E7FB0' : '#004D7A',
              contrastText: '#FFFFFF',
            },
            secondary: {
              main: mode === 'dark' ? '#4DC98A' : '#00A859',
              light: mode === 'dark' ? '#70D4A3' : '#33BA77',
              dark: mode === 'dark' ? '#2FA86B' : '#008044',
              contrastText: '#FFFFFF',
            },
            background: {
              default: mode === 'dark' ? '#121212' : mode === 'gray' ? '#E5E7EB' : '#F5F7FA',
              paper: mode === 'dark' ? '#1E1E1E' : mode === 'gray' ? '#F3F4F6' : '#FFFFFF',
            },
            text: {
              primary: mode === 'dark' ? '#E8EAED' : mode === 'gray' ? '#374151' : '#1A2332',
              secondary: mode === 'dark' ? '#9AA0A6' : mode === 'gray' ? '#6B7280' : '#5F6C7B',
            },
            error: {
              main: '#D32F2F',
            },
            warning: {
              main: '#F57C00',
            },
            info: {
              main: '#0288D1',
            },
            success: {
              main: '#388E3C',
            },
            divider: mode === 'dark' ? '#2C2C2C' : mode === 'gray' ? '#D1D5DB' : '#E0E0E0',
          },
          typography: {
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            h1: {
              fontWeight: 700,
              fontSize: '2.5rem',
            },
            h2: {
              fontWeight: 700,
              fontSize: '2rem',
            },
            h3: {
              fontWeight: 600,
              fontSize: '1.75rem',
            },
            h4: {
              fontWeight: 600,
              fontSize: '1.5rem',
            },
            h5: {
              fontWeight: 600,
              fontSize: '1.25rem',
            },
            h6: {
              fontWeight: 600,
              fontSize: '1rem',
            },
            button: {
              textTransform: 'none',
              fontWeight: 600,
            },
          },
          shape: {
            borderRadius: 12,
          },
          shadows: mode !== 'dark' 
            ? [
                'none',
                '0px 2px 4px rgba(0, 0, 0, 0.05)',
                '0px 4px 8px rgba(0, 0, 0, 0.08)',
                '0px 8px 16px rgba(0, 0, 0, 0.1)',
                '0px 12px 24px rgba(0, 0, 0, 0.12)',
                '0px 16px 32px rgba(0, 0, 0, 0.14)',
                '0px 20px 40px rgba(0, 0, 0, 0.16)',
                '0px 24px 48px rgba(0, 0, 0, 0.18)',
                '0px 28px 56px rgba(0, 0, 0, 0.2)',
                '0px 32px 64px rgba(0, 0, 0, 0.22)',
                '0px 36px 72px rgba(0, 0, 0, 0.24)',
                '0px 40px 80px rgba(0, 0, 0, 0.26)',
                '0px 44px 88px rgba(0, 0, 0, 0.28)',
                '0px 48px 96px rgba(0, 0, 0, 0.3)',
                '0px 52px 104px rgba(0, 0, 0, 0.32)',
                '0px 56px 112px rgba(0, 0, 0, 0.34)',
                '0px 60px 120px rgba(0, 0, 0, 0.36)',
                '0px 64px 128px rgba(0, 0, 0, 0.38)',
                '0px 68px 136px rgba(0, 0, 0, 0.4)',
                '0px 72px 144px rgba(0, 0, 0, 0.42)',
                '0px 76px 152px rgba(0, 0, 0, 0.44)',
                '0px 80px 160px rgba(0, 0, 0, 0.46)',
                '0px 84px 168px rgba(0, 0, 0, 0.48)',
                '0px 88px 176px rgba(0, 0, 0, 0.5)',
                '0px 92px 184px rgba(0, 0, 0, 0.52)',
              ]
            : [
                'none',
                '0px 2px 4px rgba(0, 0, 0, 0.3)',
                '0px 4px 8px rgba(0, 0, 0, 0.35)',
                '0px 8px 16px rgba(0, 0, 0, 0.4)',
                '0px 12px 24px rgba(0, 0, 0, 0.45)',
                '0px 16px 32px rgba(0, 0, 0, 0.5)',
                '0px 20px 40px rgba(0, 0, 0, 0.55)',
                '0px 24px 48px rgba(0, 0, 0, 0.6)',
                '0px 28px 56px rgba(0, 0, 0, 0.65)',
                '0px 32px 64px rgba(0, 0, 0, 0.7)',
                '0px 36px 72px rgba(0, 0, 0, 0.75)',
                '0px 40px 80px rgba(0, 0, 0, 0.8)',
                '0px 44px 88px rgba(0, 0, 0, 0.85)',
                '0px 48px 96px rgba(0, 0, 0, 0.9)',
                '0px 52px 104px rgba(0, 0, 0, 0.95)',
                '0px 56px 112px rgba(0, 0, 0, 1)',
                '0px 60px 120px rgba(0, 0, 0, 1)',
                '0px 64px 128px rgba(0, 0, 0, 1)',
                '0px 68px 136px rgba(0, 0, 0, 1)',
                '0px 72px 144px rgba(0, 0, 0, 1)',
                '0px 76px 152px rgba(0, 0, 0, 1)',
                '0px 80px 160px rgba(0, 0, 0, 1)',
                '0px 84px 168px rgba(0, 0, 0, 1)',
                '0px 88px 176px rgba(0, 0, 0, 1)',
                '0px 92px 184px rgba(0, 0, 0, 1)',
              ],
          components: {
            MuiButton: {
              styleOverrides: {
                root: {
                  borderRadius: 8,
                  padding: '10px 24px',
                  boxShadow: 'none',
                  '&:hover': {
                    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
                  },
                },
                contained: {
                  '&:hover': {
                    boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.2)',
                  },
                },
              },
            },
            MuiCard: {
              styleOverrides: {
                root: {
                  borderRadius: 16,
                  boxShadow: mode !== 'dark'
                    ? '0px 4px 20px rgba(0, 0, 0, 0.08)'
                    : '0px 4px 20px rgba(0, 0, 0, 0.4)',
                },
              },
            },
            MuiPaper: {
              styleOverrides: {
                root: {
                  backgroundImage: 'none',
                },
                elevation1: {
                  boxShadow: mode !== 'dark'
                    ? '0px 2px 8px rgba(0, 0, 0, 0.06)'
                    : '0px 2px 8px rgba(0, 0, 0, 0.3)',
                },
              },
            },
            MuiTextField: {
              styleOverrides: {
                root: {
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 8,
                  },
                },
              },
            },
            MuiTableHead: {
              styleOverrides: {
                root: {
                  '& .MuiTableCell-head': {
                    fontWeight: 700,
                    backgroundColor: mode !== 'dark' ? (mode === 'gray' ? '#E5E7EB' : '#F5F7FA') : '#2C2C2C',
                  },
                },
              },
            },
          },
        },
        esES
      ),
    [mode]
  );

  const nextModeLabel = NEXT_MODE_LABELS[mode];

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, nextModeLabel }}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
