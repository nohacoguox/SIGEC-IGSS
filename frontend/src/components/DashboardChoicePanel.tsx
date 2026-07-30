import React from 'react';
import { Box, Typography, Paper, Dialog, DialogContent } from '@mui/material';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { motion } from 'framer-motion';
import { IGSS_COLORS } from '../theme/institutionalColors';

export interface DashboardChoicePanelProps {
  variant?: 'dialog' | 'page';
  open?: boolean;
  userName?: string;
  onSelectAdmin: () => void;
  onSelectColaborador: () => void;
}

interface PanelOptionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  onClick: () => void;
  delay?: number;
}

const PanelOption: React.FC<PanelOptionProps> = ({
  title,
  description,
  icon,
  accent,
  onClick,
  delay = 0,
}) => (
  <Box
    component={motion.button}
    type="button"
    onClick={onClick}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    whileHover={{ y: -4 }}
    whileTap={{ scale: 0.99 }}
    sx={{
      width: '100%',
      textAlign: 'left',
      cursor: 'pointer',
      border: 'none',
      background: 'transparent',
      p: 0,
      font: 'inherit',
    }}
  >
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: `2px solid ${IGSS_COLORS.gris}`,
        bgcolor: IGSS_COLORS.blanco,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: accent,
          boxShadow: '0 8px 24px rgba(50, 90, 114, 0.12)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: IGSS_COLORS.blanco,
            bgcolor: accent,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            {description}
          </Typography>
        </Box>
        <ArrowForwardRoundedIcon
          sx={{
            color: accent,
            mt: 0.5,
            opacity: 0.6,
            transition: 'transform 0.2s ease',
            '.MuiPaper-root:hover &': { transform: 'translateX(4px)', opacity: 1 },
          }}
        />
      </Box>
    </Paper>
  </Box>
);

const PanelContent: React.FC<DashboardChoicePanelProps> = ({
  userName,
  onSelectAdmin,
  onSelectColaborador,
}) => {
  const displayName = userName?.trim() || 'Usuario';

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box
        sx={{
          mx: 'auto',
          mb: 2.5,
          width: 56,
          height: 4,
          borderRadius: 1,
          bgcolor: IGSS_COLORS.verde,
        }}
      />
      <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: IGSS_COLORS.azul }}>
        Bienvenido, {displayName.split(' ')[0]}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 420, mx: 'auto' }}>
        Tienes acceso a dos áreas del sistema. Elige con cuál deseas trabajar en esta sesión.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <PanelOption
          title="Panel de Administración"
          description="Gestión de usuarios, roles, catálogos, unidades médicas y configuración del sistema."
          icon={<AdminPanelSettingsOutlinedIcon />}
          accent={IGSS_COLORS.azul}
          onClick={onSelectAdmin}
          delay={0.05}
        />
        <PanelOption
          title="Panel de Colaborador"
          description="Crear y autorizar solicitudes SIAF, expedientes y flujos operativos del consultorio."
          icon={<AssignmentOutlinedIcon />}
          accent={IGSS_COLORS.verde}
          onClick={onSelectColaborador}
          delay={0.12}
        />
      </Box>
    </Box>
  );
};

const DashboardChoicePanel: React.FC<DashboardChoicePanelProps> = ({
  variant = 'page',
  open = true,
  userName,
  onSelectAdmin,
  onSelectColaborador,
}) => {
  if (variant === 'dialog') {
    return (
      <Dialog
        open={open}
        onClose={() => {}}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: IGSS_COLORS.blanco,
            border: `2px solid ${IGSS_COLORS.gris}`,
          },
        }}
      >
        <DialogContent sx={{ px: { xs: 2.5, sm: 4 }, py: 4 }}>
          <PanelContent
            userName={userName}
            onSelectAdmin={onSelectAdmin}
            onSelectColaborador={onSelectColaborador}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: IGSS_COLORS.gris,
        p: 2,
      }}
    >
      <Paper
        elevation={2}
        sx={{
          p: { xs: 3, sm: 4 },
          maxWidth: 480,
          width: '100%',
          borderRadius: 3,
          bgcolor: IGSS_COLORS.blanco,
          border: `2px solid ${IGSS_COLORS.gris}`,
        }}
      >
        <PanelContent
          userName={userName}
          onSelectAdmin={onSelectAdmin}
          onSelectColaborador={onSelectColaborador}
        />
      </Paper>
    </Box>
  );
};

export default DashboardChoicePanel;
