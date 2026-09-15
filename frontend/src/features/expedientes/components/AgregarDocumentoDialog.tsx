import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  CloudUpload as CloudUploadIcon,
  DescriptionOutlined as DescriptionIcon,
} from '@mui/icons-material';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { TIPOS_DOCUMENTO } from '../constants';
import { esPdfLocal, formatBytes } from '../utils';

type AgregarDocumentoDialogProps = {
  open: boolean;
  subiendoDoc: boolean;
  docFile: File | null;
  docPreviewUrl: string | null;
  docTipo: string;
  docTipoOtro: string;
  docComentario: string;
  arrastrandoDoc: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDocTipoChange: (value: string) => void;
  onDocTipoOtroChange: (value: string) => void;
  onDocComentarioChange: (value: string) => void;
  onDocFileChange: (file: File | null) => void;
  onArrastrandoChange: (value: boolean) => void;
  onBrowseFile: () => void;
};

const AgregarDocumentoDialog: React.FC<AgregarDocumentoDialogProps> = ({
  open,
  subiendoDoc,
  docFile,
  docPreviewUrl,
  docTipo,
  docTipoOtro,
  docComentario,
  arrastrandoDoc,
  onClose,
  onSubmit,
  onDocTipoChange,
  onDocTipoOtroChange,
  onDocComentarioChange,
  onDocFileChange,
  onArrastrandoChange,
  onBrowseFile,
}) => (
  <Dialog
    open={open}
    onClose={() => !subiendoDoc && onClose()}
    maxWidth={docFile ? 'md' : 'sm'}
    fullWidth
    disableEnforceFocus
    disableRestoreFocus
  >
    <DialogTitle>Agregar documento al expediente</DialogTitle>
    <DialogContent>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Elija el tipo de documento. Si es un documento especial que se sube por primera vez, use «Otro» e indique el nombre abajo.
        </Typography>
        <TextField
          select
          label="Tipo / Título del documento"
          value={docTipo}
          onChange={(e) => { onDocTipoChange(e.target.value); if (e.target.value !== 'Otro') onDocTipoOtroChange(''); }}
          fullWidth
          size="small"
        >
          {TIPOS_DOCUMENTO.map((t) => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </TextField>
        {docTipo === 'Otro' && (
          <TextField
            label="Especifique el tipo de documento"
            placeholder="Ej. Certificación de bienes, Informe técnico"
            value={docTipoOtro}
            onChange={(e) => onDocTipoOtroChange(e.target.value)}
            fullWidth
            size="small"
          />
        )}
        <Box
          onDragOver={(ev) => { ev.preventDefault(); onArrastrandoChange(true); }}
          onDragLeave={() => onArrastrandoChange(false)}
          onDrop={(ev) => {
            ev.preventDefault();
            onArrastrandoChange(false);
            const archivo = ev.dataTransfer.files?.[0];
            if (archivo) onDocFileChange(archivo);
          }}
          sx={{
            p: 2.5,
            borderRadius: 2.5,
            textAlign: 'center',
            border: `1.5px dashed ${alpha(IGSS_COLORS.azul, arrastrandoDoc ? 0.9 : 0.45)}`,
            bgcolor: alpha(IGSS_COLORS.azul, arrastrandoDoc ? 0.1 : 0.04),
            transition: 'background-color .15s ease, border-color .15s ease',
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 34, color: IGSS_COLORS.azulOscuro, mb: 0.5 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro }}>
            {docFile ? docFile.name : 'Arrastre el archivo aquí'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {docFile
              ? formatBytes(docFile.size)
              : 'Es la forma más rápida: no abre el explorador de archivos.'}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AttachFileIcon />}
            onClick={onBrowseFile}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {docFile ? 'Cambiar archivo' : 'Buscar en el equipo'}
          </Button>
        </Box>

        {docFile && (
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                Vista previa
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Revise que sea el documento correcto antes de subir
              </Typography>
            </Box>
            {docPreviewUrl ? (
              esPdfLocal(docFile) ? (
                <Box
                  component="iframe"
                  src={`${docPreviewUrl}#toolbar=1`}
                  title={docFile.name}
                  sx={{ width: '100%', height: { xs: 360, sm: 480 }, border: 0, display: 'block', bgcolor: '#525659' }}
                />
              ) : (
                <Box sx={{ p: 2, display: 'grid', placeItems: 'center', bgcolor: IGSS_COLORS.fondo, maxHeight: 480, overflow: 'auto' }}>
                  <Box
                    component="img"
                    src={docPreviewUrl}
                    alt={docFile.name}
                    sx={{ maxWidth: '100%', maxHeight: 440, objectFit: 'contain', borderRadius: 1 }}
                  />
                </Box>
              )
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <DescriptionIcon sx={{ fontSize: 40, color: 'grey.400', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Este tipo de archivo ({docFile.name.split('.').pop()?.toUpperCase() || 'desconocido'}) no se puede previsualizar aquí.
                  Puede subirlo de todos modos si es el correcto.
                </Typography>
              </Box>
            )}
          </Box>
        )}

        <TextField
          label="Comentario (opcional)"
          value={docComentario}
          onChange={(e) => onDocComentarioChange(e.target.value)}
          multiline
          rows={2}
          fullWidth
        />
      </Box>
    </DialogContent>
    <DialogActions>
      <Button onClick={() => { onClose(); onDocFileChange(null); }} disabled={subiendoDoc}>Cancelar</Button>
      <Button variant="contained" onClick={onSubmit} disabled={subiendoDoc || !docFile}>
        {subiendoDoc ? 'Subiendo…' : 'Subir'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default AgregarDocumentoDialog;
