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
import DownloadIcon from '@mui/icons-material/Download';
import type { ViewingDoc } from '../types';

type SiafAdjuntoViewerDialogProps = {
  open: boolean;
  viewingDoc: ViewingDoc | null;
  onClose: () => void;
  onDownload: (doc: ViewingDoc) => void;
};

const SiafAdjuntoViewerDialog: React.FC<SiafAdjuntoViewerDialogProps> = ({
  open,
  viewingDoc,
  onClose,
  onDownload,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
    <DialogTitle>{viewingDoc?.nombreOriginal || 'Visualizar Documento'}</DialogTitle>
    <DialogContent sx={{ height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 0 }}>
      {viewingDoc?.url && (
        <>
          {viewingDoc.mimeType === 'application/pdf' ||
          viewingDoc.nombreOriginal.toLowerCase().endsWith('.pdf') ? (
            <iframe
              src={`${viewingDoc.url}#toolbar=1`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={viewingDoc.nombreOriginal}
            />
          ) : viewingDoc.mimeType?.startsWith('image/') ||
            /\.(jpg|jpeg|png|gif|webp)$/i.test(viewingDoc.nombreOriginal) ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                p: 2,
              }}
            >
              <img
                src={viewingDoc.url}
                alt={viewingDoc.nombreOriginal}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </Box>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                No se puede visualizar este tipo de archivo
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Tipo: {viewingDoc.mimeType || 'desconocido'}
              </Typography>
              <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => onDownload(viewingDoc)}>
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
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => onDownload(viewingDoc)}>
          Descargar
        </Button>
      )}
    </DialogActions>
  </Dialog>
);

export default SiafAdjuntoViewerDialog;
