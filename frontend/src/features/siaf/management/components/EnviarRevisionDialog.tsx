import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import type { SiafActionTarget } from '../types';

type EnviarRevisionDialogProps = {
  target: SiafActionTarget | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const EnviarRevisionDialog: React.FC<EnviarRevisionDialogProps> = ({
  target,
  loading,
  onClose,
  onConfirm,
}) => (
  <Dialog open={target !== null} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Enviar a revisión</DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary">
        El SIAF <strong>{target?.correlativo}</strong> pasará a Dirección Departamental para su revisión.
        Mientras esté en revisión no podrá enviarlo de nuevo.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={loading}>
        Cancelar
      </Button>
      <Button variant="contained" startIcon={<SendIcon />} onClick={onConfirm} disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default EnviarRevisionDialog;
