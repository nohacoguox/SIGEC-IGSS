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
  IconButton,
  Tooltip,
  alpha,
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
  History as HistoryIcon,
  Send as SendIcon,
  TaskAlt as TaskAltIcon,
  DescriptionOutlined as DescriptionIcon,
} from '@mui/icons-material';
import { pdf } from '@react-pdf/renderer';
import api from '../../../api';
import { SiafPdfDocument } from '../../../components/SiafPdfDocument';
import { PdfMarker } from '../../../components/PdfViewerWithClick';
import { parseMarcadoresBitacora, limpiarComentarioBitacora, SiafMarcaBitacora } from '../../../utils/siafBitacora';
import { useSiaf } from '../../../context/SiafContext';
import { useNotification } from '../../../context/NotificationContext';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
  pageTitleSx,
  primaryButtonSx,
} from '../../../theme/institutionalStyles';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { estadoConfig } from './constants';
import { buildPdfDataFromForm, buildResumen } from './utils';
import type { AdjuntoRow, BitacoraEntry, SiafActionTarget, ViewingDoc } from './types';
import FinalizarDialog from './components/FinalizarDialog';
import EnviarRevisionDialog from './components/EnviarRevisionDialog';
import PdfPreviewDialog from './components/PdfPreviewDialog';
import AdjuntosDialog from './components/AdjuntosDialog';
import BitacoraDialog from './components/BitacoraDialog';
import BitacoraPrintDialog from './components/BitacoraPrintDialog';
import MarcasViewerDialog from './components/MarcasViewerDialog';
import AdjuntoViewerDialog from './components/AdjuntoViewerDialog';

const SiafManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { siafList, loadSiafs } = useSiaf();
  const { showError, showSuccess } = useNotification();
  const { hasPermission } = usePermissions();

  const [siafAEnviar, setSiafAEnviar] = useState<SiafActionTarget | null>(null);
  const [enviandoRevision, setEnviandoRevision] = useState(false);
  const [siafAFinalizar, setSiafAFinalizar] = useState<SiafActionTarget | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [selectedSiafData, setSelectedSiafData] = useState<any>(null);
  const [adjuntosOpen, setAdjuntosOpen] = useState(false);
  const [adjuntosList, setAdjuntosList] = useState<AdjuntoRow[]>([]);
  const [adjuntosLoading, setAdjuntosLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<ViewingDoc | null>(null);
  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [bitacoraList, setBitacoraList] = useState<BitacoraEntry[]>([]);
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

  const handleVerMarcasEnPdf = async (entry: BitacoraEntry) => {
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
    setMarcasViewerTitulo(`Marcas de corrección — SIAF ${siaf.id || ''}`);
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
    const state = location.state as { bitacoraSiafId?: number; bitacora?: BitacoraEntry[] } | undefined;
    if (state?.bitacoraSiafId === backendId && Array.isArray(state.bitacora)) {
      setBitacoraList(
        state.bitacora.map((b) => ({
          id: b.id,
          tipo: b.tipo,
          comentario: b.comentario ?? null,
          fecha: b.fecha,
          usuario: b.usuario,
          detalleAntes: b.detalleAntes ?? null,
          detalleDespues: b.detalleDespues ?? null,
        })),
      );
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
    } catch {
      showError('Error al recargar la bitácora');
    } finally {
      setBitacoraLoading(false);
    }
  };

  const handleCloseBitacora = (resetBackendId?: boolean) => {
    setBitacoraOpen(false);
    if (resetBackendId) setBitacoraBackendId(null);
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
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo enviar el SIAF a revisión.';
      showError(message);
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
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo finalizar el SIAF.';
      showError(message);
    } finally {
      setFinalizando(false);
    }
  };

  const resumen = buildResumen(siafList);

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
                        <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>
                          Correlativo
                        </TableCell>
                        <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>
                          Fecha
                        </TableCell>
                        <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>
                          Unidad Ejecutora
                        </TableCell>
                        <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>
                          Estado
                        </TableCell>
                        <TableCell align="left" sx={headerCellSx} style={headerCellStyle}>
                          Motivo de rechazo
                        </TableCell>
                        <TableCell align="center" sx={{ ...headerCellSx, textAlign: 'center' }} style={headerCellStyle}>
                          Acciones
                        </TableCell>
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
                              {(siaf.status === 'Borrador' ||
                                siaf.status === 'En Revisión' ||
                                siaf.status === 'Finalizado' ||
                                siaf.status === 'Rechazado') && (
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

          <FinalizarDialog
            target={siafAFinalizar}
            loading={finalizando}
            onClose={() => setSiafAFinalizar(null)}
            onConfirm={handleFinalizar}
          />

          <EnviarRevisionDialog
            target={siafAEnviar}
            loading={enviandoRevision}
            onClose={() => setSiafAEnviar(null)}
            onConfirm={handleEnviarRevision}
          />

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

          <BitacoraDialog
            open={bitacoraOpen}
            titulo={bitacoraTitulo}
            loading={bitacoraLoading}
            entries={bitacoraList}
            backendId={bitacoraBackendId}
            onClose={handleCloseBitacora}
            onRecargar={handleRecargarBitacora}
            onPrintPreview={() => setBitacoraPrintPreviewOpen(true)}
            onVerMarcasEnPdf={handleVerMarcasEnPdf}
          />

          <BitacoraPrintDialog
            open={bitacoraPrintPreviewOpen}
            titulo={bitacoraTitulo}
            entries={bitacoraList}
            printRef={bitacoraPrintRef}
            onClose={() => setBitacoraPrintPreviewOpen(false)}
            onPrint={handlePrintBitacora}
          />

          <MarcasViewerDialog
            open={marcasViewerOpen}
            titulo={marcasViewerTitulo}
            loading={marcasViewerLoading}
            fileUrl={marcasViewerUrl}
            marcas={marcasViewerList}
            markers={marcasViewerMarkers}
            onClose={cerrarMarcasViewer}
          />

          <AdjuntoViewerDialog
            open={viewerOpen}
            viewingDoc={viewingDoc}
            onClose={() => {
              setViewerOpen(false);
              setViewingDoc(null);
            }}
          />
        </>
      )}
    </Container>
  );
};

export default SiafManagement;
