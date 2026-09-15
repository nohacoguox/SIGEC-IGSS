import React from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import {
  History as HistoryIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
} from '../../../../theme/institutionalStyles';
import type { ExpedienteRevision } from '../types';
import { nombreSolicitante, origenDisplay } from '../utils';

const headerCellStyle = tableHeaderCellStyle;
const headerRowStyle = tableHeaderRowStyle;
const headerCellSx = tableHeaderCellSx;

export type RevisionListaTableProps = {
  esRevisados: boolean;
  datosTabla: ExpedienteRevision[];
  cargandoTabla: boolean;
  enviando: boolean;
  onRevisar: (id: number) => void;
  onBitacora: (expedienteId: number, titulo: string) => void;
};

const RevisionListaTable: React.FC<RevisionListaTableProps> = ({
  esRevisados,
  datosTabla,
  cargandoTabla,
  enviando,
  onRevisar,
  onBitacora,
}) => (
  <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
    <Table size="small">
      <TableHead>
        <TableRow style={headerRowStyle}>
          <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Número</TableCell>
          <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>O.C.</TableCell>
          <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Título</TableCell>
          <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Descripción</TableCell>
          <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Origen</TableCell>
          <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Solicitante</TableCell>
          <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Fecha</TableCell>
          {esRevisados && (
            <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Estado</TableCell>
          )}
          <TableCell align="center" sx={{ ...headerCellSx, textAlign: 'center' }} style={headerCellStyle}>Acciones</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {cargandoTabla ? (
          <TableRow><TableCell colSpan={esRevisados ? 9 : 8} align="center" sx={{ py: 4 }}>Cargando…</TableCell></TableRow>
        ) : datosTabla.length === 0 ? (
          <TableRow>
            <TableCell colSpan={esRevisados ? 9 : 8} align="center" sx={{ py: 4 }}>
              {esRevisados ? 'No hay expedientes revisados por usted.' : 'No hay expedientes pendientes de revisión.'}
            </TableCell>
          </TableRow>
        ) : (
          datosTabla.map((e, idx) => (
            <TableRow
              key={e.id}
              sx={{
                bgcolor: idx % 2 === 1 ? 'action.hover' : 'background.paper',
                '& td': { py: 1.5, borderColor: 'divider' },
              }}
            >
              <TableCell sx={{ fontWeight: 600 }}>{e.numeroExpediente}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{e.numeroOrdenCompra || '—'}</TableCell>
              <TableCell>{e.titulo}</TableCell>
              <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.descripcion || undefined}>{e.descripcion || '—'}</TableCell>
              <TableCell sx={{ maxWidth: 180 }} title={origenDisplay(e)}>{origenDisplay(e)}</TableCell>
              <TableCell>{nombreSolicitante(e)}</TableCell>
              <TableCell>{typeof e.fechaApertura === 'string' ? e.fechaApertura.split('T')[0] : ''}</TableCell>
              {esRevisados && (
                <TableCell>
                  {e.ultimaAccionPorMi?.tipo === 'aprobacion' ? (
                    <Chip size="small" label="Aprobado" color="success" />
                  ) : e.ultimaAccionPorMi?.tipo === 'rechazo' ? (
                    <Chip size="small" label="Rechazado" color="error" />
                  ) : (
                    '—'
                  )}
                </TableCell>
              )}
              <TableCell align="center">
                {!esRevisados ? (
                  <>
                    <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => onRevisar(e.id)} disabled={enviando} sx={{ mr: 1, textTransform: 'none' }}>
                      Revisar Expediente
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={() => onBitacora(e.id, `Bitácora — Expediente ${e.numeroExpediente}`)} sx={{ textTransform: 'none' }}>
                      Revisar Bitácora
                    </Button>
                  </>
                ) : (
                  <Tooltip title="Ver bitácora">
                    <IconButton size="small" onClick={() => onBitacora(e.id, `Bitácora — Expediente ${e.numeroExpediente}`)}>
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </TableContainer>
);

export default RevisionListaTable;
