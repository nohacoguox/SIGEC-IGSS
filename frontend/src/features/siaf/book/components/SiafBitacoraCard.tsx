import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PlaceIcon from '@mui/icons-material/Place';
import { limpiarComentarioBitacora, parseMarcadoresBitacora } from '../../../../utils/siafBitacora';
import type { BitacoraEntry } from '../types';

type SiafBitacoraCardProps = {
  bitacora: BitacoraEntry[];
  onVerMarcas: (entry: BitacoraEntry) => void;
};

const SiafBitacoraCard: React.FC<SiafBitacoraCardProps> = ({ bitacora, onVerMarcas }) => (
  <Card sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider' }} variant="outlined">
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" fontWeight="bold">
          Bitácora de rechazos y correcciones
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Historial de motivos de rechazo y correcciones realizadas. Revise los comentarios para ajustar la
        solicitud.
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
            {bitacora.map((b) => (
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
                <TableCell>
                  {b.tipo === 'correccion' &&
                  (b.detalleAntes || b.detalleDespues) &&
                  !String(b.detalleAntes || '').includes('"marcadores"') ? (
                    <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                      {b.detalleAntes && (
                        <>
                          <strong>Antes:</strong> {b.detalleAntes}
                        </>
                      )}
                      {b.detalleAntes && b.detalleDespues && <br />}
                      {b.detalleDespues && (
                        <>
                          <strong>Corregido a:</strong> {b.detalleDespues}
                        </>
                      )}
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {limpiarComentarioBitacora(b.comentario)}
                      </Typography>
                      {b.tipo === 'rechazo' && parseMarcadoresBitacora(b.detalleAntes).length > 0 && (
                        <Button
                          size="small"
                          startIcon={<PlaceIcon />}
                          onClick={() => onVerMarcas(b)}
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
    </CardContent>
  </Card>
);

export default SiafBitacoraCard;
