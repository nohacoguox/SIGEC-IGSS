import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import api from '../../../api';
import { useNotification } from '../../../context/NotificationContext';
import type {
  BitacoraListEntry,
  DialogNuevaMarcaState,
  DocEnDetalle,
  ExpedienteRevision,
  MunicipioOption,
  RechazoEntry,
  VerDetalleData,
} from './types';
import {
  mapDocEnDetalle,
  mapExpedienteRevision,
  mapExpedienteRevisado,
} from './utils';
import RevisionListaTable from './components/RevisionListaTable';
import RevisionRechazarDialog from './components/RevisionRechazarDialog';
import NuevaMarcaCorreccionDialog from './components/NuevaMarcaCorreccionDialog';
import BitacoraDialog from './components/BitacoraDialog';

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
  const [rechazosPorDoc, setRechazosPorDoc] = useState<Record<number, Array<RechazoEntry>>>({});
  /** Igual que SIAF: modo marcar + diálogo «Corrección en este punto» */
  const [modoMarcar, setModoMarcar] = useState(false);
  const [dialogNuevaMarca, setDialogNuevaMarca] = useState<DialogNuevaMarcaState | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null!);
  const viewerImageRef = useRef<HTMLImageElement>(null!);
  const [previewRechazoUrl, setPreviewRechazoUrl] = useState<string | null>(null);
  const [previewRechazoLoading, setPreviewRechazoLoading] = useState(false);
  const [previewRechazoNombre, setPreviewRechazoNombre] = useState<string>('');
  const [previewRechazoMime, setPreviewRechazoMime] = useState<string>('');
  const [enviando, setEnviando] = useState(false);
  const [verDetalleOpen, setVerDetalleOpen] = useState(false);
  const [verDetalleData, setVerDetalleData] = useState<VerDetalleData | null>(null);

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
  const [bitacoraList, setBitacoraList] = useState<BitacoraListEntry[]>([]);
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
      setLista(arr.map((e: any) => mapExpedienteRevision(e)));
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
      setListaRevisados(arr.map((e: any) => mapExpedienteRevisado(e)));
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
        const docs = (res.data.documentos || []).map((d: any) => mapDocEnDetalle(d));
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

  const cerrarRechazarDialog = () => {
    cerrarPreviewRechazo();
    setModoMarcar(false);
    setDialogNuevaMarca(null);
    setRechazarOpen(false);
    setDocEnVistaId(null);
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

      <RevisionListaTable
        esRevisados={esRevisados}
        datosTabla={datosTabla}
        cargandoTabla={cargandoTabla}
        enviando={enviando}
        onRevisar={abrirRechazar}
        onBitacora={abrirBitacora}
      />

      {/* Ver detalle: código muerto (abrirVerDetalle nunca llamado); se deja en el orquestador. */}
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

      <RevisionRechazarDialog
        open={rechazarOpen}
        enviando={enviando}
        expIdRechazar={expIdRechazar}
        rechazarLoading={rechazarLoading}
        rechazarDocumentos={rechazarDocumentos}
        comentarioRechazo={comentarioRechazo}
        onComentarioRechazoChange={setComentarioRechazo}
        getRechazosForDoc={getRechazosForDoc}
        tieneAlgunMotivoRechazo={tieneAlgunMotivoRechazo}
        docEnVistaId={docEnVistaId}
        previewRechazoUrl={previewRechazoUrl}
        previewRechazoLoading={previewRechazoLoading}
        previewRechazoNombre={previewRechazoNombre}
        previewRechazoMime={previewRechazoMime}
        viewerZoom={viewerZoom}
        setViewerZoom={setViewerZoom}
        resetViewerZoom={resetViewerZoom}
        modoMarcar={modoMarcar}
        setModoMarcar={setModoMarcar}
        viewerContainerRef={viewerContainerRef}
        viewerImageRef={viewerImageRef}
        onClose={cerrarRechazarDialog}
        onAbrirBitacora={() => expIdRechazar != null && abrirBitacora(expIdRechazar, `Bitácora — Expediente ${lista.find((e) => e.id === expIdRechazar)?.numeroExpediente ?? expIdRechazar}`)}
        onPrevisualizarDoc={previsualizarDocEnRechazo}
        onCerrarPreview={cerrarPreviewRechazo}
        onClickMarcarEnDocumento={handleClickMarcarEnDocumento}
        onClickMarcarPdf={handleClickMarcarPdf}
        onAgregarMotivo={(docId) => agregarMotivoRechazo(docId)}
        onQuitarMotivo={quitarMotivoRechazo}
        onActualizarMotivo={actualizarMotivoRechazo}
        onAprobar={handleAprobarDesdeModal}
        onRechazar={handleRechazar}
      />

      <NuevaMarcaCorreccionDialog
        dialogNuevaMarca={dialogNuevaMarca}
        onChange={setDialogNuevaMarca}
        onClose={() => setDialogNuevaMarca(null)}
        onConfirm={confirmarNuevaMarca}
      />

      <BitacoraDialog
        open={bitacoraOpen}
        titulo={bitacoraTitulo}
        loading={bitacoraLoading}
        entries={bitacoraList}
        expedienteId={bitacoraExpId}
        onClose={() => { setBitacoraOpen(false); setBitacoraExpId(null); }}
        onAbrirDocumento={abrirDocumentoBitacora}
        onAbrirVersion={abrirVersionReemplazadaBitacora}
      />
    </Box>
  );
};

export default RevisarExpedientesDD;
