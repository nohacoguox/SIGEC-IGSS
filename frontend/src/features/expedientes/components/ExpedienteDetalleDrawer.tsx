import React from 'react';
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
  AttachFile as AttachFileIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  DescriptionOutlined as DescriptionIcon,
  FolderOpen as FolderOpenIcon,
  History as HistoryIcon,
  Numbers as NumbersIcon,
  Place as PlaceIcon,
  Send as SendIcon,
  ShoppingCart as ShoppingCartIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { primaryButtonSx } from '../../../theme/institutionalStyles';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { estadoConfig } from '../constants';
import type { DocumentoRow, ExpedienteRow, UltimoRechazo } from '../types';
import { formatBytes } from '../utils';

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
  onAgregarDocumento: () => void;
  onEnviarRevision: () => void;
  onVerDocumento: (expedienteId: number, docId: number, nombre: string, mimeType: string) => void;
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
  onAgregarDocumento,
  onEnviarRevision,
  onVerDocumento,
  onReemplazarDoc,
  onAbrirVersiones,
  onSolicitarEliminar,
  onVerMarca,
}) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
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
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 1.2, fontWeight: 700 }}>
            Expediente de compras
          </Typography>
          {expedienteDetalle ? (
            <>
              <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.15, letterSpacing: 0.3 }}>
                {expedienteDetalle.numeroExpediente}
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.75, opacity: 0.92, maxWidth: 720 }}>
                {expedienteDetalle.titulo}
                {expedienteDetalle.descripcion ? ` · ${expedienteDetalle.descripcion}` : ''}
              </Typography>
            </>
          ) : (
            <Typography variant="h5" fontWeight={700}>Cargando expediente…</Typography>
          )}
          {expedienteDetalle && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
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
                label={`${documentos.length} documento${documentos.length === 1 ? '' : 's'}`}
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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={onClose}
            sx={{
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
              sx={{
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Cargando detalle…</Typography>
      </Box>
    ) : expedienteDetalle ? (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '340px 1fr' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: '#fff',
              boxShadow: `0 4px 16px ${alpha('#000', 0.04)}`,
            }}
          >
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.75, color: IGSS_COLORS.azulOscuro }}>
              Datos del expediente
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Número
                </Typography>
                <Typography variant="body1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                  {expedienteDetalle.numeroExpediente}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Orden de compra (O.C.)
                </Typography>
                <Typography variant="body1" fontWeight={700}>
                  {expedienteDetalle.numeroOrdenCompra || '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Número SIAF
                </Typography>
                <Typography variant="body1" fontWeight={700}>
                  {expedienteDetalle.numeroSiaf || '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Título
                </Typography>
                <Typography variant="body1" fontWeight={700}>{expedienteDetalle.titulo}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Descripción
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.25 }}>
                  {expedienteDetalle.descripcion || 'Sin descripción'}
                </Typography>
              </Box>
            </Box>
          </Paper>

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
            {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
              <Button
                variant="contained"
                startIcon={<AttachFileIcon />}
                onClick={onAgregarDocumento}
                sx={{
                  ...primaryButtonSx,
                  bgcolor: IGSS_COLORS.azulOscuro,
                  '&:hover': { bgcolor: IGSS_COLORS.azul },
                }}
              >
                Agregar documento
              </Button>
            )}
            {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && puedeCrear && (
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={onEnviarRevision}
                disabled={enviandoRevision || documentos.length === 0}
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
            {documentos.length === 0 && (expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                Agregue al menos un documento para poder enviar a revisión.
              </Typography>
            )}
          </Paper>

          {expedienteDetalle.estado === 'rechazado' && ultimoRechazo && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: alpha(IGSS_COLORS.error, 0.06),
                border: `1px solid ${alpha(IGSS_COLORS.error, 0.25)}`,
                borderLeft: `4px solid ${IGSS_COLORS.error}`,
              }}
            >
              <Typography variant="subtitle2" fontWeight={800} color="error.dark" sx={{ mb: 0.5 }}>
                Motivo del rechazo
              </Typography>
              {ultimoRechazo.comentario && (
                <Typography variant="body2" sx={{ mb: 1 }}>{ultimoRechazo.comentario}</Typography>
              )}
              {ultimoRechazo.detalle && ultimoRechazo.detalle.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>Observaciones por documento:</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {ultimoRechazo.detalle.map((d, i) => (
                      <li key={i} style={{ marginBottom: 8 }}>
                        <Typography variant="body2">
                          <strong>{d.nombreDocumento}</strong>: {d.comentario}
                          {(d.pagina != null || d.xPercent != null) && (
                            <>
                              <Chip size="small" label="Señalizado" color="warning" sx={{ ml: 0.5, verticalAlign: 'middle' }} icon={<PlaceIcon sx={{ fontSize: 14 }} />} />
                              <Button
                                size="small"
                                startIcon={<PlaceIcon />}
                                onClick={() => expedienteDetalle && d.expedienteDocumentoId && onVerMarca(expedienteDetalle.id, d.expedienteDocumentoId, d.nombreDocumento, documentos.find((doc) => doc.id === d.expedienteDocumentoId)?.mimeType ?? 'application/octet-stream', d.xPercent ?? 0, d.yPercent ?? 0, d.pagina, d.comentario, d.documentoVersionIdParaMarca)}
                                sx={{ ml: 0.5, verticalAlign: 'middle', textTransform: 'none' }}
                              >
                                Ver marca de rechazo
                              </Button>
                            </>
                          )}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </>
              )}
            </Box>
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
            minHeight: 420,
          }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              borderLeft: `4px solid ${IGSS_COLORS.verde}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: 'grey.800' }}>
                Documentos del expediente
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Gestione los archivos que conforman este expediente.
              </Typography>
            </Box>
            {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
              <Button
                size="small"
                variant="contained"
                startIcon={<AttachFileIcon />}
                onClick={onAgregarDocumento}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: IGSS_COLORS.azulOscuro,
                  '&:hover': { bgcolor: IGSS_COLORS.azul },
                }}
              >
                Agregar
              </Button>
            )}
          </Box>

          <Box sx={{ p: 2.5 }}>
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
                  Expediente listo para documentar
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 2.5 }}>
                  Agregue los archivos del expediente. Puede iniciar con la Orden de Compras, ACTA, SIAF autorizado, Contrato u otros.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.75, mb: 3 }}>
                  {['Orden de Compras', 'ACTA', 'SIAF autorizado', 'Contrato', 'Factura'].map((tipo) => (
                    <Chip
                      key={tipo}
                      size="small"
                      label={tipo}
                      sx={{
                        fontWeight: 600,
                        bgcolor: '#fff',
                        border: `1px solid ${alpha(IGSS_COLORS.azul, 0.25)}`,
                        color: IGSS_COLORS.azulOscuro,
                      }}
                    />
                  ))}
                </Box>
                {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<CloudUploadIcon />}
                    onClick={onAgregarDocumento}
                    sx={{
                      ...primaryButtonSx,
                      bgcolor: IGSS_COLORS.azulOscuro,
                      '&:hover': { bgcolor: IGSS_COLORS.azul },
                      px: 3,
                    }}
                  >
                    Subir primer documento
                  </Button>
                )}
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                {documentos.map((doc) => (
                  <Paper
                    key={doc.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: IGSS_COLORS.fondo,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      transition: 'box-shadow .2s ease, border-color .2s ease',
                      '&:hover': {
                        borderColor: alpha(IGSS_COLORS.azul, 0.45),
                        boxShadow: `0 6px 18px ${alpha(IGSS_COLORS.azulOscuro, 0.08)}`,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        flexShrink: 0,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(IGSS_COLORS.verde, 0.12),
                        color: IGSS_COLORS.verdeOscuro,
                      }}
                    >
                      <DescriptionIcon />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ color: IGSS_COLORS.azulOscuro }}>
                        {doc.tipoDocumento || doc.nombreArchivo}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {doc.descripcion || doc.nombreArchivo} · {formatBytes(doc.tamanioBytes)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <Tooltip title="Visualizar">
                        <IconButton
                          size="small"
                          onClick={() => onVerDocumento(expedienteDetalle.id, doc.id, doc.nombreArchivo, doc.mimeType)}
                          sx={{ color: IGSS_COLORS.azulOscuro }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {(expedienteDetalle.estado === 'abierto' || expedienteDetalle.estado === 'rechazado') && (
                        <>
                          <Tooltip title="Reemplazar archivo">
                            <IconButton size="small" onClick={() => onReemplazarDoc(doc)} sx={{ color: IGSS_COLORS.azul }}>
                              <CloudUploadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Historial de versiones">
                            <IconButton size="small" onClick={() => onAbrirVersiones(doc)} sx={{ color: IGSS_COLORS.azul }}>
                              <HistoryIcon fontSize="small" />
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
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    ) : null}
  </motion.div>
);

export default ExpedienteDetalleDrawer;
