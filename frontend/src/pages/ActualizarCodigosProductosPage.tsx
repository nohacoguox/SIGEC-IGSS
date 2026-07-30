// Actualización independiente de catálogos MINFIN y SIBOFA (códigos / descripciones)
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  InputAdornment,
  Paper,
  FormGroup,
  FormControlLabel,
  Checkbox,
  LinearProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import api from '../api';
import { useThemeMode } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { IGSS_COLORS } from '../theme/institutionalColors';

type CatalogoOrigen = 'MINFIN' | 'SIBOFA';

type CatalogoStats = {
  total: number;
  ultimaActualizacion: string | null;
  columnaCodigo?: string | null;
  columnasDescripcion?: string[];
};

type CatalogoItem = {
  id: number;
  codigo: string;
  descripcion: string;
  origen: CatalogoOrigen;
  datosOriginales: Record<string, string>;
};

const CATALOGOS: { key: CatalogoOrigen; label: string; ayuda: string }[] = [
  {
    key: 'MINFIN',
    label: 'MINFIN',
    ayuda: 'Catálogo de códigos y productos del Ministerio de Finanzas Públicas.',
  },
  {
    key: 'SIBOFA',
    label: 'SIBOFA',
    ayuda: 'Catálogo de códigos y productos SIBOFA.',
  },
];

const excelColumnLabel = (index: number) => {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
};

const buildDescriptionPreview = (data: Record<string, string>, columns: string[]) => {
  const parts = columns
    .map((column) => String(data?.[column] ?? '').trim().replace(/(?:\s*;\s*)+$/g, ''))
    .filter(Boolean);
  return parts.length ? `${parts.join('; ')};` : '—';
};

const ActualizarCodigosProductosPage: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const { showSuccess, showError } = useNotification();
  const [tab, setTab] = useState<CatalogoOrigen>('MINFIN');
  const [uploading, setUploading] = useState(false);
  const [statsByOrigen, setStatsByOrigen] = useState<Record<CatalogoOrigen, CatalogoStats>>({
    MINFIN: { total: 0, ultimaActualizacion: null },
    SIBOFA: { total: 0, ultimaActualizacion: null },
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [codigoColumn, setCodigoColumn] = useState<string | null>(null);
  const [descriptionColumns, setDescriptionColumns] = useState<string[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [configProgress, setConfigProgress] = useState(0);
  const [configMessage, setConfigMessage] = useState('');
  const inputFileRef = useRef<HTMLInputElement>(null);

  const watchJob = (
    jobId: string,
    setProgress: React.Dispatch<React.SetStateAction<number>>,
    setMessage: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const timer = window.setInterval(async () => {
      try {
        const res = await api.get(`/catalogo-productos/trabajos/${jobId}`);
        setProgress((current) => Math.max(current, Number(res.data?.progreso ?? 1)));
        setMessage(res.data?.mensaje ?? 'Procesando...');
        if (res.data?.estado === 'COMPLETADO' || res.data?.estado === 'ERROR') {
          window.clearInterval(timer);
        }
      } catch {
        // La petición principal mostrará cualquier error.
      }
    }, 700);
    return () => window.clearInterval(timer);
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/catalogo-productos/stats');
      setStatsByOrigen({
        MINFIN: {
          total: res.data?.MINFIN?.total ?? 0,
          ultimaActualizacion: res.data?.MINFIN?.ultimaActualizacion ?? null,
          columnaCodigo: res.data?.MINFIN?.columnaCodigo ?? null,
          columnasDescripcion: res.data?.MINFIN?.columnasDescripcion ?? [],
        },
        SIBOFA: {
          total: res.data?.SIBOFA?.total ?? 0,
          ultimaActualizacion: res.data?.SIBOFA?.ultimaActualizacion ?? null,
          columnaCodigo: res.data?.SIBOFA?.columnaCodigo ?? null,
          columnasDescripcion: res.data?.SIBOFA?.columnasDescripcion ?? [],
        },
      });
    } catch {
      setStatsByOrigen({
        MINFIN: { total: 0, ultimaActualizacion: null },
        SIBOFA: { total: 0, ultimaActualizacion: null },
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const loadList = async () => {
    setLoadingList(true);
    try {
      const res = await api.get('/catalogo-productos', {
        params: {
          origen: tab,
          q: searchDebounced || undefined,
          page: page + 1,
          limit: rowsPerPage,
        },
      });
      setItems(res.data?.items ?? []);
      setTotalItems(res.data?.total ?? 0);
    } catch {
      setItems([]);
      setTotalItems(0);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const loadConfig = async (origen: CatalogoOrigen) => {
    try {
      const res = await api.get('/catalogo-productos/config', { params: { origen } });
      setHeaders(res.data?.encabezados ?? []);
      setCodigoColumn(res.data?.columnaCodigo ?? null);
      setDescriptionColumns(res.data?.columnasDescripcion ?? []);
    } catch {
      setHeaders([]);
      setCodigoColumn(null);
      setDescriptionColumns([]);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [tab, searchDebounced]);

  useEffect(() => {
    loadConfig(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, rowsPerPage, searchDebounced]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('origen', tab);
    setUploading(true);
    setUploadProgress(1);
    setUploadMessage('Preparando carga...');
    let stopWatching = () => {};
    try {
      const job = await api.post('/catalogo-productos/trabajos', { tipo: 'IMPORTAR' });
      const jobId = String(job.data.id);
      stopWatching = watchJob(jobId, setUploadProgress, setUploadMessage);
      const res = await api.post('/catalogo-productos/importar', formData, {
        params: { trabajoId: jobId },
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event: any) => {
          if (!event.total) return;
          const networkProgress = 1 + Math.round((event.loaded / event.total) * 24);
          setUploadProgress((current) => Math.max(current, Math.min(25, networkProgress)));
          setUploadMessage(`Subiendo archivo: ${Math.min(100, Math.round((event.loaded / event.total) * 100))}%`);
        },
      });
      setUploadProgress(100);
      setUploadMessage(res.data?.message || 'Carga completada.');
      showSuccess(res.data?.message || `Catálogo ${tab} actualizado: ${res.data?.total ?? 0} registros.`);
      await loadStats();
      await loadList();
      await loadConfig(tab);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error al importar el archivo.';
      showError(msg);
    } finally {
      stopWatching();
      setUploading(false);
      e.target.value = '';
      if (inputFileRef.current) inputFileRef.current.value = '';
    }
  };

  const saveDescriptionConfig = async () => {
    if (descriptionColumns.length === 0) {
      showError('Seleccione al menos una columna para la descripción.');
      return;
    }
    setSavingConfig(true);
    setConfigProgress(1);
    setConfigMessage('Preparando actualización...');
    let stopWatching = () => {};
    try {
      const job = await api.post('/catalogo-productos/trabajos', { tipo: 'CONFIGURAR' });
      const jobId = String(job.data.id);
      stopWatching = watchJob(jobId, setConfigProgress, setConfigMessage);
      const res = await api.put('/catalogo-productos/config', {
        origen: tab,
        columnasDescripcion: descriptionColumns,
      }, {
        params: { trabajoId: jobId },
      });
      setConfigProgress(100);
      setConfigMessage(res.data?.message || 'Descripciones actualizadas.');
      showSuccess(res.data?.message || `Descripción de ${tab} actualizada.`);
      await loadStats();
      await loadList();
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Error al guardar la configuración.');
    } finally {
      stopWatching();
      setSavingConfig(false);
    }
  };

  const stats = statsByOrigen[tab];
  const meta = CATALOGOS.find((c) => c.key === tab)!;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/colaborador-dashboard')} sx={{ mb: 2 }}>
        Volver al panel
      </Button>
      <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ color: IGSS_COLORS.textoOscuro }}>
        Actualización de Códigos y Productos
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Gestione de forma independiente los catálogos <strong>MINFIN</strong> y <strong>SIBOFA</strong>. Cada carga
        guarda todas las columnas del archivo y agrega únicamente códigos nuevos; los existentes se omiten. Después
        podrá elegir o cambiar las columnas que aparecerán en la descripción del SIAF.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v: CatalogoOrigen) => setTab(v)}
        sx={{
          mb: 2,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root.Mui-selected': { color: IGSS_COLORS.azul, fontWeight: 700 },
          '& .MuiTabs-indicator': { bgcolor: IGSS_COLORS.azul },
        }}
      >
        {CATALOGOS.map((c) => (
          <Tab
            key={c.key}
            value={c.key}
            label={`${c.label} (${statsByOrigen[c.key].total})`}
          />
        ))}
      </Tabs>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {meta.ayuda}
      </Typography>

      {loadingStats ? (
        <CircularProgress size={24} sx={{ mb: 2 }} />
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          Registros en <strong>{tab}</strong>: <strong>{stats.total}</strong>
          {stats.ultimaActualizacion && (
            <> · Última actualización: {new Date(stats.ultimaActualizacion).toLocaleString('es-GT')}</>
          )}
        </Alert>
      )}

      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2,
          border: '2px dashed',
          borderColor: mode !== 'dark' ? 'grey.300' : 'grey.600',
          bgcolor: mode !== 'dark' ? 'grey.50' : 'grey.900',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <input
            ref={inputFileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            disabled={uploading}
            onClick={() => inputFileRef.current?.click()}
            fullWidth
            sx={{
              py: 2,
              bgcolor: IGSS_COLORS.azul,
              '&:hover': { bgcolor: IGSS_COLORS.azulOscuro },
            }}
          >
            {uploading ? `Cargando toda la información de ${tab}...` : `Cargar Excel completo para ${tab}`}
          </Button>
          {uploadProgress > 0 && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                <Typography variant="body2">{uploadMessage}</Typography>
                <Typography variant="body2" fontWeight={700}>{Math.round(uploadProgress)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 10, borderRadius: 5 }} />
            </Box>
          )}
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>
              Configurar descripción para el SIAF — {tab}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              El catálogo ya está cargado con todas sus columnas. Seleccione aquí cuáles valores deben aparecer en
              “Descripción”. Puede cambiar esta configuración en cualquier momento sin volver a subir el Excel.
            </Typography>

            <Alert severity="success" sx={{ mb: 2 }}>
              Columna de código detectada: <strong>{codigoColumn || '—'}</strong>
            </Alert>
            <Typography fontWeight={700} sx={{ mb: 0.5 }}>
              Columnas que formarán la descripción
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Cada valor se unirá en el orden del Excel y quedará separado por punto y coma (;).
            </Typography>
            <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, mb: 2 }}>
              {headers.map((header, index) => (
                <FormControlLabel
                  key={index}
                  control={
                    <Checkbox
                      checked={descriptionColumns.includes(header)}
                      onChange={(e) => {
                        setDescriptionColumns((current) =>
                          e.target.checked
                            ? headers.filter((value) => [...current, header].includes(value))
                            : current.filter((value) => value !== header)
                        );
                      }}
                    />
                  }
                  label={`Columna ${excelColumnLabel(index)} — ${String(header || '(sin encabezado)')}`}
                />
              ))}
            </FormGroup>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                Vista previa de “Descripción”
              </Typography>
              {items.slice(0, 3).map((row) => (
                <Typography key={row.id} variant="body2" sx={{ mb: 0.5, wordBreak: 'break-word' }}>
                  {buildDescriptionPreview(row.datosOriginales, descriptionColumns)}
                </Typography>
              ))}
            </Alert>

            <Button
              variant="contained"
              onClick={saveDescriptionConfig}
              disabled={savingConfig || descriptionColumns.length === 0}
              startIcon={savingConfig ? <CircularProgress size={20} color="inherit" /> : undefined}
              sx={{ bgcolor: IGSS_COLORS.verde, '&:hover': { bgcolor: IGSS_COLORS.verdeOscuro } }}
            >
              {savingConfig ? 'Actualizando descripciones...' : 'Guardar selección de columnas'}
            </Button>
            {configProgress > 0 && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                  <Typography variant="body2">{configMessage}</Typography>
                  <Typography variant="body2" fontWeight={700}>{Math.round(configProgress)}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={configProgress}
                  color="success"
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5, color: IGSS_COLORS.textoOscuro }}>
        Códigos cargados — {tab}
      </Typography>

      <TextField
        size="small"
        fullWidth
        placeholder="Buscar por código o descripción..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: 420 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 480 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: 160 }}>Código</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Descripción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingList ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No hay registros en este catálogo
                    {searchDebounced ? ' para la búsqueda indicada' : ''}.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.codigo}</TableCell>
                    <TableCell>{row.descripcion || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100]}
          labelRowsPerPage="Filas:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`}
        />
      </Paper>
    </Box>
  );
};

export default ActualizarCodigosProductosPage;
