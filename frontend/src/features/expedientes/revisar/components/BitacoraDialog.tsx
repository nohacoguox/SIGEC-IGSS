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
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import type { BitacoraListEntry } from '../types';

export type BitacoraDialogProps = {
  open: boolean;
  titulo: string;
  loading: boolean;
  entries: BitacoraListEntry[];
  expedienteId: number | null;
  onClose: () => void;
  onAbrirDocumento: (expedienteId: number, docId: number) => void;
  onAbrirVersion: (expedienteId: number, docId: number, versionId: number) => void;
};

/** Bitácora de revisión DD (sin «Ver marca» / Recargar — distinto al BitacoraDialog de expedientes). */
const BitacoraDialog: React.FC<BitacoraDialogProps> = ({
  open,
  titulo,
  loading,
  entries,
  expedienteId,
  onClose,
  onAbrirDocumento,
  onAbrirVersion,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 2, maxWidth: 960 } }}>
    <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 2, bgcolor: 'grey.50' }}>
      {titulo}
    </DialogTitle>
    <DialogContent sx={{ p: 3 }}>
      {loading ? (
        <Box display="flex" alignItems="center" gap={2} py={4}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">Cargando bitácora…</Typography>
        </Box>
      ) : entries.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>No hay registros en la bitácora.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Historial de rechazos (motivo y observaciones por documento), aprobaciones y reemplazos de documento. En cada reemplazo se muestra el texto «documento X reemplazado por Y» y puede usar <strong>Ver documento actual</strong> para abrir el archivo actual. Los documentos rechazados que ya fueron corregidos se marcan con <Chip size="small" label="Corregido" color="info" sx={{ verticalAlign: 'middle' }} />.
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Table size="medium">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 700, width: 160 }}>Fecha y hora</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 120 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 180 }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 280 }}>Comentario / Motivo y rechazos por documento</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((b) => (
                  <TableRow key={b.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ whiteSpace: 'nowrap', verticalAlign: 'top', pt: 2, pb: 2 }}>
                      {new Date(b.fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', pt: 2, pb: 2 }}>
                      <Chip
                        size="small"
                        label={b.tipo === 'rechazo' ? 'Rechazo' : b.tipo === 'aprobacion' ? 'Aprobado' : b.tipo === 'correccion' ? 'Reemplazo de documento' : b.tipo}
                        color={b.tipo === 'rechazo' ? 'error' : b.tipo === 'aprobacion' ? 'success' : b.tipo === 'correccion' ? 'info' : 'default'}
                        variant="filled"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', pt: 2, pb: 2 }}>
                      {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                    </TableCell>
                    <TableCell sx={{ minWidth: 280, verticalAlign: 'top', pt: 2, pb: 2 }}>
                      <Box>
                        {(b.comentario || '').trim() && (
                          <Typography variant="body2" sx={{ mb: (b.detalle?.length || b.tipo === 'correccion') ? 1 : 0 }}>{b.comentario}</Typography>
                        )}
                        {b.tipo === 'correccion' && expedienteId != null && b.expedienteDocumentoId != null && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<VisibilityIcon />}
                              onClick={() => onAbrirDocumento(expedienteId, b.expedienteDocumentoId!)}
                            >
                              Ver documento actual{b.documentoReemplazo?.nombreArchivo ? `: ${b.documentoReemplazo.nombreArchivo}` : ''}
                            </Button>
                            {b.documentoReemplazado != null && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                startIcon={<VisibilityIcon />}
                                onClick={() => onAbrirVersion(expedienteId, b.expedienteDocumentoId!, b.documentoReemplazado!.versionId)}
                              >
                                Ver documento reemplazado{b.documentoReemplazado.nombreArchivo ? `: ${b.documentoReemplazado.nombreArchivo}` : ''}
                              </Button>
                            )}
                          </Box>
                        )}
                        {b.detalle && b.detalle.length > 0 && (
                          <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { marginBottom: 8 } }}>
                            {b.detalle.map((d, i) => (
                              <li key={i}>
                                <Typography variant="body2" component="span">
                                  <strong>{d.nombreDocumento}</strong>: {d.comentario}
                                  {d.corregido && <Chip size="small" label="Corregido" color="info" sx={{ ml: 0.5, verticalAlign: 'middle', fontWeight: 600 }} />}
                                </Typography>
                              </li>
                            ))}
                          </Box>
                        )}
                        {!(b.comentario || '').trim() && (!b.detalle || b.detalle.length === 0) && b.tipo !== 'correccion' && '—'}
                      </Box>
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

export default BitacoraDialog;
