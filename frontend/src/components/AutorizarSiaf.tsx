import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material';
import { motion } from 'framer-motion';
import { Visibility, Check, Close, Cancel, AttachFile, Download } from '@mui/icons-material';
import { formatFechaDMA } from '../utils';
import { PDFViewer } from '@react-pdf/renderer';
import { SiafPdfDocument } from './SiafPdfDocument';
import api from '../api';
import { useNotification } from '../context/NotificationContext';

interface SiafItem {
  id: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidadMedida?: string;
}

interface SiafSubproducto {
  id: string;
  codigo?: string;
  descripcion?: string;
  cantidad: number;
  unidadMedida?: string;
}

interface SiafAdjunto {
  id: number;
  nombreOriginal: string;
  tamanioBytes: number;
  mimeType?: string;
}

interface SiafSolicitud {
  id: string;
  correlativo: string;
  fecha: string;
  nombreSolicitante: string;
  puestoSolicitante: string;
  nombreUnidad: string;
  areaUnidad: string;
  direccion: string;
  unidadSolicitante: string;
  justificacion: string;
  nombreAutoridad: string;
  puestoAutoridad: string;
  unidadAutoridad: string;
  consistentItem: string;
  items: SiafItem[];
  subproductos: SiafSubproducto[];
  status: 'pendiente' | 'autorizado' | 'rechazado';
  documentosAdjuntos?: SiafAdjunto[];
}

const AutorizarSiaf: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pendientes' | 'autorizados' | 'rechazados'>('pendientes');
  const [solicitudes, setSolicitudes] = useState<Record<string, SiafSolicitud[]>>({
    pendientes: [],
    autorizados: [],
    rechazados: [],
  });
  const [selectedSiaf, setSelectedSiaf] = useState<SiafSolicitud | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openRechazarDialog, setOpenRechazarDialog] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjuntosDialogOpen, setAdjuntosDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ id: number; nombreOriginal: string; mimeType?: string; url?: string } | null>(null);
  const { showSuccess, showError } = useNotification();

  const transformSiaf = useCallback((siaf: any): SiafSolicitud => ({
    id: siaf.id.toString(),
    correlativo: siaf.correlativo,
    fecha: new Date(siaf.fecha).toISOString().split('T')[0],
    nombreSolicitante: siaf.nombreSolicitante || `${siaf.usuarioSolicitante?.nombres || ''} ${siaf.usuarioSolicitante?.apellidos || ''}`.trim() || 'N/A',
    puestoSolicitante: siaf.puestoSolicitante || siaf.usuarioSolicitante?.puesto?.nombre || 'N/A',
    nombreUnidad: siaf.nombreUnidad || siaf.area?.nombre || 'N/A',
    areaUnidad: siaf.area?.nombre || 'N/A',
    direccion: siaf.direccion || '',
    unidadSolicitante: siaf.unidadSolicitante || siaf.area?.nombre || 'N/A',
    justificacion: siaf.justificacion || '',
    nombreAutoridad: siaf.nombreAutoridad || '',
    puestoAutoridad: siaf.puestoAutoridad || '',
    unidadAutoridad: siaf.unidadAutoridad || '',
    consistentItem: siaf.consistenteItem || siaf.consistentItem || '',
    items: (siaf.items || []).map((i: any) => ({ id: i.id?.toString(), codigo: i.codigo || '', descripcion: i.descripcion || '', cantidad: Number(i.cantidad || 0), unidadMedida: i.unidadMedida })),
    subproductos: (siaf.subproductos || []).map((s: any) => ({ id: s.id?.toString(), codigo: s.codigo || '', cantidad: Number(s.cantidad || 0), descripcion: s.descripcion, unidadMedida: s.unidadMedida })),
    status: (siaf.estado || siaf.status) as 'pendiente' | 'autorizado' | 'rechazado',
    documentosAdjuntos: (siaf.documentosAdjuntos || []).map((a: any) => ({ id: a.id, nombreOriginal: a.nombreOriginal, tamanioBytes: a.tamanioBytes || 0, mimeType: a.mimeType })),
  }), []);

  const fetchAllSolicitudes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resPend, resUnidad] = await Promise.all([
        api.get('/siaf/para-autorizar'),
        api.get('/siaf/por-unidad'),
      ]);
      const pendientes = (resPend.data || []).map(transformSiaf);
      const todas = (resUnidad.data || []).map(transformSiaf);
      const autorizados = todas.filter((s: SiafSolicitud) => s.status === 'autorizado');
      const rechazados = todas.filter((s: SiafSolicitud) => s.status === 'rechazado');
      setSolicitudes({ pendientes, autorizados, rechazados });
    } catch (err: any) {
      console.error('Error al obtener solicitudes:', err);
      setError('Error al cargar las solicitudes SIAF. Por favor, intente de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  }, [transformSiaf]);
  
  useEffect(() => {
    fetchAllSolicitudes();
  }, [fetchAllSolicitudes]);

  const handleOpenDialog = (siaf: SiafSolicitud) => {
    setSelectedSiaf(siaf);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setSelectedSiaf(null);
    setOpenDialog(false);
    setOpenRechazarDialog(false);
    setMotivoRechazo('');
  };

  const handleAutorizar = async () => {
    if (!selectedSiaf) return;
    try {
      await api.put(`/siaf/${selectedSiaf.id}/autorizar`, { comentario: '' });
      showSuccess('Solicitud SIAF aprobada correctamente');
      handleCloseDialog();
      await fetchAllSolicitudes();
      setActiveTab('pendientes');
    } catch (error: any) {
      console.error('Error al autorizar:', error);
      showError(error.response?.data?.message || 'Error al autorizar la solicitud');
    }
  };

  const handleConfirmarRechazo = async () => {
    if (!selectedSiaf) return;
    const motivo = (motivoRechazo || '').trim();
    if (!motivo) {
      showError('Debe indicar el motivo del rechazo (obligatorio).');
      return;
    }
    try {
      await api.put(`/siaf/${selectedSiaf.id}/rechazar`, { comentario: motivo });
      showSuccess('Solicitud SIAF rechazada');
      setOpenRechazarDialog(false);
      setMotivoRechazo('');
      handleCloseDialog();
      await fetchAllSolicitudes();
      setActiveTab('pendientes');
    } catch (error: any) {
      console.error('Error al rechazar:', error);
      showError(error.response?.data?.message || 'Error al rechazar la solicitud');
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pendiente':
        return <Chip label="Pendiente" color="warning" size="small" />;
      case 'autorizado':
        return <Chip label="Autorizado" color="success" size="small" />;
      case 'rechazado':
        return <Chip label="Rechazado" color="error" size="small" />;
      default:
        return <Chip label="Desconocido" color="default" size="small" />;
    }
  };
  
  const getTabLabel = (tab: 'pendientes' | 'autorizados' | 'rechazados') => {
    const count = solicitudes[tab]?.length || 0;
    return `${tab.charAt(0).toUpperCase() + tab.slice(1)} (${count})`;
  };

  const getCurrentSolicitudes = () => {
    return solicitudes[activeTab] || [];
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          Autorización de Solicitudes SIAF
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Solicitudes SIAF de tu unidad (Pendientes, Autorizadas y Rechazadas)
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Estadísticas */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              cursor: 'pointer',
              border: activeTab === 'pendientes' ? '2px solid #1976d2' : 'none',
              '&:hover': { 
                boxShadow: 6,
                transform: 'translateY(-2px)',
                transition: 'all 0.3s ease'
              }
            }}
            onClick={() => setActiveTab('pendientes')}
          >
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Pendientes
              </Typography>
              <Typography variant="h4" color="warning.main">
                {solicitudes.pendientes.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              cursor: 'pointer',
              border: activeTab === 'autorizados' ? '2px solid #2e7d32' : 'none',
              '&:hover': { 
                boxShadow: 6,
                transform: 'translateY(-2px)',
                transition: 'all 0.3s ease'
              }
            }}
            onClick={() => setActiveTab('autorizados')}
          >
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Autorizados
              </Typography>
              <Typography variant="h4" color="success.main">
                {solicitudes.autorizados.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              cursor: 'pointer',
              border: activeTab === 'rechazados' ? '2px solid #d32f2f' : 'none',
              '&:hover': { 
                boxShadow: 6,
                transform: 'translateY(-2px)',
                transition: 'all 0.3s ease'
              }
            }}
            onClick={() => setActiveTab('rechazados')}
          >
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Rechazados
              </Typography>
              <Typography variant="h4" color="error.main">
                {solicitudes.rechazados.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box mb={3}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab label={getTabLabel('pendientes')} value="pendientes" />
          <Tab label={getTabLabel('autorizados')} value="autorizados" />
          <Tab label={getTabLabel('rechazados')} value="rechazados" />
        </Tabs>
      </Box>

      {/* Tabla */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Correlativo</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Solicitante</TableCell>
              <TableCell>Área/Unidad</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {getCurrentSolicitudes().length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    No hay solicitudes SIAF {activeTab}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              getCurrentSolicitudes().map((siaf) => (
                <TableRow key={siaf.id}>
                  <TableCell>{siaf.correlativo}</TableCell>
                  <TableCell>{formatFechaDMA(siaf.fecha)}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {siaf.nombreSolicitante}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {siaf.puestoSolicitante}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {siaf.nombreUnidad}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {siaf.areaUnidad}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{getStatusChip(siaf.status)}</TableCell>
                  <TableCell>
                    <Tooltip title="Ver detalles">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(siaf)}
                        color="primary"
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Diálogo: PDF con formato SIAF y botones Aprobar / Rechazar / Cancelar */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <span>Solicitud SIAF — {selectedSiaf?.correlativo}</span>
          {(selectedSiaf?.documentosAdjuntos?.length ?? 0) > 0 && (
            <Tooltip title="Ver documentos adjuntos">
              <Button
                size="small"
                startIcon={<AttachFile />}
                onClick={() => setAdjuntosDialogOpen(true)}
                variant="outlined"
              >
                Documentos adjuntos ({selectedSiaf?.documentosAdjuntos?.length ?? 0})
              </Button>
            </Tooltip>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedSiaf && (
            <Box sx={{ height: '70vh', minHeight: 400 }}>
              <PDFViewer width="100%" height="100%" style={{ border: 'none' }}>
                <SiafPdfDocument
                  data={{
                    fecha: selectedSiaf.fecha,
                    correlativo: selectedSiaf.correlativo,
                    nombreUnidad: selectedSiaf.nombreUnidad,
                    direccion: selectedSiaf.direccion || '',
                    justificacion: selectedSiaf.justificacion,
                    items: selectedSiaf.items.map((i) => ({ codigo: i.codigo || '', descripcion: i.descripcion || '', cantidad: Number(i.cantidad || 0) })),
                    subproductos: selectedSiaf.subproductos.map((s) => ({ codigo: String(s.codigo ?? ''), cantidad: Number(s.cantidad || 0) })),
                    totalSubproductoCantidad: selectedSiaf.subproductos.reduce((sum, s) => sum + Number(s.cantidad || 0), 0),
                    nombreSolicitante: selectedSiaf.nombreSolicitante,
                    puestoSolicitante: selectedSiaf.puestoSolicitante,
                    unidadSolicitante: selectedSiaf.unidadSolicitante || selectedSiaf.nombreUnidad,
                    nombreAutoridad: selectedSiaf.nombreAutoridad || '',
                    puestoAutoridad: selectedSiaf.puestoAutoridad || '',
                    unidadAutoridad: selectedSiaf.unidadAutoridad || '',
                    areaUnidad: selectedSiaf.areaUnidad || selectedSiaf.nombreUnidad,
                    consistentItem: selectedSiaf.consistentItem,
                  }}
                />
              </PDFViewer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button
            onClick={handleCloseDialog}
            startIcon={<Cancel />}
            variant="outlined"
          >
            Cancelar / Cerrar
          </Button>
          {selectedSiaf?.status === 'pendiente' && (
            <>
              <Button
                onClick={() => { setMotivoRechazo(''); setOpenRechazarDialog(true); }}
                color="error"
                startIcon={<Close />}
                variant="outlined"
              >
                Rechazar
              </Button>
              <Button
                onClick={handleAutorizar}
                color="success"
                startIcon={<Check />}
                variant="contained"
              >
                Aprobar
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Diálogo: indicar motivo de rechazo (solo al presionar Rechazar) */}
      <Dialog open={openRechazarDialog} onClose={() => { setOpenRechazarDialog(false); setMotivoRechazo(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>Motivo de rechazo</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={4}
            required
            label="Indique el motivo del rechazo"
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Escriba por qué se rechaza esta solicitud..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setOpenRechazarDialog(false); setMotivoRechazo(''); }} variant="outlined">
            Cancelar
          </Button>
          <Button onClick={handleConfirmarRechazo} color="error" variant="contained" startIcon={<Close />}>
            Confirmar rechazo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de documentos adjuntos (desde Autorizar SIAF) */}
      <Dialog open={adjuntosDialogOpen} onClose={() => setAdjuntosDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Documentos adjuntos del SIAF</DialogTitle>
        <DialogContent>
          {selectedSiaf?.documentosAdjuntos?.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Tamaño</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedSiaf.documentosAdjuntos.map((a) => (
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
                          <Visibility />
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
                          <Download />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography color="text.secondary">No hay documentos adjuntos.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjuntosDialogOpen(false)}>Cerrar</Button>
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
                    startIcon={<Download />}
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
              startIcon={<Download />}
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
    </motion.div>
  );
};

export default AutorizarSiaf;