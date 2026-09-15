import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Place as PlaceIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import type { DocumentoVersionRow } from '../types';
import { formatBytes } from '../utils';

type VersionesDocumentoDialogProps = {
  open: boolean;
  loading: boolean;
  nombreDocumento?: string | null;
  versiones: DocumentoVersionRow[];
  onClose: () => void;
  onVerVersion: (versionId: number) => void;
  onDescargarVersion: (versionId: number, nombreArchivo: string) => void;
};

const VersionesDocumentoDialog: React.FC<VersionesDocumentoDialogProps> = ({
  open,
  loading,
  nombreDocumento,
  versiones,
  onClose,
  onVerVersion,
  onDescargarVersion,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.04) }}>
      Historial de versiones — {nombreDocumento}
    </DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cada versión conserva el archivo y las observaciones que DAF dejó sobre esa versión específica.
      </Typography>
      {loading ? (
        <Box display="flex" alignItems="center" gap={1} py={2}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Cargando versiones…</Typography>
        </Box>
      ) : versiones.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Aún no hay versiones registradas para este documento.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {versiones.map((v) => (
            <Paper
              key={v.id}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: v.esActual ? IGSS_COLORS.verde : 'divider',
                bgcolor: v.esActual ? alpha(IGSS_COLORS.verde, 0.045) : '#fff',
                boxShadow: v.esActual ? `0 0 0 1px ${alpha(IGSS_COLORS.verde, 0.14)}` : 'none',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: v.esActual ? IGSS_COLORS.verde : alpha(IGSS_COLORS.azulOscuro, 0.12),
                    color: v.esActual ? '#fff' : IGSS_COLORS.azulOscuro,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  V{v.numeroVersion}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                      Versión {v.numeroVersion}{v.numeroVersion === 1 ? ' · Original' : ''}
                    </Typography>
                    {v.esActual && <Chip size="small" label="Versión vigente" color="success" sx={{ fontWeight: 700 }} />}
                    {(v.observaciones?.length || 0) > 0 && (
                      <Chip size="small" label={`${v.observaciones!.length} observación${v.observaciones!.length === 1 ? '' : 'es'}`} color="error" sx={{ fontWeight: 700 }} />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {v.nombreArchivo} · {formatBytes(v.tamanioBytes)} · {typeof v.fechaSubida === 'string' ? new Date(v.fechaSubida).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }) : String(v.fechaSubida)}
                  </Typography>
                  {(v.observaciones?.length || 0) > 0 && (
                    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {v.observaciones!.map((obs, index) => (
                        <Box
                          key={index}
                          sx={{
                            px: 1.25,
                            py: 1,
                            borderRadius: 1.5,
                            borderLeft: `3px solid ${IGSS_COLORS.error}`,
                            bgcolor: alpha(IGSS_COLORS.error, 0.045),
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{obs.comentario}</Typography>
                          {obs.pagina != null && <Chip size="small" icon={<PlaceIcon />} label={`Pág. ${obs.pagina}`} color="error" variant="outlined" sx={{ mt: 0.75, height: 22 }} />}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
                  <Tooltip title="Ver esta versión">
                    <IconButton size="small" onClick={() => onVerVersion(v.id)} sx={{ color: IGSS_COLORS.azulOscuro }}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Descargar esta versión">
                    <IconButton size="small" onClick={() => onDescargarVersion(v.id, v.nombreArchivo)} sx={{ color: IGSS_COLORS.azulOscuro }}>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cerrar</Button>
    </DialogActions>
  </Dialog>
);

export default VersionesDocumentoDialog;
