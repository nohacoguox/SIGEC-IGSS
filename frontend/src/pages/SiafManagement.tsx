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
} from '@mui/icons-material';
import api from '../api';
import { PDFViewer } from '@react-pdf/renderer';
import { SiafPdfDocument } from '../components/SiafPdfDocument';

import { useSiaf } from '../context/SiafContext';
import { useNotification } from '../context/NotificationContext';

// --- Main Component ---
const SiafManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { siafList, loadSiafs } = useSiaf();
  const { showError } = useNotification();

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

  /** Encabezados de tabla: estilos en línea para buena visibilidad en cualquier tema */
  const headerCellStyle = { backgroundColor: '#0d47a1', color: '#ffffff' };
  const headerRowStyle = { backgroundColor: '#0d47a1' };
  const headerCellSx = { fontWeight: 700, fontSize: '0.9375rem', py: 2, borderBottom: 'none' };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            sx={{
              background: 'linear-gradient(135deg, #0066A1 0%, #004D7A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 0.5,
            }}
          >
            Gestión de SIAF
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Consulte, cree y administre sus solicitudes SIAF. Desde aquí puede ver el estado, la bitácora y los adjuntos.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/colaborador-dashboard')}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              ← Volver
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, borderColor: 'grey.400', color: 'grey.700' }}
            >
              Recargar
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => navigate('/siaf-book/crear')}
              sx={{ borderRadius: 2, py: 1.5, px: 3, textTransform: 'none', fontWeight: 600, boxShadow: 2 }}
            >
              + Crear Nuevo SIAF
            </Button>
          </Box>
        </Box>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="h6" fontWeight="700" sx={{ color: 'grey.800' }}>
              SIAF Existentes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Listado de sus solicitudes con estado, motivo de rechazo (si aplica) y acciones disponibles.
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
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Typography variant="body2" sx={{ color: 'grey.600' }}>
                          No hay solicitudes SIAF registradas. Use «Crear Nuevo SIAF» para agregar una.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    siafList.map((siaf, index) => (
                      <TableRow
                        key={siaf.id}
                        sx={{
                          bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                          '&:hover': { bgcolor: 'action.selected' },
                          '& td': { py: 1.75, borderColor: 'divider' },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>{siaf.id}</TableCell>
                        <TableCell>{siaf.date}</TableCell>
                        <TableCell>{siaf.unit}</TableCell>
                        <TableCell>
                          <Chip
                            label={siaf.status}
                            size="small"
                            color={
                              siaf.status === 'Aprobado' ? 'success' :
                              siaf.status === 'En Revisión' ? 'warning' : 'error'
                            }
                            variant="filled"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>
                          {siaf.status === 'Rechazado' && siaf.ultimoRechazo?.comentario ? (
                            <Tooltip title={siaf.ultimoRechazo.comentario}>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 220, color: 'grey.700' }}>
                                {siaf.ultimoRechazo.comentario}
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
                          {(siaf.status === 'En Revisión' || siaf.status === 'Rechazado') && (
                            <Tooltip title={siaf.status === 'Rechazado' ? 'Corregir y reenviar' : 'Corregir SIAF'}>
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
                          {b.tipo === 'rechazo' ? 'Rechazo' : b.tipo === 'correccion' ? 'Corrección' : b.tipo === 'aprobado_dd' ? 'Aprobado (DD)' : 'Autorizado'}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 400 }}>
                        {b.tipo === 'correccion' ? (
                          (b.detalleAntes || b.detalleDespues) ? (
                            <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                              {b.detalleAntes && <><strong>Antes:</strong> {b.detalleAntes}</>}
                              {b.detalleAntes && b.detalleDespues && '\n'}
                              {b.detalleDespues && <><strong>Corregido a:</strong> {b.detalleDespues}</>}
                            </Box>
                          ) : (b.comentario || 'Corrección registrada.')
                        ) : (b.comentario || '—')}
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
            <Box sx={{ textAlign: 'center', mb: 3, pb: 2, borderBottom: '2px solid #1565c0' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0', letterSpacing: '0.02em' }}>
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
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
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
                            color: b.tipo === 'rechazo' ? '#c62828' : b.tipo === 'correccion' ? '#1565c0' : '#2e7d32',
                          }}
                        >
                          {b.tipo === 'rechazo' ? 'Rechazo' : b.tipo === 'correccion' ? 'Corrección' : b.tipo === 'aprobado_dd' ? 'Aprobado (DD)' : 'Autorizado'}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderColor: '#e0e0e0', color: '#333' }}>
                        {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                      </TableCell>
                      <TableCell sx={{ borderColor: '#e0e0e0', color: '#333', maxWidth: 400 }}>
                        {b.tipo === 'correccion' ? (
                          (b.detalleAntes || b.detalleDespues) ? (
                            <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                              {b.detalleAntes && <><strong>Antes:</strong> {b.detalleAntes}</>}
                              {b.detalleAntes && b.detalleDespues && '\n'}
                              {b.detalleDespues && <><strong>Corregido a:</strong> {b.detalleDespues}</>}
                            </Box>
                          ) : (b.comentario || 'Corrección registrada.')
                        ) : (b.comentario || '—')}
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
    </Container>
  );
};

export default SiafManagement;
