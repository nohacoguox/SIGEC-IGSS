import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Visibility,
  Check,
  Close,
  Cancel,
  AttachFile,
  History,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  Place as PlaceIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  PushPin as PushPinIcon,
  DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material';
import { formatFechaDMA } from '../utils';
import { pdf } from '@react-pdf/renderer';
import { SiafPdfDocument } from './SiafPdfDocument';
import PdfViewerWithClick, { PdfMarker } from './PdfViewerWithClick';
import api from '../api';
import { useNotification } from '../context/NotificationContext';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
} from '../theme/institutionalStyles';
import { limpiarComentarioBitacora, parseMarcadoresBitacora, SiafMarcaBitacora } from '../utils/siafBitacora';

interface SiafItem {
  id: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
}

interface SiafSubproducto {
  id: string;
  codigo?: string;
  cantidad: number;
}

interface SiafAdjunto {
  id: number;
  nombreOriginal: string;
  tamanioBytes: number;
  mimeType?: string;
}

interface SiafSolicitud {
  id: string;
  correlativo: string;
  fecha: string;
  nombreSolicitante: string;
  puestoSolicitante: string;
  nombreUnidad: string;
  areaUnidad: string;
  direccion: string;
  unidadSolicitante: string;
  justificacion: string;
  nombreAutoridad: string;
  puestoAutoridad: string;
  unidadAutoridad: string;
  consistentItem: string;
  items: SiafItem[];
  subproductos: SiafSubproducto[];
  documentosAdjuntos?: SiafAdjunto[];
  /** true si el expediente fue rechazado y el solicitante lo corrigió y reenvió */
  esCorreccion?: boolean;
}

interface MetaDD {
  unidadAsignada: string;
  departamento: string;
  departamentoId?: number | null;
}

interface Municipio {
  id: number;
  nombre: string;
}

interface SiafHistorialItem {
  id: number;
  correlativo: string;
  fecha: string;
  nombreSolicitante: string;
  puestoSolicitante: string;
  nombreUnidad: string;
  areaUnidad: string;
  estado: string;
  fechaDecision: string;
  comentario: string | null;
  siaf: any;
}

/** Una fila por expediente (SIAF) con estado actual y cantidad de rechazos */
interface HistorialUnificadoItem {
  backendId: number;
  correlativo: string;
  fecha: string;
  nombreSolicitante: string;
  puestoSolicitante: string;
  nombreUnidad: string;
  areaUnidad: string;
  estadoActual: string;
  fechaUltimaDecision: string;
  cantidadRechazos: number;
  siaf: any;
}

interface BitacoraEntry {
  id: number;
  tipo: string;
  comentario: string | null;
  fecha: string;
  usuario?: { nombres?: string; apellidos?: string };
  detalleAntes?: string | null;
  detalleDespues?: string | null;
}

type MarcaCorreccion = SiafMarcaBitacora;

const MOTIVOS_RECHAZO_OPTS = [
  { valor: 'falta_documento', etiqueta: 'Falta documento' },
  { valor: 'ortografia', etiqueta: 'Ortografía / redacción' },
  { valor: 'mal_explicado', etiqueta: 'Mal explicado / poco claro' },
  { valor: 'datos_incorrectos', etiqueta: 'Datos incorrectos o inconsistentes' },
  { valor: 'otro', etiqueta: 'Otro' },
];

function etiquetaMotivo(valor: string): string {
  return MOTIVOS_RECHAZO_OPTS.find((m) => m.valor === valor)?.etiqueta || valor || 'Otro';
}

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
  const [motivosRechazo, setMotivosRechazo] = useState<Array<{ categoria: string; descripcion: string }>>([{ categoria: '', descripcion: '' }]);

  const MOTIVOS_RECHAZO = MOTIVOS_RECHAZO_OPTS;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjuntosDialogOpen, setAdjuntosDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ id: number; nombreOriginal: string; mimeType?: string; url?: string } | null>(null);
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
  const [dialogNuevaMarca, setDialogNuevaMarca] = useState<{
    open: boolean;
    pagina: number;
    xPercent: number;
    yPercent: number;
    categoria: string;
    descripcion: string;
  } | null>(null);
  const [marcasHistorialVista, setMarcasHistorialVista] = useState<MarcaCorreccion[]>([]);
  const pdfUrlRef = useRef<string | null>(null);
  /** División redimensionable SIAF | panel derecho (porcentaje del ancho izquierdo) */
  const [leftPanePct, setLeftPanePct] = useState(55);
  const splitDraggingRef = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  /** Adjunto abierto a la derecha para comparar con el SIAF */
  const [adjuntoComparar, setAdjuntoComparar] = useState<{
    id: number;
    nombreOriginal: string;
    mimeType?: string;
    url: string;
  } | null>(null);
  const [adjuntoCompararLoading, setAdjuntoCompararLoading] = useState(false);
  const adjuntoUrlRef = useRef<string | null>(null);

  /** Encabezados: paleta institucional IGSS */
  const headerCellStyle = tableHeaderCellStyle;
  const headerRowStyle = tableHeaderRowStyle;
  const headerCellSx = tableHeaderCellSx;

  const transformSiaf = useCallback((siaf: any, esCorreccion?: boolean): SiafSolicitud => ({
    id: siaf.id.toString(),
    correlativo: siaf.correlativo,
    fecha: new Date(siaf.fecha).toISOString().split('T')[0],
    nombreSolicitante: siaf.nombreSolicitante || `${siaf.usuarioSolicitante?.nombres || ''} ${siaf.usuarioSolicitante?.apellidos || ''}`.trim() || 'N/A',
    puestoSolicitante: siaf.puestoSolicitante || siaf.usuarioSolicitante?.puesto?.nombre || 'N/A',
    nombreUnidad: siaf.nombreUnidad || siaf.area?.nombre || 'N/A',
    areaUnidad: siaf.area?.nombre || 'N/A',
    direccion: siaf.direccion || '',
    unidadSolicitante: siaf.unidadSolicitante || siaf.area?.nombre || 'N/A',
    justificacion: siaf.justificacion || '',
    nombreAutoridad: siaf.nombreAutoridad || '',
    puestoAutoridad: siaf.puestoAutoridad || '',
    unidadAutoridad: siaf.unidadAutoridad || '',
    consistentItem: siaf.consistenteItem || siaf.consistentItem || '',
    items: (siaf.items || []).map((i: any) => ({ id: i.id?.toString(), codigo: i.codigo || '', descripcion: i.descripcion || '', cantidad: Number(i.cantidad || 0) })),
    subproductos: (siaf.subproductos || []).map((s: any) => ({ id: s.id?.toString(), codigo: s.codigo || '', cantidad: Number(s.cantidad || 0) })),
    documentosAdjuntos: (siaf.documentosAdjuntos || []).map((a: any) => ({ id: a.id, nombreOriginal: a.nombreOriginal, tamanioBytes: a.tamanioBytes || 0, mimeType: a.mimeType })),
    esCorreccion: esCorreccion ?? false,
  }), []);

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
  }, [transformSiaf]);

  const fetchHistorial = useCallback(async () => {
    setHistorialLoading(true);
    try {
      const res = await api.get('/siaf/historial-direccion-departamental');
      const list = Array.isArray(res.data) ? res.data : [];
      setHistorial(list.map((item: any) => ({
        id: item.id,
        correlativo: item.correlativo,
        fecha: item.fecha ? new Date(item.fecha).toISOString().split('T')[0] : '',
        nombreSolicitante: item.nombreSolicitante || 'N/A',
        puestoSolicitante: item.puestoSolicitante || 'N/A',
        nombreUnidad: item.nombreUnidad || 'N/A',
        areaUnidad: item.areaUnidad || 'N/A',
        estado: item.estado || '',
        fechaDecision: item.fechaDecision ? new Date(item.fechaDecision).toISOString() : '',
        comentario: item.comentario ?? null,
        siaf: item.siaf,
      })));
    } catch (err: any) {
      console.error('Error al cargar historial DD:', err);
      showError(err.response?.data?.message || 'Error al cargar historial.');
      setHistorial([]);
    } finally {
      setHistorialLoading(false);
    }
  }, [showError]);

  /** Agrupa el historial por SIAF (id) y deja una fila por expediente con estado actual y cantidad de rechazos */
  const historialUnificado = useMemo((): HistorialUnificadoItem[] => {
    const byId = new Map<number, SiafHistorialItem[]>();
    for (const item of historial) {
      const sid = item.siaf?.id ?? item.id;
      const id = typeof sid === 'number' ? sid : Number(sid);
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id)!.push(item);
    }
    const result: HistorialUnificadoItem[] = [];
    byId.forEach((items, backendId) => {
      const ordered = [...items].sort((a, b) => new Date(b.fechaDecision).getTime() - new Date(a.fechaDecision).getTime());
      const primero = ordered[0];
      const cantidadRechazos = items.filter((i) => String(i.estado).toLowerCase() !== 'autorizado').length;
      result.push({
        backendId,
        correlativo: primero.correlativo,
        fecha: primero.fecha,
        nombreSolicitante: primero.nombreSolicitante,
        puestoSolicitante: primero.puestoSolicitante,
        nombreUnidad: primero.nombreUnidad,
        areaUnidad: primero.areaUnidad,
        estadoActual: primero.estado,
        fechaUltimaDecision: primero.fechaDecision,
        cantidadRechazos,
        siaf: primero.siaf,
      });
    });
    return result.sort((a, b) => new Date(b.fechaUltimaDecision).getTime() - new Date(a.fechaUltimaDecision).getTime());
  }, [historial]);

  const fetchBitacora = useCallback(async (backendId: number): Promise<BitacoraEntry[]> => {
    const res = await api.post(`/siaf/${backendId}/bitacora`, {});
    if (!Array.isArray(res.data)) return [];
    return res.data.map((b: any) => ({
      id: b.id,
      tipo: b.tipo,
      comentario: b.comentario ?? null,
      fecha: b.fecha,
      usuario: b.usuario,
      detalleAntes: b.detalleAntes ?? null,
      detalleDespues: b.detalleDespues ?? null,
    }));
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

  const buildSiafPdfData = useCallback((siaf: SiafSolicitud) => ({
    fecha: siaf.fecha,
    correlativo: siaf.correlativo,
    nombreUnidad: siaf.nombreUnidad,
    direccion: siaf.direccion || '',
    justificacion: siaf.justificacion,
    items: siaf.items.map((i) => ({ codigo: i.codigo || '', descripcion: i.descripcion || '', cantidad: Number(i.cantidad || 0) })),
    subproductos: siaf.subproductos.map((s) => ({ codigo: String(s.codigo ?? ''), cantidad: Number(s.cantidad || 0) })),
    totalSubproductoCantidad: siaf.subproductos.reduce((sum, s) => sum + Number(s.cantidad || 0), 0),
    nombreSolicitante: siaf.nombreSolicitante,
    puestoSolicitante: siaf.puestoSolicitante,
    unidadSolicitante: siaf.unidadSolicitante || siaf.nombreUnidad,
    nombreAutoridad: siaf.nombreAutoridad || '',
    puestoAutoridad: siaf.puestoAutoridad || '',
    unidadAutoridad: siaf.unidadAutoridad || '',
    areaUnidad: siaf.areaUnidad || siaf.nombreUnidad,
    consistentItem: siaf.consistentItem,
  }), []);

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
  }, [openDialog, selectedSiaf, buildSiafPdfData, revokePdfUrl, showError]);

  const markersVisibles: PdfMarker[] = useMemo(() => {
    const fromDraft = marcasCorreccion.map((m, idx) => ({
      pageNumber: m.pagina,
      xPercent: m.xPercent,
      yPercent: m.yPercent,
      label: idx + 1,
      active: m.id === marcaActivaId,
    }));
    const fromHist = marcasHistorialVista.map((m, idx) => ({
      pageNumber: m.pagina,
      xPercent: m.xPercent,
      yPercent: m.yPercent,
      label: `H${idx + 1}`,
      active: false,
    }));
    return [...fromHist, ...fromDraft];
  }, [marcasCorreccion, marcasHistorialVista, marcaActivaId]);

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
        setBitacoraEnVistaDialog(res.data.map((b: any) => ({
          id: b.id,
          tipo: b.tipo,
          comentario: b.comentario ?? null,
          fecha: b.fecha,
          usuario: b.usuario,
          detalleAntes: b.detalleAntes ?? null,
          detalleDespues: b.detalleDespues ?? null,
        })));
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
      {/* Tarjeta de contexto: unidad y departamento */}
      {meta?.unidadAsignada && (
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.5, color: 'grey.800', fontWeight: 700 }}>
            Contexto de revisión
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'baseline' }}>
            <Box>
              <Typography component="span" variant="body2" sx={{ color: 'grey.700', fontWeight: 500 }}>Unidad asignada: </Typography>
              <Typography component="span" variant="body2" fontWeight="600" color="primary.main">{meta.unidadAsignada}</Typography>
            </Box>
            {meta.departamento && (
              <Box>
                <Typography component="span" variant="body2" sx={{ color: 'grey.700', fontWeight: 500 }}>Departamento: </Typography>
                <Typography component="span" variant="body2" fontWeight="600" color="primary.main">{meta.departamento}</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

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
        <>
          <Box
            sx={{
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflow: 'hidden',
                '&:hover': { borderColor: 'primary.main' },
                '&:focus-within': { borderColor: 'primary.main', borderWidth: 2 },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', pl: 1.5, color: 'action.active' }}>
                <SearchIcon sx={{ fontSize: 22 }} />
              </Box>
              <FormControl
                size="small"
                sx={{
                  minWidth: 260,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { border: 'none' },
                    '&:hover fieldset': { border: 'none' },
                  },
                }}
              >
                <InputLabel id="filtro-municipio-label">Filtrar por municipio</InputLabel>
                <Select
                  labelId="filtro-municipio-label"
                  id="filtro-municipio"
                  value={filtroMunicipioId}
                  label="Filtrar por municipio"
                  onChange={(e) => setFiltroMunicipioId(e.target.value === '' ? '' : Number(e.target.value))}
                  renderValue={(v: number | string) => (v === '' ? 'Todos los municipios' : municipios.find((m) => m.id === Number(v))?.nombre ?? '')}
                >
                  <MenuItem value="">Todos los municipios</MenuItem>
                  {municipios.map((m) => (
                    <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            {filtroMunicipioId !== '' && (
              <Chip
                size="small"
                label="Filtro activo por municipio"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            )}
          </Box>

          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
            }}
          >
            <Table size="medium">
              <TableHead>
                <TableRow style={headerRowStyle}>
                  <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Correlativo</TableCell>
                  <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Fecha</TableCell>
                  <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Solicitante</TableCell>
                  <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Área / Unidad</TableCell>
                  <TableCell align="center" sx={{ ...headerCellSx, textAlign: 'center' }} style={headerCellStyle}>Tipo</TableCell>
                  <TableCell align="right" sx={headerCellSx} style={headerCellStyle}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {solicitudes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <Typography sx={{ color: 'grey.600' }} variant="body2">
                        No hay SIAFs pendientes de su departamento.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  solicitudes.map((siaf, index) => (
                    <TableRow
                      key={siaf.id}
                      sx={{
                        bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                        '&:hover': { bgcolor: 'action.selected' },
                        '& td': { py: 1.75, borderColor: 'divider' },
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600 }}>{siaf.correlativo}</TableCell>
                      <TableCell>{formatFechaDMA(siaf.fecha)}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="600">{siaf.nombreSolicitante}</Typography>
                          <Typography variant="body2" sx={{ color: 'grey.700', fontSize: '0.8125rem', display: 'block', mt: 0.25 }}>{siaf.puestoSolicitante}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{siaf.nombreUnidad}</Typography>
                          <Typography variant="body2" sx={{ color: 'grey.700', fontSize: '0.8125rem', display: 'block', mt: 0.25 }}>{siaf.areaUnidad}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={siaf.esCorreccion ? 'Corrección' : 'Nuevo'}
                          color={siaf.esCorreccion ? 'info' : 'default'}
                          variant="filled"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Ver SIAF, adjuntos y bitácora">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(siaf, false)}
                            color="primary"
                            sx={{
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              '&:hover': { bgcolor: 'primary.dark' },
                            }}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {tabValue === 1 && (
        <>
          {historialLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="280px">
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              <Table size="medium">
                <TableHead>
                  <TableRow style={headerRowStyle}>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Correlativo</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Fecha solicitud</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Solicitante</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Área / Unidad</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Estado</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Última decisión</TableCell>
                    <TableCell align="center" sx={{ ...headerCellSx, textAlign: 'center' }} style={headerCellStyle}>Rechazos</TableCell>
                    <TableCell align="right" sx={headerCellSx} style={headerCellStyle}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historialUnificado.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                        <Typography sx={{ color: 'grey.600' }} variant="body2">
                          No hay registros en su historial. Las revisiones favorables y rechazos aparecerán aquí.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    historialUnificado.map((item, index) => (
                      <TableRow
                        key={item.backendId}
                        sx={{
                          bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                          '&:hover': { bgcolor: 'action.selected' },
                          '& td': { py: 1.75, borderColor: 'divider' },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>{item.correlativo}</TableCell>
                        <TableCell>{formatFechaDMA(item.fecha)}</TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="600">{item.nombreSolicitante}</Typography>
                            <Typography variant="body2" sx={{ color: 'grey.700', fontSize: '0.8125rem', display: 'block', mt: 0.25 }}>{item.puestoSolicitante}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">{item.nombreUnidad}</Typography>
                            <Typography variant="body2" sx={{ color: 'grey.700', fontSize: '0.8125rem', display: 'block', mt: 0.25 }}>{item.areaUnidad}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.estadoActual === 'autorizado' ? 'Revisión favorable' : 'Rechazado'}
                            size="small"
                            color={item.estadoActual === 'autorizado' ? 'success' : 'error'}
                            variant="filled"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>{item.fechaUltimaDecision ? formatFechaDMA(item.fechaUltimaDecision) : '—'}</TableCell>
                        <TableCell align="center">
                          {item.cantidadRechazos > 0 ? (
                            <Typography variant="body2" fontWeight="600" color="text.secondary">
                              {item.cantidadRechazos} {item.cantidadRechazos === 1 ? 'vez' : 'veces'}
                            </Typography>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Ver bitácora (rechazos y correcciones)">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenBitacora(item.backendId, item.correlativo)}
                              sx={{ color: 'grey.700', mr: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
                            >
                              <History fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Ver SIAF">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(transformSiaf(item.siaf), true)}
                              color="primary"
                              sx={{
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                '&:hover': { bgcolor: 'primary.dark' },
                              }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
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

      <Dialog
        open={!!dialogNuevaMarca?.open}
        onClose={() => setDialogNuevaMarca(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlaceIcon color="error" />
          Corrección en este punto
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Página {dialogNuevaMarca?.pagina ?? 1} · posición marcada en el documento. Indique qué debe corregir el solicitante.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Categoría</InputLabel>
            <Select
              value={dialogNuevaMarca?.categoria || ''}
              label="Categoría"
              onChange={(e) => setDialogNuevaMarca((prev) => prev ? { ...prev, categoria: e.target.value } : prev)}
            >
              {MOTIVOS_RECHAZO.map((m) => (
                <MenuItem key={m.valor} value={m.valor}>{m.etiqueta}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            autoFocus
            fullWidth
            size="small"
            multiline
            rows={3}
            label="Qué debe corregirse"
            value={dialogNuevaMarca?.descripcion || ''}
            onChange={(e) => setDialogNuevaMarca((prev) => prev ? { ...prev, descripcion: e.target.value } : prev)}
            placeholder="Ej.: La cantidad del ítem no coincide con la justificación…"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogNuevaMarca(null)} variant="outlined">Cancelar</Button>
          <Button onClick={confirmarNuevaMarca} color="error" variant="contained" startIcon={<PushPinIcon />}>
            Guardar marca
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bitácora del expediente: rechazos, correcciones y revisiones favorables */}
      <Dialog open={bitacoraOpen} onClose={() => { setBitacoraOpen(false); setBitacoraBackendId(null); }} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <span>{bitacoraTitulo}</span>
          <Button size="small" startIcon={<RefreshIcon />} onClick={handleRecargarBitacora} disabled={bitacoraLoading || bitacoraBackendId == null}>
            Recargar
          </Button>
        </DialogTitle>
        <DialogContent>
          {bitacoraLoading ? (
            <Box display="flex" alignItems="center" gap={2} py={2}>
              <CircularProgress size={24} />
              <Typography color="text.secondary">Cargando bitácora...</Typography>
            </Box>
          ) : bitacoraList.length === 0 ? (
            <Typography color="text.secondary">No hay registros en la bitácora para este SIAF.</Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Historial de rechazos, correcciones y revisiones favorables de Dirección Departamental.
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Comentario / Motivo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bitacoraList.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{new Date(b.fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={
                              b.tipo === 'rechazo' ? 'Rechazo' :
                              b.tipo === 'correccion' ? 'Corrección' :
                              b.tipo === 'aprobado_dd' ? 'Revisión favorable (DD)' : b.tipo
                            }
                            color={
                              b.tipo === 'rechazo' ? 'error' :
                              b.tipo === 'correccion' ? 'info' : 'success'
                            }
                            variant="filled"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 400 }}>
                          {b.tipo === 'correccion' && (b.detalleAntes || b.detalleDespues) && !String(b.detalleAntes || '').includes('"marcadores"') ? (
                            <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                              {b.detalleAntes && <><strong>Antes:</strong> {b.detalleAntes}</>}
                              {b.detalleAntes && b.detalleDespues && '\n'}
                              {b.detalleDespues && <><strong>Corregido a:</strong> {b.detalleDespues}</>}
                            </Box>
                          ) : (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                              {limpiarComentarioBitacora(b.comentario)}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBitacoraOpen(false); setBitacoraBackendId(null); }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openRechazarDialog} onClose={() => { setOpenRechazarDialog(false); setMotivosRechazo([{ categoria: '', descripcion: '' }]); }} maxWidth="sm" fullWidth>
        <DialogTitle>Motivos del rechazo (Dirección Departamental)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Puede agregar varios motivos para esta misma revisión. Todos quedarán registrados en la bitácora como un solo rechazo.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            {motivosRechazo.map((motivo, index) => (
              <Paper
                key={index}
                elevation={0}
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.5 }}>
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
                      mt: 0.15,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ flex: 1, color: 'grey.800', mt: 0.35 }}>
                    Motivo {index + 1}
                  </Typography>
                  {motivosRechazo.length > 1 && (
                    <IconButton size="small" onClick={() => quitarMotivoRechazo(index)} color="error" aria-label="Quitar motivo">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                  <InputLabel>Categoría</InputLabel>
                  <Select
                    value={motivo.categoria || ''}
                    label="Categoría"
                    onChange={(e) => actualizarMotivoRechazo(index, 'categoria', e.target.value)}
                  >
                    {MOTIVOS_RECHAZO.map((m) => (
                      <MenuItem key={m.valor} value={m.valor}>{m.etiqueta}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  label="Qué debe corregirse"
                  value={motivo.descripcion}
                  onChange={(e) => actualizarMotivoRechazo(index, 'descripcion', e.target.value)}
                  placeholder="Describa el motivo con detalle..."
                />
              </Paper>
            ))}
          </Box>
          <Button startIcon={<AddIcon />} onClick={agregarMotivoRechazo} variant="outlined" size="small" sx={{ mt: 2, textTransform: 'none', fontWeight: 700 }}>
            Agregar otro motivo
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setOpenRechazarDialog(false); setMotivosRechazo([{ categoria: '', descripcion: '' }]); }} variant="outlined">Cancelar</Button>
          <Button onClick={handleConfirmarRechazo} color="error" variant="contained" startIcon={<Close />}>Confirmar rechazo</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={adjuntosDialogOpen} onClose={() => setAdjuntosDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Documentos adjuntos del SIAF</DialogTitle>
        <DialogContent>
          {selectedSiaf?.documentosAdjuntos?.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Tamaño</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedSiaf.documentosAdjuntos.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.nombreOriginal}</TableCell>
                    <TableCell align="right">{((a.tamanioBytes || 0) / 1024).toFixed(1)} KB</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Comparar junto al SIAF">
                        <IconButton
                          size="small"
                          onClick={async () => {
                            setAdjuntosDialogOpen(false);
                            await cargarAdjuntoParaComparar(a);
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Descargar">
                        <IconButton
                          size="small"
                          onClick={async () => {
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
                        >
                          <AttachFile />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography color="text.secondary">Sin documentos adjuntos.</Typography>
          )}
        </DialogContent>
      </Dialog>

      {viewerOpen && viewingDoc?.url && (
        <Dialog open={viewerOpen} onClose={() => { setViewerOpen(false); setViewingDoc(null); }} maxWidth="lg" fullWidth>
          <DialogTitle>{viewingDoc.nombreOriginal}</DialogTitle>
          <DialogContent>
            {viewingDoc.mimeType?.startsWith('image/') ? (
              <img src={viewingDoc.url} alt={viewingDoc.nombreOriginal} style={{ maxWidth: '100%', height: 'auto' }} />
            ) : (
              <iframe title={viewingDoc.nombreOriginal} src={viewingDoc.url} width="100%" height="600" style={{ border: 'none' }} />
            )}
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

export default RevisarDireccionDepartamental;
