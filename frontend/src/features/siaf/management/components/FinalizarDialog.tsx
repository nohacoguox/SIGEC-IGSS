import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import type { SiafActionTarget } from '../types';

type FinalizarDialogProps = {
  target: SiafActionTarget | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const FinalizarDialog: React.FC<FinalizarDialogProps> = ({ target, loading, onClose, onConfirm }) => (
  <Dialog open={target !== null} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Finalizar SIAF</DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary">
        El SIAF <strong>{target?.correlativo}</strong> se marcará como <strong>Finalizado</strong>.
        Este estado indica que está listo para continuar, aunque no se haya solicitado orientación a Dirección Departamental.
        Podrá editarlo posteriormente si necesita hacer algún ajuste.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={loading}>
        Cancelar
      </Button>
      <Button variant="contained" startIcon={<TaskAltIcon />} onClick={onConfirm} disabled={loading}>
        {loading ? 'Finalizando...' : 'Finalizar'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default FinalizarDialog;
