import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { PdfViewerWithClick, type PdfMarker } from '../../../components/PdfViewerWithClick';
import { primaryButtonSx } from '../../../theme/institutionalStyles';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { TIPOS_DOCUMENTO } from '../constants';

export type SeccionCategorizacion = {
  id: string;
  tipoDocumento: string;
  tipoOtro: string;
  paginaInicio: number;
  paginaFin: number;
  /** Rango listo: esas páginas se ocultan del listado pendiente. */
  confirmada: boolean;
};

type CategorizarPaqueteDialogProps = {
  open: boolean;
  guardando: boolean;
  fileUrl: string | null;
  numeroExpediente?: string;
  onClose: () => void;
  onGuardar: (secciones: Array<{ tipoDocumento: string; paginaInicio: number; paginaFin: number }>) => void;
};

const tipoSeccion = (s: SeccionCategorizacion) =>
  (s.tipoDocumento === 'Otro' ? s.tipoOtro.trim() : s.tipoDocumento.trim());

const rangoValido = (s: SeccionCategorizacion) =>
  s.paginaInicio >= 1 && s.paginaFin >= s.paginaInicio;

const etiquetaRango = (s: SeccionCategorizacion) =>
  !rangoValido(s)
    ? 'Sin rango'
    : s.paginaInicio === s.paginaFin
      ? `Página ${s.paginaInicio}`
      : `Páginas ${s.paginaInicio} – ${s.paginaFin}`;

const newSeccion = (): SeccionCategorizacion => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  tipoDocumento: TIPOS_DOCUMENTO[0],
  tipoOtro: '',
  paginaInicio: 0,
  paginaFin: 0,
  confirmada: false,
});

const CategorizarPaqueteDialog: React.FC<CategorizarPaqueteDialogProps> = ({
  open,
  guardando,
  fileUrl,
  numeroExpediente,
  onClose,
  onGuardar,
}) => {
  const [numPages, setNumPages] = useState(0);
  const [secciones, setSecciones] = useState<SeccionCategorizacion[]>([newSeccion()]);
  const [seccionActivaId, setSeccionActivaId] = useState<string | null>(null);
  const [modoClic, setModoClic] = useState<'inicio' | 'fin'>('inicio');
  /** Vista previa de un documento ya categorizado (muestra solo su rango). */
  const [vistaPreviaId, setVistaPreviaId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const first = newSeccion();
    setSecciones([first]);
    setSeccionActivaId(first.id);
    setModoClic('inicio');
    setNumPages(0);
    setVistaPreviaId(null);
  }, [open, fileUrl]);

  const updateSeccion = (id: string, patch: Partial<SeccionCategorizacion>) => {
    setSecciones((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const seccionActiva = useMemo(
    () => secciones.find((s) => s.id === seccionActivaId) || null,
    [secciones, seccionActivaId]
  );

  const documentosListos = useMemo(
    () => secciones.filter((s) => s.confirmada && rangoValido(s) && !!tipoSeccion(s)),
    [secciones]
  );

  const paginasOcultas = useMemo(() => {
    const set = new Set<number>();
    for (const s of documentosListos) {
      for (let p = s.paginaInicio; p <= s.paginaFin; p++) set.add(p);
    }
    return set;
  }, [documentosListos]);

  const paginasPendientes = useMemo(() => {
    if (numPages <= 0) return [] as number[];
    return Array.from({ length: numPages }, (_, i) => i + 1).filter((p) => !paginasOcultas.has(p));
  }, [numPages, paginasOcultas]);

  const seccionVistaPrevia = useMemo(
    () => (vistaPreviaId ? secciones.find((s) => s.id === vistaPreviaId) || null : null),
    [vistaPreviaId, secciones]
  );

  const visiblePages = useMemo(() => {
    if (seccionVistaPrevia && rangoValido(seccionVistaPrevia)) {
      return Array.from(
        { length: seccionVistaPrevia.paginaFin - seccionVistaPrevia.paginaInicio + 1 },
        (_, i) => seccionVistaPrevia.paginaInicio + i
      );
    }
    return paginasPendientes;
  }, [seccionVistaPrevia, paginasPendientes]);

  const markers: PdfMarker[] = useMemo(() => {
    if (vistaPreviaId || !seccionActiva || !rangoValido(seccionActiva) || seccionActiva.confirmada) return [];
    const pins: PdfMarker[] = [
      { pageNumber: seccionActiva.paginaInicio, xPercent: 10, yPercent: 8, label: 'I', active: true },
    ];
    if (seccionActiva.paginaFin !== seccionActiva.paginaInicio) {
      pins.push({ pageNumber: seccionActiva.paginaFin, xPercent: 18, yPercent: 8, label: 'F', active: true });
    }
    return pins;
  }, [seccionActiva, vistaPreviaId]);

  /** Agrega una sección vacía al final. Devuelve lista + id nuevo (sin setState). */
  const appendNuevaSeccion = (prev: SeccionCategorizacion[]) => {
    const n = newSeccion();
    return { list: [...prev, n], newId: n.id };
  };

  const confirmarYPrepararSiguiente = (id: string, from: number, to: number) => {
    setVistaPreviaId(null);
    setSecciones((prev) => {
      const updated = prev.map((s) =>
        s.id === id
          ? { ...s, paginaInicio: from, paginaFin: to, confirmada: true }
          : s
      );
      const ocupadas = new Set<number>();
      for (const s of updated) {
        if (!s.confirmada || !rangoValido(s)) continue;
        for (let p = s.paginaInicio; p <= s.paginaFin; p++) ocupadas.add(p);
      }
      const quedanPendientes = numPages > 0 && Array.from({ length: numPages }, (_, i) => i + 1).some((p) => !ocupadas.has(p));
      if (quedanPendientes) {
        const { list, newId } = appendNuevaSeccion(updated.filter((s) => s.confirmada || rangoValido(s) || s.id === id));
        queueMicrotask(() => {
          setSeccionActivaId(newId);
          setModoClic('inicio');
        });
        return list;
      }
      queueMicrotask(() => {
        setSeccionActivaId(id);
        setModoClic('inicio');
      });
      return updated;
    });
  };

  const handleClickPage = (pageNumber: number) => {
    if (vistaPreviaId) return;
    if (paginasOcultas.has(pageNumber)) return;

    setSecciones((prev) => {
      let working = [...prev];
      let targetId = seccionActivaId || working[0]?.id || null;
      let target = targetId ? working.find((s) => s.id === targetId) : undefined;

      // Si la activa ya está confirmada, NO la sobrescribas: crea otra sección
      if (target?.confirmada && rangoValido(target)) {
        const { list, newId } = appendNuevaSeccion(working.filter((s) => s.confirmada || rangoValido(s)));
        working = list;
        targetId = newId;
        target = working.find((s) => s.id === newId);
        queueMicrotask(() => setSeccionActivaId(newId));
      }

      if (!targetId || !target) return working;

      if (modoClic === 'inicio') {
        queueMicrotask(() => setModoClic('fin'));
        return working.map((s) =>
          s.id === targetId
            ? {
                ...s,
                paginaInicio: pageNumber,
                paginaFin: s.paginaFin >= pageNumber ? s.paginaFin : pageNumber,
                confirmada: false,
              }
            : s
        );
      }

      // modo fin → confirmar y preparar siguiente si quedan páginas
      const inicio = target.paginaInicio > 0 ? target.paginaInicio : pageNumber;
      const from = Math.min(inicio, pageNumber);
      const to = Math.max(inicio, pageNumber);

      const updated = working.map((s) =>
        s.id === targetId
          ? { ...s, paginaInicio: from, paginaFin: to, confirmada: true }
          : s
      );

      const ocupadas = new Set<number>();
      for (const s of updated) {
        if (!s.confirmada || !rangoValido(s)) continue;
        for (let p = s.paginaInicio; p <= s.paginaFin; p++) ocupadas.add(p);
      }
      const quedanPendientes = numPages > 0 && Array.from({ length: numPages }, (_, i) => i + 1).some((p) => !ocupadas.has(p));
      if (quedanPendientes) {
        const kept = updated.filter((s) => s.confirmada || rangoValido(s));
        const { list, newId } = appendNuevaSeccion(kept);
        queueMicrotask(() => {
          setSeccionActivaId(newId);
          setModoClic('inicio');
        });
        return list;
      }
      queueMicrotask(() => setModoClic('inicio'));
      return updated;
    });
  };

  const editarSeccion = (id: string) => {
    setVistaPreviaId(null);
    setModoClic('inicio');
    setSecciones((prev) => {
      const cleaned = prev.filter((s) => s.id === id || s.confirmada || rangoValido(s));
      return cleaned.map((s) => (s.id === id ? { ...s, confirmada: false } : s));
    });
    setSeccionActivaId(id);
  };

  const visualizarSeccion = (id: string) => {
    setVistaPreviaId(id);
  };

  const handleGuardar = () => {
    const payload = secciones
      .filter((s) => rangoValido(s) && !!tipoSeccion(s))
      .map((s) => ({
        tipoDocumento: tipoSeccion(s),
        paginaInicio: s.paginaInicio,
        paginaFin: s.paginaFin,
      }));
    if (!payload.length) return;
    if (numPages > 0 && payload.some((s) => s.paginaFin > numPages)) return;
    onGuardar(payload);
  };

  const seccionesValidas = useMemo(
    () => secciones.filter((s) => rangoValido(s) && !!tipoSeccion(s)),
    [secciones]
  );

  const borradorIncompleto = useMemo(
    () =>
      secciones.some(
        (s) =>
          !s.confirmada &&
          (s.paginaInicio > 0 || s.paginaFin > 0) &&
          !rangoValido(s)
      ),
    [secciones]
  );

  const puedeGuardar =
    !guardando &&
    !!fileUrl &&
    seccionesValidas.length > 0 &&
    !borradorIncompleto;

  const agregarSeccion = () => {
    setVistaPreviaId(null);
    setSecciones((prev) => {
      const marked = prev.map((s) =>
        s.id === seccionActivaId && rangoValido(s) && tipoSeccion(s) ? { ...s, confirmada: true } : s
      );
      const kept = marked.filter((s) => s.confirmada || rangoValido(s));
      const { list, newId } = appendNuevaSeccion(kept);
      queueMicrotask(() => {
        setSeccionActivaId(newId);
        setModoClic('inicio');
      });
      return list;
    });
  };

  const eliminarSeccion = (id: string) => {
    setSecciones((prev) => {
      const next = prev.filter((x) => x.id !== id);
      if (!next.length) {
        const { list, newId } = appendNuevaSeccion([]);
        queueMicrotask(() => {
          setSeccionActivaId(newId);
          setModoClic('inicio');
        });
        return list;
      }
      if (seccionActivaId === id) {
        const siguiente = next.find((s) => !s.confirmada) || next[next.length - 1];
        queueMicrotask(() => setSeccionActivaId(siguiente?.id || null));
      }
      if (vistaPreviaId === id) setVistaPreviaId(null);
      return next;
    });
  };

  const confirmarDocumentoActivo = () => {
    if (!seccionActiva || !rangoValido(seccionActiva) || !tipoSeccion(seccionActiva)) return;
    confirmarYPrepararSiguiente(seccionActiva.id, seccionActiva.paginaInicio, seccionActiva.paginaFin);
  };

  return (
    <Dialog
      open={open}
      onClose={() => !guardando && onClose()}
      maxWidth="xl"
      fullWidth
      disableEnforceFocus
      PaperProps={{ sx: { height: '92vh', maxHeight: '92vh' } }}
    >
      <DialogTitle sx={{ pb: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
          Categorizar expediente completo
          {numeroExpediente ? ` · ${numeroExpediente}` : ''}
        </Typography>
        {numPages > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {paginasPendientes.length} página{paginasPendientes.length === 1 ? '' : 's'} pendiente{paginasPendientes.length === 1 ? '' : 's'} de {numPages}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', gap: 2, pt: 2, pb: 1, overflow: 'hidden' }}>
        {/* Visor PDF */}
        <Box sx={{ flex: '1 1 58%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {vistaPreviaId && seccionVistaPrevia ? (
            <Paper
              elevation={0}
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 2,
                border: `1px solid ${alpha(IGSS_COLORS.azul, 0.35)}`,
                bgcolor: alpha(IGSS_COLORS.azul, 0.06),
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <VisibilityIcon sx={{ color: IGSS_COLORS.azulOscuro, fontSize: 20 }} />
              <Typography variant="body2" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, flex: 1 }}>
                Vista previa · {tipoSeccion(seccionVistaPrevia) || 'Documento'} · {etiquetaRango(seccionVistaPrevia)}
              </Typography>
              <Button
                size="small"
                startIcon={<ArrowBackIcon />}
                onClick={() => setVistaPreviaId(null)}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Volver a pendientes
              </Button>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip
                size="small"
                label="1. Clic = inicio"
                color={modoClic === 'inicio' ? 'primary' : 'default'}
                onClick={() => setModoClic('inicio')}
                sx={{ fontWeight: 700 }}
              />
              <Chip
                size="small"
                label="2. Clic = fin"
                color={modoClic === 'fin' ? 'primary' : 'default'}
                onClick={() => setModoClic('fin')}
                sx={{ fontWeight: 700 }}
              />
              <Typography variant="caption" color="text.secondary">
                {modoClic === 'inicio' ? 'Seleccione la primera página del documento' : 'Seleccione la última página del documento'}
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: alpha(IGSS_COLORS.azulOscuro, 0.03),
              p: 1,
            }}
          >
            {fileUrl ? (
              visiblePages.length === 0 && numPages > 0 && !vistaPreviaId ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                    Todas las páginas ya están categorizadas
                  </Typography>
                </Box>
              ) : (
                <PdfViewerWithClick
                  fileUrl={fileUrl}
                  enableClickMark={!vistaPreviaId}
                  onClickOnPage={(page) => handleClickPage(page)}
                  onNumPagesChange={setNumPages}
                  markers={markers}
                  visiblePages={visiblePages}
                  minHeight={480}
                  zoom={1}
                />
              )
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Cargando PDF…
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Panel derecho: listado profesional */}
        <Box
          sx={{
            flex: '0 0 380px',
            maxWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
              Documentos del expediente
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {documentosListos.length} categorizado{documentosListos.length === 1 ? '' : 's'}
              {seccionActiva && !seccionActiva.confirmada ? ' · editando uno nuevo' : ''}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {documentosListos.length === 0 && !(seccionActiva && !seccionActiva.confirmada) && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px dashed ${alpha(IGSS_COLORS.azul, 0.4)}`,
                  bgcolor: alpha(IGSS_COLORS.azul, 0.04),
                  textAlign: 'center',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Aún no hay documentos categorizados. Marque inicio y fin en el PDF.
                </Typography>
              </Paper>
            )}

            {documentosListos.map((s, idx) => {
              const titulo = tipoSeccion(s) || `Documento ${idx + 1}`;
              const enVista = vistaPreviaId === s.id;
              return (
                <Paper
                  key={s.id}
                  elevation={0}
                  sx={{
                    p: 1.75,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: enVista ? IGSS_COLORS.azul : 'divider',
                    bgcolor: enVista ? alpha(IGSS_COLORS.azul, 0.06) : '#fff',
                    boxShadow: enVista ? `0 4px 14px ${alpha(IGSS_COLORS.azulOscuro, 0.1)}` : 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1.5,
                        flexShrink: 0,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: IGSS_COLORS.azulOscuro,
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      {idx + 1}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ color: IGSS_COLORS.azulOscuro }}>
                        {titulo}
                      </Typography>
                      <Chip
                        size="small"
                        label={etiquetaRango(s)}
                        sx={{
                          mt: 0.75,
                          height: 24,
                          fontWeight: 700,
                          bgcolor: alpha(IGSS_COLORS.verde, 0.12),
                          color: IGSS_COLORS.verdeOscuro,
                        }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1.25, justifyContent: 'flex-end' }}>
                    <Tooltip title="Ver solo estas páginas">
                      <Button
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => visualizarSeccion(s.id)}
                        sx={{ textTransform: 'none', fontWeight: 700, color: IGSS_COLORS.azulOscuro }}
                      >
                        Visualizar
                      </Button>
                    </Tooltip>
                    <Tooltip title="Editar rango o tipo">
                      <IconButton size="small" onClick={() => editarSeccion(s.id)} sx={{ color: IGSS_COLORS.azul }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" color="error" onClick={() => eliminarSeccion(s.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              );
            })}

            {/* Formulario de la sección en edición */}
            {seccionActiva && !seccionActiva.confirmada && (
              <Paper
                elevation={0}
                sx={{
                  p: 1.75,
                  borderRadius: 2.5,
                  border: `1.5px solid ${alpha(IGSS_COLORS.azul, 0.55)}`,
                  bgcolor: alpha(IGSS_COLORS.azul, 0.05),
                }}
              >
                <Typography variant="caption" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', mb: 1.25 }}>
                  Definiendo documento
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <TextField
                    select
                    size="small"
                    label="Tipo / título del documento"
                    value={seccionActiva.tipoDocumento}
                    onChange={(e) =>
                      updateSeccion(seccionActiva.id, {
                        tipoDocumento: e.target.value,
                        tipoOtro: e.target.value === 'Otro' ? seccionActiva.tipoOtro : '',
                      })
                    }
                    fullWidth
                  >
                    {TIPOS_DOCUMENTO.map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </TextField>
                  {seccionActiva.tipoDocumento === 'Otro' && (
                    <TextField
                      size="small"
                      label="Nombre del documento"
                      value={seccionActiva.tipoOtro}
                      onChange={(e) => updateSeccion(seccionActiva.id, { tipoOtro: e.target.value })}
                      fullWidth
                    />
                  )}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      label="Desde pág."
                      type="number"
                      value={seccionActiva.paginaInicio || ''}
                      placeholder="—"
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value || '0', 10) || 0);
                        updateSeccion(seccionActiva.id, {
                          paginaInicio: v,
                          paginaFin: seccionActiva.paginaFin > 0 ? Math.max(v, seccionActiva.paginaFin) : v,
                          confirmada: false,
                        });
                      }}
                      inputProps={{ min: 1, max: numPages || undefined }}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Hasta pág."
                      type="number"
                      value={seccionActiva.paginaFin || ''}
                      placeholder="—"
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value || '0', 10) || 0);
                        const inicio = seccionActiva.paginaInicio > 0 ? seccionActiva.paginaInicio : v;
                        updateSeccion(seccionActiva.id, {
                          paginaInicio: inicio,
                          paginaFin: Math.max(v, inicio),
                          confirmada: false,
                        });
                      }}
                      inputProps={{ min: 1, max: numPages || undefined }}
                      fullWidth
                    />
                  </Box>
                  {rangoValido(seccionActiva) && !!tipoSeccion(seccionActiva) && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={confirmarDocumentoActivo}
                      sx={{
                        ...primaryButtonSx,
                        bgcolor: IGSS_COLORS.verde,
                        '&:hover': { bgcolor: IGSS_COLORS.verdeOscuro },
                        alignSelf: 'stretch',
                      }}
                    >
                      Confirmar documento ({etiquetaRango(seccionActiva)})
                    </Button>
                  )}
                </Box>
              </Paper>
            )}
          </Box>

          <Divider />

          <Button
            startIcon={<AddIcon />}
            disabled={guardando}
            variant="outlined"
            onClick={agregarSeccion}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderColor: IGSS_COLORS.azul,
              color: IGSS_COLORS.azulOscuro,
            }}
          >
            Agregar otro documento
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button disabled={guardando} onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600 }}>
          Más tarde
        </Button>
        <Button
          variant="contained"
          disabled={!puedeGuardar}
          startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleGuardar}
          sx={{ ...primaryButtonSx, bgcolor: IGSS_COLORS.azulOscuro, '&:hover': { bgcolor: IGSS_COLORS.azul } }}
        >
          {guardando ? 'Separando…' : 'Guardar categorías'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CategorizarPaqueteDialog;
