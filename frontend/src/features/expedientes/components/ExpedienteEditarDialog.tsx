import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { primaryButtonSx } from '../../../theme/institutionalStyles';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { TITULOS_OPCIONES } from '../constants';

type ExpedienteEditarDialogProps = {
  open: boolean;
  guardandoEdit: boolean;
  editNumero: string;
  editTitulo: string;
  editNumeroOc: string;
  editNumeroSiaf: string;
  editDescripcion: string;
  onClose: () => void;
  onGuardar: () => void;
  onEditTituloChange: (value: string) => void;
  onEditNumeroOcChange: (value: string) => void;
  onEditNumeroSiafChange: (value: string) => void;
  onEditDescripcionChange: (value: string) => void;
};

const ExpedienteEditarDialog: React.FC<ExpedienteEditarDialogProps> = ({
  open,
  guardandoEdit,
  editNumero,
  editTitulo,
  editNumeroOc,
  editNumeroSiaf,
  editDescripcion,
  onClose,
  onGuardar,
  onEditTituloChange,
  onEditNumeroOcChange,
  onEditNumeroSiafChange,
  onEditDescripcionChange,
}) => (
  <Dialog
    open={open}
    onClose={() => !guardandoEdit && onClose()}
    maxWidth="sm"
    fullWidth
    PaperProps={{
      sx: {
        borderRadius: 3,
        overflow: 'hidden',
        border: `1px solid ${IGSS_COLORS.gris}`,
        boxShadow: `0 16px 40px ${alpha(IGSS_COLORS.azulOscuro, 0.18)}`,
      },
    }}
  >
    <DialogTitle
      sx={{
        px: 3,
        pt: 2.5,
        pb: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(IGSS_COLORS.azul, 0.04),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: IGSS_COLORS.azulOscuro,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <EditIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, lineHeight: 1.3 }}>
            Editar expediente
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            Actualice el título, la O.C. o la descripción del expediente.
          </Typography>
        </Box>
      </Box>
    </DialogTitle>
    <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 1 }}>
        <TextField
          label="Número de expediente"
          value={editNumero}
          fullWidth
          disabled
          InputLabelProps={{ shrink: true }}
          helperText="El número no se puede modificar"
        />
        <TextField
          label="Título"
          select
          value={editTitulo}
          onChange={(ev) => onEditTituloChange(ev.target.value)}
          required
          fullWidth
          InputLabelProps={{ shrink: true }}
        >
          {TITULOS_OPCIONES.map((t) => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Número de orden de compra (O.C.)"
          value={editNumeroOc}
          onChange={(ev) => onEditNumeroOcChange(ev.target.value)}
          required
          fullWidth
          placeholder="Ej. 12345"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Número SIAF"
          value={editNumeroSiaf}
          onChange={(ev) => onEditNumeroSiafChange(ev.target.value)}
          fullWidth
          placeholder="Ej. SIAF-44-2026"
          helperText="Opcional; permite relacionar el expediente con las mediciones del piloto."
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Descripción"
          value={editDescripcion}
          onChange={(ev) => onEditDescripcionChange(ev.target.value)}
          required
          multiline
          rows={3}
          fullWidth
          placeholder="Resumen breve del objeto del expediente"
          InputLabelProps={{ shrink: true }}
        />
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
      <Button
        onClick={onClose}
        disabled={guardandoEdit}
        sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
      >
        Cancelar
      </Button>
      <Button
        variant="contained"
        onClick={onGuardar}
        disabled={guardandoEdit}
        startIcon={guardandoEdit ? <CircularProgress size={16} color="inherit" /> : <EditIcon />}
        sx={{
          ...primaryButtonSx,
          bgcolor: IGSS_COLORS.azulOscuro,
          '&:hover': { bgcolor: IGSS_COLORS.azul },
          minWidth: 120,
        }}
      >
        {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ExpedienteEditarDialog;
