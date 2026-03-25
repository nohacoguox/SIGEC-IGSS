import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add as AddIcon, History as HistoryIcon, Refresh as RefreshIcon, Remove as RemoveIcon, Visibility as VisibilityIcon, ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon } from '@mui/icons-material';
import api from '../api';
import { useNotification } from '../context/NotificationContext';
import PdfViewerWithClick from './PdfViewerWithClick';

const MOTIVOS_RECHAZO = [
  'Falta firma',
  'Fecha incorrecta o faltante',
  'Datos incompletos',
  'Documento ilegible',
  'No corresponde al tipo de documento',
  'Otro',
];

type MunicipioOption = { id: number; nombre: string };

type ExpedienteRevision = {
  id: number;
  numeroExpediente: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  fechaApertura: string;
  municipioOrigen?: string | null;
  unidadOrigen?: string | null;
  usuario?: { nombres?: string; apellidos?: string; unidadMedica?: string };
  /** Solo en lista "Revisados": última acción (aprobación/rechazo) hecha por el analista. */
  ultimaAccionPorMi?: { tipo: string; fecha?: string } | null;
};

type DocEnDetalle = { id: number; tipoDocumento: string; nombreArchivo: string; mimeType?: string; enUltimoRechazo?: boolean };

const headerCellStyle = { backgroundColor: '#0d47a1', color: '#ffffff' };
const headerRowStyle = { backgroundColor: '#0d47a1' };
const headerCellSx = { fontWeight: 700, fontSize: '0.9375rem', py: 2, borderBottom: 'none' };

const RevisarExpedientesDD: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [lista, setLista] = useState<ExpedienteRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ departamento: string; departamentoId: number | null } | null>(null);
  const [municipios, setMunicipios] = useState<MunicipioOption[]>([]);
  const [filtroMunicipioId, setFiltroMunicipioId] = useState<number | ''>('');
  const [rechazarOpen, setRechazarOpen] = useState(false);
  const [expIdRechazar, setExpIdRechazar] = useState<number | null>(null);
  const [comentarioRechazo, setComentarioRechazo] = useState('');
  const [rechazarDocumentos, setRechazarDocumentos] = useState<DocEnDetalle[]>([]);
  const [rechazarLoading, setRechazarLoading] = useState(false);
  /** Varios motivos de rechazo por documento; puede incluir posición (señal con clic derecho en el documento). */
  const [rechazosPorDoc, setRechazosPorDoc] = useState<Record<number, Array<{ categoria: string; descripcion: string; pagina?: number | null; xPercent?: number | null; yPercent?: number | null }>>>({});
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ xPercent: number; yPercent: number; pagina?: number } | null>(null);
  const [mostrarOverlaySeñalar, setMostrarOverlaySeñalar] = useState(false);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerImageRef = useRef<HTMLImageElement>(null);
  const [previewRechazoUrl, setPreviewRechazoUrl] = useState<string | null>(null);
  const [previewRechazoLoading, setPreviewRechazoLoading] = useState(false);
  const [previewRechazoNombre, setPreviewRechazoNombre] = useState<string>('');
  const [previewRechazoMime, setPreviewRechazoMime] = useState<string>('');
  const [enviando, setEnviando] = useState(false);
  const [verDetalleOpen, setVerDetalleOpen] = useState(false);
  const [verDetalleData, setVerDetalleData] = useState<{ expedienteId: number; numeroExpediente: string; titulo: string; descripcion: string | null; documentos: DocEnDetalle[] } | null>(null);

  const abrirBitacora = (expedienteId: number, titulo: string) => {
    setBitacoraExpId(expedienteId);
    setBitacoraTitulo(titulo);
    setBitacoraList([]);
    setBitacoraOpen(true);
    setBitacoraLoading(true);
    api.get(`/expedientes/${expedienteId}/bitacora`)
      .then((res) => setBitacoraList(Array.isArray(res.data) ? res.data : []))
      .catch(() => { showError('No se pudo cargar la bitácora.'); setBitacoraList([]); })
      .finally(() => setBitacoraLoading(false));
  };
  const [verDetalleLoading, setVerDetalleLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewNombre, setPreviewNombre] = useState<string>('');
  const [previewMime, setPreviewMime] = useState<string>('');
  const [docEnVistaId, setDocEnVistaId] = useState<number | null>(null);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [bitacoraExpId, setBitacoraExpId] = useState<number | null>(null);
  const [bitacoraTitulo, setBitacoraTitulo] = useState('');
  const [bitacoraList, setBitacoraList] = useState<Array<{
    id: number;
    tipo: string;
    fecha: string;
    comentario: string | null;
    usuario: { nombres?: string; apellidos?: string } | null;
    expedienteDocumentoId?: number | null;
    documentoReemplazo?: { nombreArchivo: string; mimeType: string };
    /** Versión que quedó como respaldo (el archivo que fue reemplazado). */
    documentoReemplazado?: { versionId: number; nombreArchivo: string; mimeType: string };
    detalle: Array<{ expedienteDocumentoId?: number; nombreDocumento: string; comentario: string; corregido?: boolean }>;
  }>>([]);
  const [bitacoraLoading, setBitacoraLoading] = useState(false);
  const [vistaRevision, setVistaRevision] = useState<'pendientes' | 'revisados'>('pendientes');
  const [listaRevisados, setListaRevisados] = useState<ExpedienteRevision[]>([]);
  const [loadingRevisados, setLoadingRevisados] = useState(false);

  const load = useCallback(async (municipioId?: number | '') => {
    setLoading(true);
    try {
      const params = municipioId !== undefined && municipioId !== '' ? { municipioId } : {};
      const res = await api.get('/expedientes/para-revision-departamental', { params });
      const data = res.data;
      const arr = Array.isArray(data) ? data : (data?.expedientes ?? []);
      setLista(arr.map((e: any) => ({
        id: e.id,
        numeroExpediente: e.numeroExpediente ?? '',
        titulo: e.titulo ?? '',
        descripcion: e.descripcion ?? null,
        estado: e.estado ?? '',
        fechaApertura: e.fechaApertura ?? e.createdAt ?? '',
        municipioOrigen: e.municipioOrigen ?? null,
        unidadOrigen: e.unidadOrigen ?? null,
        usuario: e.usuario,
      })));
      if (data && !Array.isArray(data) && data.meta) {
        setMeta({ departamento: data.meta.departamento ?? '', departamentoId: data.meta.departamentoId ?? null });
      } else {
        setMeta(null);
      }
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al cargar expedientes.');
      setLista([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadRevisados = useCallback(async () => {
    setLoadingRevisados(true);
    try {
      const res = await api.get('/expedientes/revisados-departamental');
      const data = res.data;
      const arr = Array.isArray(data?.expedientes) ? data.expedientes : [];
      setListaRevisados(arr.map((e: any) => ({
        id: e.id,
        numeroExpediente: e.numeroExpediente ?? '',
        titulo: e.titulo ?? '',
        descripcion: e.descripcion ?? null,
        estado: e.estado ?? '',
        fechaApertura: e.fechaApertura ?? e.createdAt ?? '',
        municipioOrigen: e.municipioOrigen ?? null,
        unidadOrigen: e.unidadOrigen ?? null,
        usuario: e.usuario,
        ultimaAccionPorMi: e.ultimaAccionPorMi ?? null,
      })));
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al cargar expedientes revisados.');
      setListaRevisados([]);
    } finally {
      setLoadingRevisados(false);
    }
  }, [showError]);

  useEffect(() => {
    load(filtroMunicipioId);
  }, [load, filtroMunicipioId]);

  useEffect(() => {
    if (vistaRevision === 'revisados') loadRevisados();
  }, [vistaRevision, loadRevisados]);

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

  const handleAprobar = async (id: number) => {
    setEnviando(true);
    try {
      await api.post(`/expedientes/${id}/aprobar`);
      showSuccess('Expediente aprobado.');
      load(filtroMunicipioId);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al aprobar.');
    } finally {
      setEnviando(false);
    }
  };

  const abrirRechazar = (id: number) => {
    setExpIdRechazar(id);
    setComentarioRechazo('');
    setRechazosPorDoc({});
    setPreviewRechazoUrl(null);
    setRechazarDocumentos([]);
    setRechazarOpen(true);
  };

  type RechazoEntry = { categoria: string; descripcion: string; pagina?: number | null; xPercent?: number | null; yPercent?: number | null };
  const getRechazosForDoc = (docId: number): RechazoEntry[] => rechazosPorDoc[docId] || [];

  const agregarMotivoRechazo = (docId: number, pos?: { xPercent: number; yPercent: number; pagina?: number | null }) => {
    const nueva: RechazoEntry = { categoria: '', descripcion: '' };
    if (pos) {
      nueva.xPercent = pos.xPercent;
      nueva.yPercent = pos.yPercent;
      nueva.pagina = pos.pagina ?? null;
    }
    setRechazosPorDoc((prev) => ({
      ...prev,
      [docId]: [...getRechazosForDoc(docId), nueva],
    }));
  };

  const quitarMotivoRechazo = (docId: number, index: number) => {
    setRechazosPorDoc((prev) => ({
      ...prev,
      [docId]: getRechazosForDoc(docId).filter((_, i) => i !== index),
    }));
  };

  const actualizarMotivoRechazo = (docId: number, index: number, field: 'categoria' | 'descripcion' | 'pagina', value: string | number | null) => {
    setRechazosPorDoc((prev) => {
      const arr = getRechazosForDoc(docId).map((item, i) => (i === index ? { ...item, [field]: value } : item));
      return { ...prev, [docId]: arr };
    });
  };

  const handleContextMenuEnDocumento = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (docEnVistaId == null || !viewerContainerRef.current) return;
    // Posición relativa al contenido del documento (imagen) para que "Ver marca" sea exacta
    const isImage = previewRechazoMime.startsWith('image/');
    const rect = isImage && viewerImageRef.current
      ? viewerImageRef.current.getBoundingClientRect()
      : viewerContainerRef.current.getBoundingClientRect();
    const xPercent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setContextMenuPosition({ xPercent, yPercent });
    setContextMenuAnchor({ x: e.clientX, y: e.clientY });
  };

  const cerrarMenuContexto = () => {
    setContextMenuAnchor(null);
    setContextMenuPosition(null);
  };

  const confirmarAgregarRechazoDesdeSeñal = () => {
    if (docEnVistaId != null && contextMenuPosition) {
      agregarMotivoRechazo(docEnVistaId, contextMenuPosition);
      cerrarMenuContexto();
      setMostrarOverlaySeñalar(false);
    }
  };

  const previsualizarDocEnRechazo = async (docId: number, nombre: string, mimeType: string) => {
    if (expIdRechazar == null) return;
    setDocEnVistaId(docId);
    if (previewRechazoUrl) URL.revokeObjectURL(previewRechazoUrl);
    setPreviewRechazoUrl(null);
    setPreviewRechazoNombre(nombre);
    setPreviewRechazoMime(mimeType || 'application/octet-stream');
    setPreviewRechazoLoading(true);
    try {
      const res = await api.get(`/expedientes/${expIdRechazar}/documentos/${docId}/archivo`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setPreviewRechazoUrl(url);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'No se pudo cargar el documento.');
    } finally {
      setPreviewRechazoLoading(false);
    }
  };

  const resetViewerZoom = () => setViewerZoom(1);

  const cerrarPreviewRechazo = () => {
    if (previewRechazoUrl) URL.revokeObjectURL(previewRechazoUrl);
    setPreviewRechazoUrl(null);
    setViewerZoom(1);
  };

  useEffect(() => {
    if (!rechazarOpen || expIdRechazar == null) return;
    setRechazarLoading(true);
    setDocEnVistaId(null);
    api.get(`/expedientes/${expIdRechazar}`)
      .then((res) => {
        const docs = (res.data.documentos || []).map((d: any) => ({
          id: d.id,
          tipoDocumento: d.tipoDocumento ?? '',
          nombreArchivo: d.nombreArchivo ?? '',
          mimeType: d.mimeType ?? 'application/octet-stream',
          enUltimoRechazo: !!d.enUltimoRechazo,
        }));
        setRechazarDocumentos(docs);
      })
      .catch(() => setRechazarDocumentos([]))
      .finally(() => setRechazarLoading(false));
  }, [rechazarOpen, expIdRechazar]);

  const tieneAlgunMotivoRechazo = rechazarDocumentos.some((d) => getRechazosForDoc(d.id).length > 0);

  const handleAprobarDesdeModal = async () => {
    if (expIdRechazar == null) return;
    setEnviando(true);
    try {
      await api.post(`/expedientes/${expIdRechazar}/aprobar`, { comentario: (comentarioRechazo || '').trim() || undefined });
      showSuccess('Expediente aprobado.');
      setRechazarOpen(false);
      setExpIdRechazar(null);
      setComentarioRechazo('');
      setRechazosPorDoc({});
      cerrarPreviewRechazo();
      load(filtroMunicipioId);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al aprobar.');
    } finally {
      setEnviando(false);
    }
  };

  const handleRechazar = async () => {
    if (expIdRechazar == null) return;
    const comentariosPorDocumento: Array<{ documentoId: number; comentario: string; pagina?: number; xPercent?: number; yPercent?: number }> = [];
    rechazarDocumentos.forEach((d) => {
      const entradas = getRechazosForDoc(d.id);
      entradas.forEach((item) => {
        const cat = (item.categoria || '').trim();
        const desc = (item.descripcion || '').trim();
        if (cat || desc) {
          const texto = cat && desc ? `${cat}: ${desc}` : cat || desc;
          comentariosPorDocumento.push({
            documentoId: d.id,
            comentario: texto,
            pagina: item.pagina != null ? item.pagina : undefined,
            xPercent: item.xPercent != null ? item.xPercent : undefined,
            yPercent: item.yPercent != null ? item.yPercent : undefined,
          });
        }
      });
    });
    const tieneAlgo = (comentarioRechazo || '').trim() || comentariosPorDocumento.length > 0;
    if (!tieneAlgo) {
      showError('Indique al menos un comentario general o agregue al menos un motivo/categoría en algún documento.');
      return;
    }
    setEnviando(true);
    try {
      await api.post(`/expedientes/${expIdRechazar}/rechazar`, {
        comentario: comentarioRechazo.trim() || undefined,
        comentariosPorDocumento: comentariosPorDocumento.length ? comentariosPorDocumento : undefined,
      });
      showSuccess('Expediente rechazado. El creador verá los motivos por documento en la bitácora.');
      setRechazarOpen(false);
      setExpIdRechazar(null);
      setComentarioRechazo('');
      setRechazosPorDoc({});
      cerrarPreviewRechazo();
      load(filtroMunicipioId);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al rechazar.');
    } finally {
      setEnviando(false);
    }
  };

  const nombreSolicitante = (e: ExpedienteRevision) => {
    const u = e.usuario;
    if (!u) return '—';
    return [u.nombres, u.apellidos].filter(Boolean).join(' ') || '—';
  };

  const abrirVerDetalle = async (id: number) => {
    setVerDetalleOpen(true);
    setVerDetalleData(null);
    setVerDetalleLoading(true);
    try {
      const res = await api.get(`/expedientes/${id}`);
      const e = res.data;
      setVerDetalleData({
        expedienteId: id,
        numeroExpediente: e.numeroExpediente ?? '',
        titulo: e.titulo ?? '',
        descripcion: e.descripcion ?? null,
        documentos: (e.documentos || []).map((d: any) => ({
          id: d.id,
          tipoDocumento: d.tipoDocumento ?? '',
          nombreArchivo: d.nombreArchivo ?? '',
          mimeType: d.mimeType ?? 'application/octet-stream',
          enUltimoRechazo: !!d.enUltimoRechazo,
        })),
      });
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al cargar detalle.');
      setVerDetalleOpen(false);
    } finally {
      setVerDetalleLoading(false);
    }
  };

  const abrirDocumento = async (expedienteId: number, docId: number, nombreArchivo: string, mimeType: string) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewNombre(nombreArchivo);
    setPreviewMime(mimeType || 'application/octet-stream');
    setPreviewLoading(true);
    try {
      const res = await api.get(`/expedientes/${expedienteId}/documentos/${docId}/archivo`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'No se pudo cargar el documento.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const cerrarPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewNombre('');
    setPreviewMime('');
  };

  const origenDisplay = (e: ExpedienteRevision) => {
    const texto = (e.municipioOrigen || e.unidadOrigen || (e.usuario as any)?.unidadMedica || '').trim();
    return texto || '—';
  };

  const abrirDocumentoBitacora = (expedienteId: number, docId: number) => {
    api.get(`/expedientes/${expedienteId}/documentos/${docId}/archivo`, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data], { type: res.data.type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
      })
      .catch((err: any) => showError(err?.response?.data?.message || 'No se pudo abrir el documento.'));
  };

  const abrirVersionReemplazadaBitacora = (expedienteId: number, docId: number, versionId: number) => {
    api.get(`/expedientes/${expedienteId}/documentos/${docId}/versiones/${versionId}/archivo`, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data], { type: res.data.type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
      })
      .catch((err: any) => showError(err?.response?.data?.message || 'No se pudo abrir el documento reemplazado.'));
  };

  const esRevisados = vistaRevision === 'revisados';
  const datosTabla = esRevisados ? listaRevisados : lista;
  const cargandoTabla = esRevisados ? loadingRevisados : loading;

  return (
    <Box>
      <Typography variant="h5" fontWeight="700" color="primary.main" sx={{ mb: 0.5 }}>
        Revisión por Dirección Departamental
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {esRevisados
          ? 'Expedientes que usted ya aprobó o rechazó. Puede ver detalle y bitácora.'
          : <>Expedientes pendientes de su revisión. Use <strong>Ver</strong> para revisar documentos, <strong>Aprobar</strong> o <strong>Rechazar</strong> con motivos por documento.</>}
      </Typography>
      <Tabs value={vistaRevision} onChange={(_, v) => setVistaRevision(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label="Pendientes" value="pendientes" />
        <Tab label="Revisados" value="revisados" />
      </Tabs>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
        {!esRevisados && meta?.departamentoId != null && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="filtro-municipio-exp-label">Filtrar por municipio</InputLabel>
            <Select
              labelId="filtro-municipio-exp-label"
              id="filtro-municipio-exp"
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
        )}
        <Button
          startIcon={<RefreshIcon />}
          onClick={() => (esRevisados ? loadRevisados() : load(filtroMunicipioId))}
          disabled={cargandoTabla}
          variant="outlined"
        >
          Recargar
        </Button>
      </Box>
      <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow style={headerRowStyle}>
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Número</TableCell>
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Título</TableCell>
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Descripción</TableCell>
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Origen</TableCell>
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Solicitante</TableCell>
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Fecha</TableCell>
              {esRevisados && (
                <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Estado</TableCell>
              )}
              <TableCell align="center" sx={{ ...headerCellSx, textAlign: 'center' }} style={headerCellStyle}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cargandoTabla ? (
              <TableRow><TableCell colSpan={esRevisados ? 8 : 7} align="center" sx={{ py: 4 }}>Cargando…</TableCell></TableRow>
            ) : datosTabla.length === 0 ? (
              <TableRow>
                <TableCell colSpan={esRevisados ? 8 : 7} align="center" sx={{ py: 4 }}>
                  {esRevisados ? 'No hay expedientes revisados por usted.' : 'No hay expedientes pendientes de revisión.'}
                </TableCell>
              </TableRow>
            ) : (
              datosTabla.map((e, idx) => (
                <TableRow
                  key={e.id}
                  sx={{
                    bgcolor: idx % 2 === 1 ? 'action.hover' : 'background.paper',
                    '& td': { py: 1.5, borderColor: 'divider' },
                  }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{e.numeroExpediente}</TableCell>
                  <TableCell>{e.titulo}</TableCell>
                  <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.descripcion || undefined}>{e.descripcion || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 180 }} title={origenDisplay(e)}>{origenDisplay(e)}</TableCell>
                  <TableCell>{nombreSolicitante(e)}</TableCell>
                  <TableCell>{typeof e.fechaApertura === 'string' ? e.fechaApertura.split('T')[0] : ''}</TableCell>
                  {esRevisados && (
                    <TableCell>
                      {e.ultimaAccionPorMi?.tipo === 'aprobacion' ? (
                        <Chip size="small" label="Aprobado" color="success" />
                      ) : e.ultimaAccionPorMi?.tipo === 'rechazo' ? (
                        <Chip size="small" label="Rechazado" color="error" />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  )}
                  <TableCell align="center">
                    {!esRevisados ? (
                      <>
                        <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => abrirRechazar(e.id)} disabled={enviando} sx={{ mr: 1, textTransform: 'none' }}>
                          Revisar Expediente
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={() => abrirBitacora(e.id, `Bitácora — Expediente ${e.numeroExpediente}`)} sx={{ textTransform: 'none' }}>
                          Revisar Bitácora
                        </Button>
                      </>
                    ) : (
                      <Tooltip title="Ver bitácora">
                        <IconButton size="small" onClick={() => abrirBitacora(e.id, `Bitácora — Expediente ${e.numeroExpediente}`)}>
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={verDetalleOpen}
        onClose={() => { cerrarPreview(); setVerDetalleOpen(false); }}
        maxWidth={previewUrl ? 'lg' : 'sm'}
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <span>Detalle del expediente</span>
          {verDetalleData && (
            <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={() => abrirBitacora(verDetalleData.expedienteId, `Bitácora — Expediente ${verDetalleData.numeroExpediente}`)} sx={{ textTransform: 'none' }}>
              Ver bitácora
            </Button>
          )}
        </DialogTitle>
        <DialogContent>
          {verDetalleLoading && <Typography color="text.secondary">Cargando…</Typography>}
          {verDetalleData && !verDetalleLoading && (
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography><strong>Número:</strong> {verDetalleData.numeroExpediente}</Typography>
                <Typography><strong>Título:</strong> {verDetalleData.titulo}</Typography>
                <Typography><strong>Descripción:</strong> {verDetalleData.descripcion || '—'}</Typography>
              </Box>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Documentos adjuntos ({verDetalleData.documentos.length})</Typography>
              {verDetalleData.documentos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Sin documentos.</Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 2, listStyle: 'none' }}>
                  {verDetalleData.documentos.map((d) => (
                    <Box
                      key={d.id}
                      component="li"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        py: 0.75,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <Typography variant="body2">{d.tipoDocumento || d.nombreArchivo}</Typography>
                      <Tooltip title="Previsualizar aquí">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => abrirDocumento(verDetalleData.expedienteId, d.id, d.nombreArchivo, d.mimeType ?? '')}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Box>
              )}
              {previewLoading && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Cargando documento…</Typography>
              )}
              {previewUrl && !previewLoading && (
                <Box sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: 'grey.100' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, bgcolor: 'grey.200' }}>
                    <Typography variant="subtitle2">{previewNombre}</Typography>
                    <Button size="small" onClick={cerrarPreview}>Cerrar previsualización</Button>
                  </Box>
                  <Box sx={{ height: 480, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 1 }}>
                    {previewMime.startsWith('image/') ? (
                      <img src={previewUrl} alt={previewNombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <iframe
                        title={previewNombre}
                        src={previewUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                      />
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { cerrarPreview(); setVerDetalleOpen(false); }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={rechazarOpen}
        onClose={() => { if (!enviando) { cerrarPreviewRechazo(); setRechazarOpen(false); setDocEnVistaId(null); } }}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { minHeight: '88vh', maxHeight: '95vh', borderRadius: 2, display: 'flex', flexDirection: 'column' } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1.5, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
          <span>Revisar expediente</span>
          {expIdRechazar != null && (
            <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={() => abrirBitacora(expIdRechazar, `Bitácora — Expediente ${lista.find((e) => e.id === expIdRechazar)?.numeroExpediente ?? expIdRechazar}`)} sx={{ textTransform: 'none' }}>
              Ver bitácora
            </Button>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, pb: 2, flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, px: 0.5, flexShrink: 0 }}>
            <strong>Pasos:</strong> 1) En la lista de la derecha, haga clic en <strong>«Ver»</strong> para abrir cada documento a la izquierda. 2) Use <strong>Acercar / Alejar</strong> si lo necesita. 3) Opcional: active «Señalar error» y haga <strong>clic derecho</strong> en el punto del documento donde está el problema. 4) A la derecha, agregue al menos un <strong>motivo y descripción</strong> por documento. Todo queda registrado en la bitácora.
          </Typography>
          {rechazarLoading ? (
            <Typography variant="body2" color="text.secondary">Cargando documentos…</Typography>
          ) : rechazarDocumentos.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No hay documentos en este expediente.</Typography>
          ) : (
            <Grid container spacing={2} sx={{ flex: 1, minHeight: 0, overflow: 'hidden', alignItems: 'stretch' }}>
              {/* Columna izquierda: visor del documento (solo esta zona hace scroll) */}
              <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="subtitle2" fontWeight="600" color="text.primary">
                      {previewRechazoLoading ? 'Cargando…' : previewRechazoNombre || 'Seleccione un documento con «Ver»'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {(previewRechazoUrl || previewRechazoLoading) && (
                        <>
                          <Tooltip title="Alejar">
                            <span>
                              <IconButton size="small" onClick={() => setViewerZoom((z) => Math.max(0.5, z - 0.25))} disabled={viewerZoom <= 0.5} aria-label="Alejar">
                                <ZoomOutIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Typography variant="caption" sx={{ minWidth: 44, textAlign: 'center' }}>{Math.round(viewerZoom * 100)}%</Typography>
                          <Tooltip title="Acercar">
                            <IconButton size="small" onClick={() => setViewerZoom((z) => Math.min(2.5, z + 0.25))} disabled={viewerZoom >= 2.5} aria-label="Acercar">
                              <ZoomInIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Restablecer zoom">
                            <IconButton size="small" onClick={resetViewerZoom} aria-label="Restablecer zoom">
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {(previewRechazoUrl || previewRechazoLoading) && docEnVistaId != null && (
                        <Button
                          size="small"
                          variant={mostrarOverlaySeñalar ? 'contained' : 'outlined'}
                          color="primary"
                          onClick={() => setMostrarOverlaySeñalar((v) => !v)}
                          sx={{ ml: 0.5 }}
                        >
                          {mostrarOverlaySeñalar ? 'Cancelar señalar' : 'Señalar error (clic derecho)'}
                        </Button>
                      )}
                      {(previewRechazoUrl || previewRechazoLoading) && (
                        <Button size="small" onClick={cerrarPreviewRechazo} sx={{ ml: 0.5 }}>Cerrar vista</Button>
                      )}
                    </Box>
                  </Box>
                  <Box
                    ref={viewerContainerRef}
                    sx={{
                      flex: 1,
                      minHeight: 360,
                      height: '58vh',
                      maxHeight: '58vh',
                      display: 'block',
                      p: 1,
                      position: 'relative',
                      overflowY: 'scroll',
                      overflowX: 'auto',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    {previewRechazoLoading ? (
                      <Typography variant="body2" color="text.secondary">Cargando documento…</Typography>
                    ) : previewRechazoUrl && previewRechazoMime.startsWith('image/') ? (
                      <>
                        <Box sx={{ overflow: 'auto', maxWidth: '100%', maxHeight: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <Box sx={{ transform: `scale(${viewerZoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease', position: 'relative', display: 'inline-block' }}>
                            <img ref={viewerImageRef} src={previewRechazoUrl} alt={previewRechazoNombre} style={{ maxWidth: '80vw', maxHeight: '70vh', objectFit: 'contain', display: 'block' }} />
                            {docEnVistaId != null && getRechazosForDoc(docEnVistaId).filter((m) => m.xPercent != null || m.yPercent != null).map((m, idx) => (
                              <Box
                                key={idx}
                                aria-label="Marca de rechazo"
                                sx={{
                                  position: 'absolute',
                                  left: `${m.xPercent ?? 0}%`,
                                  top: `${m.yPercent ?? 0}%`,
                                  transform: 'translate(-50%, -100%)',
                                  pointerEvents: 'none',
                                  zIndex: 10,
                                }}
                              >
                                <Box component="svg" viewBox="0 0 24 24" width={48} height={48} sx={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))', display: 'block' }}>
                                  <path fill="#d32f2f" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                        {mostrarOverlaySeñalar && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              bgcolor: 'rgba(0,0,0,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'context-menu',
                              pointerEvents: 'auto',
                            }}
                            onContextMenu={handleContextMenuEnDocumento}
                          >
                            <Typography variant="body2" sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 2, boxShadow: 2 }}>
                              Haga <strong>clic derecho</strong> donde está el error → «Agregar rechazo aquí»
                            </Typography>
                          </Box>
                        )}
                      </>
                    ) : previewRechazoUrl && (previewRechazoMime === 'application/pdf' || previewRechazoNombre.toLowerCase().endsWith('.pdf')) ? (
                      <>
                        {mostrarOverlaySeñalar && (
                          <Typography variant="body2" sx={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', bgcolor: 'background.paper', p: 1.5, borderRadius: 2, boxShadow: 2, zIndex: 2 }}>
                            Haga <strong>clic derecho</strong> en la página del PDF donde está el error → «Agregar rechazo aquí»
                          </Typography>
                        )}
                        <PdfViewerWithClick
                          fileUrl={previewRechazoUrl}
                          enableContextMenu={mostrarOverlaySeñalar}
                          onContextMenuOnPage={(pageNumber, xPercent, yPercent, e) => {
                            setContextMenuPosition({ xPercent, yPercent, pagina: pageNumber });
                            setContextMenuAnchor({ x: e.clientX, y: e.clientY });
                          }}
                          markers={docEnVistaId != null
                            ? getRechazosForDoc(docEnVistaId)
                                .filter((m) => m.xPercent != null || m.yPercent != null)
                                .map((m) => ({
                                  pageNumber: m.pagina != null ? m.pagina : 1,
                                  xPercent: m.xPercent ?? 0,
                                  yPercent: m.yPercent ?? 0,
                                }))
                            : null}
                          minHeight={520}
                          zoom={viewerZoom}
                        />
                      </>
                    ) : previewRechazoUrl ? (
                      <>
                        <iframe title={previewRechazoNombre} src={previewRechazoUrl} style={{ width: '100%', height: '100%', minHeight: 500, border: 'none' }} />
                        {mostrarOverlaySeñalar && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              bgcolor: 'rgba(0,0,0,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'context-menu',
                            }}
                            onContextMenu={handleContextMenuEnDocumento}
                          >
                            <Typography variant="body2" sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 2, boxShadow: 2 }}>
                              Haga <strong>clic derecho</strong> en el documento donde está el error → elegir «Agregar rechazo aquí»
                            </Typography>
                          </Box>
                        )}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ px: 2 }}>
                        Haga clic en «Ver» en cualquier documento de la lista de la derecha para leerlo aquí mientras indica el rechazo.
                      </Typography>
                    )}
                  </Box>
                  <Menu
                    open={contextMenuAnchor !== null}
                    onClose={cerrarMenuContexto}
                    anchorReference="anchorPosition"
                    anchorPosition={contextMenuAnchor ? { left: contextMenuAnchor.x, top: contextMenuAnchor.y } : undefined}
                  >
                    <MenuItem onClick={confirmarAgregarRechazoDesdeSeñal}>Agregar rechazo aquí</MenuItem>
                  </Menu>
                </Box>
              </Grid>
              {/* Columna derecha: motivos de rechazo por documento (con scroll para ver todos) */}
              <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, bgcolor: 'grey.50' }}>
                  <Box sx={{ flexShrink: 0, mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Observación (opcional)</Typography>
                    <TextField
                      value={comentarioRechazo}
                      onChange={(e) => setComentarioRechazo(e.target.value)}
                      placeholder="Ej. Revisar todos los documentos antes de reenviar."
                      multiline
                      rows={2}
                      fullWidth
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="subtitle2" fontWeight="600" color="text.primary" sx={{ mb: 0.5, flexShrink: 0 }}>
                    Motivos por documento
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', flexShrink: 0 }}>
                    Puede agregar motivo de rechazo por documento. Si agrega al menos uno, el botón «Aprobar expediente» se deshabilitará.
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0, maxHeight: '55vh', overflowY: 'scroll', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
                  {rechazarDocumentos.map((d) => {
                    const motivos = getRechazosForDoc(d.id);
                    return (
                    <Box
                      key={d.id}
                      sx={{
                        p: 1.5,
                        border: '2px solid',
                        borderColor: docEnVistaId === d.id ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        bgcolor: docEnVistaId === d.id ? 'action.hover' : 'background.paper',
                        transition: 'border-color 0.2s, background-color 0.2s',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight="600">{d.tipoDocumento || d.nombreArchivo}</Typography>
                        {d.enUltimoRechazo ? <Chip size="small" label="Corregido" color="info" sx={{ fontWeight: 600 }} /> : <Chip size="small" label="Nuevo" color="default" variant="outlined" />}
                        <Tooltip title="Ver este documento a la izquierda">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => previsualizarDocEnRechazo(d.id, d.nombreArchivo, d.mimeType ?? '')}
                            sx={{ bgcolor: docEnVistaId === d.id ? 'primary.light' : undefined }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      {motivos.map((item, idx) => (
                        <Box key={idx} sx={{ mb: idx < motivos.length - 1 ? 1.5 : 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {motivos.length > 1 && (
                              <Tooltip title="Quitar este motivo">
                                <IconButton size="small" color="error" onClick={() => quitarMotivoRechazo(d.id, idx)} aria-label="Quitar motivo">
                                  <RemoveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Typography variant="caption" color="text.secondary">Motivo {idx + 1}</Typography>
                          </Box>
                          <FormControl size="small" fullWidth sx={{ mb: 0.5 }}>
                            <InputLabel id={`categoria-${d.id}-${idx}`}>Categoría de rechazo</InputLabel>
                            <Select
                              labelId={`categoria-${d.id}-${idx}`}
                              label="Categoría de rechazo"
                              value={item.categoria}
                              onChange={(e) => actualizarMotivoRechazo(d.id, idx, 'categoria', e.target.value)}
                            >
                              <MenuItem value="">— Ninguna —</MenuItem>
                              {MOTIVOS_RECHAZO.map((m) => (
                                <MenuItem key={m} value={m}>{m}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <TextField
                            label="Descripción del problema"
                            placeholder="Ej. Página 2, falta firma"
                            value={item.descripcion}
                            onChange={(e) => actualizarMotivoRechazo(d.id, idx, 'descripcion', e.target.value)}
                            size="small"
                            fullWidth
                            multiline
                            minRows={1}
                          />
                          {(item.xPercent != null || item.yPercent != null) && (
                            <TextField
                              label="Página (opcional)"
                              placeholder="Ej. 3"
                              type="number"
                              inputProps={{ min: 1 }}
                              value={item.pagina ?? ''}
                              onChange={(e) => actualizarMotivoRechazo(d.id, idx, 'pagina', e.target.value ? parseInt(e.target.value, 10) : null)}
                              size="small"
                              sx={{ maxWidth: 120 }}
                            />
                          )}
                        </Box>
                      ))}
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => agregarMotivoRechazo(d.id)}
                        variant="outlined"
                        sx={{ mt: 1 }}
                      >
                        {motivos.length === 0 ? 'Agregar motivo de rechazo' : 'Agregar otro motivo'}
                      </Button>
                    </Box>
                  ); })}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { cerrarPreviewRechazo(); setRechazarOpen(false); setDocEnVistaId(null); }} disabled={enviando}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={handleAprobarDesdeModal} disabled={enviando || rechazarLoading || tieneAlgunMotivoRechazo}>
            Aprobar expediente
          </Button>
          <Button variant="contained" color="error" onClick={handleRechazar} disabled={enviando || rechazarLoading}>Rechazar expediente</Button>
        </DialogActions>
      </Dialog>

      {/* Bitácora (analista DAF) */}
      <Dialog open={bitacoraOpen} onClose={() => { setBitacoraOpen(false); setBitacoraExpId(null); }} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 2, maxWidth: 960 } }}>
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 2, bgcolor: 'grey.50' }}>
          {bitacoraTitulo}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {bitacoraLoading ? (
            <Box display="flex" alignItems="center" gap={2} py={4}>
              <CircularProgress size={24} />
              <Typography color="text.secondary">Cargando bitácora…</Typography>
            </Box>
          ) : bitacoraList.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>No hay registros en la bitácora.</Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Historial de rechazos (motivo y observaciones por documento), aprobaciones y reemplazos de documento. En cada reemplazo se muestra el texto «documento X reemplazado por Y» y puede usar <strong>Ver documento actual</strong> para abrir el archivo actual. Los documentos rechazados que ya fueron corregidos se marcan con <Chip size="small" label="Corregido" color="info" sx={{ verticalAlign: 'middle' }} />.
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
                          <Box>
                            {(b.comentario || '').trim() && (
                              <Typography variant="body2" sx={{ mb: (b.detalle?.length || b.tipo === 'correccion') ? 1 : 0 }}>{b.comentario}</Typography>
                            )}
                            {b.tipo === 'correccion' && bitacoraExpId != null && b.expedienteDocumentoId != null && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<VisibilityIcon />}
                                  onClick={() => abrirDocumentoBitacora(bitacoraExpId, b.expedienteDocumentoId!)}
                                >
                                  Ver documento actual{b.documentoReemplazo?.nombreArchivo ? `: ${b.documentoReemplazo.nombreArchivo}` : ''}
                                </Button>
                                {b.documentoReemplazado != null && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<VisibilityIcon />}
                                    onClick={() => abrirVersionReemplazadaBitacora(bitacoraExpId, b.expedienteDocumentoId!, b.documentoReemplazado!.versionId)}
                                  >
                                    Ver documento reemplazado{b.documentoReemplazado.nombreArchivo ? `: ${b.documentoReemplazado.nombreArchivo}` : ''}
                                  </Button>
                                )}
                              </Box>
                            )}
                            {b.detalle && b.detalle.length > 0 && (
                              <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { marginBottom: 8 } }}>
                                {b.detalle.map((d: any, i: number) => (
                                  <li key={i}>
                                    <Typography variant="body2" component="span">
                                      <strong>{d.nombreDocumento}</strong>: {d.comentario}
                                      {d.corregido && <Chip size="small" label="Corregido" color="info" sx={{ ml: 0.5, verticalAlign: 'middle', fontWeight: 600 }} />}
                                    </Typography>
                                  </li>
                                ))}
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
          <Button onClick={() => { setBitacoraOpen(false); setBitacoraExpId(null); }}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RevisarExpedientesDD;
