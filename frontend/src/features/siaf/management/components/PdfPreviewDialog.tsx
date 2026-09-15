import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { PDFViewer } from '@react-pdf/renderer';
import { SiafPdfDocument } from '../../../../components/SiafPdfDocument';

type PdfPreviewDialogProps = {
  open: boolean;
  siafData: any;
  onClose: () => void;
};

const PdfPreviewDialog: React.FC<PdfPreviewDialogProps> = ({ open, siafData, onClose }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
    <DialogTitle>Previsualización de SIAF</DialogTitle>
    <DialogContent sx={{ height: '80vh' }}>
      {siafData && (
        <PDFViewer width="100%" height="100%">
          <SiafPdfDocument data={siafData} />
        </PDFViewer>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cerrar</Button>
    </DialogActions>
  </Dialog>
);

export default PdfPreviewDialog;
