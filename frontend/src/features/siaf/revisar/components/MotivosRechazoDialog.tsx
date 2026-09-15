import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { MOTIVOS_RECHAZO_OPTS } from '../constants';
import type { MotivoRechazoDraft } from '../types';

type MotivosRechazoDialogProps = {
  open: boolean;
  motivosRechazo: MotivoRechazoDraft[];
  onClose: () => void;
  onAgregar: () => void;
  onQuitar: (index: number) => void;
  onActualizar: (index: number, field: 'categoria' | 'descripcion', value: string) => void;
  onConfirmar: () => void;
};

const MotivosRechazoDialog: React.FC<MotivosRechazoDialogProps> = ({
  open,
  motivosRechazo,
  onClose,
  onAgregar,
  onQuitar,
  onActualizar,
  onConfirmar,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Motivos del rechazo (Dirección Departamental)</DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Puede agregar varios motivos para esta misma revisión. Todos quedarán registrados en la bitácora como un solo rechazo.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {motivosRechazo.map((motivo, index) => (
          <Paper
            key={index}
            elevation={0}
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.5 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: '#c62828',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  mt: 0.15,
                }}
              >
                {index + 1}
              </Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ flex: 1, color: 'grey.800', mt: 0.35 }}>
                Motivo {index + 1}
              </Typography>
              {motivosRechazo.length > 1 && (
                <IconButton size="small" onClick={() => onQuitar(index)} color="error" aria-label="Quitar motivo">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel>Categoría</InputLabel>
              <Select
                value={motivo.categoria || ''}
                label="Categoría"
                onChange={(e) => onActualizar(index, 'categoria', e.target.value)}
              >
                {MOTIVOS_RECHAZO_OPTS.map((m) => (
                  <MenuItem key={m.valor} value={m.valor}>{m.etiqueta}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label="Qué debe corregirse"
              value={motivo.descripcion}
              onChange={(e) => onActualizar(index, 'descripcion', e.target.value)}
              placeholder="Describa el motivo con detalle..."
            />
          </Paper>
        ))}
      </Box>
      <Button startIcon={<AddIcon />} onClick={onAgregar} variant="outlined" size="small" sx={{ mt: 2, textTransform: 'none', fontWeight: 700 }}>
        Agregar otro motivo
      </Button>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}>
      <Button onClick={onClose} variant="outlined">Cancelar</Button>
      <Button onClick={onConfirmar} color="error" variant="contained" startIcon={<Close />}>Confirmar rechazo</Button>
    </DialogActions>
  </Dialog>
);

export default MotivosRechazoDialog;
