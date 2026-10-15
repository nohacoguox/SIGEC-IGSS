import React, { useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  DescriptionOutlined as DescriptionIcon,
  FolderOpen as FolderOpenIcon,
  History as HistoryIcon,
  Numbers as NumbersIcon,
  ReportProblem as ReportProblemIcon,
  Send as SendIcon,
  ShoppingCart as ShoppingCartIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { primaryButtonSx } from '../../../theme/institutionalStyles';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { estadoConfig, esDocumentoPaquete } from '../constants';
import type { DocumentoRow, ExpedienteRow, UltimoRechazo } from '../types';
import { formatBytes } from '../utils';

type ObsDetalle = UltimoRechazo['detalle'][number];

type ExpedienteDetalleDrawerProps = {
  expedienteDetalle: ExpedienteRow | null;
  documentos: DocumentoRow[];
  ultimoRechazo: UltimoRechazo | null;
  detalleLoading: boolean;
  puedeCrear: boolean;
  enviandoRevision: boolean;
  eliminandoId: number | null;
  onClose: () => void;
  onOpenBitacora: (expedienteId: number, numeroExpediente: string) => void;
  onCategorizarPaquete: (doc: DocumentoRow) => void;
  onReemplazarPaquete?: () => void;
  onEnviarRevision: () => void;
  onVerDocumento: (
    expedienteId: number,
    docId: number,
    nombre: string,
    mimeType: string,
    observaciones?: Array<{ comentario: string; pagina?: number | null; tieneMarca?: boolean }>,
  ) => void;
  onReemplazarDoc: (doc: DocumentoRow) => void;
  onAbrirVersiones: (doc: DocumentoRow) => void;
  onSolicitarEliminar: (doc: DocumentoRow) => void;
  onVerMarca: (
    expedienteId: number,
    docId: number,
    nombreDocumento: string,
    mimeType: string,
    xPercent: number,
    yPercent: number,
    pagina?: number | null,
    comentario?: string,
    versionId?: number | null,
  ) => void;
};

const normalizarNombre = (nombre: string) =>
  String(nombre || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const FieldBlock: React.FC<{ label: string; value: React.ReactNode; multiline?: boolean }> = ({
  label,
  value,
  multiline,
}) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography
      variant="caption"
      color="text.secondary"
      fontWeight={700}
      sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.35 }}
    >
      {label}
    </Typography>
    <Typography
      variant={multiline ? 'body2' : 'body1'}
      fontWeight={multiline ? 500 : 700}
      sx={{
        color: IGSS_COLORS.textoOscuro,
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      }}
    >
      {value}
    </Typography>
  </Box>
);

const ExpedienteDetalleDrawer: React.FC<ExpedienteDetalleDrawerProps> = ({
  expedienteDetalle,
  documentos,
  ultimoRechazo,
  detalleLoading,
  puedeCrear,
  enviandoRevision,
  eliminandoId,
  onClose,
  onOpenBitacora,
  onCategorizarPaquete,
  onReemplazarPaquete,
  onEnviarRevision,
  onVerDocumento,
  onReemplazarDoc,
  onAbrirVersiones,
  onSolicitarEliminar,
  onVerMarca,
}) => {
  const docsSeparados = documentos.filter((d) => !esDocumentoPaquete(d.tipoDocumento));
  const paqueteDoc = documentos.find((d) => esDocumentoPaquete(d.tipoDocumento)) || null;

  /** Observaciones del rechazo indexadas por id de documento (y fallback por nombre). */
  const obsPorDocId = useMemo(() => {
    const map = new Map<number, ObsDetalle[]>();
    if (!ultimoRechazo?.detalle?.length) return map;
    for (const d of ultimoRechazo.detalle) {
      let matched = false;
      if (d.expedienteDocumentoId) {
        const prev = map.get(d.expedienteDocumentoId) ?? [];
        prev.push(d);
        map.set(d.expedienteDocumentoId, prev);
        matched = true;
      }
      if (!matched && d.nombreDocumento) {
        const target = normalizarNombre(d.nombreDocumento);
        const doc = documentos.find(
          (x) =>
            normalizarNombre(x.nombreArchivo) === target ||
            normalizarNombre(x.tipoDocumento) === target ||
            normalizarNombre(x.nombreArchivo).includes(target) ||
            target.includes(normalizarNombre(x.nombreArchivo)),
        );
        if (doc) {
          const prev = map.get(doc.id) ?? [];
          prev.push(d);
          map.set(doc.id, prev);
        }
      }
    }
    return map;
  }, [ultimoRechazo, documentos]);

  const getObs = (docId: number) => obsPorDocId.get(docId) ?? [];

  /** Observaciones cuyo documento ya no está en el listado actual. */
  const obsSinDocumentoEnLista = useMemo(() => {
    if (!ultimoRechazo?.detalle?.length) return [] as ObsDetalle[];
    return ultimoRechazo.detalle.filter((d) => {
      if (d.expedienteDocumentoId && documentos.some((x) => x.id === d.expedienteDocumentoId)) return false;
      const target = normalizarNombre(d.nombreDocumento);
      return !documentos.some(
        (x) =>
          normalizarNombre(x.nombreArchivo) === target ||
          normalizarNombre(x.nombreArchivo).includes(target) ||
          target.includes(normalizarNombre(x.nombreArchivo)),
      );
    });
  }, [ultimoRechazo, documentos]);

  const abrirDocumentoConObservaciones = (doc: DocumentoRow) => {
    if (!expedienteDetalle) return;
    const obs = getObs(doc.id);
    const conMarca = obs.find(
      (o) => o.xPercent != null && o.yPercent != null && Number.isFinite(o.xPercent) && Number.isFinite(o.yPercent),
    );
    if (conMarca) {
      onVerMarca(
        expedienteDetalle.id,
        conMarca.expedienteDocumentoId || doc.id,
        conMarca.nombreDocumento || doc.nombreArchivo,
        doc.mimeType,
        conMarca.xPercent ?? 0,
        conMarca.yPercent ?? 0,
        conMarca.pagina,
        conMarca.comentario,
        conMarca.documentoVersionIdParaMarca,
      );
      return;
    }
    onVerDocumento(
      expedienteDetalle.id,
      doc.id,
      doc.nombreArchivo,
      doc.mimeType,
      obs.map((o) => ({
        comentario: o.comentario,
        pagina: o.pagina,
        tieneMarca: o.xPercent != null && o.yPercent != null,
      })),
    );
  };

  const puedeEditarDocs =
    puedeCrear &&
    (expedienteDetalle?.estado === 'abierto' || expedienteDetalle?.estado === 'rechazado');
  const puedeEnviarRevision =
    puedeCrear &&
    (expedienteDetalle?.estado === 'abierto' || expedienteDetalle?.estado === 'rechazado');
  const mostrarPanelAcciones =
    puedeEditarDocs ||
    puedeEnviarRevision ||
    (docsSeparados.length === 0 && puedeEnviarRevision);
  /** En la lista principal solo las piezas categorizadas; el paquete va aparte. */
  const docsListaPrincipal = docsSeparados.length > 0 ? docsSeparados : documentos;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Box
        sx={{
          mb: { xs: 2, md: 3 },
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
            gap: { xs: 2, sm: 2.5 },
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="overline"
              sx={{ opacity: 0.85, letterSpacing: 1.2, fontWeight: 700, fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
            >
              Expediente de compras
            </Typography>
            {expedienteDetalle ? (
              <>
                <Typography
                  component="h1"
                  fontWeight={800}
                  sx={{
                    fontSize: { xs: '1.45rem', sm: '1.75rem', md: '2rem' },
                    lineHeight: 1.15,
                    letterSpacing: 0.2,
                    wordBreak: 'break-word',
                  }}
                >
                  {expedienteDetalle.numeroExpediente}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    mt: 0.75,
                    opacity: 0.92,
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                    wordBreak: 'break-word',
                  }}
                >
                  {expedienteDetalle.titulo}
                  {expedienteDetalle.descripcion ? ` · ${expedienteDetalle.descripcion}` : ''}
                </Typography>
              </>
            ) : (
              <Typography variant="h5" fontWeight={700}>
                Cargando expediente…
              </Typography>
            )}
            {expedienteDetalle && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.75 }}>
                {(() => {
                  const cfg = estadoConfig[expedienteDetalle.estado] ?? estadoConfig.abierto;
                  return (
                    <Chip
                      size="small"
                      label={cfg.label}
                      sx={{ fontWeight: 700, bgcolor: alpha('#fff', 0.95), color: cfg.color }}
                    />
                  );
                })()}
                {expedienteDetalle.numeroOrdenCompra && (
                  <Chip
                    size="small"
                    icon={<ShoppingCartIcon />}
                    label={`O.C. ${expedienteDetalle.numeroOrdenCompra}`}
                    sx={{
                      fontWeight: 700,
                      bgcolor: alpha('#fff', 0.16),
                      color: '#fff',
                      border: `1px solid ${alpha('#fff', 0.28)}`,
                      '& .MuiChip-icon': { color: '#fff' },
                    }}
                  />
                )}
                <Chip
                  size="small"
                  icon={<NumbersIcon />}
                  label={`${docsSeparados.length} documento${docsSeparados.length === 1 ? '' : 's'}`}
                  sx={{
                    fontWeight: 700,
                    bgcolor: alpha('#fff', 0.16),
                    color: '#fff',
                    border: `1px solid ${alpha('#fff', 0.28)}`,
                    '& .MuiChip-icon': { color: '#fff' },
                  }}
                />
              </Box>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              gap: 1.25,
              flexShrink: 0,
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={onClose}
              fullWidth
              sx={{
                width: { xs: '100%', sm: 'auto' },
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                color: '#fff',
                borderColor: alpha('#fff', 0.65),
                '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) },
              }}
            >
              Volver a la lista
            </Button>
            {expedienteDetalle && (
              <Button
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => onOpenBitacora(expedienteDetalle.id, expedienteDetalle.numeroExpediente)}
                fullWidth
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#fff',
                  borderColor: alpha('#fff', 0.65),
                  '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.12) },
                }}
              >
                Bitácora
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {detalleLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
          <CircularProgress size={40} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Cargando detalle…
          </Typography>
        </Box>
      ) : expedienteDetalle ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 280px) minmax(0, 1fr)' },
            gap: { xs: 2, md: 2.5 },
            alignItems: 'start',
            width: '100%',
            maxWidth: '100%',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: '#fff',
                boxShadow: `0 4px 16px ${alpha('#000', 0.04)}`,
                overflow: 'hidden',
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={800}
                sx={{ mb: 1.75, color: IGSS_COLORS.azulOscuro }}
              >
                Datos del expediente
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                <FieldBlock label="Número" value={expedienteDetalle.numeroExpediente} />
                <FieldBlock
                  label="Orden de compra (O.C.)"
                  value={expedienteDetalle.numeroOrdenCompra || '—'}
                />
                <FieldBlock label="Número SIAF" value={expedienteDetalle.numeroSiaf || '—'} />
                <FieldBlock label="Título" value={expedienteDetalle.titulo} />
                <FieldBlock
                  label="Descripción"
                  value={expedienteDetalle.descripcion || 'Sin descripción'}
                  multiline
                />
              </Box>
            </Paper>

            {mostrarPanelAcciones && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                }}
              >
                {puedeEditarDocs && paqueteDoc && docsSeparados.length === 0 && (
                  <Button
                    variant="contained"
                    startIcon={<FolderOpenIcon />}
                    onClick={() => onCategorizarPaquete(paqueteDoc)}
                    sx={{
                      ...primaryButtonSx,
                      bgcolor: IGSS_COLORS.azulOscuro,
                      '&:hover': { bgcolor: IGSS_COLORS.azul },
                    }}
                  >
                    Categorizar PDF completo
                  </Button>
                )}
                {puedeEditarDocs && onReemplazarPaquete && (
                  <Button
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    onClick={onReemplazarPaquete}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2,
                      borderColor: IGSS_COLORS.azulOscuro,
                      color: IGSS_COLORS.azulOscuro,
                    }}
                  >
                    Reemplazar PDF completo y re-categorizar
                  </Button>
                )}
                {puedeEnviarRevision && (
                  <Button
                    variant="contained"
                    startIcon={<SendIcon />}
                    onClick={onEnviarRevision}
                    disabled={enviandoRevision || docsSeparados.length === 0}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2,
                      bgcolor: IGSS_COLORS.verde,
                      '&:hover': { bgcolor: IGSS_COLORS.verdeOscuro },
                    }}
                  >
                    {enviandoRevision ? 'Enviando…' : 'Enviar a revisión'}
                  </Button>
                )}
                {docsSeparados.length === 0 && puedeEnviarRevision && (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                    {paqueteDoc
                      ? 'Categorice el PDF completo para poder enviar a revisión.'
                      : 'Este expediente no tiene PDF completo. Créelo de nuevo con el archivo del expediente.'}
                  </Typography>
                )}
              </Paper>
            )}

          </Box>

          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: '#fff',
              overflow: 'hidden',
              boxShadow: `0 4px 18px ${alpha('#000', 0.05)}`,
              minWidth: 0,
              width: '100%',
            }}
          >
            <Box
              sx={{
                px: { xs: 2, sm: 2.5, md: 3 },
                py: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'action.hover',
                borderLeft: `4px solid ${IGSS_COLORS.verde}`,
              }}
            >
              <Typography variant="h6" fontWeight={800} sx={{ color: 'grey.800', fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
                Documentos del expediente
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Se generan al categorizar el PDF completo por tipo y páginas.
              </Typography>
            </Box>

            <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5 }, minWidth: 0 }}>
              {documentos.length === 0 ? (
                <Box
                  sx={{
                    p: { xs: 3, md: 5 },
                    borderRadius: 3,
                    border: `1.5px dashed ${alpha(IGSS_COLORS.azul, 0.45)}`,
                    bgcolor: alpha(IGSS_COLORS.azul, 0.04),
                    textAlign: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      mx: 'auto',
                      mb: 1.5,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.1),
                      color: IGSS_COLORS.azulOscuro,
                    }}
                  >
                    <FolderOpenIcon sx={{ fontSize: 36 }} />
                  </Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.75 }}>
                    Sin PDF completo
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto' }}>
                    Al crear el expediente debe subir el PDF completo. Luego categorice las páginas (SIAF,
                    factura, O.C., etc.).
                  </Typography>
                </Box>
              ) : docsSeparados.length === 0 && paqueteDoc ? (
                <Box
                  sx={{
                    p: { xs: 3, md: 5 },
                    borderRadius: 3,
                    border: `1.5px dashed ${alpha(IGSS_COLORS.azul, 0.45)}`,
                    bgcolor: alpha(IGSS_COLORS.azul, 0.04),
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h5" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.75 }}>
                    PDF completo cargado
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ maxWidth: 520, mx: 'auto', mb: 2.5 }}
                  >
                    Marque qué páginas son SIAF, factura, O.C., acta, etc. El sistema generará cada documento
                    por separado.
                  </Typography>
                  {puedeEditarDocs && (
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<FolderOpenIcon />}
                      onClick={() => onCategorizarPaquete(paqueteDoc)}
                      sx={{
                        ...primaryButtonSx,
                        bgcolor: IGSS_COLORS.azulOscuro,
                        '&:hover': { bgcolor: IGSS_COLORS.azul },
                        px: 3,
                      }}
                    >
                      Categorizar ahora
                    </Button>
                  )}
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
                  {docsListaPrincipal.map((doc) => {
                    const titulo = doc.tipoDocumento || doc.nombreArchivo || 'Documento';
                    const descLimpia = String(doc.descripcion || '')
                      .replace(/\s*del paquete original\.?/gi, '.')
                      .replace(/\s*del PDF completo\.?/gi, '.')
                      .replace(/\.\s*\./g, '.')
                      .trim();
                    const meta = [descLimpia || null, formatBytes(doc.tamanioBytes)].filter(Boolean).join(' · ');
                    const esPaquete = esDocumentoPaquete(doc.tipoDocumento);
                    const obs = getObs(doc.id);
                    const conCorreccion = obs.length > 0;
                    return (
                      <Paper
                        key={doc.id}
                        elevation={0}
                        onClick={() => conCorreccion && abrirDocumentoConObservaciones(doc)}
                        sx={{
                          p: { xs: 1.5, sm: 2 },
                          borderRadius: 2.5,
                          border: '1px solid',
                          borderColor: conCorreccion
                            ? alpha(IGSS_COLORS.error, 0.55)
                            : esPaquete
                              ? alpha(IGSS_COLORS.azul, 0.4)
                              : 'divider',
                          borderLeft: conCorreccion ? `4px solid ${IGSS_COLORS.error}` : undefined,
                          bgcolor: conCorreccion ? alpha(IGSS_COLORS.error, 0.07) : IGSS_COLORS.fondo,
                          overflow: 'hidden',
                          minWidth: 0,
                          cursor: conCorreccion ? 'pointer' : 'default',
                          transition: 'border-color .2s ease, box-shadow .2s ease, background-color .2s ease',
                          '&:hover': {
                            borderColor: conCorreccion
                              ? IGSS_COLORS.error
                              : alpha(IGSS_COLORS.azul, 0.45),
                            boxShadow: conCorreccion
                              ? `0 4px 14px ${alpha(IGSS_COLORS.error, 0.18)}`
                              : `0 4px 14px ${alpha(IGSS_COLORS.azulOscuro, 0.08)}`,
                          },
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: { xs: 'stretch', sm: 'center' },
                            gap: { xs: 1.25, sm: 1.75 },
                            minWidth: 0,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1, minWidth: 0 }}>
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 2,
                                flexShrink: 0,
                                display: 'grid',
                                placeItems: 'center',
                                bgcolor: conCorreccion
                                  ? alpha(IGSS_COLORS.error, 0.14)
                                  : alpha(IGSS_COLORS.verde, 0.14),
                                color: conCorreccion ? IGSS_COLORS.error : IGSS_COLORS.verdeOscuro,
                              }}
                            >
                              {conCorreccion ? (
                                <ReportProblemIcon fontSize="small" />
                              ) : (
                                <DescriptionIcon fontSize="small" />
                              )}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                              <Typography
                                fontWeight={800}
                                title={titulo}
                                sx={{
                                  color: conCorreccion ? IGSS_COLORS.error : IGSS_COLORS.azulOscuro,
                                  fontSize: { xs: '0.95rem', sm: '1rem' },
                                  lineHeight: 1.3,
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {titulo}
                              </Typography>
                              {meta && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    mt: 0.35,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={meta}
                                >
                                  {meta}
                                </Typography>
                              )}
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                                {esPaquete && (
                                  <Chip size="small" label="Paquete origen" sx={{ height: 22, fontWeight: 600 }} />
                                )}
                                {conCorreccion && (
                                  <Chip
                                    size="small"
                                    color="error"
                                    label={
                                      obs.length === 1
                                        ? 'Requiere corrección'
                                        : `${obs.length} correcciones`
                                    }
                                    sx={{ height: 22, fontWeight: 700 }}
                                  />
                                )}
                              </Box>
                              {conCorreccion && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    mt: 0.5,
                                    color: 'error.dark',
                                    fontWeight: 600,
                                  }}
                                >
                                  Clic para ver {obs.some((o) => o.xPercent != null) ? 'la marca y ' : ''}
                                  la observación
                                </Typography>
                              )}
                            </Box>
                          </Box>

                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 0.25,
                              flexShrink: 0,
                              borderTop: { xs: `1px solid ${alpha('#000', 0.06)}`, sm: 'none' },
                              pt: { xs: 1, sm: 0 },
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {esPaquete && puedeEditarDocs && (
                              <Tooltip title="Categorizar páginas">
                                <IconButton size="small" onClick={() => onCategorizarPaquete(doc)} sx={{ color: IGSS_COLORS.azulOscuro }}>
                                  <FolderOpenIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title={conCorreccion ? 'Ver documento y observación' : 'Visualizar'}>
                              <IconButton
                                size="small"
                                onClick={() =>
                                  conCorreccion
                                    ? abrirDocumentoConObservaciones(doc)
                                    : onVerDocumento(
                                        expedienteDetalle.id,
                                        doc.id,
                                        doc.nombreArchivo,
                                        doc.mimeType,
                                      )
                                }
                                sx={{ color: conCorreccion ? IGSS_COLORS.error : IGSS_COLORS.azulOscuro }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Historial de versiones">
                              <IconButton size="small" onClick={() => onAbrirVersiones(doc)} sx={{ color: IGSS_COLORS.azul }}>
                                <HistoryIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {puedeEditarDocs && !esPaquete && (
                              <>
                                <Tooltip title="Reemplazar archivo">
                                  <IconButton size="small" onClick={() => onReemplazarDoc(doc)} sx={{ color: IGSS_COLORS.azul }}>
                                    <CloudUploadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Eliminar">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    disabled={eliminandoId === doc.id}
                                    onClick={() => onSolicitarEliminar(doc)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}

                  {obsSinDocumentoEnLista.length > 0 &&
                    obsSinDocumentoEnLista.map((d, idx) => (
                      <Paper
                        key={`obs-huerfana-${idx}`}
                        elevation={0}
                        onClick={() => {
                          if (!expedienteDetalle || !d.expedienteDocumentoId) return;
                          if (d.xPercent != null && d.yPercent != null) {
                            onVerMarca(
                              expedienteDetalle.id,
                              d.expedienteDocumentoId,
                              d.nombreDocumento,
                              'application/pdf',
                              d.xPercent,
                              d.yPercent,
                              d.pagina,
                              d.comentario,
                              d.documentoVersionIdParaMarca,
                            );
                          } else {
                            onVerDocumento(
                              expedienteDetalle.id,
                              d.expedienteDocumentoId,
                              d.nombreDocumento,
                              'application/pdf',
                              [{ comentario: d.comentario, pagina: d.pagina, tieneMarca: false }],
                            );
                          }
                        }}
                        sx={{
                          p: { xs: 1.5, sm: 2 },
                          borderRadius: 2.5,
                          border: `1px solid ${alpha(IGSS_COLORS.error, 0.55)}`,
                          borderLeft: `4px solid ${IGSS_COLORS.error}`,
                          bgcolor: alpha(IGSS_COLORS.error, 0.07),
                          cursor: d.expedienteDocumentoId ? 'pointer' : 'default',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: 2,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: alpha(IGSS_COLORS.error, 0.14),
                              color: IGSS_COLORS.error,
                              flexShrink: 0,
                            }}
                          >
                            <ReportProblemIcon fontSize="small" />
                          </Box>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography fontWeight={800} sx={{ color: IGSS_COLORS.error }}>
                              {d.nombreDocumento}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                              {d.comentario}
                            </Typography>
                            <Chip
                              size="small"
                              color="error"
                              label="Requiere corrección"
                              sx={{ mt: 0.75, height: 22, fontWeight: 700 }}
                            />
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'error.dark', fontWeight: 600 }}>
                              Clic para abrir y ver la observación
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    ))}

                  {/* Solo el creador ve el PDF de origen; DAF/unidad no. */}
                  {puedeCrear && paqueteDoc && docsSeparados.length > 0 && (
                    <Box
                      sx={{
                        mt: 1.5,
                        pt: 2,
                        borderTop: `1px dashed ${alpha(IGSS_COLORS.azul, 0.35)}`,
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Archivo de origen (solo usted · no se envía a revisión como documento)
                      </Typography>
                      {(() => {
                        const obsPaquete = getObs(paqueteDoc.id);
                        const paqueteConObs = obsPaquete.length > 0;
                        return (
                      <Paper
                        elevation={0}
                        onClick={() => paqueteConObs && abrirDocumentoConObservaciones(paqueteDoc)}
                        sx={{
                          mt: 1,
                          p: { xs: 1.5, sm: 2 },
                          borderRadius: 2.5,
                          border: `1px solid ${
                            paqueteConObs ? alpha(IGSS_COLORS.error, 0.5) : alpha(IGSS_COLORS.azul, 0.3)
                          }`,
                          borderLeft: paqueteConObs ? `4px solid ${IGSS_COLORS.error}` : undefined,
                          bgcolor: paqueteConObs ? alpha(IGSS_COLORS.error, 0.07) : alpha(IGSS_COLORS.azul, 0.04),
                          overflow: 'hidden',
                          cursor: paqueteConObs ? 'pointer' : 'default',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: { xs: 'stretch', sm: 'center' },
                            gap: 1.5,
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              fontWeight={800}
                              sx={{ color: paqueteConObs ? IGSS_COLORS.error : IGSS_COLORS.azulOscuro }}
                            >
                              PDF escaneado completo
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap title={paqueteDoc.nombreArchivo}>
                              {paqueteDoc.nombreArchivo} · {formatBytes(paqueteDoc.tamanioBytes)}
                            </Typography>
                            {paqueteConObs ? (
                              <Chip
                                size="small"
                                color="error"
                                label="Requiere corrección"
                                sx={{ mt: 0.75, height: 22, fontWeight: 700 }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                Use «Reemplazar PDF completo…» si debe volver a armar todo el expediente.
                              </Typography>
                            )}
                          </Box>
                          <Box
                            sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25, flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Tooltip title={paqueteConObs ? 'Ver documento y observación' : 'Ver PDF de origen'}>
                              <IconButton
                                size="small"
                                onClick={() =>
                                  paqueteConObs
                                    ? abrirDocumentoConObservaciones(paqueteDoc)
                                    : onVerDocumento(
                                        expedienteDetalle.id,
                                        paqueteDoc.id,
                                        paqueteDoc.nombreArchivo,
                                        paqueteDoc.mimeType,
                                      )
                                }
                                sx={{ color: paqueteConObs ? IGSS_COLORS.error : IGSS_COLORS.azulOscuro }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Historial de versiones">
                              <IconButton size="small" onClick={() => onAbrirVersiones(paqueteDoc)} sx={{ color: IGSS_COLORS.azul }}>
                                <HistoryIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {puedeEditarDocs && onReemplazarPaquete && (
                              <Tooltip title="Reemplazar PDF completo y re-categorizar">
                                <IconButton size="small" onClick={onReemplazarPaquete} sx={{ color: IGSS_COLORS.azulOscuro }}>
                                  <CloudUploadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                        );
                      })()}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      ) : null}
    </motion.div>
  );
};

export default ExpedienteDetalleDrawer;
