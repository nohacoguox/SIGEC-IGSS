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
  Drawer,
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
} from '@mui/icons-material';
import api from '../api';
import { useNotification } from '../context/NotificationContext';
import { usePermissions } from '../hooks/usePermissions';
import PdfViewerWithClick from '../components/PdfViewerWithClick';

type ExpedienteRow = {
  id: number;
  numeroExpediente: string;
  titulo: string;
  tipoExpediente: string;
  estado: string;
  fechaApertura: string;
  descripcion?: string | null;
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

const headerCellStyle = { backgroundColor: '#0d47a1', color: '#ffffff' };
const headerRowStyle = { backgroundColor: '#0d47a1' };
const headerCellSx = { fontWeight: 700, fontSize: '0.9375rem', py: 2, borderBottom: 'none' };

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
  const [nuevoNumero, setNuevoNumero] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState('Compras');
  const [nuevoTitulo, setNuevoTitulo] = useState(TITULOS_OPCIONES[0]);
  const [nuevoDescripcion, setNuevoDescripcion] = useState('');
  const [creando, setCreando] = useState(false);

  // Editar expediente (solo si no aprobado/cerrado/archivado)
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNumero, setEditNumero] = useState('');
  const [editTitulo, setEditTitulo] = useState(TITULOS_OPCIONES[0]);
  const [editDescripcion, setEditDescripcion] = useState('');
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // Detalle / documentos
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expedienteDetalle, setExpedienteDetalle] = useState<ExpedienteRow | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [ultimoRechazo, setUltimoRechazo] = useState<UltimoRechazo | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [agregarDocOpen, setAgregarDocOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTipo, setDocTipo] = useState(TIPOS_DOCUMENTO[0]);
  const [docTipoOtro, setDocTipoOtro] = useState(''); // Cuando el tipo es "Otro", texto libre
  const [docComentario, setDocComentario] = useState('');
  const [subiendoDoc, setSubiendoDoc] = useState(false);
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
  const [reemplazandoDoc, setReemplazandoDoc] = useState(false);

  // Historial de versiones de un documento
  const [versionesOpen, setVersionesOpen] = useState(false);
  const [versionesTarget, setVersionesTarget] = useState<{ docId: number; nombre: string } | null>(null);
  const [versionesList, setVersionesList] = useState<Array<{ id: number; numeroVersion: number; nombreArchivo: string; fechaSubida: string; tamanioBytes: number; subidoPor?: { nombres?: string; apellidos?: string } | null }>>([]);
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

  // Solo se puede editar si está abierto o rechazado (no mientras está en revisión)
  const expedienteEditable = (e: ExpedienteRow) => e.estado === 'abierto' || e.estado === 'rechazado';

  const abrirEditar = (e: ExpedienteRow) => {
    setEditId(e.id);
    setEditNumero(e.numeroExpediente);
    setEditTitulo(TITULOS_OPCIONES.includes(e.titulo) ? e.titulo : TITULOS_OPCIONES[0]);
    setEditDescripcion(e.descripcion ?? '');
    setEditOpen(true);
  };

  const handleGuardarEdicion = async () => {
    if (editId == null) return;
    const tit = editTitulo.trim();
    if (!tit) { showError('Elija un título (Bien/Producto o Servicio).'); return; }
    setGuardandoEdit(true);
    try {
      await api.put(`/expedientes/${editId}`, {
        titulo: tit,
        descripcion: editDescripcion.trim() || undefined,
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

  const handleCrear = async () => {
    const num = nuevoNumero.trim();
    const tit = nuevoTitulo.trim();
    if (!num) { showError('Indique el número de expediente.'); return; }
    if (!tit) { showError('Elija un título (Bien/Producto o Servicio).'); return; }
    setCreando(true);
    try {
      const { data } = await api.post('/expedientes', {
        numeroExpediente: num,
        tipoExpediente: nuevoTipo.trim() || 'Compras',
        titulo: tit,
        descripcion: nuevoDescripcion.trim() || undefined,
      });
      showSuccess('Expediente creado correctamente.');
      setCrearOpen(false);
      setNuevoNumero(''); setNuevoTitulo(TITULOS_OPCIONES[0]); setNuevoDescripcion(''); setNuevoTipo('Compras');
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
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            sx={{
              background: 'linear-gradient(135deg, #F57C00 0%, #E65100 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 0.5,
            }}
          >
            Creación de Expediente
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Crea y administra expedientes de compras. Agregue los documentos que conforman cada expediente (Orden de Compras, ACTA, SIAF autorizado, etc.).
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/colaborador-dashboard')}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              ← Volver
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadExpedientes}
              disabled={loading}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, borderColor: 'grey.400', color: 'grey.700' }}
            >
              Recargar
            </Button>
            {puedeCrear && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCrearOpen(true)}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  px: 3,
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: 2,
                  background: 'linear-gradient(135deg, #F57C00 0%, #E65100 100%)',
                  '&:hover': { opacity: 0.9 },
                }}
              >
                + Crear Nuevo Expediente
              </Button>
            )}
          </Box>
        </Box>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="h6" fontWeight="700" sx={{ color: 'grey.800' }}>
              Expedientes creados
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Listado de expedientes. Use «Ver» para gestionar los documentos de cada uno (cargar, titular, comentar, visualizar o eliminar).
            </Typography>
          </Box>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow style={headerRowStyle}>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Número</TableCell>
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
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Typography variant="body2" sx={{ color: 'grey.600' }}>Cargando...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : expedientes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Typography variant="body2" sx={{ color: 'grey.600' }}>
                          No hay expedientes. Use «Crear Nuevo Expediente» para agregar uno.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    expedientes.map((e, index) => (
                      <TableRow
                        key={e.id}
                        sx={{
                          bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                          '&:hover': { bgcolor: 'action.selected' },
                          '& td': { py: 1.75, borderColor: 'divider' },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>{e.numeroExpediente}</TableCell>
                        <TableCell>{e.titulo}</TableCell>
                        <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.descripcion || undefined}>{e.descripcion || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={e.estado}
                            size="small"
                            color={e.estado === 'abierto' ? 'default' : e.estado === 'cerrado' ? 'success' : e.estado === 'rechazado' ? 'error' : 'primary'}
                            variant="filled"
                            sx={{ fontWeight: 600 }}
                          />
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

      {/* Drawer: detalle del expediente y documentos */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100%' },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight="700" color="primary.main">
                  Documentos del expediente
                </Typography>
                {expedienteDetalle && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {expedienteDetalle.numeroExpediente} — {expedienteDetalle.titulo}
                  </Typography>
                )}
              </Box>
              {expedienteDetalle && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  onClick={() => handleOpenBitacora(expedienteDetalle.id, expedienteDetalle.numeroExpediente)}
                  sx={{ textTransform: 'none' }}
                >
                  Ver bitácora
                </Button>
              )}
            </Box>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {detalleLoading ? (
              <Typography color="text.secondary">Cargando...</Typography>
            ) : expedienteDetalle ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && puedeCrear && (
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SendIcon />}
                        onClick={enviarARevision}
                        disabled={enviandoRevision}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        {enviandoRevision ? 'Enviando…' : 'Enviar a revisión'}
                      </Button>
                    )}
                  </Box>
                  {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
                    <Button
                      variant="contained"
                      startIcon={<AttachFileIcon />}
                      onClick={() => setAgregarDocOpen(true)}
                      sx={{
                        background: 'linear-gradient(135deg, #F57C00 0%, #E65100 100%)',
                        textTransform: 'none',
                        fontWeight: 600,
                      }}
                    >
                      Agregar documento
                    </Button>
                  )}
                </Box>
                {expedienteDetalle.estado === 'rechazado' && ultimoRechazo && (
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'error.50', borderLeft: '4px solid', borderColor: 'error.main', borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight="700" color="error.dark" sx={{ mb: 0.5 }}>Motivo del rechazo</Typography>
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
                {documentos.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Aún no hay documentos. Use «Agregar documento» para cargar la Orden de Compras, ACTA, SIAF autorizado u otros.
                  </Typography>
                ) : (
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={headerRowStyle}>
                          <TableCell sx={{ ...headerCellSx, ...headerCellStyle }}>Título / Tipo</TableCell>
                          <TableCell sx={{ ...headerCellSx, ...headerCellStyle }}>Comentario</TableCell>
                          <TableCell sx={{ ...headerCellSx, ...headerCellStyle }}>Tamaño</TableCell>
                          <TableCell align="center" sx={{ ...headerCellSx, ...headerCellStyle }}>Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {documentos.map((doc, idx) => (
                          <TableRow
                            key={doc.id}
                            sx={{
                              bgcolor: idx % 2 === 1 ? 'action.hover' : 'background.paper',
                              '& td': { borderColor: 'divider', py: 1.5 },
                            }}
                          >
                            <TableCell sx={{ fontWeight: 600 }}>{doc.tipoDocumento || doc.nombreArchivo}</TableCell>
                            <TableCell sx={{ maxWidth: 200 }}>{doc.descripcion || '—'}</TableCell>
                            <TableCell>{formatBytes(doc.tamanioBytes)}</TableCell>
                            <TableCell align="center">
                              <Tooltip title="Visualizar">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleVerDocumento(expedienteDetalle.id, doc.id, doc.nombreArchivo, doc.mimeType)}
                                  sx={{ mr: 0.25 }}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
                                <>
                                  <Tooltip title="Reemplazar por archivo corregido (guarda la versión anterior)">
                                    <IconButton size="small" color="primary" onClick={() => abrirReemplazarDoc(doc)} sx={{ mr: 0.25 }}>
                                      <CloudUploadIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Ver historial de versiones">
                                    <IconButton size="small" color="primary" onClick={() => abrirVersiones(doc)} sx={{ mr: 0.25 }}>
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
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            ) : null}
          </Box>
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button variant="outlined" fullWidth onClick={closeDrawer}>
              Cerrar
            </Button>
          </Box>
        </Box>
      </Drawer>

      {/* Dialog: Agregar documento */}
      <Dialog open={agregarDocOpen} onClose={() => !subiendoDoc && setAgregarDocOpen(false)} maxWidth="sm" fullWidth>
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
            <Button variant="outlined" component="label" startIcon={<AttachFileIcon />} fullWidth>
              {docFile ? docFile.name : 'Seleccionar archivo'}
              <input type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
            </Button>
            <TextField
              label="Comentario (opcional)"
              value={docComentario}
              onChange={(e) => setDocComentario(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAgregarDocOpen(false)} disabled={subiendoDoc}>Cancelar</Button>
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
      <Dialog open={replaceDocOpen} onClose={() => !reemplazandoDoc && setReplaceDocOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reemplazar documento (corrección)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Suba el archivo corregido. El documento actual se guardará como respaldo en el historial de versiones (original y correcciones) para que siempre pueda consultar qué se subió antes.
          </Typography>
          <Button variant="outlined" component="label" startIcon={<AttachFileIcon />} fullWidth>
            {replaceDocFile ? replaceDocFile.name : 'Seleccionar archivo corregido'}
            <input type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(e) => setReplaceDocFile(e.target.files?.[0] || null)} />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setReplaceDocOpen(false); setReplaceDocTarget(null); setReplaceDocFile(null); }} disabled={reemplazandoDoc}>Cancelar</Button>
          <Button variant="contained" onClick={handleReemplazarDocumento} disabled={reemplazandoDoc || !replaceDocFile}>
            {reemplazandoDoc ? 'Reemplazando…' : 'Reemplazar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Historial de versiones del documento */}
      <Dialog open={versionesOpen} onClose={() => setVersionesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Historial de versiones — {versionesTarget?.nombre}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            La primera subida es la versión original; cada corrección (reemplazo) guarda la anterior como respaldo. Puede descargar cualquier versión.
          </Typography>
          {versionesLoading ? (
            <Box display="flex" alignItems="center" gap={1} py={2}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">Cargando versiones…</Typography>
            </Box>
          ) : versionesList.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Aún no hay versiones guardadas (se crean al reemplazar el documento).</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Versión</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tamaño</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Acción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versionesList.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        {v.numeroVersion === 1 ? 'Versión 1 (original)' : `Versión ${v.numeroVersion} (${v.numeroVersion - 1}.ª corrección)`}
                      </TableCell>
                      <TableCell>{typeof v.fechaSubida === 'string' ? v.fechaSubida.split('T')[0] : String(v.fechaSubida)}</TableCell>
                      <TableCell>{formatBytes(v.tamanioBytes)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" startIcon={<DownloadIcon />} onClick={() => descargarVersion(v.id, v.nombreArchivo)}>
                          Descargar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
      <Dialog open={crearOpen} onClose={() => !creando && setCrearOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Crear nuevo expediente</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Número de expediente *" value={nuevoNumero} onChange={(ev) => setNuevoNumero(ev.target.value)} required fullWidth />
            <TextField label="Título *" select SelectProps={{ native: true }} value={nuevoTitulo} onChange={(ev) => setNuevoTitulo(ev.target.value)} required fullWidth>
              {TITULOS_OPCIONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </TextField>
            <TextField label="Descripción" value={nuevoDescripcion} onChange={(ev) => setNuevoDescripcion(ev.target.value)} multiline rows={3} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCrearOpen(false)} disabled={creando}>Cancelar</Button>
          <Button variant="contained" onClick={handleCrear} disabled={creando}>Crear</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Editar expediente */}
      <Dialog open={editOpen} onClose={() => !guardandoEdit && setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar expediente</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Número de expediente" value={editNumero} fullWidth disabled />
            <TextField label="Título *" select SelectProps={{ native: true }} value={editTitulo} onChange={(ev) => setEditTitulo(ev.target.value)} required fullWidth>
              {TITULOS_OPCIONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </TextField>
            <TextField label="Descripción" value={editDescripcion} onChange={(ev) => setEditDescripcion(ev.target.value)} multiline rows={3} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={guardandoEdit}>Cancelar</Button>
          <Button variant="contained" onClick={handleGuardarEdicion} disabled={guardandoEdit}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ExpedientesPage;
