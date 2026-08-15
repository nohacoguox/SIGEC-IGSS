// frontend/src/pages/ExpedientesPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  AttachFile as AttachFileIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  Place as PlaceIcon,
  Send as SendIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  DescriptionOutlined as DescriptionIcon,
  HourglassTopOutlined as HourglassIcon,
  TaskAlt as TaskAltIcon,
  HighlightOff as HighlightOffIcon,
  FolderOpen as FolderOpenIcon,
  Numbers as NumbersIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import api from '../api';
import { useNotification } from '../context/NotificationContext';
import { usePermissions } from '../hooks/usePermissions';
import PdfViewerWithClick from '../components/PdfViewerWithClick';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
  pageTitleSx,
  primaryButtonSx,
} from '../theme/institutionalStyles';
import { IGSS_COLORS } from '../theme/institutionalColors';

type ExpedienteRow = {
  id: number;
  numeroExpediente: string;
  titulo: string;
  tipoExpediente: string;
  estado: string;
  fechaApertura: string;
  descripcion?: string | null;
  numeroOrdenCompra?: string | null;
  numeroSiaf?: string | null;
};

type DocumentoRow = {
  id: number;
  tipoDocumento: string;
  nombreArchivo: string;
  descripcion: string | null;
  fechaSubida: string;
  tamanioBytes: number;
  mimeType: string;
};

type UltimoRechazo = {
  id: number;
  fecha: string;
  comentario: string | null;
  usuario: { nombres?: string; apellidos?: string } | null;
  detalle: Array<{ expedienteDocumentoId: number; nombreDocumento: string; comentario: string; pagina?: number | null; xPercent?: number | null; yPercent?: number | null }>;
};

type BitacoraEntry = {
  id: number;
  tipo: string;
  comentario: string | null;
  fecha: string;
  usuario?: { nombres?: string; apellidos?: string } | null;
  expedienteDocumentoId?: number | null;
  documentoReemplazo?: { nombreArchivo: string; mimeType: string };
  /** Versión que quedó como respaldo (el archivo que fue reemplazado). */
  documentoReemplazado?: { versionId: number; nombreArchivo: string; mimeType: string };
  detalle?: Array<{ expedienteDocumentoId?: number; nombreDocumento: string; mimeType?: string; comentario: string; corregido?: boolean; pagina?: number | null; xPercent?: number | null; yPercent?: number | null; documentoVersionIdParaMarca?: number }>;
};

const TIPOS_DOCUMENTO = [
  'Orden de Compras (Guatecompras)',
  'ACTA',
  'SIAF autorizado',
  'Contrato',
  'Factura',
  'Otro',
];

const TITULOS_OPCIONES = ['Bien/Producto', 'Servicio'];

/** Lista corta de extensiones: los comodines MIME (image/*) hacen lento el diálogo nativo de Windows. */
const ARCHIVOS_ACEPTADOS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';

function esArchivoPrevisualizable(file: File | null): boolean {
  if (!file) return false;
  const mime = (file.type || '').toLowerCase();
  const nombre = file.name.toLowerCase();
  return (
    mime === 'application/pdf' ||
    mime.startsWith('image/') ||
    nombre.endsWith('.pdf') ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(nombre)
  );
}

function esPdfLocal(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

const headerCellStyle = tableHeaderCellStyle;
const headerRowStyle = tableHeaderRowStyle;
const headerCellSx = tableHeaderCellSx;

const estadoConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactElement }> = {
  abierto: {
    label: 'Abierto',
    color: IGSS_COLORS.azul,
    bg: alpha(IGSS_COLORS.azul, 0.12),
    icon: <DescriptionIcon />,
  },
  en_proceso: {
    label: 'En revisión',
    color: '#B26A00',
    bg: alpha('#ED6C02', 0.14),
    icon: <HourglassIcon />,
  },
  aprobado: {
    label: 'Aprobado',
    color: '#1565C0',
    bg: alpha('#1976D2', 0.12),
    icon: <TaskAltIcon />,
  },
  cerrado: {
    label: 'Cerrado',
    color: '#1565C0',
    bg: alpha('#1976D2', 0.12),
    icon: <TaskAltIcon />,
  },
  rechazado: {
    label: 'Rechazado',
    color: IGSS_COLORS.error,
    bg: alpha(IGSS_COLORS.error, 0.12),
    icon: <HighlightOffIcon />,
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ExpedientesPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { hasPermission } = usePermissions();
  const puedeCrear = hasPermission('crear-expediente');
  const [expedientes, setExpedientes] = useState<ExpedienteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [crearOpen, setCrearOpen] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState('Compras');
  const [nuevoTitulo, setNuevoTitulo] = useState(TITULOS_OPCIONES[0]);
  const [nuevoDescripcion, setNuevoDescripcion] = useState('');
  const [nuevoNumeroOc, setNuevoNumeroOc] = useState('');
  const [nuevoNumeroSiaf, setNuevoNumeroSiaf] = useState('');
  const [creando, setCreando] = useState(false);
  const [siguienteCorrelativo, setSiguienteCorrelativo] = useState<string | null>(null);
  const [cargandoCorrelativo, setCargandoCorrelativo] = useState(false);

  // Editar expediente (solo si no aprobado/cerrado/archivado)
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNumero, setEditNumero] = useState('');
  const [editTitulo, setEditTitulo] = useState(TITULOS_OPCIONES[0]);
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editNumeroOc, setEditNumeroOc] = useState('');
  const [editNumeroSiaf, setEditNumeroSiaf] = useState('');
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // Detalle / documentos
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expedienteDetalle, setExpedienteDetalle] = useState<ExpedienteRow | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [ultimoRechazo, setUltimoRechazo] = useState<UltimoRechazo | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [agregarDocOpen, setAgregarDocOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [docTipo, setDocTipo] = useState(TIPOS_DOCUMENTO[0]);
  const [docTipoOtro, setDocTipoOtro] = useState(''); // Cuando el tipo es "Otro", texto libre
  const [docComentario, setDocComentario] = useState('');
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [arrastrandoDoc, setArrastrandoDoc] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [confirmEliminarOpen, setConfirmEliminarOpen] = useState(false);
  const [docAEliminar, setDocAEliminar] = useState<{ id: number; nombre: string } | null>(null);

  // Previsualización de documento (en diálogo, como SIAF)
  const [viewingDoc, setViewingDoc] = useState<{
    url: string;
    nombreOriginal: string;
    mimeType: string;
    expedienteId: number;
    docId: number;
  } | null>(null);
  const [viewerDocLoading, setViewerDocLoading] = useState(false);
  const [enviandoRevision, setEnviandoRevision] = useState(false);
  const [enviandoRevisionId, setEnviandoRevisionId] = useState<number | null>(null);

  // Bitácora de rechazos/aprobaciones (como SIAF)
  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [bitacoraList, setBitacoraList] = useState<BitacoraEntry[]>([]);
  const [bitacoraLoading, setBitacoraLoading] = useState(false);
  const [bitacoraTitulo, setBitacoraTitulo] = useState('');
  const [bitacoraExpedienteId, setBitacoraExpedienteId] = useState<number | null>(null);

  // Reemplazar documento (sube nueva versión, la anterior queda como respaldo)
  const [replaceDocOpen, setReplaceDocOpen] = useState(false);
  const [replaceDocTarget, setReplaceDocTarget] = useState<{ docId: number; nombre: string } | null>(null);
  const [replaceDocFile, setReplaceDocFile] = useState<File | null>(null);
  const [replacePreviewUrl, setReplacePreviewUrl] = useState<string | null>(null);
  const [reemplazandoDoc, setReemplazandoDoc] = useState(false);

  // Historial de versiones de un documento
  const [versionesOpen, setVersionesOpen] = useState(false);
  const [versionesTarget, setVersionesTarget] = useState<{ docId: number; nombre: string } | null>(null);
  const [versionesList, setVersionesList] = useState<Array<{
    id: number;
    numeroVersion: number;
    esActual: boolean;
    nombreArchivo: string;
    fechaSubida: string;
    tamanioBytes: number;
    subidoPor?: { nombres?: string; apellidos?: string } | null;
    observaciones?: Array<{
      comentario: string;
      pagina?: number | null;
      fecha?: string | null;
      usuario?: { nombres?: string; apellidos?: string } | null;
    }>;
  }>>([]);
  const [versionesLoading, setVersionesLoading] = useState(false);

  // Ver marca de rechazo (posición donde DAF hizo clic derecho en el documento)
  const [verMarcaOpen, setVerMarcaOpen] = useState(false);
  const [verMarcaLoading, setVerMarcaLoading] = useState(false);
  const [verMarcaUrl, setVerMarcaUrl] = useState<string | null>(null);
  const [verMarcaData, setVerMarcaData] = useState<{ nombreDocumento: string; mimeType: string; xPercent: number; yPercent: number; pagina?: number | null; comentario: string } | null>(null);
  const [verMarcaEsDocumentoReemplazado, setVerMarcaEsDocumentoReemplazado] = useState(false);
  const [verMarcaMarkerPx, setVerMarcaMarkerPx] = useState<{ left: number; top: number } | null>(null);
  const [verMarcaLoadError, setVerMarcaLoadError] = useState(false);
  const [verMarcaZoom, setVerMarcaZoom] = useState(1);
  const verMarcaContainerRef = useRef<HTMLDivElement>(null);
  const verMarcaImageRef = useRef<HTMLImageElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const loadExpedientes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/expedientes');
      const list = Array.isArray(res.data) ? res.data : [];
      setExpedientes(list.map((e: any) => ({
        id: e.id,
        numeroExpediente: e.numeroExpediente ?? '',
        titulo: e.titulo ?? '',
        tipoExpediente: e.tipoExpediente ?? '',
        estado: e.estado ?? 'abierto',
        fechaApertura: e.fechaApertura ?? e.createdAt ?? '',
        descripcion: e.descripcion ?? null,
        numeroOrdenCompra: e.numeroOrdenCompra ?? null,
        numeroSiaf: e.numeroSiaf ?? null,
      })));
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al cargar expedientes.');
      setExpedientes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpedientes();
  }, []);

  // Vista previa local del archivo a subir (antes de enviarlo al servidor)
  useEffect(() => {
    if (!docFile || !esArchivoPrevisualizable(docFile)) {
      setDocPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(docFile);
    setDocPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    return () => URL.revokeObjectURL(url);
  }, [docFile]);

  useEffect(() => {
    if (!replaceDocFile || !esArchivoPrevisualizable(replaceDocFile)) {
      setReplacePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(replaceDocFile);
    setReplacePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    return () => URL.revokeObjectURL(url);
  }, [replaceDocFile]);

  const resumen = ['abierto', 'en_proceso', 'aprobado', 'rechazado'].map((estado) => ({
    estado,
    total: expedientes.filter((expediente) => expediente.estado === estado).length,
    ...estadoConfig[estado],
  }));

  // Solo se puede editar si está abierto o rechazado (no mientras está en revisión)
  const expedienteEditable = (e: ExpedienteRow) => e.estado === 'abierto' || e.estado === 'rechazado';

  const abrirEditar = (e: ExpedienteRow) => {
    setEditId(e.id);
    setEditNumero(e.numeroExpediente);
    setEditTitulo(TITULOS_OPCIONES.includes(e.titulo) ? e.titulo : TITULOS_OPCIONES[0]);
    setEditDescripcion(e.descripcion ?? '');
    setEditNumeroOc(e.numeroOrdenCompra ?? '');
    setEditNumeroSiaf(e.numeroSiaf ?? '');
    setEditOpen(true);
  };

  const handleGuardarEdicion = async () => {
    if (editId == null) return;
    const tit = editTitulo.trim();
    const desc = editDescripcion.trim();
    const oc = editNumeroOc.trim();
    const siaf = editNumeroSiaf.trim();
    if (!tit) { showError('Elija un título (Bien/Producto o Servicio).'); return; }
    if (!desc) { showError('La descripción es obligatoria.'); return; }
    if (!oc) { showError('El número de orden de compra (O.C.) es obligatorio.'); return; }
    setGuardandoEdit(true);
    try {
      await api.put(`/expedientes/${editId}`, {
        titulo: tit,
        descripcion: desc,
        numeroOrdenCompra: oc,
        numeroSiaf: siaf,
      });
      showSuccess('Expediente actualizado.');
      setEditOpen(false);
      setEditId(null);
      loadExpedientes();
      if (expedienteDetalle?.id === editId) openDetalle(editId);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al actualizar expediente.');
    } finally {
      setGuardandoEdit(false);
    }
  };

  const openCrearDialog = async () => {
    setNuevoTitulo(TITULOS_OPCIONES[0]);
    setNuevoDescripcion('');
    setNuevoNumeroOc('');
    setNuevoNumeroSiaf('');
    setNuevoTipo('Compras');
    setSiguienteCorrelativo(null);
    setCrearOpen(true);
    setCargandoCorrelativo(true);
    try {
      const { data } = await api.get('/correlativos/expedientes/siguiente');
      setSiguienteCorrelativo(data?.correlativo ?? null);
    } catch {
      setSiguienteCorrelativo(null);
    } finally {
      setCargandoCorrelativo(false);
    }
  };

  const handleCrear = async () => {
    const tit = nuevoTitulo.trim();
    const desc = nuevoDescripcion.trim();
    const oc = nuevoNumeroOc.trim();
    const siaf = nuevoNumeroSiaf.trim();
    if (!tit) { showError('Elija un título (Bien/Producto o Servicio).'); return; }
    if (!desc) { showError('La descripción es obligatoria.'); return; }
    if (!oc) { showError('El número de orden de compra (O.C.) es obligatorio.'); return; }
    setCreando(true);
    try {
      const { data } = await api.post('/expedientes', {
        tipoExpediente: nuevoTipo.trim() || 'Compras',
        titulo: tit,
        descripcion: desc,
        numeroOrdenCompra: oc,
        numeroSiaf: siaf,
      });
      showSuccess(data?.numeroExpediente ? `Expediente ${data.numeroExpediente} creado correctamente.` : 'Expediente creado correctamente.');
      setCrearOpen(false);
      setSiguienteCorrelativo(null);
      setNuevoTitulo(TITULOS_OPCIONES[0]); setNuevoDescripcion(''); setNuevoNumeroOc(''); setNuevoNumeroSiaf(''); setNuevoTipo('Compras');
      await loadExpedientes();
      if (data?.id) openDetalle(data.id);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al crear expediente.');
    } finally {
      setCreando(false);
    }
  };

  const openDetalle = async (expedienteId: number) => {
    setDrawerOpen(true);
    setExpedienteDetalle(null);
    setDocumentos([]);
    setDetalleLoading(true);
    try {
      const res = await api.get(`/expedientes/${expedienteId}`);
      const e = res.data;
      setExpedienteDetalle({
        id: e.id,
        numeroExpediente: e.numeroExpediente ?? '',
        titulo: e.titulo ?? '',
        tipoExpediente: e.tipoExpediente ?? '',
        estado: e.estado ?? 'abierto',
        fechaApertura: e.fechaApertura ?? e.createdAt ?? '',
        descripcion: e.descripcion ?? null,
        numeroOrdenCompra: e.numeroOrdenCompra ?? null,
        numeroSiaf: e.numeroSiaf ?? null,
      });
      const docs = (e.documentos || []).map((d: any) => ({
        id: d.id,
        tipoDocumento: d.tipoDocumento ?? '',
        nombreArchivo: d.nombreArchivo ?? '',
        descripcion: d.descripcion ?? null,
        fechaSubida: d.fechaSubida ?? d.fecha_subida ?? '',
        tamanioBytes: d.tamanioBytes ?? d.tamanio_bytes ?? 0,
        mimeType: d.mimeType ?? d.mime_type ?? '',
      }));
      setDocumentos(docs);
      setUltimoRechazo(e.ultimoRechazo ?? null);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al cargar el expediente.');
      setDrawerOpen(false);
    } finally {
      setDetalleLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setExpedienteDetalle(null);
    setDocumentos([]);
    setUltimoRechazo(null);
    setAgregarDocOpen(false);
    setDocFile(null);
    setDocTipo(TIPOS_DOCUMENTO[0]);
    setDocTipoOtro('');
    setDocComentario('');
  };

  const fetchBitacora = async (expedienteId: number): Promise<BitacoraEntry[]> => {
    const res = await api.get(`/expedientes/${expedienteId}/bitacora`);
    return Array.isArray(res.data) ? res.data : [];
  };

  const handleOpenBitacora = async (expedienteId: number, numeroExpediente: string) => {
    setBitacoraTitulo(`Bitácora — Expediente ${numeroExpediente}`);
    setBitacoraExpedienteId(expedienteId);
    setBitacoraOpen(true);
    setBitacoraLoading(true);
    setBitacoraList([]);
    try {
      const lista = await fetchBitacora(expedienteId);
      setBitacoraList(lista);
    } catch {
      showError('Error al cargar la bitácora.');
      setBitacoraList([]);
    } finally {
      setBitacoraLoading(false);
    }
  };

  const handleRecargarBitacora = async () => {
    if (bitacoraExpedienteId == null) return;
    setBitacoraLoading(true);
    try {
      const lista = await fetchBitacora(bitacoraExpedienteId);
      setBitacoraList(lista);
    } catch {
      showError('Error al recargar la bitácora.');
    } finally {
      setBitacoraLoading(false);
    }
  };

  const abrirDocumentoBitacora = (expedienteId: number, docId: number) => {
    api.get(`/expedientes/${expedienteId}/documentos/${docId}/archivo`, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data], { type: res.data.type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
      })
      .catch(() => showError('No se pudo abrir el documento.'));
  };

  const abrirVersionReemplazadaBitacora = (expedienteId: number, docId: number, versionId: number) => {
    api.get(`/expedientes/${expedienteId}/documentos/${docId}/versiones/${versionId}/archivo`, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data], { type: res.data.type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
      })
      .catch(() => showError('No se pudo abrir el documento reemplazado.'));
  };

  const abrirReemplazarDoc = (doc: DocumentoRow) => {
    setReplaceDocTarget({ docId: doc.id, nombre: doc.nombreArchivo || doc.tipoDocumento });
    setReplaceDocFile(null);
    setReplaceDocOpen(true);
  };

  const handleReemplazarDocumento = async () => {
    if (!expedienteDetalle || !replaceDocTarget || !replaceDocFile) return;
    setReemplazandoDoc(true);
    try {
      const form = new FormData();
      form.append('archivo', replaceDocFile);
      await api.post(`/expedientes/${expedienteDetalle.id}/documentos/${replaceDocTarget.docId}/reemplazar`, form);
      showSuccess('Documento reemplazado. La corrección queda registrada en la bitácora y la versión anterior en el historial.');
      setReplaceDocOpen(false);
      setReplaceDocTarget(null);
      setReplaceDocFile(null);
      openDetalle(expedienteDetalle.id);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al reemplazar el documento.');
    } finally {
      setReemplazandoDoc(false);
    }
  };

  const abrirVersiones = async (doc: DocumentoRow) => {
    if (!expedienteDetalle) return;
    setVersionesTarget({ docId: doc.id, nombre: doc.nombreArchivo || doc.tipoDocumento });
    setVersionesOpen(true);
    setVersionesLoading(true);
    setVersionesList([]);
    try {
      const res = await api.get(`/expedientes/${expedienteDetalle.id}/documentos/${doc.id}/versiones`);
      setVersionesList(Array.isArray(res.data) ? res.data : []);
    } catch {
      showError('Error al cargar el historial de versiones.');
      setVersionesList([]);
    } finally {
      setVersionesLoading(false);
    }
  };

  const descargarVersion = (versionId: number, nombreArchivo: string) => {
    if (!expedienteDetalle || !versionesTarget) return;
    api.get(`/expedientes/${expedienteDetalle.id}/documentos/${versionesTarget.docId}/versiones/${versionId}/archivo`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo || `version-${versionId}`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => showError('Error al descargar la versión.'));
  };

  const openVerMarca = (expedienteId: number, docId: number, nombreDocumento: string, mimeType: string, xPercent: number, yPercent: number, pagina?: number | null, comentario?: string, versionId?: number | null) => {
    setVerMarcaData({ nombreDocumento, mimeType, xPercent, yPercent, pagina: pagina ?? null, comentario: comentario ?? '' });
    setVerMarcaUrl(null);
    setVerMarcaMarkerPx(null);
    setVerMarcaLoadError(false);
    setVerMarcaZoom(1);
    setVerMarcaOpen(true);
    setVerMarcaLoading(true);
    const versionIdNum = versionId != null ? Number(versionId) : NaN;
    const usarVersionReemplazada = !Number.isNaN(versionIdNum) && versionIdNum > 0;
    setVerMarcaEsDocumentoReemplazado(usarVersionReemplazada);
    const url = usarVersionReemplazada
      ? `/expedientes/${expedienteId}/documentos/${docId}/versiones/${versionIdNum}/archivo`
      : `/expedientes/${expedienteId}/documentos/${docId}/archivo`;
    api.get(url, { responseType: 'blob' })
      .then((res) => {
        if (res.data instanceof Blob && res.data.size > 0) {
          setVerMarcaUrl(URL.createObjectURL(res.data));
        } else {
          setVerMarcaLoadError(true);
        }
      })
      .catch(() => {
        setVerMarcaLoadError(true);
        showError('No se pudo cargar el documento.');
      })
      .finally(() => setVerMarcaLoading(false));
  };

  const closeVerMarca = () => {
    if (verMarcaUrl) URL.revokeObjectURL(verMarcaUrl);
    setVerMarcaUrl(null);
    setVerMarcaData(null);
    setVerMarcaEsDocumentoReemplazado(false);
    setVerMarcaMarkerPx(null);
    setVerMarcaLoadError(false);
    setVerMarcaZoom(1);
    setVerMarcaOpen(false);
  };

  const measureVerMarcaPosition = useCallback(() => {
    if (!verMarcaData?.mimeType.startsWith('image/') || !verMarcaContainerRef.current || !verMarcaImageRef.current) return;
    const containerRect = verMarcaContainerRef.current.getBoundingClientRect();
    const imgRect = verMarcaImageRef.current.getBoundingClientRect();
    const left = (imgRect.left - containerRect.left) + (verMarcaData.xPercent / 100) * imgRect.width;
    const top = (imgRect.top - containerRect.top) + (verMarcaData.yPercent / 100) * imgRect.height;
    setVerMarcaMarkerPx({ left, top });
  }, [verMarcaData?.xPercent, verMarcaData?.yPercent, verMarcaData?.mimeType]);

  useEffect(() => {
    if (!verMarcaOpen || !verMarcaData?.mimeType.startsWith('image/') || !verMarcaContainerRef.current) return;
    const el = verMarcaContainerRef.current;
    const ro = new ResizeObserver(() => measureVerMarcaPosition());
    ro.observe(el);
    return () => ro.disconnect();
  }, [verMarcaOpen, verMarcaData?.mimeType, measureVerMarcaPosition]);

  // Re-medir posición del pin cuando ya hay imagen cargada (por si el layout llegó después del onLoad)
  useEffect(() => {
    if (!verMarcaOpen || !verMarcaUrl || !verMarcaData?.mimeType.startsWith('image/')) return;
    const t = setTimeout(measureVerMarcaPosition, 150);
    return () => clearTimeout(t);
  }, [verMarcaOpen, verMarcaUrl, verMarcaData?.mimeType, verMarcaData?.xPercent, verMarcaData?.yPercent, measureVerMarcaPosition]);

  /** Limpia el valor antes de abrir para que se pueda volver a elegir el mismo archivo. */
  const abrirSelectorArchivo = (ref: React.RefObject<HTMLInputElement>) => {
    if (!ref.current) return;
    ref.current.value = '';
    ref.current.click();
  };

  const handleAgregarDocumento = async () => {
    if (!expedienteDetalle) return;
    if (!docFile) { showError('Seleccione un archivo.'); return; }
    setSubiendoDoc(true);
    try {
      const form = new FormData();
      form.append('archivo', docFile);
      const tipoEnviar = docTipo === 'Otro' ? (docTipoOtro.trim() || 'Otro') : docTipo;
      form.append('tipoDocumento', tipoEnviar);
      if (docComentario.trim()) form.append('descripcion', docComentario.trim());
      await api.post(`/expedientes/${expedienteDetalle.id}/documentos`, form);
      showSuccess('Documento agregado correctamente.');
      setAgregarDocOpen(false);
      setDocFile(null);
      setDocTipo(TIPOS_DOCUMENTO[0]);
      setDocTipoOtro('');
      setDocComentario('');
      openDetalle(expedienteDetalle.id);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al subir el documento.');
    } finally {
      setSubiendoDoc(false);
    }
  };

  const handleVerDocumento = (expedienteId: number, docId: number, nombre: string, mimeType: string) => {
    setViewerDocLoading(true);
    setViewingDoc(null);
    api.get(`/expedientes/${expedienteId}/documentos/${docId}/archivo`, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data], { type: mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        setViewingDoc({ url, nombreOriginal: nombre, mimeType: mimeType || '', expedienteId, docId });
        setViewerDocLoading(false);
      })
      .catch((err) => {
        showError(err?.response?.data?.message || 'Error al abrir el documento.');
        setViewerDocLoading(false);
      });
  };

  const cerrarViewerDoc = () => {
    if (viewingDoc?.url) URL.revokeObjectURL(viewingDoc.url);
    setViewingDoc(null);
    setViewerDocLoading(false);
  };

  const enviarARevision = async () => {
    if (!expedienteDetalle) return;
    setEnviandoRevision(true);
    try {
      await api.post(`/expedientes/${expedienteDetalle.id}/enviar-revision`);
      showSuccess('Expediente enviado a revisión.');
      openDetalle(expedienteDetalle.id);
      loadExpedientes();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al enviar a revisión.');
    } finally {
      setEnviandoRevision(false);
    }
  };

  const enviarARevisionDesdeLista = async (id: number) => {
    setEnviandoRevisionId(id);
    try {
      await api.post(`/expedientes/${id}/enviar-revision`);
      showSuccess('Expediente enviado a revisión. El analista DAF ya puede verlo.');
      loadExpedientes();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al enviar a revisión.');
    } finally {
      setEnviandoRevisionId(null);
    }
  };

  const descargarDocumentoViewer = async () => {
    if (!viewingDoc) return;
    try {
      const res = await api.get(`/expedientes/${viewingDoc.expedienteId}/documentos/${viewingDoc.docId}/archivo`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', viewingDoc.nombreOriginal);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showError('Error al descargar el documento.');
    }
  };

  const solicitarEliminarDoc = (doc: DocumentoRow) => {
    setDocAEliminar({ id: doc.id, nombre: doc.tipoDocumento || doc.nombreArchivo });
    setConfirmEliminarOpen(true);
  };

  const confirmarEliminarDoc = async () => {
    if (!expedienteDetalle || !docAEliminar) return;
    setEliminandoId(docAEliminar.id);
    try {
      await api.delete(`/expedientes/${expedienteDetalle.id}/documentos/${docAEliminar.id}`);
      showSuccess('Documento eliminado.');
      setConfirmEliminarOpen(false);
      setDocAEliminar(null);
      openDetalle(expedienteDetalle.id);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al eliminar el documento.');
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <Container maxWidth={drawerOpen ? 'xl' : 'lg'} sx={{ py: 4 }}>
      {/* Inputs siempre montados y fuera de los diálogos: el navegador abre el selector sin esperas. */}
      <input
        ref={docFileInputRef}
        type="file"
        accept={ARCHIVOS_ACEPTADOS}
        style={{ display: 'none' }}
        onChange={(e) => setDocFile(e.target.files?.[0] || null)}
      />
      <input
        ref={replaceFileInputRef}
        type="file"
        accept={ARCHIVOS_ACEPTADOS}
        style={{ display: 'none' }}
        onChange={(e) => setReplaceDocFile(e.target.files?.[0] || null)}
      />

      {!drawerOpen && (
      <>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box
          sx={{
            mb: 3,
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            color: '#fff',
            background: `linear-gradient(135deg, ${IGSS_COLORS.azulOscuro} 0%, ${IGSS_COLORS.azulClaro} 100%)`,
            boxShadow: `0 10px 30px ${alpha(IGSS_COLORS.azulOscuro, 0.28)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 260 }}>
              <Typography variant="h4" component="h1" sx={{ ...pageTitleSx, color: '#fff', mb: 0.5 }}>
                Expedientes de Compras
              </Typography>
              <Typography variant="body1" sx={{ color: alpha('#fff', 0.85), maxWidth: 580 }}>
                Cree y administre expedientes de compras. Agregue los documentos que conforman cada expediente y envíelo a revisión cuando esté listo.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/colaborador-dashboard')}
              sx={{
                borderRadius: 2, textTransform: 'none', fontWeight: 600, color: '#fff',
                borderColor: alpha('#fff', 0.6),
                '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) },
              }}
            >
              Volver
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadExpedientes}
              disabled={loading}
              sx={{
                borderRadius: 2, textTransform: 'none', fontWeight: 600, color: '#fff',
                borderColor: alpha('#fff', 0.6),
                '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) },
              }}
            >
              Recargar
            </Button>
            {puedeCrear && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={openCrearDialog}
                sx={{
                  ...primaryButtonSx,
                  bgcolor: '#fff',
                  color: IGSS_COLORS.azulOscuro,
                  '&:hover': { bgcolor: alpha('#fff', 0.88) },
                }}
              >
                Crear Nuevo Expediente
              </Button>
            )}
            </Box>
          </Box>
        </Box>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          {resumen.map((item) => (
            <Card
              key={item.estado}
              elevation={0}
              sx={{
                flex: '1 1 150px',
                minWidth: 140,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'transform .2s ease, box-shadow .2s ease',
                '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 8px 20px ${alpha('#000', 0.08)}` },
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.75, py: 2.25 }}>
                <Box sx={{ width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: item.bg, color: item.color }}>
                  {item.icon}
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1, color: item.color }}>{item.total}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{item.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <Card
          elevation={0}
          sx={{
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
            <Typography variant="h6" fontWeight="700" sx={{ color: 'grey.800' }}>
              Expedientes Existentes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Revise los expedientes, gestione sus documentos y envíelos a revisión cuando estén completos.
            </Typography>
          </Box>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow style={headerRowStyle}>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Número</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>O.C.</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Título</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Descripción</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Estado</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Fecha apertura</TableCell>
                    <TableCell align="center" sx={{ ...headerCellSx, textAlign: 'center' }} style={headerCellStyle}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        <Typography variant="body2" sx={{ color: 'grey.600' }}>Cargando...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : expedientes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 7 }}>
                        <DescriptionIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                        <Typography variant="body1" sx={{ color: 'grey.700', fontWeight: 600 }}>
                          Aún no tiene expedientes
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'grey.600' }}>
                          Use «Crear Nuevo Expediente» para registrar el primero.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    expedientes.map((e, index) => (
                      <TableRow
                        key={e.id}
                        sx={{
                          bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                          transition: 'background-color .2s ease',
                          '&:hover': { bgcolor: alpha(IGSS_COLORS.azul, 0.08) },
                          '& td': { py: 1.75, borderColor: 'divider' },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700, color: IGSS_COLORS.azulOscuro }}>{e.numeroExpediente}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{e.numeroOrdenCompra || '—'}</TableCell>
                        <TableCell>{e.titulo}</TableCell>
                        <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.descripcion || undefined}>{e.descripcion || '—'}</TableCell>
                        <TableCell>
                          {(() => {
                            const config = estadoConfig[e.estado] ?? estadoConfig.abierto;
                            return (
                          <Chip
                            label={config.label}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              bgcolor: config.bg,
                              color: config.color,
                              border: `1px solid ${alpha(config.color, 0.35)}`,
                            }}
                          />
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {typeof e.fechaApertura === 'string' ? e.fechaApertura.split('T')[0] : String(e.fechaApertura)}
                        </TableCell>
                        <TableCell align="center">
                          {(e.estado === 'abierto' || e.estado === 'rechazado') && puedeCrear && (
                            <Tooltip title="Enviar a revisión (lo verá el analista DAF)">
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => enviarARevisionDesdeLista(e.id)}
                                  disabled={enviandoRevisionId === e.id}
                                  sx={{ '&:hover': { bgcolor: 'action.hover' }, mr: 0.5 }}
                                >
                                  <SendIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {expedienteEditable(e) && (
                            <Tooltip title="Editar expediente">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => abrirEditar(e)}
                                sx={{ '&:hover': { bgcolor: 'action.hover' }, mr: 0.5 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Ver y gestionar documentos">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => openDetalle(e.id)}
                              sx={{ '&:hover': { bgcolor: 'action.hover' }, mr: 0.5 }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Ver bitácora (rechazos y aprobaciones)">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenBitacora(e.id, e.numeroExpediente)}
                              sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </motion.div>
      </>
      )}

      {drawerOpen && (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Vista detalle a ancho completo */}
        <Box
          sx={{
            mb: 3,
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            color: '#fff',
            background: `linear-gradient(135deg, ${IGSS_COLORS.azulOscuro} 0%, ${IGSS_COLORS.azulClaro} 100%)`,
            boxShadow: `0 10px 30px ${alpha(IGSS_COLORS.azulOscuro, 0.28)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 1.2, fontWeight: 700 }}>
                Expediente de compras
              </Typography>
              {expedienteDetalle ? (
                <>
                  <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.15, letterSpacing: 0.3 }}>
                    {expedienteDetalle.numeroExpediente}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.75, opacity: 0.92, maxWidth: 720 }}>
                    {expedienteDetalle.titulo}
                    {expedienteDetalle.descripcion ? ` · ${expedienteDetalle.descripcion}` : ''}
                  </Typography>
                </>
              ) : (
                <Typography variant="h5" fontWeight={700}>Cargando expediente…</Typography>
              )}
              {expedienteDetalle && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                  {(() => {
                    const cfg = estadoConfig[expedienteDetalle.estado] ?? estadoConfig.abierto;
                    return (
                      <Chip
                        size="small"
                        label={cfg.label}
                        sx={{ fontWeight: 700, bgcolor: alpha('#fff', 0.95), color: cfg.color }}
                      />
                    );
                  })()}
                  {expedienteDetalle.numeroOrdenCompra && (
                    <Chip
                      size="small"
                      icon={<ShoppingCartIcon />}
                      label={`O.C. ${expedienteDetalle.numeroOrdenCompra}`}
                      sx={{
                        fontWeight: 700,
                        bgcolor: alpha('#fff', 0.16),
                        color: '#fff',
                        border: `1px solid ${alpha('#fff', 0.28)}`,
                        '& .MuiChip-icon': { color: '#fff' },
                      }}
                    />
                  )}
                  <Chip
                    size="small"
                    icon={<NumbersIcon />}
                    label={`${documentos.length} documento${documentos.length === 1 ? '' : 's'}`}
                    sx={{
                      fontWeight: 700,
                      bgcolor: alpha('#fff', 0.16),
                      color: '#fff',
                      border: `1px solid ${alpha('#fff', 0.28)}`,
                      '& .MuiChip-icon': { color: '#fff' },
                    }}
                  />
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={closeDrawer}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#fff',
                  borderColor: alpha('#fff', 0.65),
                  '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) },
                }}
              >
                Volver a la lista
              </Button>
              {expedienteDetalle && (
                <Button
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  onClick={() => handleOpenBitacora(expedienteDetalle.id, expedienteDetalle.numeroExpediente)}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                    color: '#fff',
                    borderColor: alpha('#fff', 0.65),
                    '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) },
                  }}
                >
                  Bitácora
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        {detalleLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Cargando detalle…</Typography>
          </Box>
        ) : expedienteDetalle ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '340px 1fr' },
              gap: 2.5,
              alignItems: 'start',
            }}
          >
            {/* Columna izquierda: datos y acciones */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: '#fff',
                  boxShadow: `0 4px 16px ${alpha('#000', 0.04)}`,
                }}
              >
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.75, color: IGSS_COLORS.azulOscuro }}>
                  Datos del expediente
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Número
                    </Typography>
                    <Typography variant="body1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                      {expedienteDetalle.numeroExpediente}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Orden de compra (O.C.)
                    </Typography>
                    <Typography variant="body1" fontWeight={700}>
                      {expedienteDetalle.numeroOrdenCompra || '—'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Número SIAF
                    </Typography>
                    <Typography variant="body1" fontWeight={700}>
                      {expedienteDetalle.numeroSiaf || '—'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Título
                    </Typography>
                    <Typography variant="body1" fontWeight={700}>{expedienteDetalle.titulo}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Descripción
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>
                      {expedienteDetalle.descripcion || 'Sin descripción'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                }}
              >
                {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
                  <Button
                    variant="contained"
                    startIcon={<AttachFileIcon />}
                    onClick={() => setAgregarDocOpen(true)}
                    sx={{
                      ...primaryButtonSx,
                      bgcolor: IGSS_COLORS.azulOscuro,
                      '&:hover': { bgcolor: IGSS_COLORS.azul },
                    }}
                  >
                    Agregar documento
                  </Button>
                )}
                {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && puedeCrear && (
                  <Button
                    variant="contained"
                    startIcon={<SendIcon />}
                    onClick={enviarARevision}
                    disabled={enviandoRevision || documentos.length === 0}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2,
                      bgcolor: IGSS_COLORS.verde,
                      '&:hover': { bgcolor: IGSS_COLORS.verdeOscuro },
                    }}
                  >
                    {enviandoRevision ? 'Enviando…' : 'Enviar a revisión'}
                  </Button>
                )}
                {documentos.length === 0 && (expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                    Agregue al menos un documento para poder enviar a revisión.
                  </Typography>
                )}
              </Paper>

              {expedienteDetalle.estado === 'rechazado' && ultimoRechazo && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: alpha(IGSS_COLORS.error, 0.06),
                    border: `1px solid ${alpha(IGSS_COLORS.error, 0.25)}`,
                    borderLeft: `4px solid ${IGSS_COLORS.error}`,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={800} color="error.dark" sx={{ mb: 0.5 }}>
                    Motivo del rechazo
                  </Typography>
                  {ultimoRechazo.comentario && (
                    <Typography variant="body2" sx={{ mb: 1 }}>{ultimoRechazo.comentario}</Typography>
                  )}
                  {ultimoRechazo.detalle && ultimoRechazo.detalle.length > 0 && (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>Observaciones por documento:</Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2 }}>
                        {ultimoRechazo.detalle.map((d, i) => (
                          <li key={i} style={{ marginBottom: 8 }}>
                            <Typography variant="body2">
                              <strong>{d.nombreDocumento}</strong>: {d.comentario}
                              {(d.pagina != null || d.xPercent != null) && (
                                <>
                                  <Chip size="small" label="Señalizado" color="warning" sx={{ ml: 0.5, verticalAlign: 'middle' }} icon={<PlaceIcon sx={{ fontSize: 14 }} />} />
                                  <Button
                                    size="small"
                                    startIcon={<PlaceIcon />}
                                    onClick={() => expedienteDetalle && d.expedienteDocumentoId && openVerMarca(expedienteDetalle.id, d.expedienteDocumentoId, d.nombreDocumento, documentos.find((doc) => doc.id === d.expedienteDocumentoId)?.mimeType ?? 'application/octet-stream', d.xPercent ?? 0, d.yPercent ?? 0, d.pagina, d.comentario, (d as any).documentoVersionIdParaMarca)}
                                    sx={{ ml: 0.5, verticalAlign: 'middle', textTransform: 'none' }}
                                  >
                                    Ver marca de rechazo
                                  </Button>
                                </>
                              )}
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    </>
                  )}
                </Box>
              )}
            </Box>

            {/* Columna derecha: documentos */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: '#fff',
                overflow: 'hidden',
                boxShadow: `0 4px 18px ${alpha('#000', 0.05)}`,
                minHeight: 420,
              }}
            >
              <Box
                sx={{
                  px: 2.5,
                  py: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                  borderLeft: `4px solid ${IGSS_COLORS.verde}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ color: 'grey.800' }}>
                    Documentos del expediente
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Gestione los archivos que conforman este expediente.
                  </Typography>
                </Box>
                {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AttachFileIcon />}
                    onClick={() => setAgregarDocOpen(true)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      bgcolor: IGSS_COLORS.azulOscuro,
                      '&:hover': { bgcolor: IGSS_COLORS.azul },
                    }}
                  >
                    Agregar
                  </Button>
                )}
              </Box>

              <Box sx={{ p: 2.5 }}>
                {documentos.length === 0 ? (
                  <Box
                    sx={{
                      p: { xs: 3, md: 5 },
                      borderRadius: 3,
                      border: `1.5px dashed ${alpha(IGSS_COLORS.azul, 0.45)}`,
                      bgcolor: alpha(IGSS_COLORS.azul, 0.04),
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        mx: 'auto',
                        mb: 1.5,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.1),
                        color: IGSS_COLORS.azulOscuro,
                      }}
                    >
                      <FolderOpenIcon sx={{ fontSize: 36 }} />
                    </Box>
                    <Typography variant="h5" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.75 }}>
                      Expediente listo para documentar
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 2.5 }}>
                      Agregue los archivos del expediente. Puede iniciar con la Orden de Compras, ACTA, SIAF autorizado, Contrato u otros.
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.75, mb: 3 }}>
                      {['Orden de Compras', 'ACTA', 'SIAF autorizado', 'Contrato', 'Factura'].map((tipo) => (
                        <Chip
                          key={tipo}
                          size="small"
                          label={tipo}
                          sx={{
                            fontWeight: 600,
                            bgcolor: '#fff',
                            border: `1px solid ${alpha(IGSS_COLORS.azul, 0.25)}`,
                            color: IGSS_COLORS.azulOscuro,
                          }}
                        />
                      ))}
                    </Box>
                    {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<CloudUploadIcon />}
                        onClick={() => setAgregarDocOpen(true)}
                        sx={{
                          ...primaryButtonSx,
                          bgcolor: IGSS_COLORS.azulOscuro,
                          '&:hover': { bgcolor: IGSS_COLORS.azul },
                          px: 3,
                        }}
                      >
                        Subir primer documento
                      </Button>
                    )}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1.5,
                    }}
                  >
                    {documentos.map((doc) => (
                      <Paper
                        key={doc.id}
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 2.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: IGSS_COLORS.fondo,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          transition: 'box-shadow .2s ease, border-color .2s ease',
                          '&:hover': {
                            borderColor: alpha(IGSS_COLORS.azul, 0.45),
                            boxShadow: `0 6px 18px ${alpha(IGSS_COLORS.azulOscuro, 0.08)}`,
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: alpha(IGSS_COLORS.verde, 0.12),
                            color: IGSS_COLORS.verdeOscuro,
                          }}
                        >
                          <DescriptionIcon />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ color: IGSS_COLORS.azulOscuro }}>
                            {doc.tipoDocumento || doc.nombreArchivo}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {doc.descripcion || doc.nombreArchivo} · {formatBytes(doc.tamanioBytes)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          <Tooltip title="Visualizar">
                            <IconButton
                              size="small"
                              onClick={() => handleVerDocumento(expedienteDetalle.id, doc.id, doc.nombreArchivo, doc.mimeType)}
                              sx={{ color: IGSS_COLORS.azulOscuro }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
                            <>
                              <Tooltip title="Reemplazar archivo">
                                <IconButton size="small" onClick={() => abrirReemplazarDoc(doc)} sx={{ color: IGSS_COLORS.azul }}>
                                  <CloudUploadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Historial de versiones">
                                <IconButton size="small" onClick={() => abrirVersiones(doc)} sx={{ color: IGSS_COLORS.azul }}>
                                  <HistoryIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={eliminandoId === doc.id}
                                  onClick={() => solicitarEliminarDoc(doc)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>
        ) : null}
      </motion.div>
      )}

      {/* Dialog: Agregar documento */}
      <Dialog
        open={agregarDocOpen}
        onClose={() => !subiendoDoc && setAgregarDocOpen(false)}
        maxWidth={docFile ? 'md' : 'sm'}
        fullWidth
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle>Agregar documento al expediente</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Elija el tipo de documento. Si es un documento especial que se sube por primera vez, use «Otro» e indique el nombre abajo.
            </Typography>
            <TextField
              select
              label="Tipo / Título del documento"
              value={docTipo}
              onChange={(e) => { setDocTipo(e.target.value); if (e.target.value !== 'Otro') setDocTipoOtro(''); }}
              fullWidth
              size="small"
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
            {docTipo === 'Otro' && (
              <TextField
                label="Especifique el tipo de documento"
                placeholder="Ej. Certificación de bienes, Informe técnico"
                value={docTipoOtro}
                onChange={(e) => setDocTipoOtro(e.target.value)}
                fullWidth
                size="small"
              />
            )}
            <Box
              onDragOver={(ev) => { ev.preventDefault(); setArrastrandoDoc(true); }}
              onDragLeave={() => setArrastrandoDoc(false)}
              onDrop={(ev) => {
                ev.preventDefault();
                setArrastrandoDoc(false);
                const archivo = ev.dataTransfer.files?.[0];
                if (archivo) setDocFile(archivo);
              }}
              sx={{
                p: 2.5,
                borderRadius: 2.5,
                textAlign: 'center',
                border: `1.5px dashed ${alpha(IGSS_COLORS.azul, arrastrandoDoc ? 0.9 : 0.45)}`,
                bgcolor: alpha(IGSS_COLORS.azul, arrastrandoDoc ? 0.1 : 0.04),
                transition: 'background-color .15s ease, border-color .15s ease',
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 34, color: IGSS_COLORS.azulOscuro, mb: 0.5 }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro }}>
                {docFile ? docFile.name : 'Arrastre el archivo aquí'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                {docFile
                  ? formatBytes(docFile.size)
                  : 'Es la forma más rápida: no abre el explorador de archivos.'}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AttachFileIcon />}
                onClick={() => abrirSelectorArchivo(docFileInputRef)}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {docFile ? 'Cambiar archivo' : 'Buscar en el equipo'}
              </Button>
            </Box>

            {docFile && (
              <Box
                sx={{
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  bgcolor: '#fff',
                }}
              >
                <Box
                  sx={{
                    px: 2,
                    py: 1.25,
                    bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.06),
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                    Vista previa
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Revise que sea el documento correcto antes de subir
                  </Typography>
                </Box>
                {docPreviewUrl ? (
                  esPdfLocal(docFile) ? (
                    <Box
                      component="iframe"
                      src={`${docPreviewUrl}#toolbar=1`}
                      title={docFile.name}
                      sx={{ width: '100%', height: { xs: 360, sm: 480 }, border: 0, display: 'block', bgcolor: '#525659' }}
                    />
                  ) : (
                    <Box sx={{ p: 2, display: 'grid', placeItems: 'center', bgcolor: IGSS_COLORS.fondo, maxHeight: 480, overflow: 'auto' }}>
                      <Box
                        component="img"
                        src={docPreviewUrl}
                        alt={docFile.name}
                        sx={{ maxWidth: '100%', maxHeight: 440, objectFit: 'contain', borderRadius: 1 }}
                      />
                    </Box>
                  )
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <DescriptionIcon sx={{ fontSize: 40, color: 'grey.400', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Este tipo de archivo ({docFile.name.split('.').pop()?.toUpperCase() || 'desconocido'}) no se puede previsualizar aquí.
                      Puede subirlo de todos modos si es el correcto.
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            <TextField
              label="Comentario (opcional)"
              value={docComentario}
              onChange={(e) => setDocComentario(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAgregarDocOpen(false); setDocFile(null); }} disabled={subiendoDoc}>Cancelar</Button>
          <Button variant="contained" onClick={handleAgregarDocumento} disabled={subiendoDoc || !docFile}>
            {subiendoDoc ? 'Subiendo…' : 'Subir'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmar eliminar documento */}
      <Dialog open={confirmEliminarOpen} onClose={() => !eliminandoId && setConfirmEliminarOpen(false)}>
        <DialogTitle>Eliminar documento</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar el documento «{docAEliminar?.nombre}»? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmEliminarOpen(false); setDocAEliminar(null); }}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={confirmarEliminarDoc} disabled={!!eliminandoId}>
            {eliminandoId ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reemplazar documento (guarda la versión anterior como respaldo) */}
      <Dialog
        open={replaceDocOpen}
        onClose={() => !reemplazandoDoc && setReplaceDocOpen(false)}
        maxWidth={replaceDocFile ? 'md' : 'sm'}
        fullWidth
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle>Reemplazar documento (corrección)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Suba el archivo corregido. El documento actual se guardará como respaldo en el historial de versiones (original y correcciones) para que siempre pueda consultar qué se subió antes.
          </Typography>
          <Box
            onDragOver={(ev) => { ev.preventDefault(); }}
            onDrop={(ev) => {
              ev.preventDefault();
              const archivo = ev.dataTransfer.files?.[0];
              if (archivo) setReplaceDocFile(archivo);
            }}
            sx={{
              p: 2.5,
              borderRadius: 2.5,
              textAlign: 'center',
              border: `1.5px dashed ${alpha(IGSS_COLORS.azul, 0.45)}`,
              bgcolor: alpha(IGSS_COLORS.azul, 0.04),
              mb: 2,
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 34, color: IGSS_COLORS.azulOscuro, mb: 0.5 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro }}>
              {replaceDocFile ? replaceDocFile.name : 'Arrastre el archivo corregido aquí'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {replaceDocFile ? formatBytes(replaceDocFile.size) : 'También puede buscarlo en el equipo.'}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AttachFileIcon />}
              onClick={() => abrirSelectorArchivo(replaceFileInputRef)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {replaceDocFile ? 'Cambiar archivo' : 'Buscar en el equipo'}
            </Button>
          </Box>

          {replaceDocFile && (
            <Box
              sx={{
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                bgcolor: '#fff',
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1.25,
                  bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.06),
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="subtitle2" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                  Vista previa
                </Typography>
              </Box>
              {replacePreviewUrl ? (
                esPdfLocal(replaceDocFile) ? (
                  <Box
                    component="iframe"
                    src={`${replacePreviewUrl}#toolbar=1`}
                    title={replaceDocFile.name}
                    sx={{ width: '100%', height: { xs: 360, sm: 480 }, border: 0, display: 'block', bgcolor: '#525659' }}
                  />
                ) : (
                  <Box sx={{ p: 2, display: 'grid', placeItems: 'center', bgcolor: IGSS_COLORS.fondo, maxHeight: 480, overflow: 'auto' }}>
                    <Box
                      component="img"
                      src={replacePreviewUrl}
                      alt={replaceDocFile.name}
                      sx={{ maxWidth: '100%', maxHeight: 440, objectFit: 'contain', borderRadius: 1 }}
                    />
                  </Box>
                )
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Este tipo de archivo no se puede previsualizar aquí.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setReplaceDocOpen(false); setReplaceDocTarget(null); setReplaceDocFile(null); }} disabled={reemplazandoDoc}>Cancelar</Button>
          <Button variant="contained" onClick={handleReemplazarDocumento} disabled={reemplazandoDoc || !replaceDocFile}>
            {reemplazandoDoc ? 'Reemplazando…' : 'Reemplazar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Historial de versiones del documento */}
      <Dialog open={versionesOpen} onClose={() => setVersionesOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.04) }}>
          Historial de versiones — {versionesTarget?.nombre}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cada versión conserva el archivo y las observaciones que DAF dejó sobre esa versión específica.
          </Typography>
          {versionesLoading ? (
            <Box display="flex" alignItems="center" gap={1} py={2}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">Cargando versiones…</Typography>
            </Box>
          ) : versionesList.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Aún no hay versiones registradas para este documento.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {versionesList.map((v) => (
                <Paper
                  key={v.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: v.esActual ? IGSS_COLORS.verde : 'divider',
                    bgcolor: v.esActual ? alpha(IGSS_COLORS.verde, 0.045) : '#fff',
                    boxShadow: v.esActual ? `0 0 0 1px ${alpha(IGSS_COLORS.verde, 0.14)}` : 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: v.esActual ? IGSS_COLORS.verde : alpha(IGSS_COLORS.azulOscuro, 0.12),
                        color: v.esActual ? '#fff' : IGSS_COLORS.azulOscuro,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      V{v.numeroVersion}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                          Versión {v.numeroVersion}{v.numeroVersion === 1 ? ' · Original' : ''}
                        </Typography>
                        {v.esActual && <Chip size="small" label="Versión vigente" color="success" sx={{ fontWeight: 700 }} />}
                        {(v.observaciones?.length || 0) > 0 && (
                          <Chip size="small" label={`${v.observaciones!.length} observación${v.observaciones!.length === 1 ? '' : 'es'}`} color="error" sx={{ fontWeight: 700 }} />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {v.nombreArchivo} · {formatBytes(v.tamanioBytes)} · {typeof v.fechaSubida === 'string' ? new Date(v.fechaSubida).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }) : String(v.fechaSubida)}
                      </Typography>
                      {(v.observaciones?.length || 0) > 0 && (
                        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                          {v.observaciones!.map((obs, index) => (
                            <Box
                              key={index}
                              sx={{
                                px: 1.25,
                                py: 1,
                                borderRadius: 1.5,
                                borderLeft: `3px solid ${IGSS_COLORS.error}`,
                                bgcolor: alpha(IGSS_COLORS.error, 0.045),
                              }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{obs.comentario}</Typography>
                              {obs.pagina != null && <Chip size="small" icon={<PlaceIcon />} label={`Pág. ${obs.pagina}`} color="error" variant="outlined" sx={{ mt: 0.75, height: 22 }} />}
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
                      <Tooltip title="Ver esta versión">
                        <IconButton size="small" onClick={() => expedienteDetalle && abrirVersionReemplazadaBitacora(expedienteDetalle.id, versionesTarget!.docId, v.id)} sx={{ color: IGSS_COLORS.azulOscuro }}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Descargar esta versión">
                        <IconButton size="small" onClick={() => descargarVersion(v.id, v.nombreArchivo)} sx={{ color: IGSS_COLORS.azulOscuro }}>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVersionesOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Bitácora del expediente: rechazos, aprobaciones y correcciones */}
      <Dialog
        open={bitacoraOpen}
        onClose={() => { setBitacoraOpen(false); setBitacoraExpedienteId(null); }}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, maxWidth: 960 } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 2, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" fontWeight="700" color="text.primary">{bitacoraTitulo}</Typography>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={handleRecargarBitacora} disabled={bitacoraLoading || bitacoraExpedienteId == null}>
            Recargar
          </Button>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {bitacoraLoading ? (
            <Box display="flex" alignItems="center" gap={2} py={4}>
              <CircularProgress size={24} />
              <Typography color="text.secondary">Cargando bitácora…</Typography>
            </Box>
          ) : bitacoraList.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No hay registros en la bitácora. Aquí aparecerán los <strong>rechazos</strong> (con observaciones por documento), las <strong>aprobaciones</strong> y las <strong>correcciones</strong> (por ejemplo, cuando reemplace un documento por otro), con fecha y hora.
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Historial de <strong>rechazos</strong> (motivo y observaciones por documento), <strong>aprobaciones</strong> y <strong>correcciones</strong> (documento reemplazado). Use esta información para saber qué corregir en cada archivo.
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <Table size="medium">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 700, width: 160 }}>Fecha y hora</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 120 }}>Tipo</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 180 }}>Usuario</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 280 }}>Comentario / Motivo y rechazos por documento</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bitacoraList.map((b) => (
                      <TableRow key={b.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={{ whiteSpace: 'nowrap', verticalAlign: 'top', pt: 2, pb: 2 }}>
                          {new Date(b.fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top', pt: 2, pb: 2 }}>
                          <Chip
                            size="small"
                            label={b.tipo === 'rechazo' ? 'Rechazo' : b.tipo === 'aprobacion' ? 'Aprobado' : b.tipo === 'correccion' ? 'Reemplazo de documento' : b.tipo}
                            color={b.tipo === 'rechazo' ? 'error' : b.tipo === 'aprobacion' ? 'success' : b.tipo === 'correccion' ? 'info' : 'default'}
                            variant="filled"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top', pt: 2, pb: 2 }}>
                          {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                        </TableCell>
                        <TableCell sx={{ minWidth: 280, verticalAlign: 'top', pt: 2, pb: 2 }}>
                          <Box sx={{ display: 'block' }}>
                            {(b.comentario || '').trim() && (
                              <Typography variant="body2" component="span" display="block" sx={{ mb: (b.detalle?.length || b.tipo === 'correccion') ? 1 : 0 }}>{b.comentario}</Typography>
                            )}
                            {b.tipo === 'correccion' && bitacoraExpedienteId != null && b.expedienteDocumentoId != null && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<VisibilityIcon />}
                                  onClick={() => abrirDocumentoBitacora(bitacoraExpedienteId, b.expedienteDocumentoId!)}
                                >
                                  Ver documento actual{b.documentoReemplazo?.nombreArchivo ? `: ${b.documentoReemplazo.nombreArchivo}` : ''}
                                </Button>
                                {b.documentoReemplazado != null && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<VisibilityIcon />}
                                    onClick={() => abrirVersionReemplazadaBitacora(bitacoraExpedienteId, b.expedienteDocumentoId!, b.documentoReemplazado!.versionId)}
                                  >
                                    Ver documento reemplazado{b.documentoReemplazado.nombreArchivo ? `: ${b.documentoReemplazado.nombreArchivo}` : ''}
                                  </Button>
                                )}
                              </Box>
                            )}
                            {b.detalle && b.detalle.length > 0 && (
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="caption" fontWeight="700" color="primary.main" display="block" sx={{ mb: 0.5 }}>
                                  Rechazos por documento:
                                </Typography>
                                <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { marginBottom: 8 } }}>
                                  {b.detalle.map((d, i) => (
                                    <li key={i}>
                                      <Typography variant="body2" component="span">
                                        <strong>{d.nombreDocumento}</strong>: {d.comentario}
                                        {d.corregido && <Chip size="small" label="Corregido" color="info" sx={{ ml: 0.5, verticalAlign: 'middle', fontWeight: 600 }} />}
                                        {(d.pagina != null || d.xPercent != null) && d.expedienteDocumentoId != null && bitacoraExpedienteId != null && (
                                          <>
                                            <Chip size="small" label="Señalizado" color="warning" sx={{ ml: 0.5, verticalAlign: 'middle' }} icon={<PlaceIcon sx={{ fontSize: 14 }} />} />
                                            <Button
                                              size="small"
                                              startIcon={<PlaceIcon />}
                                              onClick={() => openVerMarca(bitacoraExpedienteId, d.expedienteDocumentoId!, d.nombreDocumento, d.mimeType ?? 'application/octet-stream', d.xPercent ?? 0, d.yPercent ?? 0, d.pagina, d.comentario, d.documentoVersionIdParaMarca)}
                                              sx={{ ml: 0.5, verticalAlign: 'middle', textTransform: 'none' }}
                                            >
                                              Ver marca de rechazo
                                            </Button>
                                          </>
                                        )}
                                      </Typography>
                                    </li>
                                  ))}
                                </Box>
                              </Box>
                            )}
                            {!(b.comentario || '').trim() && (!b.detalle || b.detalle.length === 0) && b.tipo !== 'correccion' && '—'}
                          </Box>
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
          <Button onClick={() => { setBitacoraOpen(false); setBitacoraExpedienteId(null); }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Ver marca de rechazo (posición donde DAF señaló el error) */}
      <Dialog open={verMarcaOpen} onClose={closeVerMarca} maxWidth="xl" fullWidth PaperProps={{ sx: { minHeight: '80vh', borderRadius: 2 } }}>
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1.5, bgcolor: 'grey.50' }}>
          Ver marca de rechazo — {verMarcaData?.nombreDocumento ?? 'Documento'}
          {verMarcaEsDocumentoReemplazado && (
            <Typography component="span" variant="caption" color="info.main" sx={{ ml: 1, fontWeight: 600 }}>
              (documento reemplazado)
            </Typography>
          )}
          {verMarcaData?.pagina != null && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              (Página {verMarcaData.pagina})
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '75vh' }}>
          {verMarcaData?.comentario && (
            <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2"><strong>Motivo:</strong> {verMarcaData.comentario}</Typography>
            </Box>
          )}
          {verMarcaUrl && verMarcaData && !verMarcaLoading && !verMarcaLoadError && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Tooltip title="Alejar">
                <span>
                  <IconButton size="small" onClick={() => setVerMarcaZoom((z) => Math.max(0.5, z - 0.25))} disabled={verMarcaZoom <= 0.5} aria-label="Alejar">
                    <ZoomOutIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Typography variant="caption" sx={{ minWidth: 44, textAlign: 'center' }}>{Math.round(verMarcaZoom * 100)}%</Typography>
              <Tooltip title="Acercar">
                <IconButton size="small" onClick={() => setVerMarcaZoom((z) => Math.min(2.5, z + 0.25))} disabled={verMarcaZoom >= 2.5} aria-label="Acercar">
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setVerMarcaZoom(1)} aria-label="Restablecer zoom">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
          {verMarcaLoading ? (
            <Box sx={{ flex: 1, minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="text.secondary">Cargando documento…</Typography>
            </Box>
          ) : verMarcaLoadError ? (
            <Box sx={{ flex: 1, minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
              <Typography color="error" textAlign="center">No se pudo cargar el documento. Verifique que tenga acceso y que el archivo exista.</Typography>
            </Box>
          ) : verMarcaUrl && verMarcaData ? (
            <Box ref={verMarcaContainerRef} sx={{ flex: 1, position: 'relative', overflow: 'auto', minHeight: 360, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {verMarcaData.mimeType.startsWith('image/') ? (
                <Box sx={{ display: 'inline-block', position: 'relative', transform: `scale(${verMarcaZoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease' }}>
                  <img
                    ref={verMarcaImageRef}
                    src={verMarcaUrl}
                    alt={verMarcaData.nombreDocumento}
                    style={{ maxWidth: '90%', maxHeight: '65vh', objectFit: 'contain', display: 'block' }}
                    onLoad={measureVerMarcaPosition}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${verMarcaData.xPercent}%`,
                      top: `${verMarcaData.yPercent}%`,
                      transform: 'translate(-50%, -100%)',
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}
                    aria-label="Marca de rechazo"
                  >
                    <PlaceIcon sx={{ fontSize: 48, color: 'error.main', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  </Box>
                </Box>
              ) : (verMarcaData.mimeType === 'application/pdf' || verMarcaData.nombreDocumento.toLowerCase().endsWith('.pdf')) ? (
                <Box sx={{ width: '100%', height: '100%', minHeight: 360, overflow: 'auto' }}>
                  <PdfViewerWithClick
                    fileUrl={verMarcaUrl}
                    marker={{
                      pageNumber: verMarcaData.pagina != null ? verMarcaData.pagina : 1,
                      xPercent: verMarcaData.xPercent,
                      yPercent: verMarcaData.yPercent,
                    }}
                    markerPageOnly
                    minHeight={360}
                    zoom={verMarcaZoom}
                  />
                </Box>
              ) : (
                <>
                  <iframe
                    title={verMarcaData.nombreDocumento}
                    src={verMarcaUrl}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${verMarcaData.xPercent}%`,
                      top: `${verMarcaData.yPercent}%`,
                      transform: 'translate(-50%, -100%)',
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}
                    aria-label="Marca de rechazo"
                  >
                    <PlaceIcon sx={{ fontSize: 48, color: 'error.main', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  </Box>
                </>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeVerMarca}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Previsualización de documento (en la misma página, como SIAF) */}
      <Dialog open={!!viewingDoc || viewerDocLoading} onClose={cerrarViewerDoc} maxWidth="xl" fullWidth>
        <DialogTitle>{viewingDoc?.nombreOriginal || 'Cargando…'}</DialogTitle>
        <DialogContent sx={{ height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 0 }}>
          {viewerDocLoading && (
            <Typography color="text.secondary">Cargando documento…</Typography>
          )}
          {viewingDoc?.url && !viewerDocLoading && (
            <>
              {(viewingDoc.mimeType === 'application/pdf' || viewingDoc.nombreOriginal.toLowerCase().endsWith('.pdf')) ? (
                <iframe
                  src={`${viewingDoc.url}#toolbar=1`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={viewingDoc.nombreOriginal}
                />
              ) : viewingDoc.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(viewingDoc.nombreOriginal) ? (
                <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
                  <img
                    src={viewingDoc.url}
                    alt={viewingDoc.nombreOriginal}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </Box>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>No se puede visualizar este tipo de archivo</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Tipo: {viewingDoc.mimeType || 'desconocido'}
                  </Typography>
                  <Button variant="contained" startIcon={<DownloadIcon />} onClick={descargarDocumentoViewer}>
                    Descargar para abrir
                  </Button>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarViewerDoc}>Cerrar</Button>
          {viewingDoc && (
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={descargarDocumentoViewer}>
              Descargar
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Dialog: Crear nuevo expediente */}
      <Dialog
        open={crearOpen}
        onClose={() => !creando && setCrearOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            border: `1px solid ${IGSS_COLORS.gris}`,
            boxShadow: `0 16px 40px ${alpha(IGSS_COLORS.azulOscuro, 0.18)}`,
          },
        }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 2.5,
            pb: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(IGSS_COLORS.azul, 0.04),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: IGSS_COLORS.azulOscuro,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <AddIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, lineHeight: 1.3 }}>
                Nuevo expediente de compras
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                Complete los datos básicos. Luego podrá agregar los documentos del expediente.
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 1 }}>
            <Box
              sx={{
                p: 1.75,
                borderRadius: 2,
                border: '1px dashed',
                borderColor: alpha(IGSS_COLORS.azul, 0.45),
                bgcolor: alpha(IGSS_COLORS.azul, 0.05),
              }}
            >
              <Typography variant="caption" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                Número de expediente a utilizar
              </Typography>
              {cargandoCorrelativo ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">Consultando correlativo…</Typography>
                </Box>
              ) : (
                <>
                  <Typography variant="h5" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mt: 0.5, letterSpacing: 0.4 }}>
                    {siguienteCorrelativo || 'Se asignará al crear'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {siguienteCorrelativo
                      ? 'Este será el número interno asignado al guardar el expediente.'
                      : 'El sistema asignará el siguiente correlativo disponible al crear el expediente.'}
                  </Typography>
                </>
              )}
            </Box>
            <TextField
              label="Título"
              select
              value={nuevoTitulo}
              onChange={(ev) => setNuevoTitulo(ev.target.value)}
              required
              fullWidth
              autoFocus
              helperText="Clasifique el expediente según el tipo de adquisición"
              InputLabelProps={{ shrink: true }}
            >
              {TITULOS_OPCIONES.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Número de orden de compra (O.C.)"
              value={nuevoNumeroOc}
              onChange={(ev) => setNuevoNumeroOc(ev.target.value)}
              required
              fullWidth
              placeholder="Ej. 12345"
              helperText="Ingrese el número de la orden de compra asociada"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Número SIAF"
              value={nuevoNumeroSiaf}
              onChange={(ev) => setNuevoNumeroSiaf(ev.target.value)}
              fullWidth
              placeholder="Ej. SIAF-44-2026"
              helperText="Opcional; se usa para identificar este caso en las estadísticas del piloto."
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Descripción"
              value={nuevoDescripcion}
              onChange={(ev) => setNuevoDescripcion(ev.target.value)}
              required
              multiline
              rows={3}
              fullWidth
              placeholder="Resumen breve del objeto del expediente"
              helperText="Describa el objeto del expediente"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={() => setCrearOpen(false)}
            disabled={creando}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleCrear}
            disabled={creando}
            startIcon={creando ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            sx={{
              ...primaryButtonSx,
              bgcolor: IGSS_COLORS.azulOscuro,
              '&:hover': { bgcolor: IGSS_COLORS.azul },
              minWidth: 120,
            }}
          >
            {creando ? 'Creando…' : 'Crear expediente'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Editar expediente */}
      <Dialog
        open={editOpen}
        onClose={() => !guardandoEdit && setEditOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            border: `1px solid ${IGSS_COLORS.gris}`,
            boxShadow: `0 16px 40px ${alpha(IGSS_COLORS.azulOscuro, 0.18)}`,
          },
        }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 2.5,
            pb: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(IGSS_COLORS.azul, 0.04),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: IGSS_COLORS.azulOscuro,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <EditIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, lineHeight: 1.3 }}>
                Editar expediente
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                Actualice el título, la O.C. o la descripción del expediente.
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 1 }}>
            <TextField
              label="Número de expediente"
              value={editNumero}
              fullWidth
              disabled
              InputLabelProps={{ shrink: true }}
              helperText="El número no se puede modificar"
            />
            <TextField
              label="Título"
              select
              value={editTitulo}
              onChange={(ev) => setEditTitulo(ev.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            >
              {TITULOS_OPCIONES.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Número de orden de compra (O.C.)"
              value={editNumeroOc}
              onChange={(ev) => setEditNumeroOc(ev.target.value)}
              required
              fullWidth
              placeholder="Ej. 12345"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Número SIAF"
              value={editNumeroSiaf}
              onChange={(ev) => setEditNumeroSiaf(ev.target.value)}
              fullWidth
              placeholder="Ej. SIAF-44-2026"
              helperText="Opcional; permite relacionar el expediente con las mediciones del piloto."
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Descripción"
              value={editDescripcion}
              onChange={(ev) => setEditDescripcion(ev.target.value)}
              required
              multiline
              rows={3}
              fullWidth
              placeholder="Resumen breve del objeto del expediente"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={() => setEditOpen(false)}
            disabled={guardandoEdit}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGuardarEdicion}
            disabled={guardandoEdit}
            startIcon={guardandoEdit ? <CircularProgress size={16} color="inherit" /> : <EditIcon />}
            sx={{
              ...primaryButtonSx,
              bgcolor: IGSS_COLORS.azulOscuro,
              '&:hover': { bgcolor: IGSS_COLORS.azul },
              minWidth: 120,
            }}
          >
            {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ExpedientesPage;
