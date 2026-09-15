import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  Place as PlaceIcon,
  PushPin as PushPinIcon,
} from '@mui/icons-material';
import { MOTIVOS_RECHAZO } from '../constants';
import type { DialogNuevaMarcaState } from '../types';

export type NuevaMarcaCorreccionDialogProps = {
  dialogNuevaMarca: DialogNuevaMarcaState | null;
  onChange: (next: DialogNuevaMarcaState | null | ((prev: DialogNuevaMarcaState | null) => DialogNuevaMarcaState | null)) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const NuevaMarcaCorreccionDialog: React.FC<NuevaMarcaCorreccionDialogProps> = ({
  dialogNuevaMarca,
  onChange,
  onClose,
  onConfirm,
}) => (
  <Dialog
    open={!!dialogNuevaMarca?.open}
    onClose={onClose}
    maxWidth="sm"
    fullWidth
  >
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <PlaceIcon color="error" />
      Corrección en este punto
    </DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Página {dialogNuevaMarca?.pagina ?? 1} · posición marcada en el documento. Indique qué debe corregir el solicitante.
      </Typography>
      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
        <InputLabel>Categoría</InputLabel>
        <Select
          value={dialogNuevaMarca?.categoria || ''}
          label="Categoría"
          onChange={(e) => onChange((prev) => prev ? { ...prev, categoria: e.target.value } : prev)}
        >
          {MOTIVOS_RECHAZO.map((m) => (
            <MenuItem key={m} value={m}>{m}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        autoFocus
        fullWidth
        size="small"
        multiline
        rows={3}
        label="Qué debe corregirse"
        value={dialogNuevaMarca?.descripcion || ''}
        onChange={(e) => onChange((prev) => prev ? { ...prev, descripcion: e.target.value } : prev)}
        placeholder="Ej.: Falta la firma del jefe de unidad en la página 1…"
      />
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}>
      <Button onClick={onClose} variant="outlined">Cancelar</Button>
      <Button onClick={onConfirm} color="error" variant="contained" startIcon={<PushPinIcon />}>
        Guardar marca
      </Button>
    </DialogActions>
  </Dialog>
);

export default NuevaMarcaCorreccionDialog;
