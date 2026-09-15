import React from 'react';
import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Search as SearchIcon, Visibility } from '@mui/icons-material';
import { formatFechaDMA } from '../../../../utils';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
} from '../../../../theme/institutionalStyles';
import type { Municipio, SiafSolicitud } from '../types';

type PendientesTableProps = {
  solicitudes: SiafSolicitud[];
  municipios: Municipio[];
  filtroMunicipioId: number | '';
  onFiltroMunicipioChange: (value: number | '') => void;
  onOpenSiaf: (siaf: SiafSolicitud) => void;
};

const PendientesTable: React.FC<PendientesTableProps> = ({
  solicitudes,
  municipios,
  filtroMunicipioId,
  onFiltroMunicipioChange,
  onOpenSiaf,
}) => {
  const headerCellStyle = tableHeaderCellStyle;
  const headerRowStyle = tableHeaderRowStyle;
  const headerCellSx = tableHeaderCellSx;

  return (
    <>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            overflow: 'hidden',
            '&:hover': { borderColor: 'primary.main' },
            '&:focus-within': { borderColor: 'primary.main', borderWidth: 2 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', pl: 1.5, color: 'action.active' }}>
            <SearchIcon sx={{ fontSize: 22 }} />
          </Box>
          <FormControl
            size="small"
            sx={{
              minWidth: 260,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
              },
            }}
          >
            <InputLabel id="filtro-municipio-label">Filtrar por municipio</InputLabel>
            <Select
              labelId="filtro-municipio-label"
              id="filtro-municipio"
              value={filtroMunicipioId}
              label="Filtrar por municipio"
              onChange={(e) => onFiltroMunicipioChange(e.target.value === '' ? '' : Number(e.target.value))}
              renderValue={(v: number | string) => (v === '' ? 'Todos los municipios' : municipios.find((m) => m.id === Number(v))?.nombre ?? '')}
            >
              <MenuItem value="">Todos los municipios</MenuItem>
              {municipios.map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {filtroMunicipioId !== '' && (
          <Chip
            size="small"
            label="Filtro activo por municipio"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 500 }}
          />
        )}
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <Table size="medium">
          <TableHead>
            <TableRow style={headerRowStyle}>
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Correlativo</TableCell>
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Fecha</TableCell>
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Solicitante</TableCell>
              <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Área / Unidad</TableCell>
              <TableCell align="center" sx={{ ...headerCellSx, textAlign: 'center' }} style={headerCellStyle}>Tipo</TableCell>
              <TableCell align="right" sx={headerCellSx} style={headerCellStyle}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {solicitudes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography sx={{ color: 'grey.600' }} variant="body2">
                    No hay SIAFs pendientes de su departamento.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              solicitudes.map((siaf, index) => (
                <TableRow
                  key={siaf.id}
                  sx={{
                    bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                    '&:hover': { bgcolor: 'action.selected' },
                    '& td': { py: 1.75, borderColor: 'divider' },
                  }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{siaf.correlativo}</TableCell>
                  <TableCell>{formatFechaDMA(siaf.fecha)}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="600">{siaf.nombreSolicitante}</Typography>
                      <Typography variant="body2" sx={{ color: 'grey.700', fontSize: '0.8125rem', display: 'block', mt: 0.25 }}>{siaf.puestoSolicitante}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">{siaf.nombreUnidad}</Typography>
                      <Typography variant="body2" sx={{ color: 'grey.700', fontSize: '0.8125rem', display: 'block', mt: 0.25 }}>{siaf.areaUnidad}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={siaf.esCorreccion ? 'Corrección' : 'Nuevo'}
                      color={siaf.esCorreccion ? 'info' : 'default'}
                      variant="filled"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Ver SIAF, adjuntos y bitácora">
                      <IconButton
                        size="small"
                        onClick={() => onOpenSiaf(siaf)}
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
    </>
  );
};

export default PendientesTable;
