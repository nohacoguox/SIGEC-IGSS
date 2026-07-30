import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { IGSS_COLORS } from '../../theme/institutionalColors';

interface PageHeaderProps {
  title: string;
  subtitle: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle }) => (
  <Box
    component={motion.div}
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    sx={{ mb: 4 }}
  >
    <Typography
      variant="overline"
      sx={{
        color: IGSS_COLORS.azul,
        fontWeight: 700,
        letterSpacing: 2,
        display: 'block',
        mb: 0.5,
      }}
    >
      SIGEC · IGSS
    </Typography>
    <Typography
      variant="h3"
      component="h1"
      fontWeight={800}
      sx={{
        color: IGSS_COLORS.azul,
        mb: 1,
        fontSize: { xs: '1.75rem', md: '2.25rem' },
      }}
    >
      {title}
    </Typography>
    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, lineHeight: 1.6 }}>
      {subtitle}
    </Typography>
    <Box
      component={motion.div}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      sx={{
        mt: 2,
        height: 4,
        width: 72,
        borderRadius: 1,
        transformOrigin: 'left',
        bgcolor: IGSS_COLORS.verde,
      }}
    />
  </Box>
);

export default PageHeader;
