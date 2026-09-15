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
import { Add as AddIcon } from '@mui/icons-material';
import { primaryButtonSx } from '../../../theme/institutionalStyles';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { TITULOS_OPCIONES } from '../constants';

type ExpedienteCrearDialogProps = {
  open: boolean;
  creando: boolean;
  cargandoCorrelativo: boolean;
  siguienteCorrelativo: string | null;
  nuevoTitulo: string;
  nuevoNumeroOc: string;
  nuevoNumeroSiaf: string;
  nuevoDescripcion: string;
  onClose: () => void;
  onCrear: () => void;
  onNuevoTituloChange: (value: string) => void;
  onNuevoNumeroOcChange: (value: string) => void;
  onNuevoNumeroSiafChange: (value: string) => void;
  onNuevoDescripcionChange: (value: string) => void;
};

const ExpedienteCrearDialog: React.FC<ExpedienteCrearDialogProps> = ({
  open,
  creando,
  cargandoCorrelativo,
  siguienteCorrelativo,
  nuevoTitulo,
  nuevoNumeroOc,
  nuevoNumeroSiaf,
  nuevoDescripcion,
  onClose,
  onCrear,
  onNuevoTituloChange,
  onNuevoNumeroOcChange,
  onNuevoNumeroSiafChange,
  onNuevoDescripcionChange,
}) => (
  <Dialog
    open={open}
    onClose={() => !creando && onClose()}
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
          <AddIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, lineHeight: 1.3 }}>
            Nuevo expediente de compras
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            Complete los datos básicos. Luego podrá agregar los documentos del expediente.
          </Typography>
        </Box>
      </Box>
    </DialogTitle>
    <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 1 }}>
        <Box
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: '1px dashed',
            borderColor: alpha(IGSS_COLORS.azul, 0.45),
            bgcolor: alpha(IGSS_COLORS.azul, 0.05),
          }}
        >
          <Typography variant="caption" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Número de expediente a utilizar
          </Typography>
          {cargandoCorrelativo ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">Consultando correlativo…</Typography>
            </Box>
          ) : (
            <>
              <Typography variant="h5" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mt: 0.5, letterSpacing: 0.4 }}>
                {siguienteCorrelativo || 'Se asignará al crear'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {siguienteCorrelativo
                  ? 'Este será el número interno asignado al guardar el expediente.'
                  : 'El sistema asignará el siguiente correlativo disponible al crear el expediente.'}
              </Typography>
            </>
          )}
        </Box>
        <TextField
          label="Título"
          select
          value={nuevoTitulo}
          onChange={(ev) => onNuevoTituloChange(ev.target.value)}
          required
          fullWidth
          autoFocus
          helperText="Clasifique el expediente según el tipo de adquisición"
          InputLabelProps={{ shrink: true }}
        >
          {TITULOS_OPCIONES.map((t) => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Número de orden de compra (O.C.)"
          value={nuevoNumeroOc}
          onChange={(ev) => onNuevoNumeroOcChange(ev.target.value)}
          required
          fullWidth
          placeholder="Ej. 12345"
          helperText="Ingrese el número de la orden de compra asociada"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Número SIAF"
          value={nuevoNumeroSiaf}
          onChange={(ev) => onNuevoNumeroSiafChange(ev.target.value)}
          fullWidth
          placeholder="Ej. SIAF-44-2026"
          helperText="Opcional; se usa para identificar este caso en las estadísticas del piloto."
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Descripción"
          value={nuevoDescripcion}
          onChange={(ev) => onNuevoDescripcionChange(ev.target.value)}
          required
          multiline
          rows={3}
          fullWidth
          placeholder="Resumen breve del objeto del expediente"
          helperText="Describa el objeto del expediente"
          InputLabelProps={{ shrink: true }}
        />
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
      <Button
        onClick={onClose}
        disabled={creando}
        sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
      >
        Cancelar
      </Button>
      <Button
        variant="contained"
        onClick={onCrear}
        disabled={creando}
        startIcon={creando ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
        sx={{
          ...primaryButtonSx,
          bgcolor: IGSS_COLORS.azulOscuro,
          '&:hover': { bgcolor: IGSS_COLORS.azul },
          minWidth: 120,
        }}
      >
        {creando ? 'Creando…' : 'Crear expediente'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ExpedienteCrearDialog;
