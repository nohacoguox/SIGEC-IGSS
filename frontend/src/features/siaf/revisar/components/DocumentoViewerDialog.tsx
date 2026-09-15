import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import type { ViewingDoc } from '../types';

type DocumentoViewerDialogProps = {
  open: boolean;
  viewingDoc: ViewingDoc | null;
  onClose: () => void;
};

/** Visor local de adjunto (imagen o PDF/iframe). Extraído del flujo DD sin cambiar UI. */
const DocumentoViewerDialog: React.FC<DocumentoViewerDialogProps> = ({
  open,
  viewingDoc,
  onClose,
}) => {
  if (!open || !viewingDoc?.url) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{viewingDoc.nombreOriginal}</DialogTitle>
      <DialogContent>
        {viewingDoc.mimeType?.startsWith('image/') ? (
          <img src={viewingDoc.url} alt={viewingDoc.nombreOriginal} style={{ maxWidth: '100%', height: 'auto' }} />
        ) : (
          <iframe title={viewingDoc.nombreOriginal} src={viewingDoc.url} width="100%" height="600" style={{ border: 'none' }} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentoViewerDialog;
