import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { limpiarComentarioBitacora } from '../../../../utils/siafBitacora';
import type { BitacoraEntry } from '../types';

type BitacoraStandaloneDialogProps = {
  open: boolean;
  titulo: string;
  loading: boolean;
  list: BitacoraEntry[];
  canReload: boolean;
  onClose: () => void;
  onReload: () => void;
};

const BitacoraStandaloneDialog: React.FC<BitacoraStandaloneDialogProps> = ({
  open,
  titulo,
  loading,
  list,
  canReload,
  onClose,
  onReload,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
      <span>{titulo}</span>
      <Button size="small" startIcon={<RefreshIcon />} onClick={onReload} disabled={loading || !canReload}>
        Recargar
      </Button>
    </DialogTitle>
    <DialogContent>
      {loading ? (
        <Box display="flex" alignItems="center" gap={2} py={2}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">Cargando bitácora...</Typography>
        </Box>
      ) : list.length === 0 ? (
        <Typography color="text.secondary">No hay registros en la bitácora para este SIAF.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Historial de rechazos, correcciones y revisiones favorables de Dirección Departamental.
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Comentario / Motivo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{new Date(b.fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          b.tipo === 'rechazo' ? 'Rechazo' :
                          b.tipo === 'correccion' ? 'Corrección' :
                          b.tipo === 'aprobado_dd' ? 'Revisión favorable (DD)' : b.tipo
                        }
                        color={
                          b.tipo === 'rechazo' ? 'error' :
                          b.tipo === 'correccion' ? 'info' : 'success'
                        }
                        variant="filled"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 400 }}>
                      {b.tipo === 'correccion' && (b.detalleAntes || b.detalleDespues) && !String(b.detalleAntes || '').includes('"marcadores"') ? (
                        <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                          {b.detalleAntes && <><strong>Antes:</strong> {b.detalleAntes}</>}
                          {b.detalleAntes && b.detalleDespues && '\n'}
                          {b.detalleDespues && <><strong>Corregido a:</strong> {b.detalleDespues}</>}
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {limpiarComentarioBitacora(b.comentario)}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cerrar</Button>
    </DialogActions>
  </Dialog>
);

export default BitacoraStandaloneDialog;
