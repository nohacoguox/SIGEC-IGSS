import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowBack as ArrowBackIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  DescriptionOutlined as DescriptionIcon,
} from '@mui/icons-material';
import api from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  tableHeaderCellStyle,
  tableHeaderRowStyle,
  tableHeaderCellSx,
  pageTitleSx,
} from '../../theme/institutionalStyles';
import { IGSS_COLORS } from '../../theme/institutionalColors';
import { formatFechaDMA } from '../../utils/dateUtils';
import { estadoConfig } from './constants';
import type {
  BitacoraEntry,
  DocumentoRow,
  DocumentoVersionRow,
  ExpedienteRow,
  UltimoRechazo,
  ViewingDoc,
} from './types';
import BitacoraDialog from './components/BitacoraDialog';
import DocumentoViewerDialog from './components/DocumentoViewerDialog';
import ExpedienteDetalleDrawer from './components/ExpedienteDetalleDrawer';
import VerMarcaDialog, { type VerMarcaRequest } from './components/VerMarcaDialog';
import VersionesDocumentoDialog from './components/VersionesDocumentoDialog';

type UnitExpedienteRow = ExpedienteRow & {
  unidadOrigen?: string | null;
  solicitante: string;
  ultimoRechazo?: { comentario: string | null; fecha: string } | null;
};

const ExpedientesUnidad: React.FC = () => {
  const navigate = useNavigate();
  const { showError } = useNotification();
  const { hasPermission } = usePermissions();
  const [list, setList] = useState<UnitExpedienteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expedienteDetalle, setExpedienteDetalle] = useState<ExpedienteRow | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [ultimoRechazo, setUltimoRechazo] = useState<UltimoRechazo | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  const [viewingDoc, setViewingDoc] = useState<ViewingDoc | null>(null);
  const [viewerDocLoading, setViewerDocLoading] = useState(false);

  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [bitacoraList, setBitacoraList] = useState<BitacoraEntry[]>([]);
  const [bitacoraLoading, setBitacoraLoading] = useState(false);
  const [bitacoraTitulo, setBitacoraTitulo] = useState('');
  const [bitacoraExpedienteId, setBitacoraExpedienteId] = useState<number | null>(null);

  const [versionesOpen, setVersionesOpen] = useState(false);
  const [versionesLoading, setVersionesLoading] = useState(false);
  const [versionesList, setVersionesList] = useState<DocumentoVersionRow[]>([]);
  const [versionesTarget, setVersionesTarget] = useState<{ docId: number; nombre: string } | null>(null);

  const [verMarcaRequest, setVerMarcaRequest] = useState<VerMarcaRequest | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/expedientes/unidad');
      const rows: UnitExpedienteRow[] = (Array.isArray(res.data) ? res.data : []).map((e: any) => ({
        id: e.id,
        numeroExpediente: e.numeroExpediente ?? '',
        titulo: e.titulo ?? '',
        tipoExpediente: e.tipoExpediente ?? '',
        estado: e.estado ?? '',
        fechaApertura: e.fechaApertura ?? e.createdAt ?? '',
        descripcion: e.descripcion ?? null,
        numeroOrdenCompra: e.numeroOrdenCompra ?? null,
        numeroSiaf: e.numeroSiaf ?? null,
        unidadOrigen: e.unidadOrigen ?? e.usuario?.unidadMedica ?? null,
        solicitante: [e.usuario?.nombres, e.usuario?.apellidos].filter(Boolean).join(' ').trim() || '—',
        ultimoRechazo: e.ultimoRechazo ?? null,
      }));
      setList(rows);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudieron cargar los expedientes de la unidad.';
      showError(message);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    const tryLoad = () => {
      if (hasPermission('listado-expedientes-unidad')) {
        void loadList();
      }
    };
    tryLoad();
    window.addEventListener('sigec:permissions-refreshed', tryLoad);
    return () => window.removeEventListener('sigec:permissions-refreshed', tryLoad);
  }, [hasPermission, loadList]);

  const resumen = ['en_proceso', 'rechazado', 'cerrado'].map((estado) => {
    const cfg = estadoConfig[estado] ?? estadoConfig.abierto;
    return {
      estado: cfg.label,
      total: list.filter((e) => {
        if (estado === 'cerrado') return e.estado === 'cerrado' || e.estado === 'aprobado' || e.estado === 'archivado';
        return e.estado === estado;
      }).length,
      color: cfg.color,
      bg: cfg.bg,
      icon: cfg.icon,
    };
  });

  const openDetalle = async (expedienteId: number) => {
    setDrawerOpen(true);
    setExpedienteDetalle(null);
    setDocumentos([]);
    setUltimoRechazo(null);
    setDetalleLoading(true);
    try {
      const res = await api.get(`/expedientes/${expedienteId}`);
      const e = res.data;
      setExpedienteDetalle({
        id: e.id,
        numeroExpediente: e.numeroExpediente ?? '',
        titulo: e.titulo ?? '',
        tipoExpediente: e.tipoExpediente ?? '',
        estado: e.estado ?? 'abierto',
        fechaApertura: e.fechaApertura ?? e.createdAt ?? '',
        descripcion: e.descripcion ?? null,
        numeroOrdenCompra: e.numeroOrdenCompra ?? null,
        numeroSiaf: e.numeroSiaf ?? null,
      });
      setDocumentos(
        (e.documentos || []).map((d: any) => ({
          id: d.id,
          tipoDocumento: d.tipoDocumento ?? '',
          nombreArchivo: d.nombreArchivo ?? '',
          descripcion: d.descripcion ?? null,
          fechaSubida: d.fechaSubida ?? d.fecha_subida ?? '',
          tamanioBytes: d.tamanioBytes ?? d.tamanio_bytes ?? 0,
          mimeType: d.mimeType ?? d.mime_type ?? '',
        })),
      );
      setUltimoRechazo(e.ultimoRechazo ?? null);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Error al cargar el expediente.');
      setDrawerOpen(false);
    } finally {
      setDetalleLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setExpedienteDetalle(null);
    setDocumentos([]);
    setUltimoRechazo(null);
  };

  const fetchBitacora = async (expedienteId: number): Promise<BitacoraEntry[]> => {
    const res = await api.get(`/expedientes/${expedienteId}/bitacora`);
    return Array.isArray(res.data) ? res.data : [];
  };

  const handleOpenBitacora = async (expedienteId: number, numeroExpediente: string) => {
    setBitacoraTitulo(`Bitácora — Expediente ${numeroExpediente}`);
    setBitacoraExpedienteId(expedienteId);
    setBitacoraOpen(true);
    setBitacoraLoading(true);
    setBitacoraList([]);
    try {
      setBitacoraList(await fetchBitacora(expedienteId));
    } catch {
      showError('Error al cargar la bitácora.');
      setBitacoraList([]);
    } finally {
      setBitacoraLoading(false);
    }
  };

  const handleRecargarBitacora = async () => {
    if (bitacoraExpedienteId == null) return;
    setBitacoraLoading(true);
    try {
      setBitacoraList(await fetchBitacora(bitacoraExpedienteId));
    } catch {
      showError('Error al recargar la bitácora.');
    } finally {
      setBitacoraLoading(false);
    }
  };

  const handleVerDocumento = (
    expedienteId: number,
    docId: number,
    nombre: string,
    mimeType: string,
    observaciones?: Array<{ comentario: string; pagina?: number | null; tieneMarca?: boolean }>,
  ) => {
    setViewerDocLoading(true);
    setViewingDoc(null);
    api
      .get(`/expedientes/${expedienteId}/documentos/${docId}/archivo`, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data], { type: mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        setViewingDoc({
          url,
          nombreOriginal: nombre,
          mimeType: mimeType || '',
          expedienteId,
          docId,
          observaciones: observaciones?.length ? observaciones : undefined,
        });
        setViewerDocLoading(false);
      })
      .catch((err) => {
        showError(err?.response?.data?.message || 'Error al abrir el documento.');
        setViewerDocLoading(false);
      });
  };

  const abrirVersiones = async (doc: DocumentoRow) => {
    if (!expedienteDetalle) return;
    setVersionesTarget({ docId: doc.id, nombre: doc.nombreArchivo || doc.tipoDocumento });
    setVersionesOpen(true);
    setVersionesLoading(true);
    setVersionesList([]);
    try {
      const res = await api.get(`/expedientes/${expedienteDetalle.id}/documentos/${doc.id}/versiones`);
      setVersionesList(Array.isArray(res.data) ? res.data : []);
    } catch {
      showError('Error al cargar el historial de versiones.');
      setVersionesList([]);
    } finally {
      setVersionesLoading(false);
    }
  };

  const descargarVersion = (versionId: number, nombreArchivo: string) => {
    if (!expedienteDetalle || !versionesTarget) return;
    api
      .get(`/expedientes/${expedienteDetalle.id}/documentos/${versionesTarget.docId}/versiones/${versionId}/archivo`, {
        responseType: 'blob',
      })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo || `version-${versionId}`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => showError('Error al descargar la versión.'));
  };

  if (!hasPermission('listado-expedientes-unidad')) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No tiene permiso para ver los expedientes de la unidad.
        </Typography>
      </Container>
    );
  }

  return (
    <Container
      maxWidth={drawerOpen ? false : 'lg'}
      sx={{ py: { xs: 2.5, md: 4 }, px: drawerOpen ? { xs: 1.5, sm: 2, md: 3 } : undefined }}
    >
      {!drawerOpen && (
        <>
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
                    Expedientes de mi unidad
                  </Typography>
                  <Typography variant="body1" sx={{ color: alpha('#fff', 0.85), maxWidth: 620, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                    Solo lectura para Director / Administrador: ve los expedientes de su unidad en{' '}
                    <strong>En revisión</strong>, <strong>Rechazado</strong> o <strong>Cerrado</strong>
                    (no incluye abiertos/borradores).
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
                  px: { xs: 2, sm: 3 },
                  py: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                  borderLeft: `4px solid ${IGSS_COLORS.verde}`,
                }}
              >
                <Typography variant="h6" fontWeight="700" sx={{ color: 'grey.800', fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
                  Expedientes de la unidad
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  En revisión, Rechazado y Cerrado. Solo lectura: detalle, documentos y bitácora.
                </Typography>
              </Box>
              <CardContent sx={{ p: 0 }}>
                <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <Table size="medium" sx={{ minWidth: { xs: 640, md: 900 } }}>
                    <TableHead>
                      <TableRow style={tableHeaderRowStyle}>
                        <TableCell align="left" sx={tableHeaderCellSx} style={tableHeaderCellStyle}>
                          N.º expediente
                        </TableCell>
                        <TableCell align="left" sx={{ ...tableHeaderCellSx, display: { xs: 'none', md: 'table-cell' } }} style={tableHeaderCellStyle}>
                          Fecha
                        </TableCell>
                        <TableCell align="left" sx={tableHeaderCellSx} style={tableHeaderCellStyle}>
                          Solicitante
                        </TableCell>
                        <TableCell align="left" sx={{ ...tableHeaderCellSx, display: { xs: 'none', lg: 'table-cell' } }} style={tableHeaderCellStyle}>
                          Unidad
                        </TableCell>
                        <TableCell align="left" sx={{ ...tableHeaderCellSx, display: { xs: 'none', sm: 'table-cell' } }} style={tableHeaderCellStyle}>
                          Título
                        </TableCell>
                        <TableCell align="left" sx={tableHeaderCellSx} style={tableHeaderCellStyle}>
                          Estado
                        </TableCell>
                        <TableCell align="left" sx={{ ...tableHeaderCellSx, display: { xs: 'none', md: 'table-cell' } }} style={tableHeaderCellStyle}>
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
                          <TableCell colSpan={8} align="center" sx={{ py: 7, px: 2 }}>
                            <DescriptionIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                            <Typography variant="body1" sx={{ color: 'grey.700', fontWeight: 600 }}>
                              {loading ? 'Cargando…' : 'No hay expedientes de la unidad en estos estados'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'grey.600' }}>
                              Verifique que el Director tenga la misma unidad médica que el colaborador que
                              creó el expediente.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        list.map((exp, index) => {
                          const cfg = estadoConfig[exp.estado] ?? estadoConfig.abierto;
                          return (
                            <TableRow
                              key={exp.id}
                              sx={{
                                bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                                '&:hover': { bgcolor: alpha(IGSS_COLORS.azul, 0.08) },
                                '& td': { py: 1.75, borderColor: 'divider' },
                              }}
                            >
                              <TableCell sx={{ fontWeight: 700, color: IGSS_COLORS.azulOscuro, whiteSpace: 'nowrap' }}>
                                {exp.numeroExpediente}
                              </TableCell>
                              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>
                                {formatFechaDMA(exp.fechaApertura)}
                              </TableCell>
                              <TableCell sx={{ maxWidth: 160 }}>
                                <Typography variant="body2" noWrap title={exp.solicitante}>
                                  {exp.solicitante}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, maxWidth: 180 }}>
                                <Typography variant="body2" noWrap title={exp.unidadOrigen || undefined}>
                                  {exp.unidadOrigen || '—'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, maxWidth: 140 }}>
                                <Typography variant="body2" noWrap title={exp.titulo || undefined}>
                                  {exp.titulo || '—'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={cfg.label}
                                  size="small"
                                  sx={{
                                    fontWeight: 700,
                                    bgcolor: cfg.bg,
                                    color: cfg.color,
                                    border: `1px solid ${alpha(cfg.color, 0.35)}`,
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, maxWidth: 200 }}>
                                {exp.estado === 'rechazado' && exp.ultimoRechazo?.comentario ? (
                                  <Tooltip title={exp.ultimoRechazo.comentario}>
                                    <Typography variant="body2" noWrap sx={{ maxWidth: 200, color: 'grey.700' }}>
                                      {exp.ultimoRechazo.comentario}
                                    </Typography>
                                  </Tooltip>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <Tooltip title="Ver bitácora">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenBitacora(exp.id, exp.numeroExpediente)}
                                    sx={{ color: 'grey.700' }}
                                  >
                                    <HistoryIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Ver detalle">
                                  <IconButton size="small" color="primary" onClick={() => openDetalle(exp.id)}>
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {drawerOpen && (
        <ExpedienteDetalleDrawer
          expedienteDetalle={expedienteDetalle}
          documentos={documentos}
          ultimoRechazo={ultimoRechazo}
          detalleLoading={detalleLoading}
          puedeCrear={false}
          enviandoRevision={false}
          eliminandoId={null}
          onClose={closeDrawer}
          onOpenBitacora={handleOpenBitacora}
          onCategorizarPaquete={() => undefined}
          onEnviarRevision={() => undefined}
          onVerDocumento={handleVerDocumento}
          onReemplazarDoc={() => undefined}
          onAbrirVersiones={abrirVersiones}
          onSolicitarEliminar={() => undefined}
          onVerMarca={(
            expedienteId,
            docId,
            nombreDocumento,
            mimeType,
            xPercent,
            yPercent,
            pagina,
            comentario,
            versionId,
          ) => {
            setVerMarcaRequest({
              expedienteId,
              docId,
              nombreDocumento,
              mimeType,
              xPercent,
              yPercent,
              pagina,
              comentario,
              versionId,
            });
          }}
        />
      )}

      <BitacoraDialog
        open={bitacoraOpen}
        titulo={bitacoraTitulo}
        loading={bitacoraLoading}
        entries={bitacoraList}
        expedienteId={bitacoraExpedienteId}
        onClose={() => {
          setBitacoraOpen(false);
          setBitacoraExpedienteId(null);
        }}
        onRecargar={handleRecargarBitacora}
        onAbrirDocumento={(expedienteId, docId) => {
          api
            .get(`/expedientes/${expedienteId}/documentos/${docId}/archivo`, { responseType: 'blob' })
            .then((res) => {
              const blob = new Blob([res.data], { type: res.data.type || 'application/octet-stream' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank', 'noopener,noreferrer');
            })
            .catch(() => showError('No se pudo abrir el documento.'));
        }}
        onAbrirVersion={(expedienteId, docId, versionId) => {
          api
            .get(`/expedientes/${expedienteId}/documentos/${docId}/versiones/${versionId}/archivo`, {
              responseType: 'blob',
            })
            .then((res) => {
              const blob = new Blob([res.data], { type: res.data.type || 'application/octet-stream' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank', 'noopener,noreferrer');
            })
            .catch(() => showError('No se pudo abrir el documento reemplazado.'));
        }}
        onVerMarca={(
          expedienteId,
          docId,
          nombreDocumento,
          mimeType,
          xPercent,
          yPercent,
          pagina,
          comentario,
          versionId,
        ) => {
          setVerMarcaRequest({
            expedienteId,
            docId,
            nombreDocumento,
            mimeType,
            xPercent,
            yPercent,
            pagina,
            comentario,
            versionId,
          });
        }}
      />

      <DocumentoViewerDialog
        viewingDoc={viewingDoc}
        loading={viewerDocLoading}
        onClose={() => {
          if (viewingDoc?.url) URL.revokeObjectURL(viewingDoc.url);
          setViewingDoc(null);
          setViewerDocLoading(false);
        }}
        onDownload={() => {
          if (!viewingDoc) return;
          api
            .get(`/expedientes/${viewingDoc.expedienteId}/documentos/${viewingDoc.docId}/archivo`, {
              responseType: 'blob',
            })
            .then((res) => {
              const url = URL.createObjectURL(new Blob([res.data]));
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute('download', viewingDoc.nombreOriginal);
              document.body.appendChild(link);
              link.click();
              link.remove();
              URL.revokeObjectURL(url);
            })
            .catch(() => showError('Error al descargar el documento.'));
        }}
      />

      <VersionesDocumentoDialog
        open={versionesOpen}
        loading={versionesLoading}
        versiones={versionesList}
        nombreDocumento={versionesTarget?.nombre ?? ''}
        onClose={() => {
          setVersionesOpen(false);
          setVersionesTarget(null);
          setVersionesList([]);
        }}
        onVerVersion={(versionId) => {
          if (!expedienteDetalle || !versionesTarget) return;
          api
            .get(
              `/expedientes/${expedienteDetalle.id}/documentos/${versionesTarget.docId}/versiones/${versionId}/archivo`,
              { responseType: 'blob' },
            )
            .then((res) => {
              const blob = new Blob([res.data], { type: res.data.type || 'application/octet-stream' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank', 'noopener,noreferrer');
            })
            .catch(() => showError('No se pudo abrir la versión.'));
        }}
        onDescargarVersion={descargarVersion}
      />

      <VerMarcaDialog
        open={!!verMarcaRequest}
        request={verMarcaRequest}
        onClose={() => setVerMarcaRequest(null)}
      />
    </Container>
  );
};

export default ExpedientesUnidad;
