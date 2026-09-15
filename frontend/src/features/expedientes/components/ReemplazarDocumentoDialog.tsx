import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  alpha,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { esPdfLocal, formatBytes } from '../utils';

type ReemplazarDocumentoDialogProps = {
  open: boolean;
  reemplazandoDoc: boolean;
  replaceDocFile: File | null;
  replacePreviewUrl: string | null;
  onClose: () => void;
  onSubmit: () => void;
  onFileChange: (file: File | null) => void;
  onBrowseFile: () => void;
};

const ReemplazarDocumentoDialog: React.FC<ReemplazarDocumentoDialogProps> = ({
  open,
  reemplazandoDoc,
  replaceDocFile,
  replacePreviewUrl,
  onClose,
  onSubmit,
  onFileChange,
  onBrowseFile,
}) => (
  <Dialog
    open={open}
    onClose={() => !reemplazandoDoc && onClose()}
    maxWidth={replaceDocFile ? 'md' : 'sm'}
    fullWidth
    disableEnforceFocus
    disableRestoreFocus
  >
    <DialogTitle>Reemplazar documento (corrección)</DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Suba el archivo corregido. El documento actual se guardará como respaldo en el historial de versiones (original y correcciones) para que siempre pueda consultar qué se subió antes.
      </Typography>
      <Box
        onDragOver={(ev) => { ev.preventDefault(); }}
        onDrop={(ev) => {
          ev.preventDefault();
          const archivo = ev.dataTransfer.files?.[0];
          if (archivo) onFileChange(archivo);
        }}
        sx={{
          p: 2.5,
          borderRadius: 2.5,
          textAlign: 'center',
          border: `1.5px dashed ${alpha(IGSS_COLORS.azul, 0.45)}`,
          bgcolor: alpha(IGSS_COLORS.azul, 0.04),
          mb: 2,
        }}
      >
        <CloudUploadIcon sx={{ fontSize: 34, color: IGSS_COLORS.azulOscuro, mb: 0.5 }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro }}>
          {replaceDocFile ? replaceDocFile.name : 'Arrastre el archivo corregido aquí'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {replaceDocFile ? formatBytes(replaceDocFile.size) : 'También puede buscarlo en el equipo.'}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AttachFileIcon />}
          onClick={onBrowseFile}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {replaceDocFile ? 'Cambiar archivo' : 'Buscar en el equipo'}
        </Button>
      </Box>

      {replaceDocFile && (
        <Box
          sx={{
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            bgcolor: '#fff',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.06),
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
              Vista previa
            </Typography>
          </Box>
          {replacePreviewUrl ? (
            esPdfLocal(replaceDocFile) ? (
              <Box
                component="iframe"
                src={`${replacePreviewUrl}#toolbar=1`}
                title={replaceDocFile.name}
                sx={{ width: '100%', height: { xs: 360, sm: 480 }, border: 0, display: 'block', bgcolor: '#525659' }}
              />
            ) : (
              <Box sx={{ p: 2, display: 'grid', placeItems: 'center', bgcolor: IGSS_COLORS.fondo, maxHeight: 480, overflow: 'auto' }}>
                <Box
                  component="img"
                  src={replacePreviewUrl}
                  alt={replaceDocFile.name}
                  sx={{ maxWidth: '100%', maxHeight: 440, objectFit: 'contain', borderRadius: 1 }}
                />
              </Box>
            )
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Este tipo de archivo no se puede previsualizar aquí.
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={reemplazandoDoc}>Cancelar</Button>
      <Button variant="contained" onClick={onSubmit} disabled={reemplazandoDoc || !replaceDocFile}>
        {reemplazandoDoc ? 'Reemplazando…' : 'Reemplazar'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ReemplazarDocumentoDialog;
