import React from 'react';
import {
  Box,
  CircularProgress,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { History, Visibility } from '@mui/icons-material';
import { formatFechaDMA } from '../../../../utils';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
} from '../../../../theme/institutionalStyles';
import type { HistorialUnificadoItem } from '../types';

type HistorialTableProps = {
  loading: boolean;
  historialUnificado: HistorialUnificadoItem[];
  onOpenBitacora: (backendId: number, correlativo: string) => void;
  onOpenSiaf: (item: HistorialUnificadoItem) => void;
};

const HistorialTable: React.FC<HistorialTableProps> = ({
  loading,
  historialUnificado,
  onOpenBitacora,
  onOpenSiaf,
}) => {
  const headerCellStyle = tableHeaderCellStyle;
  const headerRowStyle = tableHeaderRowStyle;
  const headerCellSx = tableHeaderCellSx;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="280px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflowX: 'auto',
      }}
    >
      <Table size="medium">
        <TableHead>
          <TableRow style={headerRowStyle}>
            <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Correlativo</TableCell>
            <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Fecha solicitud</TableCell>
            <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Solicitante</TableCell>
            <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Área / Unidad</TableCell>
            <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Estado</TableCell>
            <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Última decisión</TableCell>
            <TableCell align="center" sx={{ ...headerCellSx, textAlign: 'center' }} style={headerCellStyle}>Rechazos</TableCell>
            <TableCell align="right" sx={headerCellSx} style={headerCellStyle}>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {historialUnificado.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                <Typography sx={{ color: 'grey.600' }} variant="body2">
                  No hay registros en su historial. Las revisiones favorables y rechazos aparecerán aquí.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            historialUnificado.map((item, index) => (
              <TableRow
                key={item.backendId}
                sx={{
                  bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                  '&:hover': { bgcolor: 'action.selected' },
                  '& td': { py: 1.75, borderColor: 'divider' },
                }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{item.correlativo}</TableCell>
                <TableCell>{formatFechaDMA(item.fecha)}</TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="600">{item.nombreSolicitante}</Typography>
                    <Typography variant="body2" sx={{ color: 'grey.700', fontSize: '0.8125rem', display: 'block', mt: 0.25 }}>{item.puestoSolicitante}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2">{item.nombreUnidad}</Typography>
                    <Typography variant="body2" sx={{ color: 'grey.700', fontSize: '0.8125rem', display: 'block', mt: 0.25 }}>{item.areaUnidad}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={item.estadoActual === 'autorizado' ? 'Revisión favorable' : 'Rechazado'}
                    size="small"
                    color={item.estadoActual === 'autorizado' ? 'success' : 'error'}
                    variant="filled"
                    sx={{ fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell>{item.fechaUltimaDecision ? formatFechaDMA(item.fechaUltimaDecision) : '—'}</TableCell>
                <TableCell align="center">
                  {item.cantidadRechazos > 0 ? (
                    <Typography variant="body2" fontWeight="600" color="text.secondary">
                      {item.cantidadRechazos} {item.cantidadRechazos === 1 ? 'vez' : 'veces'}
                    </Typography>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Ver bitácora (rechazos y correcciones)">
                    <IconButton
                      size="small"
                      onClick={() => onOpenBitacora(item.backendId, item.correlativo)}
                      sx={{ color: 'grey.700', mr: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <History fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ver SIAF">
                    <IconButton
                      size="small"
                      onClick={() => onOpenSiaf(item)}
                      color="primary"
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': { bgcolor: 'primary.dark' },
                      }}
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default HistorialTable;
