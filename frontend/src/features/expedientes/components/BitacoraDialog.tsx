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
import {
  Place as PlaceIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import type { BitacoraEntry } from '../types';

type BitacoraDialogProps = {
  open: boolean;
  titulo: string;
  loading: boolean;
  entries: BitacoraEntry[];
  expedienteId: number | null;
  onClose: () => void;
  onRecargar: () => void;
  onAbrirDocumento: (expedienteId: number, docId: number) => void;
  onAbrirVersion: (expedienteId: number, docId: number, versionId: number) => void;
  onVerMarca: (
    expedienteId: number,
    docId: number,
    nombreDocumento: string,
    mimeType: string,
    xPercent: number,
    yPercent: number,
    pagina?: number | null,
    comentario?: string,
    versionId?: number | null,
  ) => void;
};

const BitacoraDialog: React.FC<BitacoraDialogProps> = ({
  open,
  titulo,
  loading,
  entries,
  expedienteId,
  onClose,
  onRecargar,
  onAbrirDocumento,
  onAbrirVersion,
  onVerMarca,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="lg"
    fullWidth
    PaperProps={{ sx: { borderRadius: 2, maxWidth: 960 } }}
  >
    <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 2, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
      <Typography variant="h6" fontWeight="700" color="text.primary">{titulo}</Typography>
      <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={onRecargar} disabled={loading || expedienteId == null}>
        Recargar
      </Button>
    </DialogTitle>
    <DialogContent sx={{ p: 3 }}>
      {loading ? (
        <Box display="flex" alignItems="center" gap={2} py={4}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">Cargando bitácora…</Typography>
        </Box>
      ) : entries.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No hay registros en la bitácora. Aquí aparecerán los <strong>rechazos</strong> (con observaciones por documento), las <strong>aprobaciones</strong> y las <strong>correcciones</strong> (por ejemplo, cuando reemplace un documento por otro), con fecha y hora.
        </Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Historial de <strong>rechazos</strong> (motivo y observaciones por documento), <strong>aprobaciones</strong> y <strong>correcciones</strong> (documento reemplazado). Use esta información para saber qué corregir en cada archivo.
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
                      <Box sx={{ display: 'block' }}>
                        {(b.comentario || '').trim() && (
                          <Typography variant="body2" component="span" display="block" sx={{ mb: (b.detalle?.length || b.tipo === 'correccion') ? 1 : 0 }}>{b.comentario}</Typography>
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
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" fontWeight="700" color="primary.main" display="block" sx={{ mb: 0.5 }}>
                              Rechazos por documento:
                            </Typography>
                            <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { marginBottom: 8 } }}>
                              {b.detalle.map((d, i) => (
                                <li key={i}>
                                  <Typography variant="body2" component="span">
                                    <strong>{d.nombreDocumento}</strong>: {d.comentario}
                                    {d.corregido && <Chip size="small" label="Corregido" color="info" sx={{ ml: 0.5, verticalAlign: 'middle', fontWeight: 600 }} />}
                                    {(d.pagina != null || d.xPercent != null) && d.expedienteDocumentoId != null && expedienteId != null && (
                                      <>
                                        <Chip size="small" label="Señalizado" color="warning" sx={{ ml: 0.5, verticalAlign: 'middle' }} icon={<PlaceIcon sx={{ fontSize: 14 }} />} />
                                        <Button
                                          size="small"
                                          startIcon={<PlaceIcon />}
                                          onClick={() => onVerMarca(expedienteId, d.expedienteDocumentoId!, d.nombreDocumento, d.mimeType ?? 'application/octet-stream', d.xPercent ?? 0, d.yPercent ?? 0, d.pagina, d.comentario, d.documentoVersionIdParaMarca)}
                                          sx={{ ml: 0.5, verticalAlign: 'middle', textTransform: 'none' }}
                                        >
                                          Ver marca de rechazo
                                        </Button>
                                      </>
                                    )}
                                  </Typography>
                                </li>
                              ))}
                            </Box>
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
