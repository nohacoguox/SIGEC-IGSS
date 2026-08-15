// frontend/src/pages/SiafManagement.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  alpha,
  CircularProgress,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Add as AddIcon,
  Edit as EditIcon,
  PictureAsPdf as PdfIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  History as HistoryIcon,
  Print as PrintIcon,
  Send as SendIcon,
  TaskAlt as TaskAltIcon,
  DescriptionOutlined as DescriptionIcon,
  HourglassTopOutlined as HourglassIcon,
  HighlightOff as HighlightOffIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
import api from '../api';
import { pdf, PDFViewer } from '@react-pdf/renderer';
import { SiafPdfDocument } from '../components/SiafPdfDocument';
import PdfViewerWithClick, { PdfMarker } from '../components/PdfViewerWithClick';
import { limpiarComentarioBitacora, parseMarcadoresBitacora, SiafMarcaBitacora } from '../utils/siafBitacora';

import { useSiaf } from '../context/SiafContext';
import { useNotification } from '../context/NotificationContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
  pageTitleSx,
  primaryButtonSx,
} from '../theme/institutionalStyles';
import { IGSS_COLORS } from '../theme/institutionalColors';

// --- Main Component ---
const SiafManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { siafList, loadSiafs } = useSiaf();
  const { showError, showSuccess } = useNotification();
  const { hasPermission } = usePermissions();

  const [siafAEnviar, setSiafAEnviar] = useState<{ backendId: number; correlativo: string } | null>(null);
  const [enviandoRevision, setEnviandoRevision] = useState(false);
  const [siafAFinalizar, setSiafAFinalizar] = useState<{ backendId: number; correlativo: string } | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [selectedSiafData, setSelectedSiafData] = useState<any>(null);
  const [adjuntosOpen, setAdjuntosOpen] = useState(false);
  const [adjuntosList, setAdjuntosList] = useState<Array<{ id: number; nombreOriginal: string; tamanioBytes: number; mimeType?: string }>>([]);
  const [adjuntosLoading, setAdjuntosLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ id: number; nombreOriginal: string; mimeType?: string; url?: string } | null>(null);
  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [bitacoraList, setBitacoraList] = useState<Array<{ id: number; tipo: string; comentario: string | null; fecha: string; usuario?: { nombres?: string; apellidos?: string }; detalleAntes?: string | null; detalleDespues?: string | null }>>([]);
  const [bitacoraLoading, setBitacoraLoading] = useState(false);
  const [bitacoraTitulo, setBitacoraTitulo] = useState<string>('');
  const [bitacoraBackendId, setBitacoraBackendId] = useState<number | null>(null);
  const [bitacoraPrintPreviewOpen, setBitacoraPrintPreviewOpen] = useState(false);
  const bitacoraPrintRef = useRef<HTMLDivElement>(null);
  const [marcasViewerOpen, setMarcasViewerOpen] = useState(false);
  const [marcasViewerLoading, setMarcasViewerLoading] = useState(false);
  const [marcasViewerUrl, setMarcasViewerUrl] = useState<string | null>(null);
  const [marcasViewerList, setMarcasViewerList] = useState<SiafMarcaBitacora[]>([]);
  const [marcasViewerTitulo, setMarcasViewerTitulo] = useState('');
  const marcasUrlRef = useRef<string | null>(null);

  const cerrarMarcasViewer = () => {
    setMarcasViewerOpen(false);
    setMarcasViewerList([]);
    setMarcasViewerTitulo('');
    if (marcasUrlRef.current) {
      URL.revokeObjectURL(marcasUrlRef.current);
      marcasUrlRef.current = null;
    }
    setMarcasViewerUrl(null);
  };

  const buildPdfDataFromForm = (formData: any) => ({
    fecha: formData.fecha ? String(formData.fecha).split('T')[0] : '',
    correlativo: formData.correlativo || '',
    nombreUnidad: formData.nombreUnidad || '',
    direccion: formData.direccion || '',
    justificacion: formData.justificacion || '',
    items: (formData.items || []).map((i: any) => ({
      codigo: i.codigo || '',
      descripcion: i.descripcion || '',
      cantidad: Number(i.cantidad || 0),
    })),
    subproductos: (formData.subproductos || []).map((s: any) => ({
      codigo: String(s.codigo ?? ''),
      cantidad: Number(s.cantidad || 0),
    })),
    totalSubproductoCantidad: (formData.subproductos || []).reduce(
      (sum: number, s: any) => sum + Number(s.cantidad || 0),
      0
    ),
    nombreSolicitante: formData.nombreSolicitante || '',
    puestoSolicitante: formData.puestoSolicitante || '',
    unidadSolicitante: formData.unidadSolicitante || formData.nombreUnidad || '',
    nombreAutoridad: formData.nombreAutoridad || '',
    puestoAutoridad: formData.puestoAutoridad || '',
    unidadAutoridad: formData.unidadAutoridad || '',
    areaUnidad: formData.nombreUnidad || '',
    consistentItem: formData.consistentItem || '',
  });

  const handleVerMarcasEnPdf = async (
    entry: { detalleAntes?: string | null; fecha?: string },
    correlativoFallback?: string
  ) => {
    const marcas = parseMarcadoresBitacora(entry.detalleAntes);
    if (marcas.length === 0) {
      showError('Este rechazo no tiene marcas en el documento.');
      return;
    }
    const siaf = siafList.find((s) => s.backendId === bitacoraBackendId);
    if (!siaf?.formData) {
      showError('No se encontró el SIAF para mostrar las marcas.');
      return;
    }
    setMarcasViewerTitulo(`Marcas de corrección — SIAF ${siaf.id || correlativoFallback || ''}`);
    setMarcasViewerList(marcas);
    setMarcasViewerOpen(true);
    setMarcasViewerLoading(true);
    try {
      if (marcasUrlRef.current) {
        URL.revokeObjectURL(marcasUrlRef.current);
        marcasUrlRef.current = null;
      }
      const blob = await pdf(<SiafPdfDocument data={buildPdfDataFromForm(siaf.formData)} />).toBlob();
      const url = URL.createObjectURL(blob);
      marcasUrlRef.current = url;
      setMarcasViewerUrl(url);
    } catch (e) {
      console.error(e);
      showError('No se pudo generar el PDF con las marcas.');
      cerrarMarcasViewer();
    } finally {
      setMarcasViewerLoading(false);
    }
  };

  const marcasViewerMarkers: PdfMarker[] = marcasViewerList.map((m, idx) => ({
    pageNumber: m.pagina,
    xPercent: m.xPercent,
    yPercent: m.yPercent,
    label: idx + 1,
  }));

  const fetchBitacora = async (backendId: number) => {
    const res = await api.post(`/siaf/${backendId}/bitacora`, {});
    if (!Array.isArray(res.data)) return [];
    return res.data.map((b: any) => ({
      id: b.id,
      tipo: b.tipo,
      comentario: b.comentario ?? null,
      fecha: b.fecha,
      usuario: b.usuario,
      detalleAntes: b.detalleAntes ?? null,
      detalleDespues: b.detalleDespues ?? null,
    }));
  };

  const handleOpenBitacora = async (backendId: number, correlativo: string) => {
    setBitacoraTitulo(`Bitácora — SIAF ${correlativo}`);
    setBitacoraBackendId(backendId);
    setBitacoraOpen(true);
    setBitacoraLoading(true);
    setBitacoraList([]);
    const state = location.state as { bitacoraSiafId?: number; bitacora?: any[] } | undefined;
    if (state?.bitacoraSiafId === backendId && Array.isArray(state.bitacora)) {
      setBitacoraList(state.bitacora.map((b: any) => ({
        id: b.id,
        tipo: b.tipo,
        comentario: b.comentario ?? null,
        fecha: b.fecha,
        usuario: b.usuario,
        detalleAntes: b.detalleAntes ?? null,
        detalleDespues: b.detalleDespues ?? null,
      })));
      setBitacoraLoading(false);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    try {
      const lista = await fetchBitacora(backendId);
      setBitacoraList(lista);
    } catch (err) {
      console.error(err);
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
      const lista = await fetchBitacora(bitacoraBackendId);
      setBitacoraList(lista);
    } catch (err) {
      showError('Error al recargar la bitácora');
    } finally {
      setBitacoraLoading(false);
    }
  };

  const handlePrintBitacora = () => {
    window.print();
  };

  useEffect(() => {
    loadSiafs();
  }, [loadSiafs]);

  const handleViewPdf = (siafData: any) => {
    setSelectedSiafData(siafData);
    setPdfPreviewOpen(true);
  };

  const handleViewAdjuntos = async (backendId: number) => {
    setAdjuntosOpen(true);
    setAdjuntosLoading(true);
    try {
      const res = await api.get(`/siaf/${backendId}`);
      setAdjuntosList((res.data.documentosAdjuntos || []).map((a: any) => ({
        id: a.id,
        nombreOriginal: a.nombreOriginal,
        tamanioBytes: a.tamanioBytes || 0,
        mimeType: a.mimeType,
      })));
    } catch {
      setAdjuntosList([]);
    } finally {
      setAdjuntosLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadSiafs();
  };

  const handleEnviarRevision = async () => {
    if (!siafAEnviar) return;
    setEnviandoRevision(true);
    try {
      await api.post(`/siaf/${siafAEnviar.backendId}/enviar-revision`);
      showSuccess(`SIAF ${siafAEnviar.correlativo} enviado a revisión.`);
      setSiafAEnviar(null);
      await loadSiafs();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'No se pudo enviar el SIAF a revisión.');
    } finally {
      setEnviandoRevision(false);
    }
  };

  const handleFinalizar = async () => {
    if (!siafAFinalizar) return;
    setFinalizando(true);
    try {
      await api.post(`/siaf/${siafAFinalizar.backendId}/finalizar`);
      showSuccess(`SIAF ${siafAFinalizar.correlativo} marcado como finalizado.`);
      setSiafAFinalizar(null);
      await loadSiafs();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'No se pudo finalizar el SIAF.');
    } finally {
      setFinalizando(false);
    }
  };

  /** Colores y textos por estado, para chips y tarjetas de resumen. */
  const estadoConfig: Record<string, { color: string; bg: string; icon: React.ReactElement }> = {
    'Borrador': { color: IGSS_COLORS.azul, bg: alpha(IGSS_COLORS.azul, 0.12), icon: <DescriptionIcon /> },
    'En Revisión': { color: '#B26A00', bg: alpha('#ED6C02', 0.14), icon: <HourglassIcon /> },
    'Finalizado': { color: '#1565C0', bg: alpha('#1976D2', 0.12), icon: <TaskAltIcon /> },
    'Rechazado': { color: IGSS_COLORS.error, bg: alpha(IGSS_COLORS.error, 0.12), icon: <HighlightOffIcon /> },
  };

  const resumen = ['Borrador', 'En Revisión', 'Finalizado', 'Rechazado'].map((estado) => ({
    estado,
    total: siafList.filter((s) => s.status === estado).length,
    ...estadoConfig[estado],
  }));

  /** Encabezados de tabla: paleta institucional IGSS */
  const headerCellStyle = tableHeaderCellStyle;
  const headerRowStyle = tableHeaderRowStyle;
  const headerCellSx = tableHeaderCellSx;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {!hasPermission('listado-siaf') ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No tiene permiso para ver el listado de SIAF.
        </Typography>
      ) : (
      <>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box
          sx={{
            mb: 3,
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            color: '#fff',
            background: `linear-gradient(135deg, ${IGSS_COLORS.azulOscuro} 0%, ${IGSS_COLORS.azulClaro} 100%)`,
            boxShadow: `0 10px 30px ${alpha(IGSS_COLORS.azulOscuro, 0.28)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 260 }}>
              <Typography variant="h4" component="h1" sx={{ ...pageTitleSx, color: '#fff', mb: 0.5 }}>
                Gestión de SIAF
              </Typography>
              <Typography variant="body1" sx={{ color: alpha('#fff', 0.85), maxWidth: 560 }}>
                Cree sus solicitudes, revíselas con calma y envíelas a revisión solo cuando lo considere necesario.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
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
                  '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) },
                }}
              >
                Volver
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#fff',
                  borderColor: alpha('#fff', 0.6),
                  '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) },
                }}
              >
                Recargar
              </Button>
              {hasPermission('crear-siaf') && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/siaf-book/crear')}
                  sx={{
                    ...primaryButtonSx,
                    bgcolor: '#fff',
                    color: IGSS_COLORS.azulOscuro,
                    '&:hover': { bgcolor: alpha('#fff', 0.88) },
                  }}
                >
                  Crear Nuevo SIAF
                </Button>
              )}
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
                transition: 'transform .2s ease, box-shadow .2s ease',
                '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 8px 20px ${alpha('#000', 0.08)}` },
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
              SIAF Existentes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              En borrador puede finalizarlo sin revisión o enviarlo a Dirección Departamental cuando necesite el visto bueno.
            </Typography>
          </Box>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow style={headerRowStyle}>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Correlativo</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Fecha</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Unidad Ejecutora</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Estado</TableCell>
                    <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>Motivo de rechazo</TableCell>
                    <TableCell align="center" sx={{ ...headerCellSx, textAlign: 'center' }} style={headerCellStyle}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {siafList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 7 }}>
                        <DescriptionIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                        <Typography variant="body1" sx={{ color: 'grey.700', fontWeight: 600 }}>
                          Aún no tiene solicitudes SIAF
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'grey.600' }}>
                          Use «Crear Nuevo SIAF» para registrar la primera.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    siafList.map((siaf, index) => (
                      <TableRow
                        key={siaf.id}
                        sx={{
                          bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                          transition: 'background-color .2s ease',
                          '&:hover': { bgcolor: alpha(IGSS_COLORS.azul, 0.08) },
                          '& td': { py: 1.75, borderColor: 'divider' },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700, color: IGSS_COLORS.azulOscuro }}>{siaf.id}</TableCell>
                        <TableCell>{siaf.date}</TableCell>
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
                          <Tooltip title="Ver bitácora de rechazos y correcciones">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenBitacora(siaf.backendId, siaf.id)}
                                sx={{ color: 'grey.700', '&:hover': { bgcolor: 'action.hover' } }}
                              >
                                <HistoryIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {(siaf.status === 'Borrador' || siaf.status === 'En Revisión' || siaf.status === 'Finalizado' || siaf.status === 'Rechazado') && (
                            <Tooltip title={siaf.status === 'Rechazado' ? 'Corregir y reenviar' : 'Editar SIAF'}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => navigate(`/siaf-book/corregir/${siaf.backendId}`)}
                                sx={{ '&:hover': { bgcolor: 'primary.light' } }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {siaf.status === 'Borrador' && (
                            <>
                              <Tooltip title="Finalizar sin enviar a revisión">
                                <IconButton
                                  size="small"
                                  onClick={() => setSiafAFinalizar({ backendId: siaf.backendId, correlativo: siaf.id })}
                                  sx={{
                                    color: '#1565C0',
                                    '&:hover': { bgcolor: alpha('#1976D2', 0.12) },
                                  }}
                                >
                                  <TaskAltIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Enviar a revisión de Dirección Departamental">
                                <IconButton
                                  size="small"
                                  onClick={() => setSiafAEnviar({ backendId: siaf.backendId, correlativo: siaf.id })}
                                  sx={{
                                    color: IGSS_COLORS.verdeOscuro,
                                    '&:hover': { bgcolor: alpha(IGSS_COLORS.verde, 0.14) },
                                  }}
                                >
                                  <SendIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip title="Ver PDF">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewPdf(siaf.formData)}
                              sx={{ '&:hover': { bgcolor: 'primary.light' } }}
                            >
                              <PdfIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {siaf.documentCount > 0 && (
                            <Tooltip title="Ver documentos adjuntos">
                              <IconButton
                                size="small"
                                onClick={() => handleViewAdjuntos(siaf.backendId)}
                                sx={{ color: 'grey.700', '&:hover': { bgcolor: 'action.hover' } }}
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

      {/* Confirmación: finalizar sin revisión */}
      <Dialog open={siafAFinalizar !== null} onClose={() => setSiafAFinalizar(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Finalizar SIAF</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            El SIAF <strong>{siafAFinalizar?.correlativo}</strong> se marcará como <strong>Finalizado</strong>.
            Este estado indica que está listo para continuar, aunque no se haya solicitado orientación a Dirección Departamental.
            Podrá editarlo posteriormente si necesita hacer algún ajuste.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSiafAFinalizar(null)} disabled={finalizando}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<TaskAltIcon />}
            onClick={handleFinalizar}
            disabled={finalizando}
          >
            {finalizando ? 'Finalizando...' : 'Finalizar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmación: enviar a revisión */}
      <Dialog open={siafAEnviar !== null} onClose={() => setSiafAEnviar(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Enviar a revisión</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            El SIAF <strong>{siafAEnviar?.correlativo}</strong> pasará a Dirección Departamental para su revisión.
            Mientras esté en revisión no podrá enviarlo de nuevo.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSiafAEnviar(null)} disabled={enviandoRevision}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleEnviarRevision}
            disabled={enviandoRevision}
          >
            {enviandoRevision ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={pdfPreviewOpen} onClose={() => setPdfPreviewOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle>Previsualización de SIAF</DialogTitle>
        <DialogContent sx={{ height: '80vh' }}>
          {selectedSiafData && (
            <PDFViewer width="100%" height="100%">
              <SiafPdfDocument data={selectedSiafData} />
            </PDFViewer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPdfPreviewOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Documentos adjuntos Dialog */}
      <Dialog open={adjuntosOpen} onClose={() => setAdjuntosOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Documentos adjuntos del SIAF</DialogTitle>
        <DialogContent>
          {adjuntosLoading ? (
            <Typography color="text.secondary">Cargando...</Typography>
          ) : adjuntosList.length === 0 ? (
            <Typography color="text.secondary">No hay documentos adjuntos.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Tamaño</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Acción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {adjuntosList.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.nombreOriginal}</TableCell>
                      <TableCell align="right">{((a.tamanioBytes || 0) / 1024).toFixed(1)} KB</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Visualizar">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              try {
                                const res = await api.get(`/siaf/adjuntos/${a.id}/descargar`, { responseType: 'blob' });
                                const mime = a.mimeType || res.data?.type || 'application/pdf';
                                const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
                                setViewingDoc({ id: a.id, nombreOriginal: a.nombreOriginal, mimeType: mime, url });
                                setViewerOpen(true);
                              } catch (err) {
                                console.error(err);
                                showError('Error al cargar el documento');
                              }
                            }}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Descargar">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              try {
                                const res = await api.get(`/siaf/adjuntos/${a.id}/descargar`, { responseType: 'blob' });
                                const url = window.URL.createObjectURL(new Blob([res.data]));
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', a.nombreOriginal);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                window.URL.revokeObjectURL(url);
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjuntosOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Bitácora: rechazos y correcciones */}
      <Dialog open={bitacoraOpen} onClose={() => { setBitacoraOpen(false); setBitacoraBackendId(null); }} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{bitacoraTitulo}</span>
          <Button size="small" startIcon={<RefreshIcon />} onClick={handleRecargarBitacora} disabled={bitacoraLoading || bitacoraBackendId == null}>
            Recargar
          </Button>
        </DialogTitle>
        <DialogContent>
          {bitacoraLoading ? (
            <Typography color="text.secondary">Cargando bitácora...</Typography>
          ) : bitacoraList.length === 0 ? (
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
                  {bitacoraList.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{new Date(b.fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                      <TableCell>
                        <Box
                          component="span"
                          sx={{
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            bgcolor: b.tipo === 'rechazo' ? 'error.light' : b.tipo === 'correccion' ? 'info.light' : b.tipo === 'aprobado_dd' ? 'success.light' : 'success.light',
                            color: b.tipo === 'rechazo' ? 'error.dark' : b.tipo === 'correccion' ? 'info.dark' : b.tipo === 'aprobado_dd' ? 'success.dark' : 'success.dark',
                          }}
                        >
                          {b.tipo === 'rechazo' ? 'Rechazo' : b.tipo === 'correccion' ? 'Corrección' : b.tipo === 'aprobado_dd' ? 'Revisión favorable (DD)' : 'Revisado'}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 420 }}>
                        {b.tipo === 'correccion' ? (
                          (b.detalleAntes || b.detalleDespues) && !String(b.detalleAntes || '').includes('"marcadores"') ? (
                            <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                              {b.detalleAntes && <><strong>Antes:</strong> {b.detalleAntes}</>}
                              {b.detalleAntes && b.detalleDespues && '\n'}
                              {b.detalleDespues && <><strong>Corregido a:</strong> {b.detalleDespues}</>}
                            </Box>
                          ) : (limpiarComentarioBitacora(b.comentario) === '—' ? 'Corrección registrada.' : limpiarComentarioBitacora(b.comentario))
                        ) : (
                          <Box>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'grey.800' }}>
                              {limpiarComentarioBitacora(b.comentario)}
                            </Typography>
                            {b.tipo === 'rechazo' && parseMarcadoresBitacora(b.detalleAntes).length > 0 && (
                              <Button
                                size="small"
                                startIcon={<PlaceIcon />}
                                onClick={() => handleVerMarcasEnPdf(b)}
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
          {bitacoraList.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => setBitacoraPrintPreviewOpen(true)}
            >
              Vista previa e imprimir
            </Button>
          )}
          <Button onClick={() => setBitacoraOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Vista previa / impresión de bitácora */}
      <Dialog
        open={bitacoraPrintPreviewOpen}
        onClose={() => setBitacoraPrintPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { maxHeight: '90vh' } }}
      >
        <DialogTitle className="no-print" sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
          Vista previa — {bitacoraTitulo}
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto' }}>
          <Box
            id="bitacora-print"
            ref={bitacoraPrintRef}
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
              {bitacoraTitulo}
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
                  {bitacoraList.map((b) => (
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
                            color: b.tipo === 'rechazo' ? IGSS_COLORS.error : b.tipo === 'correccion' ? IGSS_COLORS.azul : IGSS_COLORS.verde,
                          }}
                        >
                          {b.tipo === 'rechazo' ? 'Rechazo' : b.tipo === 'correccion' ? 'Corrección' : b.tipo === 'aprobado_dd' ? 'Revisión favorable (DD)' : 'Revisado'}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderColor: '#e0e0e0', color: '#333' }}>
                        {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                      </TableCell>
                      <TableCell sx={{ borderColor: '#e0e0e0', color: '#333', maxWidth: 400 }}>
                        {b.tipo === 'correccion' ? (
                          (b.detalleAntes || b.detalleDespues) && !String(b.detalleAntes || '').includes('"marcadores"') ? (
                            <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                              {b.detalleAntes && <><strong>Antes:</strong> {b.detalleAntes}</>}
                              {b.detalleAntes && b.detalleDespues && '\n'}
                              {b.detalleDespues && <><strong>Corregido a:</strong> {b.detalleDespues}</>}
                            </Box>
                          ) : (limpiarComentarioBitacora(b.comentario) === '—' ? 'Corrección registrada.' : limpiarComentarioBitacora(b.comentario))
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
          <Button onClick={() => setBitacoraPrintPreviewOpen(false)}>Cerrar</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrintBitacora}>
            Imprimir
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ver marcas de corrección sobre el PDF del SIAF */}
      <Dialog
        open={marcasViewerOpen}
        onClose={cerrarMarcasViewer}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { maxHeight: '95vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlaceIcon color="error" />
          {marcasViewerTitulo || 'Marcas de corrección'}
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 480 }}>
          <Box sx={{ flex: '1 1 62%', minWidth: 0, height: '70vh', borderRight: 1, borderColor: 'divider', overflow: 'auto', bgcolor: 'grey.100' }}>
            {marcasViewerLoading || !marcasViewerUrl ? (
              <Box display="flex" alignItems="center" justifyContent="center" height="100%" gap={1}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">Cargando documento…</Typography>
              </Box>
            ) : (
              <PdfViewerWithClick
                fileUrl={marcasViewerUrl}
                markers={marcasViewerMarkers}
                minHeight={400}
                zoom={1}
              />
            )}
          </Box>
          <Box sx={{ flex: '0 0 38%', p: 2, overflow: 'auto', maxHeight: '70vh', bgcolor: '#f4f7fa' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Correcciones señaladas ({marcasViewerList.length})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {marcasViewerList.map((m, idx) => (
                <Paper key={m.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        bgcolor: '#c62828',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'grey.800' }}>
                        {m.descripcion || '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Página {m.pagina}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={cerrarMarcasViewer} variant="outlined">Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Viewer Dialog para documentos adjuntos */}
      <Dialog open={viewerOpen} onClose={() => { setViewerOpen(false); if (viewingDoc?.url) window.URL.revokeObjectURL(viewingDoc.url); setViewingDoc(null); }} maxWidth="xl" fullWidth>
        <DialogTitle>{viewingDoc?.nombreOriginal || 'Visualizar Documento'}</DialogTitle>
        <DialogContent sx={{ height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 0 }}>
          {viewingDoc?.url && (
            <>
              {(viewingDoc.mimeType === 'application/pdf' || viewingDoc.nombreOriginal.toLowerCase().endsWith('.pdf')) ? (
                <iframe
                  src={`${viewingDoc.url}#toolbar=1`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={viewingDoc.nombreOriginal}
                />
              ) : viewingDoc.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(viewingDoc.nombreOriginal) ? (
                <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
                  <img
                    src={viewingDoc.url}
                    alt={viewingDoc.nombreOriginal}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </Box>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>No se puede visualizar este tipo de archivo</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Tipo: {viewingDoc.mimeType || 'desconocido'}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={async () => {
                      if (!viewingDoc) return;
                      try {
                        const res = await api.get(`/siaf/adjuntos/${viewingDoc.id}/descargar`, { responseType: 'blob' });
                        const url = window.URL.createObjectURL(new Blob([res.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', viewingDoc.nombreOriginal);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                  >
                    Descargar para abrir
                  </Button>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setViewerOpen(false); if (viewingDoc?.url) window.URL.revokeObjectURL(viewingDoc.url); setViewingDoc(null); }}>Cerrar</Button>
          {viewingDoc && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={async () => {
                if (!viewingDoc) return;
                try {
                  const res = await api.get(`/siaf/adjuntos/${viewingDoc.id}/descargar`, { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', viewingDoc.nombreOriginal);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  console.error(err);
                }
              }}
            >
              Descargar
            </Button>
          )}
        </DialogActions>
      </Dialog>
      </>
      )}
    </Container>
  );
};

export default SiafManagement;
