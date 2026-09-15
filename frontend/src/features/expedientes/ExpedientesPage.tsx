import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Send as SendIcon,
  DescriptionOutlined as DescriptionIcon,
} from '@mui/icons-material';
import api from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
  pageTitleSx,
  primaryButtonSx,
} from '../../theme/institutionalStyles';
import { IGSS_COLORS } from '../../theme/institutionalColors';
import { ARCHIVOS_ACEPTADOS, TIPOS_DOCUMENTO, TITULOS_OPCIONES, estadoConfig } from './constants';
import type {
  BitacoraEntry,
  DocumentoRow,
  DocumentoVersionRow,
  ExpedienteRow,
  UltimoRechazo,
  ViewingDoc,
} from './types';
import { abrirSelectorArchivo, esArchivoPrevisualizable } from './utils';
import AgregarDocumentoDialog from './components/AgregarDocumentoDialog';
import BitacoraDialog from './components/BitacoraDialog';
import ConfirmarEliminarDocDialog from './components/ConfirmarEliminarDocDialog';
import DocumentoViewerDialog from './components/DocumentoViewerDialog';
import ExpedienteCrearDialog from './components/ExpedienteCrearDialog';
import ExpedienteDetalleDrawer from './components/ExpedienteDetalleDrawer';
import ExpedienteEditarDialog from './components/ExpedienteEditarDialog';
import ReemplazarDocumentoDialog from './components/ReemplazarDocumentoDialog';
import VerMarcaDialog, { type VerMarcaRequest } from './components/VerMarcaDialog';
import VersionesDocumentoDialog from './components/VersionesDocumentoDialog';

const headerCellStyle = tableHeaderCellStyle;
const headerRowStyle = tableHeaderRowStyle;
const headerCellSx = tableHeaderCellSx;

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

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNumero, setEditNumero] = useState('');
  const [editTitulo, setEditTitulo] = useState(TITULOS_OPCIONES[0]);
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editNumeroOc, setEditNumeroOc] = useState('');
  const [editNumeroSiaf, setEditNumeroSiaf] = useState('');
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expedienteDetalle, setExpedienteDetalle] = useState<ExpedienteRow | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [ultimoRechazo, setUltimoRechazo] = useState<UltimoRechazo | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [agregarDocOpen, setAgregarDocOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [docTipo, setDocTipo] = useState(TIPOS_DOCUMENTO[0]);
  const [docTipoOtro, setDocTipoOtro] = useState('');
  const [docComentario, setDocComentario] = useState('');
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [arrastrandoDoc, setArrastrandoDoc] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [confirmEliminarOpen, setConfirmEliminarOpen] = useState(false);
  const [docAEliminar, setDocAEliminar] = useState<{ id: number; nombre: string } | null>(null);

  const [viewingDoc, setViewingDoc] = useState<ViewingDoc | null>(null);
  const [viewerDocLoading, setViewerDocLoading] = useState(false);
  const [enviandoRevision, setEnviandoRevision] = useState(false);
  const [enviandoRevisionId, setEnviandoRevisionId] = useState<number | null>(null);

  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [bitacoraList, setBitacoraList] = useState<BitacoraEntry[]>([]);
  const [bitacoraLoading, setBitacoraLoading] = useState(false);
  const [bitacoraTitulo, setBitacoraTitulo] = useState('');
  const [bitacoraExpedienteId, setBitacoraExpedienteId] = useState<number | null>(null);

  const [replaceDocOpen, setReplaceDocOpen] = useState(false);
  const [replaceDocTarget, setReplaceDocTarget] = useState<{ docId: number; nombre: string } | null>(null);
  const [replaceDocFile, setReplaceDocFile] = useState<File | null>(null);
  const [replacePreviewUrl, setReplacePreviewUrl] = useState<string | null>(null);
  const [reemplazandoDoc, setReemplazandoDoc] = useState(false);

  const [versionesOpen, setVersionesOpen] = useState(false);
  const [versionesTarget, setVersionesTarget] = useState<{ docId: number; nombre: string } | null>(null);
  const [versionesList, setVersionesList] = useState<DocumentoVersionRow[]>([]);
  const [versionesLoading, setVersionesLoading] = useState(false);

  const [verMarcaRequest, setVerMarcaRequest] = useState<VerMarcaRequest | null>(null);

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

  const openVerMarca = (
    expedienteId: number,
    docId: number,
    nombreDocumento: string,
    mimeType: string,
    xPercent: number,
    yPercent: number,
    pagina?: number | null,
    comentario?: string,
    versionId?: number | null,
  ) => {
    setVerMarcaRequest({
      expedienteId,
      docId,
      nombreDocumento,
      mimeType,
      xPercent,
      yPercent,
      pagina,
      comentario,
      versionId,
    });
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
    } catch {
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
        <ExpedienteDetalleDrawer
          expedienteDetalle={expedienteDetalle}
          documentos={documentos}
          ultimoRechazo={ultimoRechazo}
          detalleLoading={detalleLoading}
          puedeCrear={puedeCrear}
          enviandoRevision={enviandoRevision}
          eliminandoId={eliminandoId}
          onClose={closeDrawer}
          onOpenBitacora={handleOpenBitacora}
          onAgregarDocumento={() => setAgregarDocOpen(true)}
          onEnviarRevision={enviarARevision}
          onVerDocumento={handleVerDocumento}
          onReemplazarDoc={abrirReemplazarDoc}
          onAbrirVersiones={abrirVersiones}
          onSolicitarEliminar={solicitarEliminarDoc}
          onVerMarca={openVerMarca}
        />
      )}

      <AgregarDocumentoDialog
        open={agregarDocOpen}
        subiendoDoc={subiendoDoc}
        docFile={docFile}
        docPreviewUrl={docPreviewUrl}
        docTipo={docTipo}
        docTipoOtro={docTipoOtro}
        docComentario={docComentario}
        arrastrandoDoc={arrastrandoDoc}
        onClose={() => setAgregarDocOpen(false)}
        onSubmit={handleAgregarDocumento}
        onDocTipoChange={setDocTipo}
        onDocTipoOtroChange={setDocTipoOtro}
        onDocComentarioChange={setDocComentario}
        onDocFileChange={setDocFile}
        onArrastrandoChange={setArrastrandoDoc}
        onBrowseFile={() => abrirSelectorArchivo(docFileInputRef)}
      />

      <ConfirmarEliminarDocDialog
        open={confirmEliminarOpen}
        nombreDocumento={docAEliminar?.nombre}
        eliminando={!!eliminandoId}
        onClose={() => { setConfirmEliminarOpen(false); setDocAEliminar(null); }}
        onConfirm={confirmarEliminarDoc}
      />

      <ReemplazarDocumentoDialog
        open={replaceDocOpen}
        reemplazandoDoc={reemplazandoDoc}
        replaceDocFile={replaceDocFile}
        replacePreviewUrl={replacePreviewUrl}
        onClose={() => { setReplaceDocOpen(false); setReplaceDocTarget(null); setReplaceDocFile(null); }}
        onSubmit={handleReemplazarDocumento}
        onFileChange={setReplaceDocFile}
        onBrowseFile={() => abrirSelectorArchivo(replaceFileInputRef)}
      />

      <VersionesDocumentoDialog
        open={versionesOpen}
        loading={versionesLoading}
        nombreDocumento={versionesTarget?.nombre}
        versiones={versionesList}
        onClose={() => setVersionesOpen(false)}
        onVerVersion={(versionId) => {
          if (expedienteDetalle && versionesTarget) {
            abrirVersionReemplazadaBitacora(expedienteDetalle.id, versionesTarget.docId, versionId);
          }
        }}
        onDescargarVersion={descargarVersion}
      />

      <BitacoraDialog
        open={bitacoraOpen}
        titulo={bitacoraTitulo}
        loading={bitacoraLoading}
        entries={bitacoraList}
        expedienteId={bitacoraExpedienteId}
        onClose={() => { setBitacoraOpen(false); setBitacoraExpedienteId(null); }}
        onRecargar={handleRecargarBitacora}
        onAbrirDocumento={abrirDocumentoBitacora}
        onAbrirVersion={abrirVersionReemplazadaBitacora}
        onVerMarca={openVerMarca}
      />

      <VerMarcaDialog
        open={!!verMarcaRequest}
        request={verMarcaRequest}
        onClose={() => setVerMarcaRequest(null)}
      />

      <DocumentoViewerDialog
        viewingDoc={viewingDoc}
        loading={viewerDocLoading}
        onClose={cerrarViewerDoc}
        onDownload={descargarDocumentoViewer}
      />

      <ExpedienteCrearDialog
        open={crearOpen}
        creando={creando}
        cargandoCorrelativo={cargandoCorrelativo}
        siguienteCorrelativo={siguienteCorrelativo}
        nuevoTitulo={nuevoTitulo}
        nuevoNumeroOc={nuevoNumeroOc}
        nuevoNumeroSiaf={nuevoNumeroSiaf}
        nuevoDescripcion={nuevoDescripcion}
        onClose={() => setCrearOpen(false)}
        onCrear={handleCrear}
        onNuevoTituloChange={setNuevoTitulo}
        onNuevoNumeroOcChange={setNuevoNumeroOc}
        onNuevoNumeroSiafChange={setNuevoNumeroSiaf}
        onNuevoDescripcionChange={setNuevoDescripcion}
      />

      <ExpedienteEditarDialog
        open={editOpen}
        guardandoEdit={guardandoEdit}
        editNumero={editNumero}
        editTitulo={editTitulo}
        editNumeroOc={editNumeroOc}
        editNumeroSiaf={editNumeroSiaf}
        editDescripcion={editDescripcion}
        onClose={() => setEditOpen(false)}
        onGuardar={handleGuardarEdicion}
        onEditTituloChange={setEditTitulo}
        onEditNumeroOcChange={setEditNumeroOc}
        onEditNumeroSiafChange={setEditNumeroSiaf}
        onEditDescripcionChange={setEditDescripcion}
      />
    </Container>
  );
};

export default ExpedientesPage;
