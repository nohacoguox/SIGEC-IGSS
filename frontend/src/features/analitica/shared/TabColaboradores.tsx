import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Chip, CircularProgress, FormControl, Grid, InputLabel, MenuItem,
  Paper, Select, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, Tabs, Typography,
} from '@mui/material';
import {
  EmojiEvents, Groups, ThumbDownAlt, ThumbUpAlt, TrendingUp,
} from '@mui/icons-material';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import api from '../../../api';
import { AnalyticsFilter } from './AnalyticsFilterPanel';
import { axisTick, ChartTooltip, panelSx, tableScrollSx, gridStroke, analyticsTabsSx } from './charts';
import { KpiCard, SectionBlock } from './ui';

type Contadores = {
  casos: number;
  aprobados: number;
  rechazadosAlCierre: number;
  pendientesCorreccion: number;
  pendientesRevisionDaf: number;
  rechazosAcumulados: number;
};

type RankingRow = {
  usuarioId: number;
  etiqueta: string;
  unidadMedica: string | null;
  historico: Contadores;
  porMes: Array<{ mes: string; etiqueta: string } & Contadores>;
};

type Destacado = { usuarioId: number; etiqueta: string; valor: number } | null;

type RankingResponse = {
  tipo: 'siaf' | 'expedientes';
  desde: string;
  hasta: string;
  alcance?: {
    modo: string;
    unidad: string | null;
    usuarioId: number | null;
    canViewUnidad: boolean;
    canPickUnidad: boolean;
  };
  destacados: {
    masCasos: Destacado;
    masAprobados: Destacado;
    masRechazos: Destacado;
  };
  ranking: RankingRow[];
};

type Props = {
  tipo: 'siaf' | 'expedientes';
  filters: AnalyticsFilter;
};

const etiquetaCaso = (tipo: 'siaf' | 'expedientes') => (tipo === 'siaf' ? 'SIAF' : 'expedientes');

export default function TabColaboradores({ tipo, filters }: Props) {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<'casos' | 'aprobados' | 'rechazos'>('casos');
  const [vista, setVista] = useState(0);
  const [mesFocus, setMesFocus] = useState<string>('todos');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get('/estadisticas/ranking-colaboradores', {
      params: {
        tipo,
        dias: filters.dias,
        desde: filters.desde,
        hasta: filters.hasta,
        alcance: filters.alcance,
        unidad: filters.unidad,
        usuarioId: filters.usuarioId,
      },
    })
      .then((res) => {
        setData(res.data);
        setPage(0);
      })
      .catch((err) => {
        setData(null);
        setError(err.response?.data?.message || 'No se pudo cargar el ranking de colaboradores.');
      })
      .finally(() => setLoading(false));
  }, [tipo, filters]);

  const rankingOrdenado = useMemo(() => {
    if (!data?.ranking) return [];
    const copy = [...data.ranking];
    copy.sort((a, b) => {
      if (orden === 'aprobados') return b.historico.aprobados - a.historico.aprobados;
      if (orden === 'rechazos') return b.historico.rechazosAcumulados - a.historico.rechazosAcumulados;
      return b.historico.casos - a.historico.casos;
    });
    return copy;
  }, [data, orden]);

  const mesesDisponibles = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.ranking ?? []) {
      for (const m of row.porMes) {
        if (m.casos > 0 || m.rechazosAcumulados > 0) map.set(m.mes, m.etiqueta);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  useEffect(() => {
    if (mesesDisponibles.length === 0) {
      setMesFocus('todos');
      return;
    }
    const ultimo = mesesDisponibles[mesesDisponibles.length - 1][0];
    setMesFocus(ultimo);
  }, [mesesDisponibles]);

  const filasMensuales = useMemo(() => {
    const rows: Array<{
      key: string;
      mes: string;
      etiquetaMes: string;
      colaborador: string;
      casos: number;
      aprobados: number;
      rechazos: number;
      pendientes: number;
    }> = [];
    for (const col of rankingOrdenado) {
      for (const m of col.porMes) {
        if (mesFocus !== 'todos' && m.mes !== mesFocus) continue;
        if (m.casos === 0 && m.rechazosAcumulados === 0) continue;
        rows.push({
          key: `${col.usuarioId}-${m.mes}`,
          mes: m.mes,
          etiquetaMes: m.etiqueta,
          colaborador: col.etiqueta,
          casos: m.casos,
          aprobados: m.aprobados,
          rechazos: m.rechazosAcumulados,
          pendientes: m.pendientesCorreccion + m.pendientesRevisionDaf,
        });
      }
    }
    rows.sort((a, b) => b.mes.localeCompare(a.mes) || b.casos - a.casos);
    return rows;
  }, [rankingOrdenado, mesFocus]);

  if (loading) {
    return (
      <Box display="grid" sx={{ placeItems: 'center', minHeight: 280 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity={error.includes('alcance') || error.includes('unidad') ? 'info' : 'error'} sx={{ borderRadius: 2 }}>
        {error}
        {(error.includes('alcance') || error.includes('unidad')) && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Su rol actual es «Mis estadísticas». Para rankings de toda la unidad necesita el permiso «Estadísticas de mi unidad».
          </Typography>
        )}
      </Alert>
    );
  }

  if (!data) return null;

  const d = data.destacados;
  const casoLabel = etiquetaCaso(tipo);
  const rankingPage = rankingOrdenado.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const topAprobadosChart = [...rankingOrdenado]
    .filter((r) => r.historico.aprobados > 0)
    .sort((a, b) => b.historico.aprobados - a.historico.aprobados)
    .slice(0, 8)
    .map((r) => ({
      nombre: r.etiqueta.length > 18 ? `${r.etiqueta.slice(0, 16)}…` : r.etiqueta,
      aprobados: r.historico.aprobados,
    }));
  const topRechazosChart = [...rankingOrdenado]
    .filter((r) => r.historico.rechazosAcumulados > 0)
    .sort((a, b) => b.historico.rechazosAcumulados - a.historico.rechazosAcumulados)
    .slice(0, 8)
    .map((r) => ({
      nombre: r.etiqueta.length > 18 ? `${r.etiqueta.slice(0, 16)}…` : r.etiqueta,
      rechazos: r.historico.rechazosAcumulados,
    }));

  return (
    <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          ...panelSx,
          mb: 2.5,
          py: 2,
          background: `linear-gradient(135deg, ${IGSS_COLORS.azulOscuro} 0%, ${IGSS_COLORS.azul} 100%)`,
          color: '#fff',
          border: 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Groups sx={{ fontSize: 32, opacity: 0.95 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.25 }}>
              Rankings de colaboradores
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.35, maxWidth: 640 }}>
              Quién lidera en casos, aprobaciones y rechazos según el alcance de su rol.
            </Typography>
          </Box>
          {data.alcance?.unidad && (
            <Chip
              size="small"
              label={data.alcance.unidad}
              sx={{ fontWeight: 700, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }}
            />
          )}
        </Box>
      </Paper>

      <SectionBlock
        title="Podio del período"
      >
        <Grid container spacing={2.25}>
          <Grid item xs={12} sm={4}>
            <KpiCard
              label="Más casos"
              value={d.masCasos ? d.masCasos.valor : '—'}
              note={d.masCasos ? d.masCasos.etiqueta : 'Sin datos'}
              icon={<TrendingUp />}
              color={IGSS_COLORS.azulOscuro}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KpiCard
              label="Más aprobados"
              value={d.masAprobados ? d.masAprobados.valor : '—'}
              note={d.masAprobados ? d.masAprobados.etiqueta : 'Sin datos'}
              icon={<ThumbUpAlt />}
              color={IGSS_COLORS.verdeOscuro}
              delay={0.05}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KpiCard
              label="Más rechazos"
              value={d.masRechazos ? d.masRechazos.valor : '—'}
              note={d.masRechazos ? d.masRechazos.etiqueta : 'Sin datos'}
              icon={<ThumbDownAlt />}
              color={IGSS_COLORS.error}
              delay={0.1}
            />
          </Grid>
        </Grid>
      </SectionBlock>

      <SectionBlock
        title="Gráficas rápidas (Top 8)"
      >
        <Grid container spacing={2.25}>
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ ...panelSx, height: '100%' }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, color: IGSS_COLORS.verdeOscuro }}>
                Ranking de aprobados
              </Typography>
              {topAprobadosChart.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Sin aprobados en el período.</Typography>
              ) : (
                <Box sx={{ height: Math.min(360, Math.max(220, topAprobadosChart.length * 40)) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topAprobadosChart} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                      <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nombre" width={110} tick={axisTick} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="aprobados" name="Aprobados" fill={IGSS_COLORS.verde} radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ ...panelSx, height: '100%' }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, color: IGSS_COLORS.error }}>
                Ranking de rechazos
              </Typography>
              {topRechazosChart.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Sin rechazos en el período.</Typography>
              ) : (
                <Box sx={{ height: Math.min(360, Math.max(220, topRechazosChart.length * 40)) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topRechazosChart} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                      <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nombre" width={110} tick={axisTick} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="rechazos" name="Rechazos" fill={IGSS_COLORS.error} radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </SectionBlock>

      <SectionBlock
        title="Tabla completa"
      >
        <Paper elevation={0} sx={{ ...panelSx, p: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tabs
              value={vista}
              onChange={(_e, v) => { setVista(v); setPage(0); }}
              sx={analyticsTabsSx}
            >
              <Tab label="Ranking del período" />
              <Tab label="Mes a mes" />
            </Tabs>
          </Box>

          {vista === 0 && (
            <Box sx={{ p: 2.25 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Ordenar por</InputLabel>
                  <Select
                    label="Ordenar por"
                    value={orden}
                    onChange={(e) => { setOrden(e.target.value as typeof orden); setPage(0); }}
                  >
                    <MenuItem value="casos">Más casos</MenuItem>
                    <MenuItem value="aprobados">Más aprobados</MenuItem>
                    <MenuItem value="rechazos">Más rechazos</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {rankingOrdenado.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No hay {casoLabel} de colaboradores en este período / unidad.
                </Typography>
              ) : (
                <>
                  <TableContainer sx={tableScrollSx}>
                    <Table size="small" sx={{ minWidth: 720 }}>
                      <TableHead>
                        <TableRow sx={{ '& th': { fontWeight: 700, color: IGSS_COLORS.azulOscuro, borderBottomColor: gridStroke, whiteSpace: 'nowrap' } }}>
                          <TableCell>#</TableCell>
                          <TableCell>Colaborador</TableCell>
                          <TableCell align="right">Casos</TableCell>
                          <TableCell align="right">Aprobados</TableCell>
                          <TableCell align="right">Rechazos</TableCell>
                          <TableCell align="right">Pend. corrección</TableCell>
                          <TableCell align="right">En revisión DAF</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rankingPage.map((row, idx) => {
                          const rank = page * rowsPerPage + idx;
                          return (
                            <TableRow key={row.usuarioId} hover sx={{ '& td': { borderBottomColor: gridStroke } }}>
                              <TableCell>
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                  {rank === 0 && <EmojiEvents sx={{ fontSize: 18, color: '#C47A20' }} />}
                                  <Typography variant="body2" fontWeight={700}>{rank + 1}</Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={700}>{row.etiqueta}</Typography>
                                {row.unidadMedica && (
                                  <Typography variant="caption" color="text.secondary" display="block">{row.unidadMedica}</Typography>
                                )}
                              </TableCell>
                              <TableCell align="right"><strong>{row.historico.casos}</strong></TableCell>
                              <TableCell align="right">{row.historico.aprobados}</TableCell>
                              <TableCell align="right">{row.historico.rechazosAcumulados}</TableCell>
                              <TableCell align="right">{row.historico.pendientesCorreccion}</TableCell>
                              <TableCell align="right">{row.historico.pendientesRevisionDaf}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={rankingOrdenado.length}
                    page={page}
                    onPageChange={(_e, p) => setPage(p)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                    rowsPerPageOptions={[5, 10, 25]}
                    labelRowsPerPage="Filas"
                  />
                </>
              )}
            </Box>
          )}

          {vista === 1 && (
            <Box sx={{ p: 2.25 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Mes</InputLabel>
                  <Select
                    label="Mes"
                    value={mesFocus}
                    onChange={(e) => setMesFocus(e.target.value)}
                  >
                    <MenuItem value="todos">Todos los meses</MenuItem>
                    {mesesDisponibles.map(([clave, etiqueta]) => (
                      <MenuItem key={clave} value={clave}>{etiqueta}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {filasMensuales.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Sin movimiento mensual en el rango.</Typography>
              ) : (
                <TableContainer sx={tableScrollSx}>
                  <Table size="small" sx={{ minWidth: 640 }}>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, color: IGSS_COLORS.azulOscuro, borderBottomColor: gridStroke, whiteSpace: 'nowrap' } }}>
                        <TableCell>Mes</TableCell>
                        <TableCell>Colaborador</TableCell>
                        <TableCell align="right">Casos</TableCell>
                        <TableCell align="right">Aprobados</TableCell>
                        <TableCell align="right">Rechazos</TableCell>
                        <TableCell align="right">Pendientes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filasMensuales.map((f) => (
                        <TableRow key={f.key} hover sx={{ '& td': { borderBottomColor: gridStroke } }}>
                          <TableCell sx={{ whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{f.etiquetaMes}</TableCell>
                          <TableCell>{f.colaborador}</TableCell>
                          <TableCell align="right"><strong>{f.casos}</strong></TableCell>
                          <TableCell align="right">{f.aprobados}</TableCell>
                          <TableCell align="right">{f.rechazos}</TableCell>
                          <TableCell align="right">{f.pendientes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Paper>
      </SectionBlock>
    </Box>
  );
}
