import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { AttachFile, Visibility } from '@mui/icons-material';
import type { SiafAdjunto } from '../types';

type AdjuntosListaDialogProps = {
  open: boolean;
  adjuntos: SiafAdjunto[] | undefined;
  onClose: () => void;
  onComparar: (adjunto: SiafAdjunto) => void;
  onDescargar: (adjunto: SiafAdjunto) => void;
};

const AdjuntosListaDialog: React.FC<AdjuntosListaDialogProps> = ({
  open,
  adjuntos,
  onClose,
  onComparar,
  onDescargar,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Documentos adjuntos del SIAF</DialogTitle>
    <DialogContent>
      {adjuntos?.length ? (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Tamaño</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {adjuntos.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.nombreOriginal}</TableCell>
                  <TableCell align="right">{((a.tamanioBytes || 0) / 1024).toFixed(1)} KB</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Comparar junto al SIAF">
                      <IconButton
                        size="small"
                        onClick={() => onComparar(a)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Descargar">
                      <IconButton
                        size="small"
                        onClick={() => onDescargar(a)}
                      >
                        <AttachFile />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="text.secondary">Sin documentos adjuntos.</Typography>
      )}
    </DialogContent>
  </Dialog>
);

export default AdjuntosListaDialog;
