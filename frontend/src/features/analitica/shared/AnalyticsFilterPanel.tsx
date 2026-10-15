import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, FormControl, InputLabel, MenuItem,
  Paper, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { DateRange, RestartAlt } from '@mui/icons-material';
import api from '../../../api';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  createDefaultAnalyticsFilter,
  etiquetaModo,
  fechaHoy,
  rangoDesdeDias,
  resolveAnalyticsRoleMode,
  type AnalyticsRoleMode,
} from './analyticsScope';

export type AnalyticsFilter = {
  dias: number;
  desde?: string;
  hasta?: string;
  agrupacion: 'dia' | 'semana' | 'mes' | 'anio';
  itemId?: number;
  alcance: 'personal' | 'unidad';
  unidad?: string;
  usuarioId?: number;
};

type Option = { id: number; etiqueta: string; estado?: string; unidadMedica?: string };
type UnidadOpt = { nombre: string };

type Props = {
  tipo: 'expediente' | 'siaf';
  value: AnalyticsFilter;
  onApply: (filter: AnalyticsFilter) => void;
  /** Si es false, oculta el selector de expediente/SIAF específico. */
  mostrarCasoEspecifico?: boolean;
  /** Notifica el modo de rol resuelto (para subtítulos / defaults en el padre). */
  onRoleMode?: (mode: AnalyticsRoleMode) => void;
};

const PRESETS = [
  { dias: 7, etiqueta: '7 días' },
  { dias: 28, etiqueta: '4 semanas' },
  { dias: 90, etiqueta: '3 meses' },
  { dias: 180, etiqueta: '6 meses' },
  { dias: 365, etiqueta: '1 año' },
];

export default function AnalyticsFilterPanel({
  tipo,
  value,
  onApply,
  mostrarCasoEspecifico = true,
  onRoleMode,
}: Props) {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const roleMode = useMemo(
    () =>
      resolveAnalyticsRoleMode({
        isSuperAdmin,
        hasMisEstadisticas: hasPermission('estadisticas-tiempos'),
        hasUnidad: hasPermission('ver-estadisticas-unidad'),
      }),
    [hasPermission, isSuperAdmin],
  );

  useEffect(() => {
    onRoleMode?.(roleMode);
  }, [roleMode, onRoleMode]);

  const puedeCambiarAlcance = roleMode === 'ambos' || roleMode === 'super';
  const alcanceFijo = roleMode === 'personal' || roleMode === 'unidad';

  const [catalogo, setCatalogo] = useState<Option[]>([]);
  const [colaboradores, setColaboradores] = useState<Option[]>([]);
  const [unidades, setUnidades] = useState<UnidadOpt[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [preset, setPreset] = useState<number | 'personalizado'>(value.desde ? 'personalizado' : value.dias);
  const [desde, setDesde] = useState(value.desde || rangoDesdeDias(value.dias));
  const [hasta, setHasta] = useState(value.hasta || fechaHoy());
  const [agrupacion, setAgrupacion] = useState<AnalyticsFilter['agrupacion']>(value.agrupacion);
  const [itemId, setItemId] = useState<number | null>(value.itemId ?? null);
  const [alcance, setAlcance] = useState<'personal' | 'unidad'>(value.alcance);
  const [unidad, setUnidad] = useState<string | null>(value.unidad ?? null);
  const [usuarioId, setUsuarioId] = useState<number | null>(value.usuarioId ?? null);

  useEffect(() => {
    setAlcance(value.alcance);
  }, [value.alcance]);

  useEffect(() => {
    if (value.unidad !== undefined) setUnidad(value.unidad ?? null);
  }, [value.unidad]);

  // Fijar alcance según rol (unidad = todos de la unidad; personal = solo míos).
  useEffect(() => {
    if (roleMode === 'personal' && alcance !== 'personal') {
      setAlcance('personal');
      setUsuarioId(null);
    } else if (roleMode === 'unidad' && alcance !== 'unidad') {
      setAlcance('unidad');
    }
  }, [roleMode, alcance]);

  useEffect(() => {
    setCargandoCatalogo(true);
    setMetaError(null);
    api
      .get('/estadisticas/filtros-analitica', {
        params: {
          alcance,
          unidad: alcance === 'unidad' ? unidad || undefined : undefined,
          usuarioId: alcance === 'unidad' ? usuarioId || undefined : undefined,
        },
      })
      .then((res) => {
        setCatalogo(tipo === 'expediente' ? res.data.expedientes || [] : res.data.siafs || []);
        setColaboradores(res.data.colaboradores || []);
        setUnidades(res.data.unidades || []);
        if (res.data.requiereUnidad) setMetaError(res.data.message || 'Seleccione una unidad médica.');
        if (!unidad && res.data.unidadMedica && !isSuperAdmin) setUnidad(res.data.unidadMedica);
      })
      .catch((err) => {
        setCatalogo([]);
        setColaboradores([]);
        setMetaError(err.response?.data?.message || 'No se pudieron cargar los filtros.');
      })
      .finally(() => setCargandoCatalogo(false));
  }, [tipo, alcance, unidad, usuarioId, isSuperAdmin]);

  useEffect(() => {
    if (!mostrarCasoEspecifico && itemId != null) setItemId(null);
  }, [mostrarCasoEspecifico, itemId]);

  useEffect(() => {
    setItemId(value.itemId ?? null);
  }, [value.itemId]);

  const seleccionado = useMemo(() => catalogo.find((opcion) => opcion.id === itemId) ?? null, [catalogo, itemId]);
  const colaboradorSel = useMemo(() => colaboradores.find((c) => c.id === usuarioId) ?? null, [colaboradores, usuarioId]);
  const etiquetaCaso = tipo === 'expediente' ? 'Expediente' : 'SIAF';

  const aplicarPreset = (nuevoPreset: number | 'personalizado') => {
    setPreset(nuevoPreset);
    if (nuevoPreset !== 'personalizado') {
      setDesde(rangoDesdeDias(nuevoPreset));
      setHasta(fechaHoy());
    }
  };

  const buildFilter = (alcanceNext: 'personal' | 'unidad' = alcance): AnalyticsFilter => {
    const inicio = desde <= hasta ? desde : hasta;
    const fin = desde <= hasta ? hasta : desde;
    return {
      dias: Math.max(
        1,
        Math.round(
          (new Date(`${fin}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()) / 86_400_000,
        ),
      ),
      desde: inicio,
      hasta: fin,
      agrupacion,
      itemId: mostrarCasoEspecifico ? (itemId ?? undefined) : undefined,
      alcance: alcanceNext,
      unidad: alcanceNext === 'unidad' ? (unidad || undefined) : undefined,
      usuarioId: alcanceNext === 'unidad' ? (usuarioId || undefined) : undefined,
    };
  };

  const limpiar = () => {
    const def = createDefaultAnalyticsFilter(roleMode);
    aplicarPreset(def.dias);
    setAgrupacion(def.agrupacion);
    setItemId(null);
    setAlcance(def.alcance);
    setUsuarioId(null);
    if (roleMode !== 'super') {
      // Conservar unidad del perfil; solo super elige otra.
      setUnidad(unidad && roleMode !== 'personal' ? unidad : null);
    } else {
      setUnidad(null);
    }
    onApply({
      ...def,
      unidad: def.alcance === 'unidad' && roleMode !== 'super' ? (unidad || undefined) : undefined,
    });
  };

  const aplicar = () => {
    if (alcance === 'unidad' && isSuperAdmin && !unidad) {
      setMetaError('Seleccione una unidad médica para continuar.');
      return;
    }
    onApply(buildFilter());
  };

  const fieldSx = {
    flex: '1 1 118px',
    minWidth: 0,
    width: { xs: '100%', sm: 'auto' },
    maxWidth: '100%',
  };

  const modoLabel = etiquetaModo(roleMode, value.alcance);

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 1.5,
        width: '100%',
        maxWidth: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Stack spacing={1.25} sx={{ p: { xs: 1.25, sm: 1.5 }, boxSizing: 'border-box' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Chip
            size="small"
            label={modoLabel}
            sx={{
              fontWeight: 800,
              bgcolor:
                value.alcance === 'personal' ? 'rgba(46,125,50,0.12)' : 'rgba(0,91,145,0.14)',
              color: IGSS_COLORS.azulOscuro,
            }}
          />
          {alcance === 'unidad' && !isSuperAdmin && unidad && (
            <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap sx={{ maxWidth: 280 }}>
              {unidad}
            </Typography>
          )}
          {alcanceFijo && (
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
              {roleMode === 'unidad'
                ? 'Incluye automáticamente todos los trámites de su unidad.'
                : 'Solo sus propios trámites.'}
            </Typography>
          )}
          {puedeCambiarAlcance && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={alcance}
              onChange={(_e, next) => {
                if (!next) return;
                const nextUnidad = next === 'personal' ? null : unidad;
                setAlcance(next);
                setItemId(null);
                setUsuarioId(null);
                if (next === 'personal') setUnidad(null);
                // Aplicar de inmediato al cambiar de modo (salvo super sin unidad elegida).
                if (next === 'unidad' && isSuperAdmin && !nextUnidad) {
                  setMetaError('Seleccione una unidad médica para continuar.');
                  return;
                }
                const inicio = desde <= hasta ? desde : hasta;
                const fin = desde <= hasta ? hasta : desde;
                onApply({
                  dias: Math.max(
                    1,
                    Math.round(
                      (new Date(`${fin}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()) /
                        86_400_000,
                    ),
                  ),
                  desde: inicio,
                  hasta: fin,
                  agrupacion,
                  itemId: undefined,
                  alcance: next,
                  unidad: next === 'unidad' ? (nextUnidad || undefined) : undefined,
                  usuarioId: undefined,
                });
              }}
              sx={{
                ml: { sm: 'auto' },
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 1.25,
                  py: 0.35,
                },
              }}
            >
              {(roleMode === 'ambos' || roleMode === 'super') && (
                <ToggleButton value="personal">Mis estadísticas</ToggleButton>
              )}
              <ToggleButton value="unidad">
                {roleMode === 'super' ? 'Por unidad' : 'Estadísticas de mi unidad'}
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>

        {metaError && (
          <Alert severity="info" sx={{ borderRadius: 1.5, py: 0.25 }}>
            {metaError}
          </Alert>
        )}

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ width: '100%', alignItems: 'center' }}>
          {alcance === 'unidad' && isSuperAdmin && (
            <Autocomplete
              size="small"
              options={unidades}
              value={unidades.find((u) => u.nombre === unidad) ?? null}
              onChange={(_e, opt) => {
                setUnidad(opt?.nombre ?? null);
                setUsuarioId(null);
                setItemId(null);
              }}
              getOptionLabel={(o) => o.nombre}
              isOptionEqualToValue={(a, b) => a.nombre === b.nombre}
              renderInput={(params) => (
                <TextField {...params} label="Unidad médica" placeholder="Seleccione" />
              )}
              sx={{ ...fieldSx, flex: '1 1 200px' }}
            />
          )}
          {alcance === 'unidad' && (
            <Autocomplete
              size="small"
              options={colaboradores}
              value={colaboradorSel}
              onChange={(_e, opt) => {
                setUsuarioId(opt?.id ?? null);
                setItemId(null);
              }}
              getOptionLabel={(o) => o.etiqueta}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField {...params} label="Colaborador" placeholder="Todos" />
              )}
              sx={{ ...fieldSx, flex: '1 1 180px' }}
              disabled={isSuperAdmin && !unidad}
            />
          )}

          <FormControl size="small" sx={fieldSx}>
            <InputLabel>Rango</InputLabel>
            <Select
              value={preset}
              label="Rango"
              onChange={(e) =>
                aplicarPreset(e.target.value === 'personalizado' ? 'personalizado' : Number(e.target.value))
              }
            >
              {PRESETS.map((opcion) => (
                <MenuItem key={opcion.dias} value={opcion.dias}>
                  Últimos {opcion.etiqueta}
                </MenuItem>
              ))}
              <MenuItem value="personalizado">Personalizado</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Desde"
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPreset('personalizado');
            }}
            InputLabelProps={{ shrink: true }}
            sx={fieldSx}
          />
          <TextField
            size="small"
            label="Hasta"
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPreset('personalizado');
            }}
            InputLabelProps={{ shrink: true }}
            sx={fieldSx}
          />
          <FormControl size="small" sx={{ ...fieldSx, flex: '0 1 110px' }}>
            <InputLabel>Agrupar</InputLabel>
            <Select
              value={agrupacion}
              label="Agrupar"
              onChange={(e) => setAgrupacion(e.target.value as AnalyticsFilter['agrupacion'])}
            >
              <MenuItem value="dia">Día</MenuItem>
              <MenuItem value="semana">Semana</MenuItem>
              <MenuItem value="mes">Mes</MenuItem>
              <MenuItem value="anio">Año</MenuItem>
            </Select>
          </FormControl>
          {mostrarCasoEspecifico && (
            <Autocomplete
              size="small"
              loading={cargandoCatalogo}
              options={catalogo}
              value={seleccionado}
              onChange={(_event, opcion) => setItemId(opcion?.id ?? null)}
              getOptionLabel={(opcion) => opcion.etiqueta}
              isOptionEqualToValue={(opcion, seleccion) => opcion.id === seleccion.id}
              renderInput={(params) => (
                <TextField {...params} label={etiquetaCaso} placeholder="Todos" />
              )}
              sx={{ ...fieldSx, flex: '1 1 180px' }}
              disabled={alcance === 'unidad' && isSuperAdmin && !unidad}
            />
          )}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', ml: { md: 'auto' } }}>
            <Button variant="contained" size="small" startIcon={<DateRange />} onClick={aplicar} sx={{ px: 1.75 }}>
              Aplicar
            </Button>
            <Button variant="text" size="small" color="inherit" startIcon={<RestartAlt />} onClick={limpiar}>
              Restablecer
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Paper>
  );
}
