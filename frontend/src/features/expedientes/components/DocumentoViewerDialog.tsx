import React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  alpha,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import type { ViewingDoc } from '../types';

type DocumentoViewerDialogProps = {
  viewingDoc: ViewingDoc | null;
  loading: boolean;
  onClose: () => void;
  onDownload: () => void;
};

const DocumentoViewerDialog: React.FC<DocumentoViewerDialogProps> = ({
  viewingDoc,
  loading,
  onClose,
  onDownload,
}) => (
  <Dialog open={!!viewingDoc || loading} onClose={onClose} maxWidth="xl" fullWidth>
    <DialogTitle sx={{ pb: viewingDoc?.observaciones?.length ? 1 : undefined }}>
      {viewingDoc?.nombreOriginal || 'Cargando…'}
    </DialogTitle>
    {!!viewingDoc?.observaciones?.length && (
      <Box sx={{ px: 3, pb: 1.5 }}>
        <Alert
          severity="error"
          sx={{
            borderRadius: 2,
            borderLeft: `4px solid ${IGSS_COLORS.error}`,
            bgcolor: alpha(IGSS_COLORS.error, 0.06),
          }}
        >
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
            Observaciones a corregir ({viewingDoc.observaciones.length})
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {viewingDoc.observaciones.map((o, i) => (
              <li key={i}>
                <Typography variant="body2">
                  {o.comentario}
                  {o.pagina != null ? ` · pág. ${o.pagina}` : ''}
                  {o.tieneMarca ? ' · señalizado en el PDF' : ''}
                </Typography>
              </li>
            ))}
          </Box>
        </Alert>
      </Box>
    )}
    <DialogContent
      sx={{
        height: viewingDoc?.observaciones?.length ? '72vh' : '80vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 0,
      }}
    >
      {loading && (
        <Typography color="text.secondary">Cargando documento…</Typography>
      )}
      {viewingDoc?.url && !loading && (
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
              <Button variant="contained" startIcon={<DownloadIcon />} onClick={onDownload}>
                Descargar para abrir
              </Button>
            </Box>
          )}
        </>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cerrar</Button>
      {viewingDoc && (
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={onDownload}>
          Descargar
        </Button>
      )}
    </DialogActions>
  </Dialog>
);

export default DocumentoViewerDialog;
