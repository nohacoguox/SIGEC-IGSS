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
import api from '../../../../api';
import type { ViewingDoc } from '../types';

type AdjuntoViewerDialogProps = {
  open: boolean;
  viewingDoc: ViewingDoc | null;
  onClose: () => void;
};

const AdjuntoViewerDialog: React.FC<AdjuntoViewerDialogProps> = ({ open, viewingDoc, onClose }) => {
  const handleClose = () => {
    if (viewingDoc?.url) window.URL.revokeObjectURL(viewingDoc.url);
    onClose();
  };

  const handleDownload = async () => {
    if (!viewingDoc) return;
    try {
      const res = await api.get(`/siaf/adjuntos/${viewingDoc.id}/descargar`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', viewingDoc.nombreOriginal);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
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
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownload}>
                  Descargar para abrir
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cerrar</Button>
        {viewingDoc && (
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownload}>
            Descargar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AdjuntoViewerDialog;
