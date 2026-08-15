import React, { useEffect, useState } from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { usePermissions } from '../hooks/usePermissions';
import { IGSS_COLORS } from '../theme/institutionalColors';
import RevisarDireccionDepartamental from './RevisarDireccionDepartamental';
import RevisarExpedientesDD from './RevisarExpedientesDD';

export type BandejaRevisionesTab = 'siaf' | 'expedientes';

interface BandejaRevisionesDafProps {
  /** Pestaña inicial o forzada desde el menú lateral */
  tabInicial?: BandejaRevisionesTab;
  onTabChange?: (tab: BandejaRevisionesTab) => void;
}

const BandejaRevisionesDaf: React.FC<BandejaRevisionesDafProps> = ({ tabInicial, onTabChange }) => {
  const { hasPermission } = usePermissions();
  const puedeSiaf = hasPermission('revisar-siaf-direccion-departamental');
  const puedeExpedientes =
    hasPermission('revisar-expediente-direccion-departamental') ||
    hasPermission('revisar-siaf-direccion-departamental');

  const resolveTab = (preferred?: BandejaRevisionesTab): BandejaRevisionesTab => {
    if (preferred === 'expedientes' && puedeExpedientes) return 'expedientes';
    if (preferred === 'siaf' && puedeSiaf) return 'siaf';
    if (puedeSiaf) return 'siaf';
    return 'expedientes';
  };

  const [tab, setTab] = useState<BandejaRevisionesTab>(() => resolveTab(tabInicial));

  useEffect(() => {
    setTab(resolveTab(tabInicial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabInicial, puedeSiaf, puedeExpedientes]);

  const handleTabChange = (_: React.SyntheticEvent, value: BandejaRevisionesTab) => {
    setTab(value);
    onTabChange?.(value);
  };

  if (!puedeSiaf && !puedeExpedientes) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No tiene permisos para la Bandeja de Revisiones DAF.
      </Typography>
    );
  }

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          boxShadow: `0 4px 18px ${alpha('#000', 0.05)}`,
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover',
            borderLeft: `4px solid ${IGSS_COLORS.verde}`,
          }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ color: 'grey.800' }}>
            Bandeja de Revisiones DAF
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Revise y resuelva las solicitudes pendientes de SIAF y de expedientes de compras.
          </Typography>
        </Box>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          sx={{
            px: 2,
            minHeight: 48,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 48 },
            '& .Mui-selected': { color: IGSS_COLORS.azulOscuro },
            '& .MuiTabs-indicator': { bgcolor: IGSS_COLORS.azulOscuro, height: 3 },
          }}
        >
          {puedeSiaf && <Tab label="SIAF" value="siaf" />}
          {puedeExpedientes && <Tab label="Expedientes" value="expedientes" />}
        </Tabs>
      </Paper>

      {tab === 'siaf' && puedeSiaf && <RevisarDireccionDepartamental />}
      {tab === 'expedientes' && puedeExpedientes && <RevisarExpedientesDD />}
    </Box>
  );
};

export default BandejaRevisionesDaf;
