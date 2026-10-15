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
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { ARCHIVO_PAQUETE_ACEPTADO } from '../constants';
import { formatBytes } from '../utils';

type ReemplazarPaqueteDialogProps = {
  open: boolean;
  cargando: boolean;
  file: File | null;
  tieneCategorizados: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFileChange: (file: File | null) => void;
};

const ReemplazarPaqueteDialog: React.FC<ReemplazarPaqueteDialogProps> = ({
  open,
  cargando,
  file,
  tieneCategorizados,
  onClose,
  onSubmit,
  onFileChange,
}) => (
  <Dialog open={open} onClose={() => !cargando && onClose()} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ fontWeight: 800, color: IGSS_COLORS.azulOscuro }}>
      Reemplazar PDF completo y re-categorizar
    </DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Suba el nuevo PDF completo del expediente. Luego podrá marcar de nuevo los rangos de páginas
        (O.C., ACTA, Contrato, etc.).
      </Typography>

      {tieneCategorizados && (
        <Box
          sx={{
            display: 'flex',
            gap: 1.25,
            alignItems: 'flex-start',
            p: 1.75,
            mb: 2,
            borderRadius: 2,
            bgcolor: alpha('#ED6C02', 0.08),
            border: `1px solid ${alpha('#ED6C02', 0.35)}`,
          }}
        >
          <WarningIcon sx={{ color: '#ED6C02', mt: 0.15 }} fontSize="small" />
          <Typography variant="body2" sx={{ color: 'grey.800' }}>
            Se <strong>eliminarán</strong> los documentos ya categorizados de este expediente. El PDF
            anterior del paquete queda en el historial de versiones.
          </Typography>
        </Box>
      )}

      <Box
        onDragOver={(ev) => ev.preventDefault()}
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
          bgcolor: file ? alpha(IGSS_COLORS.verde, 0.08) : alpha(IGSS_COLORS.azul, 0.04),
        }}
      >
        <CloudUploadIcon sx={{ fontSize: 34, color: IGSS_COLORS.azulOscuro, mb: 0.5 }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro }}>
          {file ? file.name : 'Arrastre el PDF completo aquí'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {file ? formatBytes(file.size) : 'Solo PDF · también puede buscarlo en el equipo'}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          component="label"
          startIcon={<AttachFileIcon />}
          disabled={cargando}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Elegir PDF
          <input
            type="file"
            hidden
            accept={ARCHIVO_PAQUETE_ACEPTADO}
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
        </Button>
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2.5 }}>
      <Button onClick={onClose} disabled={cargando} sx={{ textTransform: 'none' }}>
        Cancelar
      </Button>
      <Button
        variant="contained"
        onClick={onSubmit}
        disabled={cargando || !file}
        sx={{
          textTransform: 'none',
          fontWeight: 700,
          bgcolor: IGSS_COLORS.azulOscuro,
          '&:hover': { bgcolor: IGSS_COLORS.azul },
        }}
      >
        {cargando ? 'Subiendo…' : 'Reemplazar y categorizar'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ReemplazarPaqueteDialog;
