import React from 'react';
import { Box, useTheme } from '@mui/material';
import { IGSS_COLORS } from '../../theme/institutionalColors';

const DashboardBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: 'relative',
        flexGrow: 1,
        p: { xs: 2, sm: 3, md: 4 },
        overflow: 'hidden',
        minHeight: '100vh',
        bgcolor: theme.palette.background.default,
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>{children}</Box>
    </Box>
  );
};

export default DashboardBackground;
