import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  AttachFile as AttachFileIcon,
  History as HistoryIcon,
  DescriptionOutlined as DescriptionIcon,
} from '@mui/icons-material';
import api from '../../../api';
import { formatFechaDMA } from '../../../utils/dateUtils';
import { useNotification } from '../../../context/NotificationContext';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
  pageTitleSx,
} from '../../../theme/institutionalStyles';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { estadoConfig } from './constants';
import { buildResumen } from './utils';
import { limpiarComentarioBitacora } from '../../../utils/siafBitacora';
import type { AdjuntoRow, BitacoraEntry, ViewingDoc } from './types';
import PdfPreviewDialog from './components/PdfPreviewDialog';
import AdjuntosDialog from './components/AdjuntosDialog';
import BitacoraDialog from './components/BitacoraDialog';
import AdjuntoViewerDialog from './components/AdjuntoViewerDialog';

type UnitSiafRow = {
  id: string;
  backendId: number;
  date: string;
  unit: string;
  status: string;
  documentCount: number;
  solicitante: string;
  vistoBuenoDaf: boolean;
  ultimoRechazo?: { comentario: string; fecha: string };
  formData: any;
};

const mapEstadoUi = (estado: string): string => {
  if (estado === 'pendiente') return 'En Revisión';
  if (estado === 'finalizado' || estado === 'autorizado') return 'Finalizado';
  if (estado === 'rechazado') return 'Rechazado';
  return estado;
};

const mapApiToRow = (siaf: any): UnitSiafRow => ({
  id: siaf.correlativo,
  backendId: siaf.id,
  date: formatFechaDMA(siaf.fecha),
  unit: siaf.nombreUnidad,
  status: mapEstadoUi(String(siaf.estado || '')),
  documentCount: (siaf.documentosAdjuntos || []).length,
  solicitante: String(siaf.nombreSolicitante || '').trim() || '—',
  vistoBuenoDaf: !!siaf.aprobadoDireccionDepartamental,
  ultimoRechazo: siaf.ultimoRechazo || undefined,
  formData: {
    correlativo: siaf.correlativo,
    fecha: siaf.fecha,
    nombreUnidad: siaf.nombreUnidad,
    direccion: siaf.direccion,
    areaId: siaf.area?.id,
    justificacion: siaf.justificacion,
    nombreSolicitante: siaf.nombreSolicitante,
    puestoSolicitante: siaf.puestoSolicitante,
    unidadSolicitante: siaf.unidadSolicitante,
    nombreAutoridad: siaf.nombreAutoridad,
    puestoAutoridad: siaf.puestoAutoridad,
    unidadAutoridad: siaf.unidadAutoridad,
    consistentItem: siaf.consistenteItem,
    items: siaf.items || [],
    subproductos: siaf.subproductos || [],
  },
});

const SiafUnitFinalizados: React.FC = () => {
  const navigate = useNavigate();
  const { showError } = useNotification();
  const { hasPermission } = usePermissions();
  const [list, setList] = useState<UnitSiafRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [selectedSiafData, setSelectedSiafData] = useState<any>(null);
  const [adjuntosOpen, setAdjuntosOpen] = useState(false);
  const [adjuntosList, setAdjuntosList] = useState<AdjuntoRow[]>([]);
  const [adjuntosLoading, setAdjuntosLoading] = useState(false);
  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [bitacoraList, setBitacoraList] = useState<BitacoraEntry[]>([]);
  const [bitacoraLoading, setBitacoraLoading] = useState(false);
  const [bitacoraTitulo, setBitacoraTitulo] = useState('');
  const [bitacoraBackendId, setBitacoraBackendId] = useState<number | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<ViewingDoc | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/siaf/finalizados-unidad');
      const rows = Array.isArray(res.data) ? res.data.map(mapApiToRow) : [];
      setList(rows);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudieron cargar los SIAF de la unidad.';
      showError(message);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    const tryLoad = () => {
      if (hasPermission('listado-siaf-unidad-finalizados')) {
        void loadList();
      }
    };
    tryLoad();
    window.addEventListener('sigec:permissions-refreshed', tryLoad);
    return () => window.removeEventListener('sigec:permissions-refreshed', tryLoad);
  }, [hasPermission, loadList]);

  const resumen = buildResumen(list as any).filter((r) => r.estado !== 'Borrador');

  const handleViewPdf = (formData: any) => {
    setSelectedSiafData(formData);
    setPdfPreviewOpen(true);
  };

  const handleViewAdjuntos = async (backendId: number) => {
    setAdjuntosOpen(true);
    setAdjuntosLoading(true);
    try {
      const res = await api.get(`/siaf/${backendId}`);
      setAdjuntosList(
        (res.data.documentosAdjuntos || []).map((a: Record<string, unknown>) => ({
          id: a.id as number,
          nombreOriginal: a.nombreOriginal as string,
          tamanioBytes: (a.tamanioBytes as number) || 0,
          mimeType: a.mimeType as string | undefined,
        })),
      );
    } catch {
      setAdjuntosList([]);
    } finally {
      setAdjuntosLoading(false);
    }
  };

  const fetchBitacora = async (backendId: number) => {
    const res = await api.post(`/siaf/${backendId}/bitacora`, {});
    if (!Array.isArray(res.data)) return [];
    return res.data.map((b: Record<string, unknown>) => ({
      id: b.id as number,
      tipo: b.tipo as string,
      comentario: (b.comentario as string | null) ?? null,
      fecha: b.fecha as string,
      usuario: b.usuario as BitacoraEntry['usuario'],
      detalleAntes: (b.detalleAntes as string | null) ?? null,
      detalleDespues: (b.detalleDespues as string | null) ?? null,
    }));
  };

  const handleOpenBitacora = async (backendId: number, correlativo: string) => {
    setBitacoraTitulo(`Bitácora — SIAF ${correlativo}`);
    setBitacoraBackendId(backendId);
    setBitacoraOpen(true);
    setBitacoraLoading(true);
    setBitacoraList([]);
    try {
      setBitacoraList(await fetchBitacora(backendId));
    } catch {
      showError('Error al cargar la bitácora');
      setBitacoraList([]);
    } finally {
      setBitacoraLoading(false);
    }
  };

  const handleRecargarBitacora = async () => {
    if (bitacoraBackendId == null) return;
    setBitacoraLoading(true);
    try {
      setBitacoraList(await fetchBitacora(bitacoraBackendId));
    } catch {
      showError('Error al recargar la bitácora');
    } finally {
      setBitacoraLoading(false);
    }
  };

  if (!hasPermission('listado-siaf-unidad-finalizados')) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No tiene permiso para ver los SIAF de la unidad.
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box
          sx={{
            mb: 3,
            p: { xs: 2, sm: 2.5, md: 3.5 },
            borderRadius: { xs: 2, md: 3 },
            color: '#fff',
            background: `linear-gradient(135deg, ${IGSS_COLORS.azulOscuro} 0%, ${IGSS_COLORS.azulClaro} 100%)`,
            boxShadow: `0 10px 30px ${alpha(IGSS_COLORS.azulOscuro, 0.28)}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'flex-start' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  ...pageTitleSx,
                  color: '#fff',
                  mb: 0.5,
                  fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2rem' },
                }}
              >
                SIAF de mi unidad
              </Typography>
              <Typography variant="body1" sx={{ color: alpha('#fff', 0.85), maxWidth: 620, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                Solo lectura para Director / Administrador: ve los SIAF de su unidad en{' '}
                <strong>En revisión</strong>, <strong>Rechazado</strong> o <strong>Finalizado</strong>
                (no incluye borradores).
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                flexWrap: 'wrap',
                gap: 1.25,
              }}
            >
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/colaborador-dashboard')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#fff',
                  borderColor: alpha('#fff', 0.6),
                  width: { xs: '100%', sm: 'auto' },
                  '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) },
                }}
              >
                Volver
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadList}
                disabled={loading}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#fff',
                  borderColor: alpha('#fff', 0.6),
                  width: { xs: '100%', sm: 'auto' },
                  '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) },
                }}
              >
                Recargar
              </Button>
            </Box>
          </Box>
        </Box>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          {resumen.map((r) => (
            <Card
              key={r.estado}
              elevation={0}
              sx={{
                flex: '1 1 150px',
                minWidth: 140,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.75, py: 2.25 }}>
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: r.bg,
                    color: r.color,
                  }}
                >
                  {r.icon}
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1, color: r.color }}>
                    {r.total}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    {r.estado}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <Card
          elevation={0}
          sx={{
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            boxShadow: `0 4px 18px ${alpha('#000', 0.05)}`,
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              borderLeft: `4px solid ${IGSS_COLORS.verde}`,
            }}
          >
            <Typography variant="h6" fontWeight="700" sx={{ color: 'grey.800' }}>
              SIAF de la unidad
            </Typography>
            <Typography variant="body2" color="text.secondary">
              En revisión, Rechazado y Finalizado. Puede ver PDF, adjuntos y bitácora; no edita ni crea
              desde aquí. Use el menú «SIAF de mi unidad» (no «Listado de SIAF», que solo muestra lo
              personal).
            </Typography>
          </Box>
          <CardContent sx={{ p: 0 }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow style={tableHeaderRowStyle}>
                    <TableCell align="left" sx={tableHeaderCellSx} style={tableHeaderCellStyle}>
                      Correlativo
                    </TableCell>
                    <TableCell align="left" sx={tableHeaderCellSx} style={tableHeaderCellStyle}>
                      Fecha
                    </TableCell>
                    <TableCell align="left" sx={tableHeaderCellSx} style={tableHeaderCellStyle}>
                      Solicitante
                    </TableCell>
                    <TableCell align="left" sx={tableHeaderCellSx} style={tableHeaderCellStyle}>
                      Unidad Ejecutora
                    </TableCell>
                    <TableCell align="left" sx={tableHeaderCellSx} style={tableHeaderCellStyle}>
                      Estado
                    </TableCell>
                    <TableCell align="left" sx={tableHeaderCellSx} style={tableHeaderCellStyle}>
                      Motivo de rechazo
                    </TableCell>
                    <TableCell align="center" sx={{ ...tableHeaderCellSx, textAlign: 'center' }} style={tableHeaderCellStyle}>
                      Acciones
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 7 }}>
                        <DescriptionIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                        <Typography variant="body1" sx={{ color: 'grey.700', fontWeight: 600 }}>
                          {loading ? 'Cargando…' : 'No hay SIAF de la unidad en estos estados'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'grey.600' }}>
                          Verifique que el Director tenga la misma unidad médica que el colaborador que
                          creó el SIAF.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((siaf, index) => (
                      <TableRow
                        key={siaf.backendId}
                        sx={{
                          bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                          '&:hover': { bgcolor: alpha(IGSS_COLORS.azul, 0.08) },
                          '& td': { py: 1.75, borderColor: 'divider' },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700, color: IGSS_COLORS.azulOscuro }}>{siaf.id}</TableCell>
                        <TableCell>{siaf.date}</TableCell>
                        <TableCell>{siaf.solicitante}</TableCell>
                        <TableCell>{siaf.unit}</TableCell>
                        <TableCell>
                          <Chip
                            label={siaf.status}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              bgcolor: estadoConfig[siaf.status]?.bg,
                              color: estadoConfig[siaf.status]?.color,
                              border: `1px solid ${alpha(estadoConfig[siaf.status]?.color ?? '#999', 0.35)}`,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>
                          {siaf.status === 'Rechazado' && siaf.ultimoRechazo?.comentario ? (
                            <Tooltip title={limpiarComentarioBitacora(siaf.ultimoRechazo.comentario)}>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 220, color: 'grey.700' }}>
                                {limpiarComentarioBitacora(siaf.ultimoRechazo.comentario)}
                              </Typography>
                            </Tooltip>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Tooltip title="Ver bitácora">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenBitacora(siaf.backendId, siaf.id)}
                              sx={{ color: 'grey.700' }}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Ver PDF">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewPdf(siaf.formData)}
                            >
                              <PdfIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {siaf.documentCount > 0 && (
                            <Tooltip title="Ver documentos adjuntos">
                              <IconButton
                                size="small"
                                onClick={() => handleViewAdjuntos(siaf.backendId)}
                                sx={{ color: 'grey.700' }}
                              >
                                <AttachFileIcon fontSize="small" />
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
          </CardContent>
        </Card>
      </motion.div>

      <PdfPreviewDialog
        open={pdfPreviewOpen}
        siafData={selectedSiafData}
        onClose={() => setPdfPreviewOpen(false)}
      />
      <AdjuntosDialog
        open={adjuntosOpen}
        loading={adjuntosLoading}
        adjuntosList={adjuntosList}
        onClose={() => setAdjuntosOpen(false)}
        onViewDoc={(doc) => {
          setViewingDoc(doc);
          setViewerOpen(true);
        }}
        onError={showError}
      />
      <AdjuntoViewerDialog
        open={viewerOpen}
        viewingDoc={viewingDoc}
        onClose={() => {
          setViewerOpen(false);
          setViewingDoc(null);
        }}
      />
      <BitacoraDialog
        open={bitacoraOpen}
        titulo={bitacoraTitulo}
        loading={bitacoraLoading}
        entries={bitacoraList}
        backendId={bitacoraBackendId}
        onClose={(reset) => {
          setBitacoraOpen(false);
          if (reset) setBitacoraBackendId(null);
        }}
        onRecargar={handleRecargarBitacora}
        onPrintPreview={() => window.print()}
        onVerMarcasEnPdf={() => {
          showError('Las marcas en PDF se consultan desde la Gestión de SIAF del solicitante.');
        }}
      />
    </Container>
  );
};

export default SiafUnitFinalizados;
