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
import type { ExpedientesAnalytics } from './types';

const AnaliticaExpedientes: React.FC = () => {
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
  const [data, setData] = useState<ExpedientesAnalytics | null>(null);
  const [casosListado, setCasosListado] = useState<
    Array<{
      id: number;
      correlativo: string;
      estado: string;
      resultadoAlCorte: string;
      devoluciones: number;
      correcciones: number;
      horasPendienteRevisionDaf?: number | null;
      esperaRevisionDaf?: {
        horas: number | null;
        abierta: boolean;
        desde: string | null;
        hasta: string | null;
      } | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Cuando cargan permisos: fijar alcance (unidad = todos; personal = solo míos).
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

  const mapCasos = (payload: ExpedientesAnalytics) =>
    (payload.porExpediente?.casos ?? []).map((c) => ({
      id: c.id,
      correlativo: c.numeroExpediente,
      estado: c.titulo,
      resultadoAlCorte: c.resultadoAlCorte,
      devoluciones: c.devoluciones,
      correcciones: c.correcciones,
      horasPendienteRevisionDaf: c.horasPendienteRevisionDaf ?? c.esperaRevisionDaf?.horas ?? null,
      esperaRevisionDaf: c.esperaRevisionDaf ?? null,
    }));

  // Carga general (sin expediente seleccionado): mantiene el listado completo.
  useEffect(() => {
    if (esRanking || !puedeConsultar || filters.itemId != null) {
      if (esRanking || !puedeConsultar) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get('/estadisticas/expedientes-analitica', {
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
        setCasosListado(mapCasos(res.data));
      })
      .catch((err) => setError(err.response?.data?.message || 'No se pudo cargar el análisis de expedientes.'))
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

  // Detalle de un expediente: solo trazabilidad; no reemplaza el listado.
  useEffect(() => {
    if (!esDetalleCaso || !puedeConsultar || !filters.itemId) {
      setLoadingDetalle(false);
      return;
    }
    setLoadingDetalle(true);
    api
      .get('/estadisticas/expedientes-analitica', {
        params: {
          dias: filters.dias,
          desde: filters.desde,
          hasta: filters.hasta,
          agrupacion: 'mes',
          expedienteId: filters.itemId,
          alcance: filters.alcance,
          unidad: filters.unidad,
          usuarioId: filters.usuarioId,
        },
      })
      .then((res) => {
        const traza = res.data.porExpediente?.trazabilidad ?? res.data.trazabilidad ?? [];
        const espera = res.data.porExpediente?.esperaRevisionDaf
          ?? res.data.porExpediente?.casos?.[0]?.esperaRevisionDaf
          ?? null;
        setData((prev) => {
          if (!prev?.porExpediente) return res.data;
          return {
            ...prev,
            porExpediente: {
              ...prev.porExpediente,
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
        /* el listado sigue visible; el diálogo mostrará vacío */
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
      prev?.porExpediente
        ? { ...prev, porExpediente: { ...prev.porExpediente, trazabilidad: [] }, trazabilidad: [] }
        : prev,
    );
    if (tab !== 'caso') setTab('caso');
  };

  const limpiarCaso = () => {
    setFilters((prev) => ({ ...prev, itemId: undefined }));
    setData((prev) =>
      prev?.porExpediente
        ? { ...prev, porExpediente: { ...prev.porExpediente, trazabilidad: [] }, trazabilidad: [] }
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
      title="Resultados de expedientes"
      subtitle=""
      tab={tab}
      onTabChange={cambiarTab}
      showRankings={showRankings}
      analisisTabLabel="Análisis de expedientes"
      periodLabel={periodLabel}
      filterSlot={
        <AnalyticsFilterPanel
          tipo="expediente"
          value={filters}
          onApply={onApply}
          mostrarCasoEspecifico={false}
        />
      }
    >
      {esRanking && showRankings && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <TabColaboradores tipo="expedientes" filters={filters} />
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
              casoLabel="Expedientes"
              gradId="exp"
              resumen={
                data.general?.resumen ?? {
                  total: data.resumen.total,
                  aprobados: data.resumen.aprobados,
                  rechazadosAlCierre: data.resumen.rechazadosAlCierre ?? 0,
                  pendientesCorreccion: data.resumen.pendientesCorreccion ?? 0,
                  pendientesRevisionDaf: data.resumen.pendientesRevisionDaf ?? 0,
                }
              }
              cierre={data.general?.cierreMensual ?? data.cierreMensual ?? []}
              tiempos={data.porExpediente?.tiempos ?? data.tiempos}
            />
          )}
          {tab === 'motivos' && <TabMotivos gradId="exp" motivos={data.porExpediente?.motivos ?? data.motivos} />}
          {tab === 'caso' && (
            <TabPorCaso
              casoLabel="Expediente"
              itemId={filters.itemId}
              cargandoDetalle={loadingDetalle}
              casos={casosListado}
              esperaRevisionDaf={data.porExpediente?.esperaRevisionDaf ?? null}
              trazabilidad={(data.porExpediente?.trazabilidad ?? data.trazabilidad ?? []).map((t) => ({
                rechazoNumero: t.rechazoNumero,
                fechaRechazo: t.fechaRechazo,
                motivos: t.observaciones,
                correcciones: t.correcciones,
                horasRespuestaDaf: t.horasRespuestaDaf,
                horasCorreccion: t.horasCorreccion,
                horasRespuestaTrasReenvio: t.horasRespuestaTrasReenvio,
              }))}
              onSelectCaso={seleccionarCaso}
              onClearCaso={limpiarCaso}
              columnasCaso={{ primaria: 'Nº expediente', secundaria: 'Título' }}
              columnaMotivos="Observaciones"
            />
          )}
        </>
      )}
    </AnaliticaShell>
  );
};

export default AnaliticaExpedientes;
