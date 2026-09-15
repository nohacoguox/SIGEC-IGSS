import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { SiafPdfDocument } from '../../../../components/SiafPdfDocument';
import type { SiafFormData } from '../types';

type SiafPreviewDialogProps = {
  open: boolean;
  isDraft: boolean;
  formData: SiafFormData;
  onClose: () => void;
  onCloseAndNavigate?: () => void;
};

const SiafPreviewDialog: React.FC<SiafPreviewDialogProps> = ({
  open,
  isDraft,
  formData,
  onClose,
  onCloseAndNavigate,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
    <DialogTitle>{isDraft ? 'Vista previa del SIAF (sin guardar)' : 'Previsualización de SIAF'}</DialogTitle>
    <DialogContent sx={{ height: '80vh' }}>
      {isDraft && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Esta es solo una vista de cómo va quedando. No se guarda ni se genera el correlativo definitivo.
        </Typography>
      )}
      <PDFViewer width="100%" height="100%">
        <SiafPdfDocument data={formData} />
      </PDFViewer>
    </DialogContent>
    <DialogActions>
      <Button
        onClick={() => {
          onClose();
          if (!isDraft && onCloseAndNavigate) onCloseAndNavigate();
        }}
      >
        Cerrar
      </Button>
      {!isDraft && (
        <PDFDownloadLink
          document={<SiafPdfDocument data={formData} />}
          fileName="SIAF-A-01.pdf"
          style={{ textDecoration: 'none' }}
        >
          {({ loading }) => (
            <Button color="primary" variant="contained" disabled={loading}>
              {loading ? 'Generando PDF...' : 'Descargar PDF'}
            </Button>
          )}
        </PDFDownloadLink>
      )}
    </DialogActions>
  </Dialog>
);

export default SiafPreviewDialog;
