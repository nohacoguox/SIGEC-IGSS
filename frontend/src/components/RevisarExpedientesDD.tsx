import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Alert,
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
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Place as PlaceIcon,
  PushPin as PushPinIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import api from '../api';
import { useNotification } from '../context/NotificationContext';
import PdfViewerWithClick from './PdfViewerWithClick';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
} from '../theme/institutionalStyles';
import { IGSS_COLORS } from '../theme/institutionalColors';

const headerCellStyle = tableHeaderCellStyle;
const headerRowStyle = tableHeaderRowStyle;
const headerCellSx = tableHeaderCellSx;

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
  numeroOrdenCompra?: string | null;
  estado: string;
  fechaApertura: string;
  municipioOrigen?: string | null;
  unidadOrigen?: string | null;
  usuario?: { nombres?: string; apellidos?: string; unidadMedica?: string };
  /** Solo en lista "Revisados": última acción (aprobación/rechazo) hecha por el analista. */
  ultimaAccionPorMi?: { tipo: string; fecha?: string } | null;
};

type DocEnDetalle = {
  id: number;
  tipoDocumento: string;
  nombreArchivo: string;
  mimeType?: string;
  versionActualId?: number | null;
  enUltimoRechazo?: boolean;
};

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
  /** Varios motivos de rechazo por documento; puede incluir posición (marca en el documento). */
  const [rechazosPorDoc, setRechazosPorDoc] = useState<Record<number, Array<{ categoria: string; descripcion: string; pagina?: number | null; xPercent?: number | null; yPercent?: number | null }>>>({});
  /** Igual que SIAF: modo marcar + diálogo «Corrección en este punto» */
  const [modoMarcar, setModoMarcar] = useState(false);
  const [dialogNuevaMarca, setDialogNuevaMarca] = useState<{
    open: boolean;
    pagina: number;
    xPercent: number;
    yPercent: number;
    categoria: string;
    descripcion: string;
  } | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerImageRef = useRef<HTMLImageElement>(null);
  const [previewRechazoUrl, setPreviewRechazoUrl] = useState<string | null>(null);
  const [previewRechazoLoading, setPreviewRechazoLoading] = useState(false);
  const [previewRechazoNombre, setPreviewRechazoNombre] = useState<string>('');
  const [previewRechazoMime, setPreviewRechazoMime] = useState<string>('');
  const [enviando, setEnviando] = useState(false);
  const [verDetalleOpen, setVerDetalleOpen] = useState(false);
  const [verDetalleData, setVerDetalleData] = useState<{ expedienteId: number; numeroExpediente: string; titulo: string; descripcion: string | null; numeroOrdenCompra?: string | null; documentos: DocEnDetalle[] } | null>(null);

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
        numeroOrdenCompra: e.numeroOrdenCompra ?? null,
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
        numeroOrdenCompra: e.numeroOrdenCompra ?? null,
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
    setModoMarcar(false);
    setDialogNuevaMarca(null);
    setRechazarOpen(true);
  };

  type RechazoEntry = { categoria: string; descripcion: string; pagina?: number | null; xPercent?: number | null; yPercent?: number | null };
  const getRechazosForDoc = (docId: number): RechazoEntry[] => rechazosPorDoc[docId] || [];

  const agregarMotivoRechazo = (docId: number, pos?: { xPercent: number; yPercent: number; pagina?: number | null }, datos?: { categoria: string; descripcion: string }) => {
    const nueva: RechazoEntry = {
      categoria: datos?.categoria ?? '',
      descripcion: datos?.descripcion ?? '',
    };
    if (pos) {
      nueva.xPercent = pos.xPercent;
      nueva.yPercent = pos.yPercent;
      nueva.pagina = pos.pagina ?? null;
    }
    setRechazosPorDoc((prev) => ({
      ...prev,
      [docId]: [...(prev[docId] || []), nueva],
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

  /** Clic en el documento (imagen u overlay): abre el mismo diálogo de SIAF */
  const handleClickMarcarEnDocumento = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (docEnVistaId == null || !viewerContainerRef.current || !modoMarcar) return;
    const isImage = previewRechazoMime.startsWith('image/');
    const rect = isImage && viewerImageRef.current
      ? viewerImageRef.current.getBoundingClientRect()
      : viewerContainerRef.current.getBoundingClientRect();
    const xPercent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setModoMarcar(false);
    setDialogNuevaMarca({
      open: true,
      pagina: 1,
      xPercent,
      yPercent,
      categoria: '',
      descripcion: '',
    });
  };

  const handleClickMarcarPdf = (pageNumber: number, xPercent: number, yPercent: number) => {
    if (docEnVistaId == null) return;
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
    if (!dialogNuevaMarca || docEnVistaId == null) return;
    const desc = (dialogNuevaMarca.descripcion || '').trim();
    if (!desc) {
      showError('Escriba qué debe corregirse en este punto.');
      return;
    }
    agregarMotivoRechazo(
      docEnVistaId,
      {
        xPercent: dialogNuevaMarca.xPercent,
        yPercent: dialogNuevaMarca.yPercent,
        pagina: dialogNuevaMarca.pagina,
      },
      {
        categoria: dialogNuevaMarca.categoria || 'Otro',
        descripcion: desc,
      }
    );
    setDialogNuevaMarca(null);
    showSuccess('Marca de corrección agregada al documento.');
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
    setModoMarcar(false);
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
          versionActualId: d.versionActualId ?? null,
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
    const comentariosPorDocumento: Array<{ documentoId: number; documentoVersionId?: number; comentario: string; pagina?: number; xPercent?: number; yPercent?: number }> = [];
    rechazarDocumentos.forEach((d) => {
      const entradas = getRechazosForDoc(d.id);
      entradas.forEach((item) => {
        const cat = (item.categoria || '').trim();
        const desc = (item.descripcion || '').trim();
        if (cat || desc) {
          const texto = cat && desc ? `${cat}: ${desc}` : cat || desc;
          comentariosPorDocumento.push({
            documentoId: d.id,
            documentoVersionId: d.versionActualId ?? undefined,
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
        numeroOrdenCompra: e.numeroOrdenCompra ?? null,
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
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>O.C.</TableCell>
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
              <TableRow><TableCell colSpan={esRevisados ? 9 : 8} align="center" sx={{ py: 4 }}>Cargando…</TableCell></TableRow>
            ) : datosTabla.length === 0 ? (
              <TableRow>
                <TableCell colSpan={esRevisados ? 9 : 8} align="center" sx={{ py: 4 }}>
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
                  <TableCell sx={{ fontWeight: 600 }}>{e.numeroOrdenCompra || '—'}</TableCell>
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
                <Typography><strong>O.C.:</strong> {verDetalleData.numeroOrdenCompra || '—'}</Typography>
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
        onClose={() => { if (!enviando) { cerrarPreviewRechazo(); setModoMarcar(false); setDialogNuevaMarca(null); setRechazarOpen(false); setDocEnVistaId(null); } }}
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
        <DialogContent sx={{ pt: 2, pb: 2, flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, px: 0.5, flexShrink: 0 }}>
            <strong>Pasos:</strong> 1) En la lista de la derecha, haga clic en <strong>«Ver»</strong> para abrir cada documento a la izquierda. 2) Use <strong>Acercar / Alejar</strong> si lo necesita. 3) Active <strong>«Marcar corrección»</strong> y haga <strong>clic</strong> en el punto del documento; se abrirá el diálogo para indicar categoría y qué debe corregirse. 4) También puede agregar motivos desde la derecha. Todo queda en la bitácora.
          </Typography>
          {rechazarLoading ? (
            <Typography variant="body2" color="text.secondary">Cargando documentos…</Typography>
          ) : rechazarDocumentos.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No hay documentos en este expediente.</Typography>
          ) : (
            <Grid container spacing={2} sx={{ flex: 1, minHeight: { md: 0 }, height: { md: '100%' }, alignItems: 'stretch' }}>
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
                          variant={modoMarcar ? 'contained' : 'outlined'}
                          color={modoMarcar ? 'error' : 'primary'}
                          startIcon={<PlaceIcon />}
                          onClick={() => setModoMarcar((v) => !v)}
                          sx={{ ml: 0.5, textTransform: 'none', fontWeight: 600 }}
                        >
                          {modoMarcar ? 'Cancelar marcado' : 'Marcar corrección'}
                        </Button>
                      )}
                      {(previewRechazoUrl || previewRechazoLoading) && (
                        <Button size="small" onClick={cerrarPreviewRechazo} sx={{ ml: 0.5 }}>Cerrar vista</Button>
                      )}
                    </Box>
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
                          <Box
                            sx={{
                              transform: `scale(${viewerZoom})`,
                              transformOrigin: 'center center',
                              transition: 'transform 0.2s ease',
                              position: 'relative',
                              display: 'inline-block',
                              cursor: modoMarcar ? 'crosshair' : 'default',
                            }}
                            onClick={modoMarcar ? handleClickMarcarEnDocumento : undefined}
                          >
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
                                <PlaceIcon sx={{ fontSize: 40, color: 'error.main', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))' }} />
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </>
                    ) : previewRechazoUrl && (previewRechazoMime === 'application/pdf' || previewRechazoNombre.toLowerCase().endsWith('.pdf')) ? (
                      <PdfViewerWithClick
                        fileUrl={previewRechazoUrl}
                        enableClickMark={modoMarcar}
                        onClickOnPage={handleClickMarcarPdf}
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
                    ) : previewRechazoUrl ? (
                      <>
                        <iframe title={previewRechazoNombre} src={previewRechazoUrl} style={{ width: '100%', height: '100%', minHeight: 500, border: 'none' }} />
                        {modoMarcar && (
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
                              cursor: 'crosshair',
                            }}
                            onClick={handleClickMarcarEnDocumento}
                          >
                            <Typography variant="body2" sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 2, boxShadow: 2 }}>
                              Haga <strong>clic</strong> en el documento donde está el error
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
                </Box>
              </Grid>
              {/* Columna derecha: motivos de rechazo por documento (con scroll para ver todos) */}
              <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, alignSelf: 'stretch', maxHeight: { xs: '70vh', md: '100%' } }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2.5,
                    bgcolor: '#fff',
                    boxShadow: `0 4px 16px ${alpha('#000', 0.04)}`,
                  }}
                >
                  <Box sx={{ flexShrink: 0, px: 2, pt: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.03) }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Observación general (opcional)
                    </Typography>
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
                  <Box sx={{ px: 2, pt: 1.75, pb: 1, flexShrink: 0 }}>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, lineHeight: 1.2 }}>
                      Motivos por documento
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.4 }}>
                      Desplácese hacia abajo para ver todos los motivos. Marque en el documento o agregue motivos aquí.
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      flex: '1 1 auto',
                      minHeight: 0,
                      height: { xs: '42vh', md: 'auto' },
                      maxHeight: { xs: '48vh', md: 'calc(95vh - 260px)' },
                      overflowY: 'scroll',
                      overflowX: 'hidden',
                      px: 2,
                      pb: 2.5,
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehavior: 'contain',
                      scrollbarGutter: 'stable',
                      '&::-webkit-scrollbar': { width: 10 },
                      '&::-webkit-scrollbar-thumb': {
                        bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.35),
                        borderRadius: 8,
                      },
                      '&::-webkit-scrollbar-track': {
                        bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.06),
                        borderRadius: 8,
                      },
                    }}
                  >
                  {rechazarDocumentos.map((d) => {
                    const motivos = getRechazosForDoc(d.id);
                    const activo = docEnVistaId === d.id;
                    return (
                    <Paper
                      key={d.id}
                      elevation={0}
                      sx={{
                        p: 0,
                        border: '1px solid',
                        borderColor: activo ? IGSS_COLORS.azulOscuro : 'divider',
                        borderRadius: 2.5,
                        bgcolor: '#fff',
                        overflow: 'visible',
                        flexShrink: 0,
                        boxShadow: activo ? `0 0 0 2px ${alpha(IGSS_COLORS.azulOscuro, 0.18)}` : `0 2px 10px ${alpha('#000', 0.03)}`,
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 1.75,
                          py: 1.25,
                          bgcolor: activo ? alpha(IGSS_COLORS.azul, 0.08) : alpha(IGSS_COLORS.azulOscuro, 0.03),
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          borderLeft: activo ? `4px solid ${IGSS_COLORS.azulOscuro}` : '4px solid transparent',
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ color: IGSS_COLORS.azulOscuro }}>
                            {d.tipoDocumento || d.nombreArchivo}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.35, flexWrap: 'wrap' }}>
                            {d.enUltimoRechazo
                              ? <Chip size="small" label="Corregido" color="info" sx={{ height: 22, fontWeight: 700 }} />
                              : <Chip size="small" label="Nuevo" variant="outlined" sx={{ height: 22, fontWeight: 600 }} />}
                            {motivos.length > 0 && (
                              <Chip
                                size="small"
                                color="error"
                                label={`${motivos.length} motivo${motivos.length === 1 ? '' : 's'}`}
                                sx={{ height: 22, fontWeight: 700 }}
                              />
                            )}
                          </Box>
                        </Box>
                        <Tooltip title="Ver este documento a la izquierda">
                          <IconButton
                            size="small"
                            onClick={() => previsualizarDocEnRechazo(d.id, d.nombreArchivo, d.mimeType ?? '')}
                            sx={{
                              bgcolor: activo ? IGSS_COLORS.azulOscuro : alpha(IGSS_COLORS.azul, 0.12),
                              color: activo ? '#fff' : IGSS_COLORS.azulOscuro,
                              '&:hover': { bgcolor: IGSS_COLORS.azul },
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      <Box sx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {motivos.length === 0 ? (
                          <Box
                            sx={{
                              py: 2,
                              px: 1.5,
                              textAlign: 'center',
                              borderRadius: 2,
                              border: `1px dashed ${alpha(IGSS_COLORS.azul, 0.35)}`,
                              bgcolor: alpha(IGSS_COLORS.azul, 0.03),
                            }}
                          >
                            <PlaceIcon sx={{ color: 'error.main', fontSize: 28, mb: 0.5, opacity: 0.85 }} />
                            <Typography variant="body2" color="text.secondary">
                              Sin motivos. Marque en el documento o agregue uno abajo.
                            </Typography>
                          </Box>
                        ) : (
                          motivos.map((item, idx) => {
                            const marcado = item.xPercent != null || item.yPercent != null;
                            return (
                              <Paper
                                key={idx}
                                elevation={0}
                                sx={{
                                  p: 1.75,
                                  border: '1px solid',
                                  borderColor: marcado ? alpha('#c62828', 0.35) : 'divider',
                                  borderRadius: 2,
                                  bgcolor: marcado ? alpha('#c62828', 0.03) : alpha(IGSS_COLORS.fondo, 0.9),
                                  boxShadow: marcado ? `0 0 0 1px ${alpha('#c62828', 0.08)}` : 'none',
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
                                    {idx + 1}
                                  </Box>
                                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: 'grey.800' }}>
                                      Motivo {idx + 1}
                                    </Typography>
                                    {marcado && (
                                      <Chip
                                        size="small"
                                        icon={<PlaceIcon />}
                                        label={item.pagina != null ? `Pág. ${item.pagina}` : 'Marcado'}
                                        color="error"
                                        sx={{ height: 22, fontWeight: 700 }}
                                      />
                                    )}
                                  </Box>
                                  <Tooltip title="Quitar este motivo">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => quitarMotivoRechazo(d.id, idx)}
                                      aria-label="Quitar motivo"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                  <FormControl size="small" fullWidth>
                                    <InputLabel id={`categoria-${d.id}-${idx}`}>Categoría</InputLabel>
                                    <Select
                                      labelId={`categoria-${d.id}-${idx}`}
                                      label="Categoría"
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
                                    label="Qué debe corregirse"
                                    placeholder="Describa el problema con claridad…"
                                    value={item.descripcion}
                                    onChange={(e) => actualizarMotivoRechazo(d.id, idx, 'descripcion', e.target.value)}
                                    size="small"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                  />
                                  {marcado && (
                                    <TextField
                                      label="Página"
                                      type="number"
                                      inputProps={{ min: 1 }}
                                      value={item.pagina ?? ''}
                                      onChange={(e) => actualizarMotivoRechazo(d.id, idx, 'pagina', e.target.value ? parseInt(e.target.value, 10) : null)}
                                      size="small"
                                      sx={{ maxWidth: 140 }}
                                    />
                                  )}
                                </Box>
                              </Paper>
                            );
                          })
                        )}

                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => agregarMotivoRechazo(d.id)}
                          variant="outlined"
                          fullWidth
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            borderRadius: 2,
                            borderColor: alpha(IGSS_COLORS.azulOscuro, 0.35),
                            color: IGSS_COLORS.azulOscuro,
                            py: 0.85,
                          }}
                        >
                          {motivos.length === 0 ? 'Agregar motivo de rechazo' : 'Agregar otro motivo'}
                        </Button>
                      </Box>
                    </Paper>
                  ); })}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { cerrarPreviewRechazo(); setModoMarcar(false); setDialogNuevaMarca(null); setRechazarOpen(false); setDocEnVistaId(null); }} disabled={enviando}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={handleAprobarDesdeModal} disabled={enviando || rechazarLoading || tieneAlgunMotivoRechazo}>
            Aprobar expediente
          </Button>
          <Button variant="contained" color="error" onClick={handleRechazar} disabled={enviando || rechazarLoading}>Rechazar expediente</Button>
        </DialogActions>
      </Dialog>

      {/* Misma lógica que SIAF: diálogo al marcar un punto en el documento */}
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
                <MenuItem key={m} value={m}>{m}</MenuItem>
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
            placeholder="Ej.: Falta la firma del jefe de unidad en la página 1…"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogNuevaMarca(null)} variant="outlined">Cancelar</Button>
          <Button onClick={confirmarNuevaMarca} color="error" variant="contained" startIcon={<PushPinIcon />}>
            Guardar marca
          </Button>
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
