import React, { useMemo } from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { analyticsPageSx, analyticsTabsSx } from './charts';

export type AnaliticaTabId = 'general' | 'rankings' | 'motivos' | 'caso';

export const ANALITICA_TABS: Array<{
  id: AnaliticaTabId;
  label: string;
  guide: string;
}> = [
  {
    id: 'general',
    label: 'Vista general',
    guide: 'Totales del período y evolución mes a mes.',
  },
  {
    id: 'rankings',
    label: 'Rankings',
    guide: 'Ranking de colaboradores: casos, aprobados y rechazos.',
  },
  {
    id: 'motivos',
    label: 'Motivos de rechazo',
    guide: 'Motivos más frecuentes en el período.',
  },
  {
    id: 'caso',
    label: 'Análisis',
    guide: 'Listado del período → seleccione uno para ver proceso y tiempos.',
  },
];

type Props = {
  title: string;
  subtitle: string;
  tab: AnaliticaTabId;
  onTabChange: (next: AnaliticaTabId) => void;
  /** Si es false (rol «Mis estadísticas»), no se muestra Rankings. */
  showRankings?: boolean;
  /** Etiqueta de la pestaña de análisis por caso (p. ej. «Análisis de expedientes»). */
  analisisTabLabel?: string;
  analisisTabGuide?: string;
  periodLabel?: string | null;
  filterSlot: React.ReactNode;
  children: React.ReactNode;
};

/** Envoltorio común: título + filtros densos + pestañas. */
export default function AnaliticaShell({
  title,
  subtitle,
  tab,
  onTabChange,
  showRankings = true,
  analisisTabLabel,
  analisisTabGuide,
  periodLabel,
  filterSlot,
  children,
}: Props) {
  const tabs = useMemo(
    () =>
      ANALITICA_TABS.filter((t) => showRankings || t.id !== 'rankings').map((t) =>
        t.id === 'caso'
          ? {
              ...t,
              label: analisisTabLabel || t.label,
              guide: analisisTabGuide || t.guide,
            }
          : t,
      ),
    [showRankings, analisisTabLabel, analisisTabGuide],
  );

  const safeTab = tabs.some((t) => t.id === tab) ? tab : 'general';
  const tabIndex = Math.max(0, tabs.findIndex((t) => t.id === safeTab));
  const guide = tabs[tabIndex]?.guide ?? ANALITICA_TABS[0].guide;

  return (
    <Box sx={analyticsPageSx}>
      <Box
        sx={{
          mb: 1.25,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'baseline' },
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, letterSpacing: -0.3, lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {subtitle}
          </Typography>
        </Box>
        {periodLabel && (
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            sx={{ whiteSpace: 'nowrap', pt: { xs: 0, sm: 0.5 } }}
          >
            {periodLabel}
          </Typography>
        )}
      </Box>

      {filterSlot}

      <Paper
        elevation={0}
        sx={{
          mb: 1.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: { xs: 0.5, sm: 1.25 },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Tabs
            value={tabIndex}
            onChange={(_e, next) => {
              const id = tabs[next]?.id;
              if (id) onTabChange(id);
            }}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ ...analyticsTabsSx, maxWidth: '100%', minWidth: 0 }}
          >
            {tabs.map((t) => (
              <Tab key={t.id} label={t.label} />
            ))}
          </Tabs>
        </Box>
        <Box sx={{ px: 1.5, py: 0.75, bgcolor: 'rgba(0,91,145,0.03)', borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {guide}
          </Typography>
        </Box>
      </Paper>

      {children}
    </Box>
  );
}
