import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../../../api';
import { usePermissions } from '../../../hooks/usePermissions';
import AnalyticsFilterPanel, { AnalyticsFilter } from '../shared/AnalyticsFilterPanel';
import AnaliticaShell, { type AnaliticaTabId } from '../shared/AnaliticaShell';
import TabGenerales from '../shared/TabGenerales';
import TabPorCaso from '../shared/TabPorCaso';
import TabMotivos from '../shared/TabMotivos';
import TabColaboradores from '../shared/TabColaboradores';
import {
  createDefaultAnalyticsFilter,
  resolveAnalyticsRoleMode,
  type AnalyticsRoleMode,
} from '../shared/analyticsScope';
import type { SiafAnalytics } from './types';

const AnaliticaDaf: React.FC = () => {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const roleMode = useMemo(
    () =>
      resolveAnalyticsRoleMode({
        isSuperAdmin,
        hasMisEstadisticas: hasPermission('estadisticas-tiempos'),
        hasUnidad: hasPermission('ver-estadisticas-unidad'),
      }),
    [hasPermission, isSuperAdmin],
  );

  const showRankings = roleMode !== 'personal';
  const [filters, setFilters] = useState<AnalyticsFilter>(() => createDefaultAnalyticsFilter(roleMode));
  const [scopeReady, setScopeReady] = useState(false);
  const lastModeRef = useRef<AnalyticsRoleMode | null>(null);
  const [tab, setTab] = useState<AnaliticaTabId>('general');
  const [data, setData] = useState<SiafAnalytics | null>(null);
  const [casosListado, setCasosListado] = useState<
    NonNullable<SiafAnalytics['porSiaf']>['casos']
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => {
    if (lastModeRef.current === roleMode) {
      setScopeReady(true);
      return;
    }
    lastModeRef.current = roleMode;
    setFilters((prev) => ({ ...createDefaultAnalyticsFilter(roleMode), itemId: prev.itemId }));
    setScopeReady(true);
    if (roleMode === 'personal') setTab((t) => (t === 'rankings' ? 'general' : t));
  }, [roleMode]);

  const esRanking = tab === 'rankings';
  const esDetalleCaso = tab === 'caso' && filters.itemId != null;
  const puedeConsultar =
    scopeReady && !(filters.alcance === 'unidad' && isSuperAdmin && !filters.unidad);

  useEffect(() => {
    if (esRanking || !puedeConsultar || filters.itemId != null) {
      if (esRanking || !puedeConsultar) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get('/estadisticas/daf-analitica', {
        params: {
          dias: filters.dias,
          desde: filters.desde,
          hasta: filters.hasta,
          agrupacion: 'mes',
          alcance: filters.alcance,
          unidad: filters.unidad,
          usuarioId: filters.usuarioId,
        },
      })
      .then((res) => {
        setData(res.data);
        setCasosListado(res.data.porSiaf?.casos ?? []);
      })
      .catch((err) => setError(err.response?.data?.message || 'No se pudo cargar el análisis SIAF.'))
      .finally(() => setLoading(false));
  }, [
    filters.dias,
    filters.desde,
    filters.hasta,
    filters.alcance,
    filters.unidad,
    filters.usuarioId,
    filters.itemId,
    tab,
    esRanking,
    puedeConsultar,
  ]);

  useEffect(() => {
    if (!esDetalleCaso || !puedeConsultar || !filters.itemId) {
      setLoadingDetalle(false);
      return;
    }
    setLoadingDetalle(true);
    api
      .get('/estadisticas/daf-analitica', {
        params: {
          dias: filters.dias,
          desde: filters.desde,
          hasta: filters.hasta,
          agrupacion: 'mes',
          siafId: filters.itemId,
          alcance: filters.alcance,
          unidad: filters.unidad,
          usuarioId: filters.usuarioId,
        },
      })
      .then((res) => {
        const traza = res.data.porSiaf?.trazabilidad ?? res.data.trazabilidad ?? [];
        const espera = res.data.porSiaf?.esperaRevisionDaf
          ?? res.data.porSiaf?.casos?.[0]?.esperaRevisionDaf
          ?? null;
        setData((prev) => {
          if (!prev?.porSiaf) return res.data;
          return {
            ...prev,
            porSiaf: {
              ...prev.porSiaf,
              trazabilidad: traza,
              esperaRevisionDaf: espera,
            },
            trazabilidad: traza,
          };
        });
        if (espera && filters.itemId) {
          setCasosListado((prev) =>
            prev.map((c) =>
              c.id === filters.itemId
                ? { ...c, esperaRevisionDaf: espera, horasPendienteRevisionDaf: espera.horas }
                : c,
            ),
          );
        }
      })
      .catch(() => {
        /* listado intacto */
      })
      .finally(() => setLoadingDetalle(false));
  }, [
    filters.itemId,
    filters.dias,
    filters.desde,
    filters.hasta,
    filters.alcance,
    filters.unidad,
    filters.usuarioId,
    esDetalleCaso,
    puedeConsultar,
  ]);

  const cambiarTab = (next: AnaliticaTabId) => {
    setTab(next);
    if (next !== 'caso' && filters.itemId != null) {
      setFilters((prev) => ({ ...prev, itemId: undefined }));
    }
  };

  const seleccionarCaso = (id: number) => {
    setFilters((prev) => ({ ...prev, itemId: id }));
    setData((prev) =>
      prev?.porSiaf
        ? { ...prev, porSiaf: { ...prev.porSiaf, trazabilidad: [] }, trazabilidad: [] }
        : prev,
    );
    if (tab !== 'caso') setTab('caso');
  };

  const limpiarCaso = () => {
    setFilters((prev) => ({ ...prev, itemId: undefined }));
    setData((prev) =>
      prev?.porSiaf
        ? { ...prev, porSiaf: { ...prev.porSiaf, trazabilidad: [] }, trazabilidad: [] }
        : prev,
    );
  };

  const onApply = useCallback(
    (f: AnalyticsFilter) => {
      setFilters({ ...f, itemId: esDetalleCaso ? filters.itemId : f.itemId });
    },
    [esDetalleCaso, filters.itemId],
  );

  const periodLabel =
    data && !esRanking
      ? `${new Date(data.desde).toLocaleDateString('es-GT', { dateStyle: 'medium' })} — ${new Date(data.hasta).toLocaleDateString('es-GT', { dateStyle: 'medium' })}`
      : null;

  return (
    <AnaliticaShell
      title="Resultados SIAF"
      subtitle=""
      tab={tab}
      onTabChange={cambiarTab}
      showRankings={showRankings}
      analisisTabLabel="Análisis SIAF"
      periodLabel={periodLabel}
      filterSlot={
        <AnalyticsFilterPanel
          tipo="siaf"
          value={filters}
          onApply={onApply}
          mostrarCasoEspecifico={false}
        />
      }
    >
      {esRanking && showRankings && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <TabColaboradores tipo="siaf" filters={filters} />
        </motion.div>
      )}

      {!esRanking && !puedeConsultar && isSuperAdmin && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Seleccione una unidad médica en los filtros y pulse Aplicar.
        </Alert>
      )}

      {!esRanking && loading && !data && puedeConsultar && (
        <Box display="grid" sx={{ placeItems: 'center', minHeight: 240 }}>
          <CircularProgress />
        </Box>
      )}
      {!esRanking && !loading && error && !data && <Alert severity="error">{error}</Alert>}
      {!esRanking && data && (
        <>
          {tab === 'general' && (
            <TabGenerales
              casoLabel="SIAFs"
              gradId="siaf"
              resumen={
                data.general?.resumen ?? {
                  total: data.resumen?.total ?? 0,
                  aprobados: data.resumen?.aprobados ?? 0,
                  rechazadosAlCierre: data.resumen?.rechazadosAlCierre ?? 0,
                  pendientesCorreccion: data.resumen?.pendientesCorreccion ?? 0,
                  pendientesRevisionDaf: data.resumen?.pendientesRevisionDaf ?? 0,
                }
              }
              cierre={data.general?.cierreMensual ?? data.cierreMensual ?? []}
              tiempos={data.porSiaf?.tiempos ?? data.tiempos}
            />
          )}
          {tab === 'motivos' && <TabMotivos gradId="siaf" motivos={data.porSiaf?.motivos ?? data.motivos ?? []} />}
          {tab === 'caso' && (
            <TabPorCaso
              casoLabel="SIAF"
              itemId={filters.itemId}
              cargandoDetalle={loadingDetalle}
              casos={casosListado}
              esperaRevisionDaf={data.porSiaf?.esperaRevisionDaf ?? null}
              trazabilidad={data.porSiaf?.trazabilidad ?? data.trazabilidad ?? []}
              onSelectCaso={seleccionarCaso}
              onClearCaso={limpiarCaso}
            />
          )}
        </>
      )}
    </AnaliticaShell>
  );
};

export default AnaliticaDaf;
