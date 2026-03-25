import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
} from '@mui/material';
import { Timeline, Speed, TrendingUp, CheckCircle, HourglassEmpty } from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import api from '../api';

interface EstadisticasData {
  dias: number;
  desde: string;
  promedioRevisionHoras: number | null;
  promedioAutorizacionHoras: number | null;
  promedioCorreccionHoras: number | null;
  cantidadRevisados: number;
  cantidadAutorizados: number;
  cantidadConCorreccion: number;
  porSemana: Array<{
    semana: string;
    promedioRevisionHoras: number;
    promedioAutorizacionHoras: number;
    promedioCorreccionHoras: number;
    cantidadRevisados: number;
    cantidadAutorizados: number;
    cantidadCorrecciones: number;
  }>;
}

function formatHoras(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 24) return `${horas.toFixed(1)} h`;
  const dias = horas / 24;
  return `${dias.toFixed(1)} días`;
}

interface MotivosRechazoData {
  dias: number;
  desde: string;
  motivos: Array<{ clave: string; etiqueta: string; cantidad: number }>;
  sinClasificar: number;
  total: number;
}

interface EstadisticasSiafProps {
  /** Pestaña a mostrar al cargar (0 = Tiempos SIAF, 1 = Motivos de rechazo) */
  tabInicial?: 0 | 1;
  /** Si es true, no se muestran las pestañas y solo el contenido de tabInicial */
  ocultarTabs?: boolean;
}

const EstadisticasSiaf: React.FC<EstadisticasSiafProps> = ({ tabInicial = 0, ocultarTabs = false }) => {
  const [data, setData] = useState<EstadisticasData | null>(null);
  const [motivosData, setMotivosData] = useState<MotivosRechazoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dias, setDias] = useState(90);
  const [tabEstadisticas, setTabEstadisticas] = useState(tabInicial);
  const tabActual = ocultarTabs ? tabInicial : tabEstadisticas;

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/estadisticas/siaf-tiempos', { params: { dias } }).then((res) => res.data),
      api.get('/estadisticas/motivos-rechazo', { params: { dias } }).then((res) => res.data),
    ])
      .then(([siafRes, motivosRes]) => {
        setData(siafRes);
        setMotivosData(motivosRes);
      })
      .catch((err) => {
        const msg = err.response?.data?.message;
        const fallback = err.response
          ? (msg || 'Error al cargar estadísticas.')
          : 'No se pudo conectar con el servidor. Verifique que el backend esté en ejecución (puerto 3001).';
        setError(msg || fallback);
      })
      .finally(() => setLoading(false));
  }, [dias]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!data) return null;

  const chartData = data.porSemana.map((s) => {
    const correccionHoras = s.promedioCorreccionHoras ?? 0;
    return {
      semana: new Date(s.semana).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' }),
      revision: Math.round(s.promedioRevisionHoras * 10) / 10,
      autorizacion: Math.round((s.promedioAutorizacionHoras ?? 0) * 10) / 10,
      correccion: Math.round(correccionHoras * 10) / 10,
      correccionMin: Math.round(correccionHoras * 60 * 10) / 10,
      revisados: s.cantidadRevisados,
      autorizados: s.cantidadAutorizados ?? 0,
      correcciones: s.cantidadCorrecciones,
    };
  });

  const kpiCards = [
    {
      title: 'Tiempo hasta autorización',
      value: data.promedioAutorizacionHoras != null ? formatHoras(data.promedioAutorizacionHoras) : '—',
      subtitle: 'Desde generación hasta autorización',
      detail: `${data.cantidadAutorizados ?? 0} SIAF autorizados`,
      icon: <CheckCircle />,
      color: '#0D47A1',
      borderLeft: '4px solid #1565C0',
    },
    {
      title: 'Tiempo de revisión (total)',
      value: data.promedioRevisionHoras != null ? formatHoras(data.promedioRevisionHoras) : '—',
      subtitle: 'Hasta autorización o rechazo',
      detail: `${data.cantidadRevisados} revisados`,
      icon: <Speed />,
      color: '#1565C0',
      borderLeft: '4px solid #1565C0',
    },
    {
      title: 'Tiempo de corrección',
      value: data.promedioCorreccionHoras != null ? formatHoras(data.promedioCorreccionHoras) : '—',
      subtitle: 'Desde rechazo hasta corrección',
      detail: `${data.cantidadConCorreccion} correcciones`,
      icon: <Timeline />,
      color: '#1B5E20',
      borderLeft: '4px solid #2E7D32',
    },
    {
      title: 'Total revisados',
      value: String(data.cantidadRevisados),
      subtitle: 'Autorizados o rechazados',
      icon: <TrendingUp />,
      color: 'text.primary',
      borderLeft: '4px solid #757575',
    },
    {
      title: 'Correcciones',
      value: String(data.cantidadConCorreccion),
      subtitle: 'Tras rechazo',
      icon: <HourglassEmpty />,
      color: 'text.secondary',
      borderLeft: '4px solid #9E9E9E',
    },
  ];

  const fechaDesde = tabActual === 0 ? data.desde : (motivosData?.desde ?? data.desde);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h6" fontWeight="600" color="primary" sx={{ mb: 1 }}>
        Estadísticas
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Período</InputLabel>
          <Select value={dias} label="Período" onChange={(e) => setDias(Number(e.target.value))}>
            <MenuItem value={30}>Últimos 30 días</MenuItem>
            <MenuItem value={90}>Últimos 90 días</MenuItem>
            <MenuItem value={180}>Últimos 6 meses</MenuItem>
            <MenuItem value={365}>Último año</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          Datos desde {new Date(fechaDesde).toLocaleDateString('es-GT', { dateStyle: 'long' })}
        </Typography>
      </Box>

      {!ocultarTabs && (
        <Tabs value={tabEstadisticas} onChange={(_, v) => setTabEstadisticas(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="SIAF — Tiempos de revisión, autorización y corrección" id="estad-tab-0" aria-controls="estad-panel-0" />
          <Tab label="Motivos de rechazo más frecuentes" id="estad-tab-1" aria-controls="estad-panel-1" />
        </Tabs>
      )}

      {/* Panel: Tiempos SIAF */}
      <div role="tabpanel" hidden={tabActual !== 0} id="estad-panel-0" aria-labelledby="estad-tab-0">
        {tabActual === 0 && (
          <Box>
      {/* Resumen del período: más espacio entre tarjetas */}
      <Box sx={{ mb: 5 }}>
        <Typography variant="subtitle1" fontWeight="600" color="text.primary" sx={{ mb: 2, display: 'block' }}>
          Resumen del período
        </Typography>
        <Grid container spacing={3}>
          {kpiCards.map((kpi) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={kpi.title}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  borderLeft: kpi.borderLeft,
                  borderRadius: 2,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <CardContent sx={{ py: 2, px: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        {kpi.title}
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" sx={{ color: kpi.color, mb: 0.5 }}>
                        {kpi.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {kpi.subtitle}
                      </Typography>
                      {kpi.detail != null && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                          {kpi.detail}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ color: kpi.color, opacity: 0.7, ml: 1 }}>{kpi.icon}</Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {chartData.length > 0 && (
        <>
          {/* Detalle por semana: tabla con más aire */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="subtitle1" fontWeight="600" color="text.primary" sx={{ mb: 2, display: 'block' }}>
              Detalle por semana
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Semana</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1.5 }} align="right">Prom. revisión</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1.5 }} align="right">Prom. autorización</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1.5 }} align="right">Prom. corrección</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1.5 }} align="right">Revisados</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1.5 }} align="right">Autorizados</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1.5 }} align="right">Correcciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {chartData.map((row) => (
                    <TableRow key={row.semana} hover>
                      <TableCell sx={{ py: 1.5 }}>{row.semana}</TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>{row.revision > 0 ? formatHoras(row.revision) : '—'}</TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>{row.autorizacion > 0 ? formatHoras(row.autorizacion) : '—'}</TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>{row.correccion > 0 ? formatHoras(row.correccion) : '—'}</TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>{row.revisados}</TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>{row.autorizados}</TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>{row.correcciones}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Dos gráficos de barras separados */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="600" color="text.primary" sx={{ mb: 2, display: 'block' }}>
              Visualización por semana
            </Typography>
            <Grid container spacing={4}>
              <Grid item xs={12} lg={6}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, height: '100%', minHeight: 320, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight="600" sx={{ mb: 2 }}>
                    Revisión y autorización (horas)
                  </Typography>
                  <Box sx={{ width: '100%', height: 280 }}>
                    <ChartHoras data={chartData} formatHoras={formatHoras} />
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} lg={6}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, height: '100%', minHeight: 320, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight="600" sx={{ mb: 2 }}>
                    Tiempo de corrección (minutos)
                  </Typography>
                  <Box sx={{ width: '100%', height: 280 }}>
                    <ChartCorreccion data={chartData} />
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </>
      )}

      {chartData.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No hay datos de revisión o corrección en el período seleccionado. Las estadísticas se actualizarán cuando existan SIAFs autorizados, rechazados o corregidos.
        </Alert>
      )}
          </Box>
        )}
      </div>

      {/* Panel: Motivos de rechazo */}
      <div role="tabpanel" hidden={tabActual !== 1} id="estad-panel-1" aria-labelledby="estad-tab-1">
        {tabActual === 1 && motivosData && (
          <Box>
            <Typography variant="subtitle1" fontWeight="600" color="text.primary" sx={{ mb: 1, display: 'block' }}>
              Motivos de rechazo más frecuentes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Rechazos en el período seleccionado clasificados por categoría. Al rechazar un SIAF, Dirección Departamental puede elegir la categoría para que estas estadísticas se actualicen.
            </Typography>
            {motivosData.total === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                No hay rechazos registrados en este período, o aún no se han clasificado motivos. Los rechazos nuevos pueden incluir una categoría al confirmar el rechazo.
              </Alert>
            ) : (
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <Box sx={{ width: '100%', height: Math.max(220, motivosData.motivos.length * 44) }}>
                  <ChartMotivosRechazo data={motivosData.motivos} />
                </Box>
                {motivosData.sinClasificar > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {motivosData.sinClasificar} rechazo(s) sin categoría asignada (anteriores a esta funcionalidad).
                  </Typography>
                )}
              </Paper>
            )}
          </Box>
        )}
      </div>
    </Box>
  );
};

/** Gráfico de barras: revisión y autorización por semana (horas) */
function ChartHoras({
  data,
  formatHoras,
}: {
  data: Array<{ semana: string; revision: number; autorizacion: number }>;
  formatHoras: (h: number) => string;
}) {
  const tickFormatter = (value: number) => (value >= 1 ? `${value} h` : value > 0 ? `${Math.round(value * 60)} min` : '0');
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="semana" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'rgba(0,0,0,0.12)' }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={tickFormatter} tickLine={false} axisLine={{ stroke: 'rgba(0,0,0,0.12)' }} width={48} />
        <Tooltip
          contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '12px 14px' }}
          formatter={(value: number, name: string) => [formatHoras(value), name === 'revision' ? 'Revisión' : 'Autorización']}
          labelFormatter={(label) => `Semana ${label}`}
        />
        <Legend wrapperStyle={{ paddingTop: 8 }} iconType="square" iconSize={12} />
        <Bar dataKey="revision" name="Revisión" fill="#1565C0" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="autorizacion" name="Autorización" fill="#0D47A1" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Gráfico de barras: tiempo de corrección por semana (minutos) */
function ChartCorreccion({ data }: { data: Array<{ semana: string; correccionMin: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="semana" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'rgba(0,0,0,0.12)' }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} min`} tickLine={false} axisLine={{ stroke: 'rgba(0,0,0,0.12)' }} width={52} />
        <Tooltip
          contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '12px 14px' }}
          formatter={(value: number) => [`${Number(value).toFixed(0)} min`, 'Corrección']}
          labelFormatter={(label) => `Semana ${label}`}
        />
        <Bar dataKey="correccionMin" name="Corrección" fill="#2E7D32" radius={[4, 4, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Gráfico de barras horizontales: motivos de rechazo (cantidad por categoría) */
function ChartMotivosRechazo({ data }: { data: Array<{ clave: string; etiqueta: string; cantidad: number }> }) {
  const filtered = data.filter((d) => d.cantidad > 0);
  if (filtered.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={filtered} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={true} vertical={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'rgba(0,0,0,0.12)' }} allowDecimals={false} />
        <YAxis type="category" dataKey="etiqueta" width={200} tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'rgba(0,0,0,0.12)' }} />
        <Tooltip
          contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '12px 14px' }}
          formatter={(value: number) => [value, 'Rechazos']}
          labelFormatter={(label) => label}
        />
        <Bar dataKey="cantidad" name="Rechazos" fill="#C62828" radius={[0, 4, 4, 0]} barSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default EstadisticasSiaf;
