import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
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
    <DialogTitle>{viewingDoc?.nombreOriginal || 'Cargando…'}</DialogTitle>
    <DialogContent sx={{ height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 0 }}>
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
