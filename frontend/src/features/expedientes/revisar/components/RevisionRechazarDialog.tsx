import React, { RefObject } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Place as PlaceIcon,
  PushPin as PushPinIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import PdfViewerWithClick from '../../../../components/PdfViewerWithClick';
import { IGSS_COLORS } from '../../../../theme/institutionalColors';
import { MOTIVOS_RECHAZO } from '../constants';
import type { DocEnDetalle, RechazoEntry } from '../types';

export type RevisionRechazarDialogProps = {
  open: boolean;
  enviando: boolean;
  expIdRechazar: number | null;
  rechazarLoading: boolean;
  rechazarDocumentos: DocEnDetalle[];
  comentarioRechazo: string;
  onComentarioRechazoChange: (value: string) => void;
  getRechazosForDoc: (docId: number) => RechazoEntry[];
  tieneAlgunMotivoRechazo: boolean;
  docEnVistaId: number | null;
  previewRechazoUrl: string | null;
  previewRechazoLoading: boolean;
  previewRechazoNombre: string;
  previewRechazoMime: string;
  viewerZoom: number;
  setViewerZoom: React.Dispatch<React.SetStateAction<number>>;
  resetViewerZoom: () => void;
  modoMarcar: boolean;
  setModoMarcar: React.Dispatch<React.SetStateAction<boolean>>;
  viewerContainerRef: RefObject<HTMLDivElement>;
  viewerImageRef: RefObject<HTMLImageElement>;
  onClose: () => void;
  onAbrirBitacora: () => void;
  onPrevisualizarDoc: (docId: number, nombre: string, mimeType: string) => void;
  onCerrarPreview: () => void;
  onClickMarcarEnDocumento: (e: React.MouseEvent) => void;
  onClickMarcarPdf: (pageNumber: number, xPercent: number, yPercent: number) => void;
  onAgregarMotivo: (docId: number) => void;
  onQuitarMotivo: (docId: number, index: number) => void;
  onActualizarMotivo: (docId: number, index: number, field: 'categoria' | 'descripcion' | 'pagina', value: string | number | null) => void;
  onAprobar: () => void;
  onRechazar: () => void;
};

const RevisionRechazarDialog: React.FC<RevisionRechazarDialogProps> = ({
  open,
  enviando,
  expIdRechazar,
  rechazarLoading,
  rechazarDocumentos,
  comentarioRechazo,
  onComentarioRechazoChange,
  getRechazosForDoc,
  tieneAlgunMotivoRechazo,
  docEnVistaId,
  previewRechazoUrl,
  previewRechazoLoading,
  previewRechazoNombre,
  previewRechazoMime,
  viewerZoom,
  setViewerZoom,
  resetViewerZoom,
  modoMarcar,
  setModoMarcar,
  viewerContainerRef,
  viewerImageRef,
  onClose,
  onAbrirBitacora,
  onPrevisualizarDoc,
  onCerrarPreview,
  onClickMarcarEnDocumento,
  onClickMarcarPdf,
  onAgregarMotivo,
  onQuitarMotivo,
  onActualizarMotivo,
  onAprobar,
  onRechazar,
}) => (
  <Dialog
    open={open}
    onClose={() => { if (!enviando) onClose(); }}
    maxWidth="xl"
    fullWidth
    PaperProps={{ sx: { minHeight: '88vh', maxHeight: '95vh', borderRadius: 2, display: 'flex', flexDirection: 'column' } }}
  >
    <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1.5, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
      <span>Revisar expediente</span>
      {expIdRechazar != null && (
        <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={onAbrirBitacora} sx={{ textTransform: 'none' }}>
          Ver bitácora
        </Button>
      )}
    </DialogTitle>
    <DialogContent sx={{ pt: 2, pb: 2, flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, px: 0.5, flexShrink: 0 }}>
        <strong>Pasos:</strong> 1) En la lista de la derecha, haga clic en <strong>«Ver»</strong> para abrir cada documento a la izquierda. 2) Use <strong>Acercar / Alejar</strong> si lo necesita. 3) Active <strong>«Marcar corrección»</strong> y haga <strong>clic</strong> en el punto del documento; se abrirá el diálogo para indicar categoría y qué debe corregirse. 4) También puede agregar motivos desde la derecha. Todo queda en la bitácora.
      </Typography>
      {rechazarLoading ? (
        <Typography variant="body2" color="text.secondary">Cargando documentos…</Typography>
      ) : rechazarDocumentos.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No hay documentos en este expediente.</Typography>
      ) : (
        <Grid container spacing={2} sx={{ flex: 1, minHeight: { md: 0 }, height: { md: '100%' }, alignItems: 'stretch' }}>
          <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: 'background.paper',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight="600" color="text.primary">
                  {previewRechazoLoading ? 'Cargando…' : previewRechazoNombre || 'Seleccione un documento con «Ver»'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {(previewRechazoUrl || previewRechazoLoading) && (
                    <>
                      <Tooltip title="Alejar">
                        <span>
                          <IconButton size="small" onClick={() => setViewerZoom((z) => Math.max(0.5, z - 0.25))} disabled={viewerZoom <= 0.5} aria-label="Alejar">
                            <ZoomOutIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Typography variant="caption" sx={{ minWidth: 44, textAlign: 'center' }}>{Math.round(viewerZoom * 100)}%</Typography>
                      <Tooltip title="Acercar">
                        <IconButton size="small" onClick={() => setViewerZoom((z) => Math.min(2.5, z + 0.25))} disabled={viewerZoom >= 2.5} aria-label="Acercar">
                          <ZoomInIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Restablecer zoom">
                        <IconButton size="small" onClick={resetViewerZoom} aria-label="Restablecer zoom">
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  {(previewRechazoUrl || previewRechazoLoading) && docEnVistaId != null && (
                    <Button
                      size="small"
                      variant={modoMarcar ? 'contained' : 'outlined'}
                      color={modoMarcar ? 'error' : 'primary'}
                      startIcon={<PlaceIcon />}
                      onClick={() => setModoMarcar((v) => !v)}
                      sx={{ ml: 0.5, textTransform: 'none', fontWeight: 600 }}
                    >
                      {modoMarcar ? 'Cancelar marcado' : 'Marcar corrección'}
                    </Button>
                  )}
                  {(previewRechazoUrl || previewRechazoLoading) && (
                    <Button size="small" onClick={onCerrarPreview} sx={{ ml: 0.5 }}>Cerrar vista</Button>
                  )}
                </Box>
              </Box>
              {modoMarcar && (
                <Alert
                  severity="info"
                  icon={<PushPinIcon fontSize="inherit" />}
                  sx={{ borderRadius: 0, py: 0.25, '& .MuiAlert-message': { fontSize: '0.8125rem' } }}
                >
                  Haga <strong>clic</strong> en el punto exacto del documento que debe corregirse. Luego escriba el comentario.
                </Alert>
              )}
              <Box
                ref={viewerContainerRef}
                sx={{
                  flex: 1,
                  minHeight: 360,
                  height: '58vh',
                  maxHeight: '58vh',
                  display: 'block',
                  p: 1,
                  position: 'relative',
                  overflowY: 'scroll',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {previewRechazoLoading ? (
                  <Typography variant="body2" color="text.secondary">Cargando documento…</Typography>
                ) : previewRechazoUrl && previewRechazoMime.startsWith('image/') ? (
                  <>
                    <Box sx={{ overflow: 'auto', maxWidth: '100%', maxHeight: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Box
                        sx={{
                          transform: `scale(${viewerZoom})`,
                          transformOrigin: 'center center',
                          transition: 'transform 0.2s ease',
                          position: 'relative',
                          display: 'inline-block',
                          cursor: modoMarcar ? 'crosshair' : 'default',
                        }}
                        onClick={modoMarcar ? onClickMarcarEnDocumento : undefined}
                      >
                        <img ref={viewerImageRef} src={previewRechazoUrl} alt={previewRechazoNombre} style={{ maxWidth: '80vw', maxHeight: '70vh', objectFit: 'contain', display: 'block' }} />
                        {docEnVistaId != null && getRechazosForDoc(docEnVistaId).filter((m) => m.xPercent != null || m.yPercent != null).map((m, idx) => (
                          <Box
                            key={idx}
                            aria-label="Marca de rechazo"
                            sx={{
                              position: 'absolute',
                              left: `${m.xPercent ?? 0}%`,
                              top: `${m.yPercent ?? 0}%`,
                              transform: 'translate(-50%, -100%)',
                              pointerEvents: 'none',
                              zIndex: 10,
                            }}
                          >
                            <PlaceIcon sx={{ fontSize: 40, color: 'error.main', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))' }} />
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </>
                ) : previewRechazoUrl && (previewRechazoMime === 'application/pdf' || previewRechazoNombre.toLowerCase().endsWith('.pdf')) ? (
                  <PdfViewerWithClick
                    fileUrl={previewRechazoUrl}
                    enableClickMark={modoMarcar}
                    onClickOnPage={onClickMarcarPdf}
                    markers={docEnVistaId != null
                      ? getRechazosForDoc(docEnVistaId)
                          .filter((m) => m.xPercent != null || m.yPercent != null)
                          .map((m) => ({
                            pageNumber: m.pagina != null ? m.pagina : 1,
                            xPercent: m.xPercent ?? 0,
                            yPercent: m.yPercent ?? 0,
                          }))
                      : null}
                    minHeight={520}
                    zoom={viewerZoom}
                  />
                ) : previewRechazoUrl ? (
                  <>
                    <iframe title={previewRechazoNombre} src={previewRechazoUrl} style={{ width: '100%', height: '100%', minHeight: 500, border: 'none' }} />
                    {modoMarcar && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          bgcolor: 'rgba(0,0,0,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'crosshair',
                        }}
                        onClick={onClickMarcarEnDocumento}
                      >
                        <Typography variant="body2" sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 2, boxShadow: 2 }}>
                          Haga <strong>clic</strong> en el documento donde está el error
                        </Typography>
                      </Box>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ px: 2 }}>
                    Haga clic en «Ver» en cualquier documento de la lista de la derecha para leerlo aquí mientras indica el rechazo.
                  </Typography>
                )}
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, alignSelf: 'stretch', maxHeight: { xs: '70vh', md: '100%' } }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2.5,
                bgcolor: '#fff',
                boxShadow: `0 4px 16px ${alpha('#000', 0.04)}`,
              }}
            >
              <Box sx={{ flexShrink: 0, px: 2, pt: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.03) }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Observación general (opcional)
                </Typography>
                <TextField
                  value={comentarioRechazo}
                  onChange={(e) => onComentarioRechazoChange(e.target.value)}
                  placeholder="Ej. Revisar todos los documentos antes de reenviar."
                  multiline
                  rows={2}
                  fullWidth
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Box sx={{ px: 2, pt: 1.75, pb: 1, flexShrink: 0 }}>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, lineHeight: 1.2 }}>
                  Motivos por documento
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.4 }}>
                  Desplácese hacia abajo para ver todos los motivos. Marque en el documento o agregue motivos aquí.
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  flex: '1 1 auto',
                  minHeight: 0,
                  height: { xs: '42vh', md: 'auto' },
                  maxHeight: { xs: '48vh', md: 'calc(95vh - 260px)' },
                  overflowY: 'scroll',
                  overflowX: 'hidden',
                  px: 2,
                  pb: 2.5,
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                  scrollbarGutter: 'stable',
                  '&::-webkit-scrollbar': { width: 10 },
                  '&::-webkit-scrollbar-thumb': {
                    bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.35),
                    borderRadius: 8,
                  },
                  '&::-webkit-scrollbar-track': {
                    bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.06),
                    borderRadius: 8,
                  },
                }}
              >
                {rechazarDocumentos.map((d) => {
                  const motivos = getRechazosForDoc(d.id);
                  const activo = docEnVistaId === d.id;
                  return (
                    <Paper
                      key={d.id}
                      elevation={0}
                      sx={{
                        p: 0,
                        border: '1px solid',
                        borderColor: activo ? IGSS_COLORS.azulOscuro : 'divider',
                        borderRadius: 2.5,
                        bgcolor: '#fff',
                        overflow: 'visible',
                        flexShrink: 0,
                        boxShadow: activo ? `0 0 0 2px ${alpha(IGSS_COLORS.azulOscuro, 0.18)}` : `0 2px 10px ${alpha('#000', 0.03)}`,
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 1.75,
                          py: 1.25,
                          bgcolor: activo ? alpha(IGSS_COLORS.azul, 0.08) : alpha(IGSS_COLORS.azulOscuro, 0.03),
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          borderLeft: activo ? `4px solid ${IGSS_COLORS.azulOscuro}` : '4px solid transparent',
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ color: IGSS_COLORS.azulOscuro }}>
                            {d.tipoDocumento || d.nombreArchivo}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.35, flexWrap: 'wrap' }}>
                            {d.enUltimoRechazo
                              ? <Chip size="small" label="Corregido" color="info" sx={{ height: 22, fontWeight: 700 }} />
                              : <Chip size="small" label="Nuevo" variant="outlined" sx={{ height: 22, fontWeight: 600 }} />}
                            {motivos.length > 0 && (
                              <Chip
                                size="small"
                                color="error"
                                label={`${motivos.length} motivo${motivos.length === 1 ? '' : 's'}`}
                                sx={{ height: 22, fontWeight: 700 }}
                              />
                            )}
                          </Box>
                        </Box>
                        <Tooltip title="Ver este documento a la izquierda">
                          <IconButton
                            size="small"
                            onClick={() => onPrevisualizarDoc(d.id, d.nombreArchivo, d.mimeType ?? '')}
                            sx={{
                              bgcolor: activo ? IGSS_COLORS.azulOscuro : alpha(IGSS_COLORS.azul, 0.12),
                              color: activo ? '#fff' : IGSS_COLORS.azulOscuro,
                              '&:hover': { bgcolor: IGSS_COLORS.azul },
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      <Box sx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {motivos.length === 0 ? (
                          <Box
                            sx={{
                              py: 2,
                              px: 1.5,
                              textAlign: 'center',
                              borderRadius: 2,
                              border: `1px dashed ${alpha(IGSS_COLORS.azul, 0.35)}`,
                              bgcolor: alpha(IGSS_COLORS.azul, 0.03),
                            }}
                          >
                            <PlaceIcon sx={{ color: 'error.main', fontSize: 28, mb: 0.5, opacity: 0.85 }} />
                            <Typography variant="body2" color="text.secondary">
                              Sin motivos. Marque en el documento o agregue uno abajo.
                            </Typography>
                          </Box>
                        ) : (
                          motivos.map((item, idx) => {
                            const marcado = item.xPercent != null || item.yPercent != null;
                            return (
                              <Paper
                                key={idx}
                                elevation={0}
                                sx={{
                                  p: 1.75,
                                  border: '1px solid',
                                  borderColor: marcado ? alpha('#c62828', 0.35) : 'divider',
                                  borderRadius: 2,
                                  bgcolor: marcado ? alpha('#c62828', 0.03) : alpha(IGSS_COLORS.fondo, 0.9),
                                  boxShadow: marcado ? `0 0 0 1px ${alpha('#c62828', 0.08)}` : 'none',
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.5 }}>
                                  <Box
                                    sx={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      bgcolor: '#c62828',
                                      color: '#fff',
                                      fontWeight: 700,
                                      fontSize: 13,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      mt: 0.15,
                                    }}
                                  >
                                    {idx + 1}
                                  </Box>
                                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: 'grey.800' }}>
                                      Motivo {idx + 1}
                                    </Typography>
                                    {marcado && (
                                      <Chip
                                        size="small"
                                        icon={<PlaceIcon />}
                                        label={item.pagina != null ? `Pág. ${item.pagina}` : 'Marcado'}
                                        color="error"
                                        sx={{ height: 22, fontWeight: 700 }}
                                      />
                                    )}
                                  </Box>
                                  <Tooltip title="Quitar este motivo">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => onQuitarMotivo(d.id, idx)}
                                      aria-label="Quitar motivo"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                  <FormControl size="small" fullWidth>
                                    <InputLabel id={`categoria-${d.id}-${idx}`}>Categoría</InputLabel>
                                    <Select
                                      labelId={`categoria-${d.id}-${idx}`}
                                      label="Categoría"
                                      value={item.categoria}
                                      onChange={(e) => onActualizarMotivo(d.id, idx, 'categoria', e.target.value)}
                                    >
                                      <MenuItem value="">— Ninguna —</MenuItem>
                                      {MOTIVOS_RECHAZO.map((m) => (
                                        <MenuItem key={m} value={m}>{m}</MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                  <TextField
                                    label="Qué debe corregirse"
                                    placeholder="Describa el problema con claridad…"
                                    value={item.descripcion}
                                    onChange={(e) => onActualizarMotivo(d.id, idx, 'descripcion', e.target.value)}
                                    size="small"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                  />
                                  {marcado && (
                                    <TextField
                                      label="Página"
                                      type="number"
                                      inputProps={{ min: 1 }}
                                      value={item.pagina ?? ''}
                                      onChange={(e) => onActualizarMotivo(d.id, idx, 'pagina', e.target.value ? parseInt(e.target.value, 10) : null)}
                                      size="small"
                                      sx={{ maxWidth: 140 }}
                                    />
                                  )}
                                </Box>
                              </Paper>
                            );
                          })
                        )}

                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => onAgregarMotivo(d.id)}
                          variant="outlined"
                          fullWidth
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            borderRadius: 2,
                            borderColor: alpha(IGSS_COLORS.azulOscuro, 0.35),
                            color: IGSS_COLORS.azulOscuro,
                            py: 0.85,
                          }}
                        >
                          {motivos.length === 0 ? 'Agregar motivo de rechazo' : 'Agregar otro motivo'}
                        </Button>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            </Box>
          </Grid>
        </Grid>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={enviando}>Cancelar</Button>
      <Button variant="contained" color="success" onClick={onAprobar} disabled={enviando || rechazarLoading || tieneAlgunMotivoRechazo}>
        Aprobar expediente
      </Button>
      <Button variant="contained" color="error" onClick={onRechazar} disabled={enviando || rechazarLoading}>Rechazar expediente</Button>
    </DialogActions>
  </Dialog>
);

export default RevisionRechazarDialog;
