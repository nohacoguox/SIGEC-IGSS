import React from 'react';
import {
  Box,
  Button,
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
import PlaceIcon from '@mui/icons-material/Place';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import { limpiarComentarioBitacora, parseMarcadoresBitacora } from '../../../../utils/siafBitacora';
import type { BitacoraEntry } from '../types';

type BitacoraDialogProps = {
  open: boolean;
  titulo: string;
  loading: boolean;
  entries: BitacoraEntry[];
  backendId: number | null;
  onClose: (resetBackendId?: boolean) => void;
  onRecargar: () => void;
  onPrintPreview: () => void;
  onVerMarcasEnPdf: (entry: BitacoraEntry) => void;
};

const BitacoraDialog: React.FC<BitacoraDialogProps> = ({
  open,
  titulo,
  loading,
  entries,
  backendId,
  onClose,
  onRecargar,
  onPrintPreview,
  onVerMarcasEnPdf,
}) => (
  <Dialog open={open} onClose={() => onClose(true)} maxWidth="md" fullWidth>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{titulo}</span>
      <Button size="small" startIcon={<RefreshIcon />} onClick={onRecargar} disabled={loading || backendId == null}>
        Recargar
      </Button>
    </DialogTitle>
    <DialogContent>
      {loading ? (
        <Typography color="text.secondary">Cargando bitácora...</Typography>
      ) : entries.length === 0 ? (
        <Typography color="text.secondary">No hay registros en la bitácora para este SIAF.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Rechazos (motivo de la autoridad) y correcciones que usted ha realizado tras cada rechazo.
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Comentario / Motivo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {new Date(b.fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell>
                      <Box
                        component="span"
                        sx={{
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          bgcolor:
                            b.tipo === 'rechazo'
                              ? 'error.light'
                              : b.tipo === 'correccion'
                                ? 'info.light'
                                : b.tipo === 'aprobado_dd'
                                  ? 'success.light'
                                  : 'success.light',
                          color:
                            b.tipo === 'rechazo'
                              ? 'error.dark'
                              : b.tipo === 'correccion'
                                ? 'info.dark'
                                : b.tipo === 'aprobado_dd'
                                  ? 'success.dark'
                                  : 'success.dark',
                        }}
                      >
                        {b.tipo === 'rechazo'
                          ? 'Rechazo'
                          : b.tipo === 'correccion'
                            ? 'Corrección'
                            : b.tipo === 'aprobado_dd'
                              ? 'Revisión favorable (DD)'
                              : 'Revisado'}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 420 }}>
                      {b.tipo === 'correccion' ? (
                        (b.detalleAntes || b.detalleDespues) &&
                        !String(b.detalleAntes || '').includes('"marcadores"') ? (
                          <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                            {b.detalleAntes && (
                              <>
                                <strong>Antes:</strong> {b.detalleAntes}
                              </>
                            )}
                            {b.detalleAntes && b.detalleDespues && '\n'}
                            {b.detalleDespues && (
                              <>
                                <strong>Corregido a:</strong> {b.detalleDespues}
                              </>
                            )}
                          </Box>
                        ) : limpiarComentarioBitacora(b.comentario) === '—' ? (
                          'Corrección registrada.'
                        ) : (
                          limpiarComentarioBitacora(b.comentario)
                        )
                      ) : (
                        <Box>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'grey.800' }}>
                            {limpiarComentarioBitacora(b.comentario)}
                          </Typography>
                          {b.tipo === 'rechazo' && parseMarcadoresBitacora(b.detalleAntes).length > 0 && (
                            <Button
                              size="small"
                              startIcon={<PlaceIcon />}
                              onClick={() => onVerMarcasEnPdf(b)}
                              sx={{ mt: 0.75, textTransform: 'none', fontWeight: 600 }}
                            >
                              Ver marcas en el SIAF ({parseMarcadoresBitacora(b.detalleAntes).length})
                            </Button>
                          )}
                        </Box>
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
    <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
      {entries.length > 0 && (
        <Button variant="outlined" startIcon={<PrintIcon />} onClick={onPrintPreview}>
          Vista previa e imprimir
        </Button>
      )}
      <Button onClick={() => onClose(false)}>Cerrar</Button>
    </DialogActions>
  </Dialog>
);

export default BitacoraDialog;
