import React, { useEffect, useState } from 'react';
import {
  Alert, Box, CircularProgress, Paper, Tab, Tabs, Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import api from '../../../api';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import AnalyticsFilterPanel, { AnalyticsFilter } from '../shared/AnalyticsFilterPanel';
import { analyticsPageSx, analyticsTabsSx } from '../shared/charts';
import { TAB_GUIDES } from '../shared/ui';
import TabGenerales from '../shared/TabGenerales';
import TabPorCaso from '../shared/TabPorCaso';
import TabMotivos from '../shared/TabMotivos';
import TabColaboradores from '../shared/TabColaboradores';
import type { SiafAnalytics } from './types';

const AnaliticaDaf: React.FC = () => {
  const [filters, setFilters] = useState<AnalyticsFilter>({ dias: 90, agrupacion: 'mes', alcance: 'personal' });
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<SiafAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === 3) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.get('/estadisticas/daf-analitica', {
      params: {
        dias: filters.dias,
        desde: filters.desde,
        hasta: filters.hasta,
        agrupacion: 'mes',
        siafId: tab === 1 ? filters.itemId : undefined,
        alcance: filters.alcance,
        unidad: filters.unidad,
        usuarioId: filters.usuarioId,
      },
    })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'No se pudo cargar el análisis SIAF.'))
      .finally(() => setLoading(false));
  }, [filters, tab]);

  const cambiarTab = (_e: React.SyntheticEvent, next: number) => {
    setTab(next);
    if (next !== 1 && filters.itemId != null) {
      setFilters((prev) => ({ ...prev, itemId: undefined }));
    }
  };

  const seleccionarCaso = (id: number) => {
    setFilters((prev) => ({ ...prev, itemId: id }));
    if (tab !== 1) setTab(1);
  };

  return (
    <Box sx={analyticsPageSx}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, letterSpacing: -0.3 }}>
          Análisis SIAF
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, maxWidth: 720 }}>
          Vista organizada por tema: resumen, tiempos y casos, motivos, y rendimiento por colaborador.
        </Typography>
      </Box>

      <AnalyticsFilterPanel
        tipo="siaf"
        value={filters}
        onApply={setFilters}
        mostrarCasoEspecifico={tab === 1}
      />

      <Paper
        elevation={0}
        sx={{
          mb: 2.5,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ px: { xs: 1, sm: 2 }, pt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Tabs
            value={tab}
            onChange={cambiarTab}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ ...analyticsTabsSx, maxWidth: '100%', minWidth: 0 }}
          >
            <Tab label="1. Resumen" />
            <Tab label="2. Por SIAF" />
            <Tab label="3. Motivos" />
            <Tab label="4. Colaboradores" />
          </Tabs>
          {data && tab !== 3 && (
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ pr: 1, whiteSpace: 'nowrap' }}>
              {new Date(data.desde).toLocaleDateString('es-GT', { dateStyle: 'medium' })} — {new Date(data.hasta).toLocaleDateString('es-GT', { dateStyle: 'medium' })}
            </Typography>
          )}
        </Box>
        <Box sx={{ px: 2, py: 1.25, bgcolor: 'rgba(0,91,145,0.03)', borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            {TAB_GUIDES[tab]}
          </Typography>
        </Box>
      </Paper>

      {tab !== 3 && loading && (
        <Box display="grid" sx={{ placeItems: 'center', minHeight: 280 }}><CircularProgress /></Box>
      )}
      {tab !== 3 && !loading && error && <Alert severity="error">{error}</Alert>}
      {tab !== 3 && !loading && !error && data && (
        <>
          {tab === 0 && (
            <TabGenerales
              casoLabel="SIAFs"
              gradId="siaf"
              resumen={data.general?.resumen ?? {
                total: data.resumen?.total ?? 0,
                aprobados: data.resumen?.aprobados ?? 0,
                rechazadosAlCierre: data.resumen?.rechazadosAlCierre ?? 0,
                pendientesCorreccion: data.resumen?.pendientesCorreccion ?? 0,
                pendientesRevisionDaf: data.resumen?.pendientesRevisionDaf ?? 0,
              }}
              cierre={data.general?.cierreMensual ?? data.cierreMensual ?? []}
            />
          )}
          {tab === 1 && (
            <TabPorCaso
              casoLabel="SIAF"
              gradId="siaf"
              itemId={filters.itemId}
              tiempos={data.porSiaf?.tiempos ?? data.tiempos}
              ciclos={data.porSiaf?.ciclos ?? data.ciclos ?? []}
              casos={data.porSiaf?.casos ?? []}
              trazabilidad={data.porSiaf?.trazabilidad ?? data.trazabilidad ?? []}
              onSelectCaso={seleccionarCaso}
            />
          )}
          {tab === 2 && (
            <TabMotivos
              gradId="siaf"
              motivos={data.porSiaf?.motivos ?? data.motivos ?? []}
            />
          )}
        </>
      )}

      {tab === 3 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <TabColaboradores tipo="siaf" filters={filters} />
        </motion.div>
      )}
    </Box>
  );
};

export default AnaliticaDaf;
