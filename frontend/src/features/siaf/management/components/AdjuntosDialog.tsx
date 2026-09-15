import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
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
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import api from '../../../../api';
import type { AdjuntoRow, ViewingDoc } from '../types';

type AdjuntosDialogProps = {
  open: boolean;
  loading: boolean;
  adjuntosList: AdjuntoRow[];
  onClose: () => void;
  onViewDoc: (doc: ViewingDoc) => void;
  onError: (message: string) => void;
};

const AdjuntosDialog: React.FC<AdjuntosDialogProps> = ({
  open,
  loading,
  adjuntosList,
  onClose,
  onViewDoc,
  onError,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Documentos adjuntos del SIAF</DialogTitle>
    <DialogContent>
      {loading ? (
        <Typography color="text.secondary">Cargando...</Typography>
      ) : adjuntosList.length === 0 ? (
        <Typography color="text.secondary">No hay documentos adjuntos.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Tamaño
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Acción
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {adjuntosList.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.nombreOriginal}</TableCell>
                  <TableCell align="right">{((a.tamanioBytes || 0) / 1024).toFixed(1)} KB</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Visualizar">
                      <IconButton
                        size="small"
                        onClick={async () => {
                          try {
                            const res = await api.get(`/siaf/adjuntos/${a.id}/descargar`, { responseType: 'blob' });
                            const mime = a.mimeType || res.data?.type || 'application/pdf';
                            const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
                            onViewDoc({ id: a.id, nombreOriginal: a.nombreOriginal, mimeType: mime, url });
                          } catch (err) {
                            console.error(err);
                            onError('Error al cargar el documento');
                          }
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Descargar">
                      <IconButton
                        size="small"
                        onClick={async () => {
                          try {
                            const res = await api.get(`/siaf/adjuntos/${a.id}/descargar`, { responseType: 'blob' });
                            const url = window.URL.createObjectURL(new Blob([res.data]));
                            const link = document.createElement('a');
                            link.href = url;
                            link.setAttribute('download', a.nombreOriginal);
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            window.URL.revokeObjectURL(url);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cerrar</Button>
    </DialogActions>
  </Dialog>
);

export default AdjuntosDialog;
