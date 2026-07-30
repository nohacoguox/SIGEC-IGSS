import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { motion } from 'framer-motion';
import { IGSS_COLORS } from '../../theme/institutionalColors';

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  onClick: () => void;
  delay?: number;
}

const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon,
  accent,
  onClick,
  delay = 0,
}) => (
  <Box
    component={motion.div}
    initial={{ opacity: 0, y: 28 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -6 }}
    whileTap={{ scale: 0.98 }}
  >
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        position: 'relative',
        p: 0,
        height: '100%',
        cursor: 'pointer',
        borderRadius: 2,
        overflow: 'hidden',
        border: `2px solid ${IGSS_COLORS.gris}`,
        bgcolor: IGSS_COLORS.blanco,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: accent,
          boxShadow: '0 8px 24px rgba(50, 90, 114, 0.12)',
          '& .action-arrow': { opacity: 1, transform: 'translateX(0)' },
        },
      }}
    >
      <Box sx={{ height: 5, bgcolor: accent }} />
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 'calc(100% - 5px)' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: IGSS_COLORS.blanco,
            bgcolor: accent,
            '& svg': { fontSize: 26 },
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: IGSS_COLORS.textoOscuro, pr: 4 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, lineHeight: 1.55 }}>
          {description}
        </Typography>
        <ArrowForwardRoundedIcon
          className="action-arrow"
          sx={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            color: accent,
            opacity: 0.4,
            transform: 'translateX(-6px)',
            transition: 'all 0.2s ease',
          }}
        />
      </Box>
    </Paper>
  </Box>
);

export default ActionCard;
