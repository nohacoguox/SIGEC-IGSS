import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

type ConfirmarEliminarDocDialogProps = {
  open: boolean;
  nombreDocumento?: string | null;
  eliminando: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const ConfirmarEliminarDocDialog: React.FC<ConfirmarEliminarDocDialogProps> = ({
  open,
  nombreDocumento,
  eliminando,
  onClose,
  onConfirm,
}) => (
  <Dialog open={open} onClose={() => !eliminando && onClose()}>
    <DialogTitle>Eliminar documento</DialogTitle>
    <DialogContent>
      <Typography>
        ¿Eliminar el documento «{nombreDocumento}»? Esta acción no se puede deshacer.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancelar</Button>
      <Button variant="contained" color="error" onClick={onConfirm} disabled={eliminando}>
        {eliminando ? 'Eliminando…' : 'Eliminar'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmarEliminarDocDialog;
