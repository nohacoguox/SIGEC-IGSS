import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Place as PlaceIcon,
  Refresh as RefreshIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import api from '../../../api';
import { useNotification } from '../../../context/NotificationContext';
import PdfViewerWithClick from '../../../components/PdfViewerWithClick';
import type { VerMarcaData } from '../types';

export type VerMarcaRequest = {
  expedienteId: number;
  docId: number;
  nombreDocumento: string;
  mimeType: string;
  xPercent: number;
  yPercent: number;
  pagina?: number | null;
  comentario?: string;
  versionId?: number | null;
};

type VerMarcaDialogProps = {
  open: boolean;
  request: VerMarcaRequest | null;
  onClose: () => void;
};

const VerMarcaDialog: React.FC<VerMarcaDialogProps> = ({ open, request, onClose }) => {
  const { showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [data, setData] = useState<VerMarcaData | null>(null);
  const [esDocumentoReemplazado, setEsDocumentoReemplazado] = useState(false);
  const [, setMarkerPx] = useState<{ left: number; top: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const urlRef = useRef<string | null>(null);

  const revokeUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    revokeUrl();
    setUrl(null);
    setData(null);
    setEsDocumentoReemplazado(false);
    setMarkerPx(null);
    setLoadError(false);
    setZoom(1);
    setLoading(false);
    onClose();
  }, [onClose, revokeUrl]);

  useEffect(() => {
    if (!open || !request) return;

    const marcaData: VerMarcaData = {
      nombreDocumento: request.nombreDocumento,
      mimeType: request.mimeType,
      xPercent: request.xPercent,
      yPercent: request.yPercent,
      pagina: request.pagina ?? null,
      comentario: request.comentario ?? '',
    };
    setData(marcaData);
    revokeUrl();
    setUrl(null);
    setMarkerPx(null);
    setLoadError(false);
    setZoom(1);
    setLoading(true);

    const versionIdNum = request.versionId != null ? Number(request.versionId) : NaN;
    const usarVersionReemplazada = !Number.isNaN(versionIdNum) && versionIdNum > 0;
    setEsDocumentoReemplazado(usarVersionReemplazada);
    const fetchUrl = usarVersionReemplazada
      ? `/expedientes/${request.expedienteId}/documentos/${request.docId}/versiones/${versionIdNum}/archivo`
      : `/expedientes/${request.expedienteId}/documentos/${request.docId}/archivo`;

    let cancelled = false;
    api.get(fetchUrl, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        if (res.data instanceof Blob && res.data.size > 0) {
          const objectUrl = URL.createObjectURL(res.data);
          urlRef.current = objectUrl;
          setUrl(objectUrl);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        showError('No se pudo cargar el documento.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, request, revokeUrl, showError]);

  useEffect(() => () => { revokeUrl(); }, [revokeUrl]);

  const measurePosition = useCallback(() => {
    if (!data?.mimeType.startsWith('image/') || !containerRef.current || !imageRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const imgRect = imageRef.current.getBoundingClientRect();
    const left = (imgRect.left - containerRect.left) + (data.xPercent / 100) * imgRect.width;
    const top = (imgRect.top - containerRect.top) + (data.yPercent / 100) * imgRect.height;
    setMarkerPx({ left, top });
  }, [data?.xPercent, data?.yPercent, data?.mimeType]);

  useEffect(() => {
    if (!open || !data?.mimeType.startsWith('image/') || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => measurePosition());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, data?.mimeType, measurePosition]);

  useEffect(() => {
    if (!open || !url || !data?.mimeType.startsWith('image/')) return;
    const t = setTimeout(measurePosition, 150);
    return () => clearTimeout(t);
  }, [open, url, data?.mimeType, data?.xPercent, data?.yPercent, measurePosition]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth PaperProps={{ sx: { minHeight: '80vh', borderRadius: 2 } }}>
      <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1.5, bgcolor: 'grey.50' }}>
        Ver marca de rechazo — {data?.nombreDocumento ?? 'Documento'}
        {esDocumentoReemplazado && (
          <Typography component="span" variant="caption" color="info.main" sx={{ ml: 1, fontWeight: 600 }}>
            (documento reemplazado)
          </Typography>
        )}
        {data?.pagina != null && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            (Página {data.pagina})
          </Typography>
        )}
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '75vh' }}>
        {data?.comentario && (
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2"><strong>Motivo:</strong> {data.comentario}</Typography>
          </Box>
        )}
        {url && data && !loading && !loadError && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Tooltip title="Alejar">
              <span>
                <IconButton size="small" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} disabled={zoom <= 0.5} aria-label="Alejar">
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="caption" sx={{ minWidth: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</Typography>
            <Tooltip title="Acercar">
              <IconButton size="small" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))} disabled={zoom >= 2.5} aria-label="Acercar">
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setZoom(1)} aria-label="Restablecer zoom">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
        {loading ? (
          <Box sx={{ flex: 1, minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Cargando documento…</Typography>
          </Box>
        ) : loadError ? (
          <Box sx={{ flex: 1, minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Typography color="error" textAlign="center">No se pudo cargar el documento. Verifique que tenga acceso y que el archivo exista.</Typography>
          </Box>
        ) : url && data ? (
          <Box ref={containerRef} sx={{ flex: 1, position: 'relative', overflow: 'auto', minHeight: 360, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {data.mimeType.startsWith('image/') ? (
              <Box sx={{ display: 'inline-block', position: 'relative', transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease' }}>
                <img
                  ref={imageRef}
                  src={url}
                  alt={data.nombreDocumento}
                  style={{ maxWidth: '90%', maxHeight: '65vh', objectFit: 'contain', display: 'block' }}
                  onLoad={measurePosition}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${data.xPercent}%`,
                    top: `${data.yPercent}%`,
                    transform: 'translate(-50%, -100%)',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                  aria-label="Marca de rechazo"
                >
                  <PlaceIcon sx={{ fontSize: 48, color: 'error.main', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                </Box>
              </Box>
            ) : (data.mimeType === 'application/pdf' || data.nombreDocumento.toLowerCase().endsWith('.pdf')) ? (
              <Box sx={{ width: '100%', height: '100%', minHeight: 360, overflow: 'auto' }}>
                <PdfViewerWithClick
                  fileUrl={url}
                  marker={{
                    pageNumber: data.pagina != null ? data.pagina : 1,
                    xPercent: data.xPercent,
                    yPercent: data.yPercent,
                  }}
                  markerPageOnly
                  minHeight={360}
                  zoom={zoom}
                />
              </Box>
            ) : (
              <>
                <iframe
                  title={data.nombreDocumento}
                  src={url}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${data.xPercent}%`,
                    top: `${data.yPercent}%`,
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
        <Button onClick={handleClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default VerMarcaDialog;
