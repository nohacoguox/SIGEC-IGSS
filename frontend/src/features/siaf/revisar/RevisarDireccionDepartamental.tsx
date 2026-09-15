import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Chip,
  Divider,
  Paper,
} from '@mui/material';
import {
  Check,
  Close,
  Cancel,
  AttachFile,
  History,
  Visibility,
  Place as PlaceIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  PushPin as PushPinIcon,
  DragIndicator as DragIndicatorIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { pdf } from '@react-pdf/renderer';
import { SiafPdfDocument } from '../../../components/SiafPdfDocument';
import PdfViewerWithClick from '../../../components/PdfViewerWithClick';
import api from '../../../api';
import { useNotification } from '../../../context/NotificationContext';
import { limpiarComentarioBitacora, parseMarcadoresBitacora } from '../../../utils/siafBitacora';
import type {
  AdjuntoComparar,
  BitacoraEntry,
  DialogNuevaMarcaState,
  MarcaCorreccion,
  MetaDD,
  MotivoRechazoDraft,
  Municipio,
  SiafAdjunto,
  SiafHistorialItem,
  SiafSolicitud,
  ViewingDoc,
} from './types';
import { etiquetaMotivo } from './constants';
import {
  buildMarkersVisibles,
  buildSiafPdfData,
  mapBitacoraEntry,
  mapHistorialItem,
  transformSiaf,
  unificarHistorial,
} from './utils';
import ContextoUnidadCard from './components/ContextoUnidadCard';
import PendientesTable from './components/PendientesTable';
import HistorialTable from './components/HistorialTable';
import MotivosRechazoDialog from './components/MotivosRechazoDialog';
import NuevaMarcaDialog from './components/NuevaMarcaDialog';
import BitacoraStandaloneDialog from './components/BitacoraStandaloneDialog';
import AdjuntosListaDialog from './components/AdjuntosListaDialog';
import DocumentoViewerDialog from './components/DocumentoViewerDialog';

const RevisarDireccionDepartamental: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [solicitudes, setSolicitudes] = useState<SiafSolicitud[]>([]);
  const [historial, setHistorial] = useState<SiafHistorialItem[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [meta, setMeta] = useState<MetaDD | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [filtroMunicipioId, setFiltroMunicipioId] = useState<number | ''>('');
  const [selectedSiaf, setSelectedSiaf] = useState<SiafSolicitud | null>(null);
  const [viewOnlyFromHistorial, setViewOnlyFromHistorial] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [openRechazarDialog, setOpenRechazarDialog] = useState(false);
  /** Varios motivos de rechazo (categoría + descripción) para una sola revisión */
  const [motivosRechazo, setMotivosRechazo] = useState<MotivoRechazoDraft[]>([{ categoria: '', descripcion: '' }]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjuntosDialogOpen, setAdjuntosDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<ViewingDoc | null>(null);
  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [bitacoraList, setBitacoraList] = useState<BitacoraEntry[]>([]);
  const [bitacoraLoading, setBitacoraLoading] = useState(false);
  const [bitacoraTitulo, setBitacoraTitulo] = useState('');
  const [bitacoraBackendId, setBitacoraBackendId] = useState<number | null>(null);
  /** Bitácora mostrada a la par al abrir el SIAF (para comparar correcciones) */
  const [bitacoraEnVistaDialog, setBitacoraEnVistaDialog] = useState<BitacoraEntry[]>([]);
  const [bitacoraEnVistaLoading, setBitacoraEnVistaLoading] = useState(false);
  const { showSuccess, showError } = useNotification();

  /** Marcado de correcciones sobre el PDF */
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfBlobLoading, setPdfBlobLoading] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [modoMarcar, setModoMarcar] = useState(false);
  const [marcasCorreccion, setMarcasCorreccion] = useState<MarcaCorreccion[]>([]);
  const [marcaActivaId, setMarcaActivaId] = useState<string | null>(null);
  const [panelDerechoTab, setPanelDerechoTab] = useState(0);
  const [dialogNuevaMarca, setDialogNuevaMarca] = useState<DialogNuevaMarcaState | null>(null);
  const [marcasHistorialVista, setMarcasHistorialVista] = useState<MarcaCorreccion[]>([]);
  const pdfUrlRef = useRef<string | null>(null);
  /** División redimensionable SIAF | panel derecho (porcentaje del ancho izquierdo) */
  const [leftPanePct, setLeftPanePct] = useState(55);
  const splitDraggingRef = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  /** Adjunto abierto a la derecha para comparar con el SIAF */
  const [adjuntoComparar, setAdjuntoComparar] = useState<AdjuntoComparar | null>(null);
  const [adjuntoCompararLoading, setAdjuntoCompararLoading] = useState(false);
  const adjuntoUrlRef = useRef<string | null>(null);

  const fetchSolicitudes = useCallback(async (municipioId?: number | '') => {
    setLoading(true);
    setError(null);
    try {
      const params = municipioId !== undefined && municipioId !== '' ? { municipioId } : {};
      const res = await api.get('/siaf/para-direccion-departamental', { params });
      const data = res.data;
      const list = Array.isArray(data) ? data : (data?.solicitudes ?? []);
      const esCorreccionIds = (data?.meta?.esCorreccionIds ?? []) as number[];
      setSolicitudes((list || []).map((s: any) => transformSiaf(s, esCorreccionIds.includes(Number(s.id)))));
      if (data && !Array.isArray(data) && data.meta) {
        setMeta({
          unidadAsignada: data.meta.unidadAsignada ?? '',
          departamento: data.meta.departamento ?? '',
          departamentoId: data.meta.departamentoId ?? null,
        });
      } else {
        setMeta(null);
      }
    } catch (err: any) {
      console.error('Error al obtener solicitudes para Dirección Departamental:', err);
      setError(err.response?.data?.message || 'Error al cargar las solicitudes. Verifique que tenga un departamento asignado.');
      setSolicitudes([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistorial = useCallback(async () => {
    setHistorialLoading(true);
    try {
      const res = await api.get('/siaf/historial-direccion-departamental');
      const list = Array.isArray(res.data) ? res.data : [];
      setHistorial(list.map((item: any) => mapHistorialItem(item)));
    } catch (err: any) {
      console.error('Error al cargar historial DD:', err);
      showError(err.response?.data?.message || 'Error al cargar historial.');
      setHistorial([]);
    } finally {
      setHistorialLoading(false);
    }
  }, [showError]);

  const historialUnificado = useMemo(() => unificarHistorial(historial), [historial]);

  const fetchBitacora = useCallback(async (backendId: number): Promise<BitacoraEntry[]> => {
    const res = await api.post(`/siaf/${backendId}/bitacora`, {});
    if (!Array.isArray(res.data)) return [];
    return res.data.map((b: any) => mapBitacoraEntry(b));
  }, []);

  const handleOpenBitacora = useCallback(async (backendId: number, correlativo: string) => {
    setBitacoraTitulo(`Bitácora — SIAF ${correlativo}`);
    setBitacoraBackendId(backendId);
    setBitacoraOpen(true);
    setBitacoraLoading(true);
    setBitacoraList([]);
    try {
      const lista = await fetchBitacora(backendId);
      setBitacoraList(lista);
    } catch (err) {
      showError('Error al cargar la bitácora.');
      setBitacoraList([]);
    } finally {
      setBitacoraLoading(false);
    }
  }, [fetchBitacora, showError]);

  const handleRecargarBitacora = useCallback(async () => {
    if (bitacoraBackendId == null) return;
    setBitacoraLoading(true);
    try {
      const lista = await fetchBitacora(bitacoraBackendId);
      setBitacoraList(lista);
    } catch (err) {
      showError('Error al recargar la bitácora.');
    } finally {
      setBitacoraLoading(false);
    }
  }, [bitacoraBackendId, fetchBitacora, showError]);

  useEffect(() => {
    fetchSolicitudes(filtroMunicipioId);
  }, [fetchSolicitudes, filtroMunicipioId]);

  useEffect(() => {
    const id = meta?.departamentoId;
    if (id == null) {
      setMunicipios([]);
      return;
    }
    api.get('/municipios', { params: { departamentoId: id } })
      .then((res) => setMunicipios(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMunicipios([]));
  }, [meta?.departamentoId]);

  useEffect(() => {
    if (tabValue === 1) fetchHistorial();
  }, [tabValue, fetchHistorial]);

  const revokePdfUrl = useCallback(() => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setPdfBlobUrl(null);
  }, []);

  useEffect(() => {
    if (!openDialog || !selectedSiaf) {
      revokePdfUrl();
      return;
    }
    let cancelled = false;
    setPdfBlobLoading(true);
    (async () => {
      try {
        const blob = await pdf(<SiafPdfDocument data={buildSiafPdfData(selectedSiaf)} />).toBlob();
        if (cancelled) return;
        revokePdfUrl();
        const url = URL.createObjectURL(blob);
        pdfUrlRef.current = url;
        setPdfBlobUrl(url);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          showError('No se pudo generar el PDF para marcar correcciones.');
        }
      } finally {
        if (!cancelled) setPdfBlobLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openDialog, selectedSiaf, revokePdfUrl, showError]);

  const markersVisibles = useMemo(
    () => buildMarkersVisibles(marcasCorreccion, marcasHistorialVista, marcaActivaId),
    [marcasCorreccion, marcasHistorialVista, marcaActivaId],
  );

  const revokeAdjuntoUrl = useCallback(() => {
    if (adjuntoUrlRef.current) {
      URL.revokeObjectURL(adjuntoUrlRef.current);
      adjuntoUrlRef.current = null;
    }
    setAdjuntoComparar(null);
  }, []);

  const cargarAdjuntoParaComparar = async (a: SiafAdjunto) => {
    setAdjuntoCompararLoading(true);
    setPanelDerechoTab(2);
    try {
      const res = await api.get(`/siaf/adjuntos/${a.id}/descargar`, { responseType: 'blob' });
      const mime = a.mimeType || res.data?.type || 'application/pdf';
      if (adjuntoUrlRef.current) {
        URL.revokeObjectURL(adjuntoUrlRef.current);
        adjuntoUrlRef.current = null;
      }
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
      adjuntoUrlRef.current = url;
      setAdjuntoComparar({ id: a.id, nombreOriginal: a.nombreOriginal, mimeType: mime, url });
    } catch {
      showError('Error al cargar el documento adjunto');
      revokeAdjuntoUrl();
    } finally {
      setAdjuntoCompararLoading(false);
    }
  };

  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    splitDraggingRef.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!splitDraggingRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPanePct(Math.min(72, Math.max(28, pct)));
    };
    const onUp = () => {
      splitDraggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleOpenDialog = (siaf: SiafSolicitud, fromHistorial = false) => {
    setSelectedSiaf(siaf);
    setViewOnlyFromHistorial(fromHistorial);
    setOpenDialog(true);
    setBitacoraEnVistaDialog([]);
    setBitacoraEnVistaLoading(true);
    setModoMarcar(false);
    setMarcasCorreccion([]);
    setMarcaActivaId(null);
    setPanelDerechoTab(0);
    setMarcasHistorialVista([]);
    setViewerZoom(1);
    setDialogNuevaMarca(null);
    setLeftPanePct(55);
    revokeAdjuntoUrl();
    const backendId = Number(siaf.id);
    api.post(`/siaf/${backendId}/bitacora`, {})
      .then((res) => {
        if (!Array.isArray(res.data)) return;
        setBitacoraEnVistaDialog(res.data.map((b: any) => mapBitacoraEntry(b)));
      })
      .catch(() => setBitacoraEnVistaDialog([]))
      .finally(() => setBitacoraEnVistaLoading(false));
  };

  const handleCloseDialog = () => {
    setSelectedSiaf(null);
    setViewOnlyFromHistorial(false);
    setOpenDialog(false);
    setOpenRechazarDialog(false);
    setMotivosRechazo([{ categoria: '', descripcion: '' }]);
    setBitacoraEnVistaDialog([]);
    setModoMarcar(false);
    setMarcasCorreccion([]);
    setMarcaActivaId(null);
    setMarcasHistorialVista([]);
    setDialogNuevaMarca(null);
    revokeAdjuntoUrl();
    revokePdfUrl();
  };

  const handleAprobar = async () => {
    if (!selectedSiaf) return;
    if (marcasCorreccion.length > 0) {
      showError('No se puede dar revisión favorable mientras existan marcas de corrección. Elimínelas o rechace el SIAF.');
      return;
    }
    try {
      await api.post(`/siaf/${selectedSiaf.id}/aprobar-direccion-departamental`);
      showSuccess('Revisión favorable registrada. El SIAF quedó finalizado y puede continuar con el expediente.');
      handleCloseDialog();
      await fetchSolicitudes(filtroMunicipioId);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Error al finalizar la revisión.');
    }
  };

  const enviarRechazo = async (
    motivos: Array<{ categoria: string; descripcion: string; pagina?: number; xPercent?: number; yPercent?: number }>
  ) => {
    if (!selectedSiaf) return;
    await api.post(`/siaf/${selectedSiaf.id}/rechazar-direccion-departamental`, { motivos });
    showSuccess('SIAF rechazado por Dirección Departamental. Las marcas y motivos quedaron en la bitácora.');
    setOpenRechazarDialog(false);
    setMotivosRechazo([{ categoria: '', descripcion: '' }]);
    handleCloseDialog();
    await fetchSolicitudes(filtroMunicipioId);
  };

  const handleConfirmarRechazo = async () => {
    if (!selectedSiaf) return;
    const validos = motivosRechazo
      .filter((m) => (m.descripcion || '').trim())
      .map((m) => ({
        categoria: (m.categoria || '').trim() || 'otro',
        descripcion: (m.descripcion || '').trim(),
      }));
    if (validos.length === 0) {
      showError('Debe agregar al menos un motivo con descripción.');
      return;
    }
    try {
      await enviarRechazo(validos);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Error al rechazar.');
    }
  };

  const handleRechazarConMarcas = async () => {
    const validos = marcasCorreccion
      .filter((m) => (m.descripcion || '').trim())
      .map((m) => ({
        categoria: (m.categoria || '').trim() || 'otro',
        descripcion: (m.descripcion || '').trim(),
        pagina: m.pagina,
        xPercent: m.xPercent,
        yPercent: m.yPercent,
      }));
    if (validos.length === 0) {
      showError('Agregue al menos una marca con comentario, o use «Rechazar sin marca».');
      setPanelDerechoTab(0);
      return;
    }
    try {
      await enviarRechazo(validos);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Error al rechazar.');
    }
  };

  const agregarMotivoRechazo = () => setMotivosRechazo((prev) => [...prev, { categoria: '', descripcion: '' }]);
  const quitarMotivoRechazo = (index: number) => {
    if (motivosRechazo.length <= 1) return;
    setMotivosRechazo((prev) => prev.filter((_, i) => i !== index));
  };
  const actualizarMotivoRechazo = (index: number, field: 'categoria' | 'descripcion', value: string) => {
    setMotivosRechazo((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleClickMarcarPdf = (pageNumber: number, xPercent: number, yPercent: number) => {
    if (viewOnlyFromHistorial) return;
    setModoMarcar(false);
    setDialogNuevaMarca({
      open: true,
      pagina: pageNumber,
      xPercent,
      yPercent,
      categoria: '',
      descripcion: '',
    });
  };

  const confirmarNuevaMarca = () => {
    if (!dialogNuevaMarca) return;
    const desc = (dialogNuevaMarca.descripcion || '').trim();
    if (!desc) {
      showError('Escriba qué debe corregirse en este punto.');
      return;
    }
    const nueva: MarcaCorreccion = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      categoria: dialogNuevaMarca.categoria || 'otro',
      descripcion: desc,
      pagina: dialogNuevaMarca.pagina,
      xPercent: dialogNuevaMarca.xPercent,
      yPercent: dialogNuevaMarca.yPercent,
    };
    setMarcasCorreccion((prev) => [...prev, nueva]);
    setMarcaActivaId(nueva.id);
    setPanelDerechoTab(0);
    setDialogNuevaMarca(null);
  };

  const eliminarMarca = (id: string) => {
    setMarcasCorreccion((prev) => prev.filter((m) => m.id !== id));
    if (marcaActivaId === id) setMarcaActivaId(null);
  };

  const verMarcasDeBitacora = (entry: BitacoraEntry) => {
    const marcas = parseMarcadoresBitacora(entry.detalleAntes);
    if (marcas.length === 0) {
      showError('Este rechazo no tiene marcas en el documento.');
      return;
    }
    setMarcasHistorialVista(marcas);
    setPanelDerechoTab(0);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {meta && <ContextoUnidadCard meta={meta} />}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} variant="filled">
          {error}
        </Alert>
      )}

      {/* Pestañas con estilo corporativo */}
      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        sx={{
          mb: 3,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', minHeight: 48 },
          '& .Mui-selected': { color: 'primary.main' },
          '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
        }}
      >
        <Tab label="Pendientes" icon={<Visibility />} iconPosition="start" />
        <Tab label="Historial de revisiones" icon={<History />} iconPosition="start" />
      </Tabs>

      {tabValue === 0 && (
        <PendientesTable
          solicitudes={solicitudes}
          municipios={municipios}
          filtroMunicipioId={filtroMunicipioId}
          onFiltroMunicipioChange={setFiltroMunicipioId}
          onOpenSiaf={(siaf) => handleOpenDialog(siaf, false)}
        />
      )}

      {tabValue === 1 && (
        <HistorialTable
          loading={historialLoading}
          historialUnificado={historialUnificado}
          onOpenBitacora={handleOpenBitacora}
          onOpenSiaf={(item) => handleOpenDialog(transformSiaf(item.siaf), true)}
        />
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="xl" fullWidth PaperProps={{ sx: { maxHeight: '95vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, pb: 1 }}>
          <span>Solicitud SIAF — {selectedSiaf?.correlativo}</span>
          {(selectedSiaf?.documentosAdjuntos?.length ?? 0) > 0 && (
            <Button
              size="small"
              startIcon={<AttachFile />}
              onClick={() => {
                setPanelDerechoTab(2);
                const primero = selectedSiaf?.documentosAdjuntos?.[0];
                if (primero && (!adjuntoComparar || adjuntoComparar.id !== primero.id)) {
                  void cargarAdjuntoParaComparar(primero);
                }
              }}
              variant="outlined"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Comparar adjuntos ({selectedSiaf?.documentosAdjuntos?.length ?? 0})
            </Button>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden', minHeight: 480 }}>
          <Box
            ref={splitContainerRef}
            sx={{ display: 'flex', flexDirection: 'row', overflow: 'hidden', height: '70vh', minHeight: 420 }}
          >
          {selectedSiaf && (
            <>
              <Box
                sx={{
                  width: `${leftPanePct}%`,
                  flexShrink: 0,
                  minWidth: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap',
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: '#f7fafc',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}>
                    SIAF
                  </Typography>
                  <Tooltip title="Alejar">
                    <span>
                      <IconButton size="small" onClick={() => setViewerZoom((z) => Math.max(0.75, z - 0.25))} disabled={viewerZoom <= 0.75}>
                        <ZoomOutIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'center', fontWeight: 600, color: 'text.secondary' }}>
                    {Math.round(viewerZoom * 100)}%
                  </Typography>
                  <Tooltip title="Acercar">
                    <span>
                      <IconButton size="small" onClick={() => setViewerZoom((z) => Math.min(2.25, z + 0.25))} disabled={viewerZoom >= 2.25}>
                        <ZoomInIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                  {!viewOnlyFromHistorial && (
                    <Button
                      size="small"
                      variant={modoMarcar ? 'contained' : 'outlined'}
                      color={modoMarcar ? 'error' : 'primary'}
                      startIcon={<PlaceIcon />}
                      onClick={() => setModoMarcar((v) => !v)}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      {modoMarcar ? 'Cancelar marcado' : 'Marcar corrección'}
                    </Button>
                  )}
                  {marcasHistorialVista.length > 0 && (
                    <Button size="small" variant="text" onClick={() => setMarcasHistorialVista([])} sx={{ textTransform: 'none' }}>
                      Ocultar marcas históricas
                    </Button>
                  )}
                </Box>
                {modoMarcar && (
                  <Alert
                    severity="info"
                    icon={<PushPinIcon fontSize="inherit" />}
                    sx={{ borderRadius: 0, py: 0.25, '& .MuiAlert-message': { fontSize: '0.8125rem' } }}
                  >
                    Haga <strong>clic</strong> en el punto exacto del documento que debe corregirse. Luego escriba el comentario.
                  </Alert>
                )}
                <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative', bgcolor: 'grey.100', WebkitOverflowScrolling: 'touch' }}>
                  {pdfBlobLoading || !pdfBlobUrl ? (
                    <Box display="flex" alignItems="center" justifyContent="center" height="100%" gap={1}>
                      <CircularProgress size={28} />
                      <Typography variant="body2" color="text.secondary">Preparando documento…</Typography>
                    </Box>
                  ) : (
                    <PdfViewerWithClick
                      fileUrl={pdfBlobUrl}
                      enableClickMark={modoMarcar && !viewOnlyFromHistorial}
                      onClickOnPage={handleClickMarcarPdf}
                      markers={markersVisibles}
                      minHeight={360}
                      zoom={viewerZoom}
                    />
                  )}
                </Box>
              </Box>

              {/* Divisor redimensionable */}
              <Box
                onMouseDown={handleSplitMouseDown}
                role="separator"
                aria-orientation="vertical"
                aria-label="Ajustar tamaño de paneles"
                title="Arrastre para ajustar el tamaño"
                sx={{
                  width: 10,
                  flexShrink: 0,
                  cursor: 'col-resize',
                  bgcolor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '&:hover': { bgcolor: 'primary.light' },
                  transition: 'background-color 0.15s',
                }}
              >
                <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.secondary', transform: 'rotate(90deg)' }} />
              </Box>

              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: '#f4f7fa',
                  height: '100%',
                }}
              >
                <Tabs
                  value={panelDerechoTab}
                  onChange={(_, v) => setPanelDerechoTab(v)}
                  variant="fullWidth"
                  sx={{
                    minHeight: 42,
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 42, fontSize: '0.8rem', px: 0.5 },
                  }}
                >
                  <Tab
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Correcciones
                        {marcasCorreccion.length > 0 && (
                          <Chip size="small" color="error" label={marcasCorreccion.length} sx={{ height: 18, fontWeight: 700, fontSize: '0.7rem' }} />
                        )}
                      </Box>
                    }
                  />
                  <Tab label="Bitácora" />
                  <Tab
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Adjuntos
                        {(selectedSiaf.documentosAdjuntos?.length ?? 0) > 0 && (
                          <Chip
                            size="small"
                            label={selectedSiaf.documentosAdjuntos?.length ?? 0}
                            sx={{ height: 18, fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    }
                  />
                </Tabs>
                <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {panelDerechoTab === 0 ? (
                    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.45 }}>
                        {viewOnlyFromHistorial
                          ? 'Vista de consulta. Las marcas históricas se muestran si las activa desde la bitácora.'
                          : 'Marque en el PDF los puntos a corregir. Cada pin queda numerado y con su comentario.'}
                      </Typography>
                      {marcasHistorialVista.length > 0 && (
                        <Alert severity="warning" sx={{ mb: 1.5, py: 0 }}>
                          Mostrando {marcasHistorialVista.length} marca(s) de un rechazo anterior (etiqueta H).
                        </Alert>
                      )}
                      {marcasCorreccion.length === 0 ? (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2.5,
                            textAlign: 'center',
                            bgcolor: 'background.paper',
                            borderStyle: 'dashed',
                            borderColor: 'grey.400',
                          }}
                        >
                          <PlaceIcon sx={{ color: 'error.main', fontSize: 36, mb: 1, opacity: 0.85 }} />
                          <Typography variant="subtitle2" fontWeight={700} color="grey.800" gutterBottom>
                            Sin marcas todavía
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Active <strong>Marcar corrección</strong> y haga clic sobre el formulario.
                          </Typography>
                        </Paper>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                          {marcasCorreccion.map((m, idx) => (
                            <Paper
                              key={m.id}
                              elevation={0}
                              onClick={() => setMarcaActivaId(m.id)}
                              sx={{
                                p: 1.5,
                                border: '1px solid',
                                borderColor: marcaActivaId === m.id ? 'error.main' : 'divider',
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                                cursor: 'pointer',
                                boxShadow: marcaActivaId === m.id ? '0 0 0 2px rgba(198,40,40,0.18)' : 'none',
                                transition: 'border-color 0.15s, box-shadow 0.15s',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    bgcolor: '#c62828',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: 13,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    mt: 0.25,
                                  }}
                                >
                                  {idx + 1}
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}>
                                    <Chip size="small" label={etiquetaMotivo(m.categoria)} sx={{ height: 22, fontWeight: 600 }} />
                                    <Typography variant="caption" color="text.secondary">
                                      Pág. {m.pagina}
                                    </Typography>
                                  </Box>
                                  <Typography variant="body2" sx={{ color: 'grey.800', whiteSpace: 'pre-wrap' }}>
                                    {m.descripcion}
                                  </Typography>
                                </Box>
                                {!viewOnlyFromHistorial && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    aria-label="Quitar marca"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      eliminarMarca(m.id);
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </Box>
                            </Paper>
                          ))}
                        </Box>
                      )}
                    </Box>
                  ) : panelDerechoTab === 1 ? (
                    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                      {bitacoraEnVistaLoading ? (
                        <Box display="flex" alignItems="center" gap={1} py={2}>
                          <CircularProgress size={20} />
                          <Typography variant="body2" color="text.secondary">Cargando bitácora...</Typography>
                        </Box>
                      ) : bitacoraEnVistaDialog.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          No hay registros en la bitácora. Expediente nuevo sin rechazos previos.
                        </Typography>
                      ) : (
                        <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 1.5 } }}>
                          {bitacoraEnVistaDialog.map((b) => {
                            const marcasHist = parseMarcadoresBitacora(b.detalleAntes);
                            return (
                              <Box component="li" key={b.id} sx={{ typography: 'body2' }}>
                                <Chip
                                  size="small"
                                  label={b.tipo === 'rechazo' ? 'Rechazo' : b.tipo === 'correccion' ? 'Corrección' : b.tipo === 'aprobado_dd' ? 'Revisión favorable (DD)' : b.tipo}
                                  color={b.tipo === 'rechazo' ? 'error' : b.tipo === 'correccion' ? 'info' : 'success'}
                                  variant="filled"
                                  sx={{ mr: 1, fontWeight: 600, verticalAlign: 'middle' }}
                                />
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {new Date(b.fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}
                                </Typography>
                                <Typography variant="body2" sx={{ display: 'block', mt: 0.5, color: 'grey.800', whiteSpace: 'pre-wrap' }}>
                                  {b.tipo === 'correccion' && (b.detalleAntes || b.detalleDespues) ? (
                                    <>
                                      {b.detalleAntes && !String(b.detalleAntes).startsWith('{') && <><strong>Antes:</strong> {b.detalleAntes}</>}
                                      {b.detalleAntes && !String(b.detalleAntes).startsWith('{') && b.detalleDespues && ' → '}
                                      {b.detalleDespues && <><strong>Corregido a:</strong> {b.detalleDespues}</>}
                                      {String(b.detalleAntes || '').startsWith('{') && limpiarComentarioBitacora(b.comentario)}
                                    </>
                                  ) : limpiarComentarioBitacora(b.comentario)}
                                </Typography>
                                {b.tipo === 'rechazo' && marcasHist.length > 0 && (
                                  <Button
                                    size="small"
                                    startIcon={<PlaceIcon />}
                                    onClick={() => verMarcasDeBitacora(b)}
                                    sx={{ mt: 0.75, textTransform: 'none' }}
                                  >
                                    Ver {marcasHist.length} marca{marcasHist.length === 1 ? '' : 's'} en el PDF
                                  </Button>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  ) : (
                    /* Tab Adjuntos: comparación lado a lado */
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                      <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.35 }}>
                          Seleccione un adjunto para verlo junto al SIAF. Arrastre el divisor del centro para ampliar o reducir cada panel.
                        </Typography>
                        {(selectedSiaf.documentosAdjuntos?.length ?? 0) === 0 ? (
                          <Typography variant="body2" color="text.secondary">Este SIAF no tiene documentos adjuntos.</Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            {selectedSiaf.documentosAdjuntos!.map((a) => (
                              <Chip
                                key={a.id}
                                icon={<AttachFile />}
                                label={a.nombreOriginal}
                                size="small"
                                color={adjuntoComparar?.id === a.id ? 'primary' : 'default'}
                                variant={adjuntoComparar?.id === a.id ? 'filled' : 'outlined'}
                                onClick={() => void cargarAdjuntoParaComparar(a)}
                                sx={{
                                  maxWidth: '100%',
                                  height: 'auto',
                                  py: 0.5,
                                  fontWeight: adjuntoComparar?.id === a.id ? 700 : 500,
                                  '& .MuiChip-label': { whiteSpace: 'normal', textAlign: 'left' },
                                }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ flex: 1, minHeight: 0, bgcolor: 'grey.200', position: 'relative' }}>
                        {adjuntoCompararLoading ? (
                          <Box display="flex" alignItems="center" justifyContent="center" height="100%" gap={1}>
                            <CircularProgress size={28} />
                            <Typography variant="body2" color="text.secondary">Cargando adjunto…</Typography>
                          </Box>
                        ) : !adjuntoComparar ? (
                          <Box display="flex" alignItems="center" justifyContent="center" height="100%" px={3} textAlign="center">
                            <Box>
                              <AttachFile sx={{ fontSize: 40, color: 'grey.500', mb: 1 }} />
                              <Typography variant="subtitle2" fontWeight={700} color="grey.700">
                                Elija un adjunto arriba
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Podrá compararlo con el SIAF a la izquierda sin cerrar esta vista.
                              </Typography>
                            </Box>
                          </Box>
                        ) : adjuntoComparar.mimeType?.startsWith('image/') ? (
                          <Box sx={{ height: '100%', overflow: 'auto', p: 1, textAlign: 'center' }}>
                            <img
                              src={adjuntoComparar.url}
                              alt={adjuntoComparar.nombreOriginal}
                              style={{ maxWidth: '100%', height: 'auto' }}
                            />
                          </Box>
                        ) : (
                          <iframe
                            title={adjuntoComparar.nombreOriginal}
                            src={adjuntoComparar.url}
                            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </>
          )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={handleCloseDialog} startIcon={<Cancel />} variant="outlined">
            Cerrar
          </Button>
          {selectedSiaf && !viewOnlyFromHistorial && (
            <>
              <Button
                onClick={() => { setMotivosRechazo([{ categoria: '', descripcion: '' }]); setOpenRechazarDialog(true); }}
                color="error"
                variant="text"
                sx={{ textTransform: 'none' }}
              >
                Rechazar sin marca
              </Button>
              <Button
                onClick={handleRechazarConMarcas}
                color="error"
                startIcon={<Close />}
                variant="outlined"
                disabled={marcasCorreccion.length === 0}
              >
                Rechazar con marcas ({marcasCorreccion.length})
              </Button>
              <Tooltip
                title={
                  marcasCorreccion.length > 0
                    ? 'Quite las marcas de corrección o rechace el SIAF. No se puede dar revisión favorable con correcciones pendientes.'
                    : ''
                }
              >
                <span>
                  <Button
                    onClick={handleAprobar}
                    color="success"
                    startIcon={<Check />}
                    variant="contained"
                    disabled={marcasCorreccion.length > 0}
                  >
                    Revisión favorable y finalizar
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </DialogActions>
      </Dialog>

      <NuevaMarcaDialog
        dialogNuevaMarca={dialogNuevaMarca}
        onClose={() => setDialogNuevaMarca(null)}
        onChange={(patch) => setDialogNuevaMarca((prev) => (prev ? { ...prev, ...patch } : prev))}
        onConfirmar={confirmarNuevaMarca}
      />

      <BitacoraStandaloneDialog
        open={bitacoraOpen}
        titulo={bitacoraTitulo}
        loading={bitacoraLoading}
        list={bitacoraList}
        canReload={bitacoraBackendId != null}
        onClose={() => { setBitacoraOpen(false); setBitacoraBackendId(null); }}
        onReload={handleRecargarBitacora}
      />

      <MotivosRechazoDialog
        open={openRechazarDialog}
        motivosRechazo={motivosRechazo}
        onClose={() => { setOpenRechazarDialog(false); setMotivosRechazo([{ categoria: '', descripcion: '' }]); }}
        onAgregar={agregarMotivoRechazo}
        onQuitar={quitarMotivoRechazo}
        onActualizar={actualizarMotivoRechazo}
        onConfirmar={handleConfirmarRechazo}
      />

      <AdjuntosListaDialog
        open={adjuntosDialogOpen}
        adjuntos={selectedSiaf?.documentosAdjuntos}
        onClose={() => setAdjuntosDialogOpen(false)}
        onComparar={async (a) => {
          setAdjuntosDialogOpen(false);
          await cargarAdjuntoParaComparar(a);
        }}
        onDescargar={async (a) => {
          try {
            const res = await api.get(`/siaf/adjuntos/${a.id}/descargar`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', a.nombreOriginal);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
          } catch (err) {
            showError('Error al descargar');
          }
        }}
      />

      <DocumentoViewerDialog
        open={viewerOpen}
        viewingDoc={viewingDoc}
        onClose={() => { setViewerOpen(false); setViewingDoc(null); }}
      />
    </Box>
  );
};

export default RevisarDireccionDepartamental;
