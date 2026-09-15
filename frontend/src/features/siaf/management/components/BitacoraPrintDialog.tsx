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
import PrintIcon from '@mui/icons-material/Print';
import { limpiarComentarioBitacora } from '../../../../utils/siafBitacora';
import { IGSS_COLORS } from '../../../../theme/institutionalColors';
import type { BitacoraEntry } from '../types';

type BitacoraPrintDialogProps = {
  open: boolean;
  titulo: string;
  entries: BitacoraEntry[];
  printRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
  onPrint: () => void;
};

const BitacoraPrintDialog: React.FC<BitacoraPrintDialogProps> = ({
  open,
  titulo,
  entries,
  printRef,
  onClose,
  onPrint,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="lg"
    fullWidth
    PaperProps={{ sx: { maxHeight: '90vh' } }}
  >
    <DialogTitle className="no-print" sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
      Vista previa — {titulo}
    </DialogTitle>
    <DialogContent sx={{ p: 0, overflow: 'auto' }}>
      <Box
        id="bitacora-print"
        ref={printRef}
        sx={{
          p: 4,
          bgcolor: '#fff',
          color: '#1a1a1a',
          fontFamily: '"Segoe UI", Roboto, sans-serif',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3, pb: 2, borderBottom: `2px solid ${IGSS_COLORS.azul}` }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: IGSS_COLORS.azul, letterSpacing: '0.02em' }}>
            Instituto Guatemalteco de Seguridad Social
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            SIGEC-IGSS — Gestión SIAF
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
          {titulo}
        </Typography>
        <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
          Rechazos (motivo de la autoridad) y correcciones realizadas tras cada rechazo.
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: '#666', mb: 2 }}>
          Documento generado el {new Date().toLocaleString('es-GT', { dateStyle: 'long', timeStyle: 'short' })}
        </Typography>
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: IGSS_COLORS.fondo }}>
                <TableCell sx={{ fontWeight: 700, color: '#333', borderColor: '#e0e0e0' }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#333', borderColor: '#e0e0e0' }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#333', borderColor: '#e0e0e0' }}>Usuario</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#333', borderColor: '#e0e0e0' }}>Comentario / Motivo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((b) => (
                <TableRow key={b.id} sx={{ '&:last-child td': { borderColor: '#e0e0e0' } }}>
                  <TableCell sx={{ borderColor: '#e0e0e0', color: '#333' }}>
                    {new Date(b.fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell sx={{ borderColor: '#e0e0e0' }}>
                    <Box
                      component="span"
                      sx={{
                        px: 1.2,
                        py: 0.4,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        bgcolor: b.tipo === 'rechazo' ? '#ffebee' : b.tipo === 'correccion' ? '#e3f2fd' : '#e8f5e9',
                        color:
                          b.tipo === 'rechazo'
                            ? IGSS_COLORS.error
                            : b.tipo === 'correccion'
                              ? IGSS_COLORS.azul
                              : IGSS_COLORS.verde,
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
                  <TableCell sx={{ borderColor: '#e0e0e0', color: '#333' }}>
                    {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                  </TableCell>
                  <TableCell sx={{ borderColor: '#e0e0e0', color: '#333', maxWidth: 400 }}>
                    {b.tipo === 'correccion' ? (
                      (b.detalleAntes || b.detalleDespues) &&
                      !String(b.detalleAntes || '').includes('"marcadores"') ? (
                        <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
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
                      <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                        {limpiarComentarioBitacora(b.comentario)}
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: '#888' }}>
            Documento generado desde SIGEC-IGSS — {new Date().toLocaleDateString('es-GT')}
          </Typography>
        </Box>
      </Box>
    </DialogContent>
    <DialogActions className="no-print" sx={{ borderTop: '1px solid', borderColor: 'divider', px: 3, py: 2 }}>
      <Button onClick={onClose}>Cerrar</Button>
      <Button variant="contained" startIcon={<PrintIcon />} onClick={onPrint}>
        Imprimir
      </Button>
    </DialogActions>
  </Dialog>
);

export default BitacoraPrintDialog;
