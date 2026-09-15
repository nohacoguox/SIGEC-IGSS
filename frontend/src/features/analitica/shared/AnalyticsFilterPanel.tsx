import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, Collapse, Divider, FormControl, IconButton,
  InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography,
} from '@mui/material';
import { DateRange, ExpandLess, ExpandMore, FilterAlt, RestartAlt } from '@mui/icons-material';
import api from '../../../api';
import { IGSS_COLORS } from '../../../theme/institutionalColors';
import { usePermissions } from '../../../hooks/usePermissions';

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
};

const fechaLocal = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const rangoDesdeDias = (dias: number) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fechaLocal(fecha);
};

const PRESETS = [
  { dias: 7, etiqueta: '7 días' },
  { dias: 28, etiqueta: '4 semanas' },
  { dias: 90, etiqueta: '3 meses' },
  { dias: 180, etiqueta: '6 meses' },
  { dias: 365, etiqueta: '1 año' },
];

export default function AnalyticsFilterPanel({ tipo, value, onApply, mostrarCasoEspecifico = true }: Props) {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canViewUnidad = isSuperAdmin || hasPermission('ver-estadisticas-unidad') || hasPermission('ver-estadisticas');

  const [catalogo, setCatalogo] = useState<Option[]>([]);
  const [colaboradores, setColaboradores] = useState<Option[]>([]);
  const [unidades, setUnidades] = useState<UnidadOpt[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  const [preset, setPreset] = useState<number | 'personalizado'>(value.desde ? 'personalizado' : value.dias);
  const [desde, setDesde] = useState(value.desde || rangoDesdeDias(value.dias));
  const [hasta, setHasta] = useState(value.hasta || fechaLocal(new Date()));
  const [agrupacion, setAgrupacion] = useState<AnalyticsFilter['agrupacion']>(value.agrupacion);
  const [itemId, setItemId] = useState<number | null>(value.itemId ?? null);
  const [alcance, setAlcance] = useState<'personal' | 'unidad'>(value.alcance || 'personal');
  const [unidad, setUnidad] = useState<string | null>(value.unidad ?? null);
  const [usuarioId, setUsuarioId] = useState<number | null>(value.usuarioId ?? null);

  useEffect(() => {
    if (!canViewUnidad && alcance === 'unidad') setAlcance('personal');
  }, [canViewUnidad, alcance]);

  useEffect(() => {
    setCargandoCatalogo(true);
    setMetaError(null);
    api.get('/estadisticas/filtros-analitica', {
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
    if (!mostrarCasoEspecifico && itemId != null) {
      setItemId(null);
    }
  }, [mostrarCasoEspecifico, itemId]);

  useEffect(() => {
    setItemId(value.itemId ?? null);
  }, [value.itemId]);

  const seleccionado = useMemo(() => catalogo.find((opcion) => opcion.id === itemId) ?? null, [catalogo, itemId]);
  const colaboradorSel = useMemo(() => colaboradores.find((c) => c.id === usuarioId) ?? null, [colaboradores, usuarioId]);
  const etiquetaCaso = tipo === 'expediente' ? 'Expediente específico' : 'SIAF específico';

  const aplicarPreset = (nuevoPreset: number | 'personalizado') => {
    setPreset(nuevoPreset);
    if (nuevoPreset !== 'personalizado') {
      setDesde(rangoDesdeDias(nuevoPreset));
      setHasta(fechaLocal(new Date()));
    }
  };

  const limpiar = () => {
    aplicarPreset(90);
    setAgrupacion('semana');
    setItemId(null);
    setAlcance('personal');
    setUsuarioId(null);
    setUnidad(null);
    onApply({ dias: 90, agrupacion: 'semana', alcance: 'personal' });
  };

  const aplicar = () => {
    if (alcance === 'unidad' && isSuperAdmin && !unidad) {
      setMetaError('Seleccione una unidad médica para continuar.');
      return;
    }
    const inicio = desde <= hasta ? desde : hasta;
    const fin = desde <= hasta ? hasta : desde;
    onApply({
      dias: Math.max(1, Math.round((new Date(`${fin}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()) / 86_400_000)),
      desde: inicio,
      hasta: fin,
      agrupacion,
      itemId: mostrarCasoEspecifico ? (itemId ?? undefined) : undefined,
      alcance,
      unidad: alcance === 'unidad' ? (unidad || undefined) : undefined,
      usuarioId: alcance === 'unidad' ? (usuarioId || undefined) : undefined,
    });
    setAbierto(false);
  };

  const fieldSx = {
    flex: '1 1 140px',
    minWidth: 0,
    width: { xs: '100%', sm: 'auto' },
    maxWidth: '100%',
  };

  const resumenChips = (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
      <Chip
        size="small"
        label={value.alcance === 'personal' ? 'Mis estadísticas' : 'Unidad'}
        sx={{ fontWeight: 700, bgcolor: value.alcance === 'personal' ? 'rgba(46,125,50,0.12)' : 'rgba(0,91,145,0.12)', color: IGSS_COLORS.azulOscuro }}
      />
      <Chip
        size="small"
        variant="outlined"
        label={
          value.desde && value.hasta
            ? `${value.desde} → ${value.hasta}`
            : `Últimos ${value.dias} días`
        }
        sx={{ fontWeight: 600 }}
      />
      {value.unidad && <Chip size="small" variant="outlined" label={value.unidad} sx={{ maxWidth: 180 }} />}
      {mostrarCasoEspecifico && value.itemId && seleccionado && (
        <Chip size="small" color="primary" variant="outlined" label={seleccionado.etiqueta} sx={{ maxWidth: 200 }} />
      )}
    </Box>
  );

  return (
    <Paper elevation={0} sx={{ mb: 2.5, width: '100%', maxWidth: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
      <Box
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: 'rgba(0, 91, 145, 0.045)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          flexWrap: 'wrap',
          cursor: 'pointer',
        }}
        onClick={() => setAbierto((v) => !v)}
      >
        <FilterAlt fontSize="small" sx={{ color: IGSS_COLORS.azul }} />
        <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
          Filtros
        </Typography>
        {resumenChips}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: { xs: 'none', sm: 'block' } }}>
            {abierto ? 'Ocultar' : 'Editar'}
          </Typography>
          <IconButton size="small" aria-label={abierto ? 'Ocultar filtros' : 'Editar filtros'}>
            {abierto ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={abierto}>
        <Divider />
        <Stack spacing={1.75} sx={{ p: 2.25, width: '100%', boxSizing: 'border-box' }}>
          {canViewUnidad && (
            <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ width: '100%', alignItems: 'center' }}>
              <FormControl size="small" sx={{ ...fieldSx, flex: '1 1 180px' }}>
                <InputLabel>Alcance</InputLabel>
                <Select
                  value={alcance}
                  label="Alcance"
                  onChange={(e) => {
                    const next = e.target.value as 'personal' | 'unidad';
                    setAlcance(next);
                    setItemId(null);
                    setUsuarioId(null);
                    if (next === 'personal') setUnidad(null);
                  }}
                >
                  <MenuItem value="personal">Mis estadísticas</MenuItem>
                  <MenuItem value="unidad">Estadísticas de mi unidad</MenuItem>
                </Select>
              </FormControl>
              {alcance === 'unidad' && isSuperAdmin && (
                <Autocomplete
                  size="small"
                  options={unidades}
                  value={unidades.find((u) => u.nombre === unidad) ?? null}
                  onChange={(_e, opt) => { setUnidad(opt?.nombre ?? null); setUsuarioId(null); setItemId(null); }}
                  getOptionLabel={(o) => o.nombre}
                  isOptionEqualToValue={(a, b) => a.nombre === b.nombre}
                  renderInput={(params) => <TextField {...params} label="Unidad médica" placeholder="Seleccione una unidad" />}
                  sx={{ ...fieldSx, flex: '1 1 220px' }}
                />
              )}
              {alcance === 'unidad' && !isSuperAdmin && unidad && (
                <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 180px', minWidth: 0 }}>
                  Unidad: <strong>{unidad}</strong>
                </Typography>
              )}
              {alcance === 'unidad' && (
                <Autocomplete
                  size="small"
                  options={colaboradores}
                  value={colaboradorSel}
                  onChange={(_e, opt) => { setUsuarioId(opt?.id ?? null); setItemId(null); }}
                  getOptionLabel={(o) => o.etiqueta}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => <TextField {...params} label="Colaborador" placeholder="Todos los de la unidad" />}
                  sx={{ ...fieldSx, flex: '1 1 220px' }}
                  disabled={isSuperAdmin && !unidad}
                />
              )}
            </Stack>
          )}

          {metaError && <Alert severity="info" sx={{ borderRadius: 2 }}>{metaError}</Alert>}

          <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ width: '100%', alignItems: 'center' }}>
            <FormControl size="small" sx={fieldSx}>
              <InputLabel>Rango rápido</InputLabel>
              <Select value={preset} label="Rango rápido" onChange={(e) => aplicarPreset(e.target.value === 'personalizado' ? 'personalizado' : Number(e.target.value))}>
                {PRESETS.map((opcion) => <MenuItem key={opcion.dias} value={opcion.dias}>Últimos {opcion.etiqueta}</MenuItem>)}
                <MenuItem value="personalizado">Fechas personalizadas</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" label="Desde" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPreset('personalizado'); }} InputLabelProps={{ shrink: true }} sx={fieldSx} />
            <TextField size="small" label="Hasta" type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPreset('personalizado'); }} InputLabelProps={{ shrink: true }} sx={fieldSx} />
            <FormControl size="small" sx={fieldSx}>
              <InputLabel>Agrupar por</InputLabel>
              <Select value={agrupacion} label="Agrupar por" onChange={(e) => setAgrupacion(e.target.value as AnalyticsFilter['agrupacion'])}>
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
                renderInput={(params) => <TextField {...params} label={etiquetaCaso} placeholder="Todos los casos visibles" />}
                sx={{ ...fieldSx, flex: '1 1 220px' }}
                disabled={alcance === 'unidad' && isSuperAdmin && !unidad}
              />
            )}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
              <Button variant="contained" startIcon={<DateRange />} onClick={aplicar} sx={{ whiteSpace: 'nowrap', px: 2 }}>Aplicar</Button>
              <Button variant="text" color="inherit" startIcon={<RestartAlt />} onClick={limpiar} sx={{ whiteSpace: 'nowrap' }}>Restablecer</Button>
            </Box>
          </Stack>
        </Stack>
      </Collapse>
    </Paper>
  );
}
