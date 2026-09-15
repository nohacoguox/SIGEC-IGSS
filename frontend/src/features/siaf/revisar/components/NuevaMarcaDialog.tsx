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
import { Place as PlaceIcon, PushPin as PushPinIcon } from '@mui/icons-material';
import { MOTIVOS_RECHAZO_OPTS } from '../constants';
import type { DialogNuevaMarcaState } from '../types';

type NuevaMarcaDialogProps = {
  dialogNuevaMarca: DialogNuevaMarcaState | null;
  onClose: () => void;
  onChange: (patch: Partial<DialogNuevaMarcaState>) => void;
  onConfirmar: () => void;
};

const NuevaMarcaDialog: React.FC<NuevaMarcaDialogProps> = ({
  dialogNuevaMarca,
  onClose,
  onChange,
  onConfirmar,
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
          onChange={(e) => onChange({ categoria: e.target.value })}
        >
          {MOTIVOS_RECHAZO_OPTS.map((m) => (
            <MenuItem key={m.valor} value={m.valor}>{m.etiqueta}</MenuItem>
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
        onChange={(e) => onChange({ descripcion: e.target.value })}
        placeholder="Ej.: La cantidad del ítem no coincide con la justificación…"
      />
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}>
      <Button onClick={onClose} variant="outlined">Cancelar</Button>
      <Button onClick={onConfirmar} color="error" variant="contained" startIcon={<PushPinIcon />}>
        Guardar marca
      </Button>
    </DialogActions>
  </Dialog>
);

export default NuevaMarcaDialog;
