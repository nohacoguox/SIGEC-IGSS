import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Typography,
} from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import PdfViewerWithClick, { PdfMarker } from '../../../../components/PdfViewerWithClick';
import type { SiafMarcaBitacora } from '../../../../utils/siafBitacora';

type MarcasViewerDialogProps = {
  open: boolean;
  titulo: string;
  loading: boolean;
  fileUrl: string | null;
  marcas: SiafMarcaBitacora[];
  markers: PdfMarker[];
  onClose: () => void;
};

const MarcasViewerDialog: React.FC<MarcasViewerDialogProps> = ({
  open,
  titulo,
  loading,
  fileUrl,
  marcas,
  markers,
  onClose,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="xl"
    fullWidth
    PaperProps={{ sx: { maxHeight: '95vh' } }}
  >
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <PlaceIcon color="error" />
      {titulo || 'Marcas de corrección'}
    </DialogTitle>
    <DialogContent sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, overflow: 'hidden', minHeight: 480 }}>
      <Box
        sx={{
          flex: { xs: '1 1 auto', md: '1 1 62%' },
          minWidth: 0,
          height: { xs: '45vh', md: '70vh' },
          borderRight: { md: 1 },
          borderBottom: { xs: 1, md: 0 },
          borderColor: 'divider',
          overflow: 'auto',
          bgcolor: 'grey.100',
        }}
      >
        {loading || !fileUrl ? (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%" gap={1}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Cargando documento…
            </Typography>
          </Box>
        ) : (
          <PdfViewerWithClick fileUrl={fileUrl} markers={markers} minHeight={400} zoom={1} />
        )}
      </Box>
      <Box sx={{ flex: { xs: '1 1 auto', md: '0 0 38%' }, minWidth: 0, p: 2, overflow: 'auto', maxHeight: { xs: '40vh', md: '70vh' }, bgcolor: '#f4f7fa' }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          Correcciones señaladas ({marcas.length})
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {marcas.map((m, idx) => (
            <Paper key={m.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    bgcolor: '#c62828',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'grey.800' }}>
                    {m.descripcion || '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Página {m.pagina}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}>
      <Button onClick={onClose} variant="outlined">
        Cerrar
      </Button>
    </DialogActions>
  </Dialog>
);

export default MarcasViewerDialog;
