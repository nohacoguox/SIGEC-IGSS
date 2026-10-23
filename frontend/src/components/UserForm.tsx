import React, { useMemo, useState } from 'react';
import {
  Autocomplete, Box, Button, Checkbox, Chip, Divider, Grid, InputAdornment, Paper,
  TextField, Typography, SelectChangeEvent,
} from '@mui/material';
import {
  AccountCircle, AlternateEmail, Badge, Business, CalendarToday, Fingerprint, Phone, Pin,
  Search, Work,
} from '@mui/icons-material';
import ClearIcon from '@mui/icons-material/Clear';
import SaveIcon from '@mui/icons-material/Save';
import { IGSS_COLORS } from '../theme/institutionalColors';
import { useAppScreens } from '../context/AppScreensContext';
import {
  FALLBACK_APP_SCREENS,
  getScreenLabelForPermission,
  type AppScreenDefinition,
} from '../config/appScreens';

interface Role {
  id: number;
  name: string;
  permissions?: { id: number; name: string; description?: string }[];
}

type RoleMeta = {
  role: Role;
  title: string;
  description: string;
  panel: 'admin' | 'colaborador' | 'sistema';
  group: string;
};

interface UserFormProps {
  formState: {
    id?: number;
    nombres: string;
    apellidos: string;
    dpi: string;
    nit: string;
    telefono: string;
    correoInstitucional: string;
    codigoEmpleado: string;
    renglon: string;
    puestoId: number;
    unidadMedica: string;
    roleIds: number[];
    departamentoDireccion?: string;
  };
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>) => void;
  handleAutocompleteChange: (name: string, value: any) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleClearForm: () => void;
  editingId: number | null;
  unidadesMedicas: { nombre: string; departamento: string }[];
  puestos: { id: number; nombre: string }[];
  roles: Role[];
  onCancelToList?: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 1.5 }}>
        {title}
      </Typography>
      <Grid container spacing={2}>
        {children}
      </Grid>
    </Box>
  );
}

function resolveRoleMeta(role: Role, screens: AppScreenDefinition[]): RoleMeta {
  const nameLower = (role.name || '').toLowerCase();
  if (nameLower === 'super administrador') {
    return {
      role,
      title: 'Super administrador',
      description: 'Acceso completo a administración y panel de colaborador.',
      panel: 'sistema',
      group: 'Acceso total',
    };
  }

  const permNames = (role.permissions || []).map((p) => p.name);
  const catalog = screens.length ? screens : FALLBACK_APP_SCREENS;
  const findIn = (list: AppScreenDefinition[]) =>
    list.find((s) => s.label === role.name || s.permission === role.name) ||
    (permNames.length === 1
      ? list.find((s) => s.permission === permNames[0])
      : undefined) ||
    list.find((s) => permNames.includes(s.permission));

  const matched = findIn(catalog) || findIn(FALLBACK_APP_SCREENS);

  if (matched) {
    return {
      role,
      title: role.name === matched.permission ? matched.label : role.name,
      description: matched.description,
      panel: matched.panel,
      group: matched.group || (matched.panel === 'admin' ? 'Gestiones' : 'General'),
    };
  }

  const firstPerm = role.permissions?.[0];
  return {
    role,
    title: role.name,
    description: firstPerm
      ? `Incluye: ${(role.permissions || []).map((p) => getScreenLabelForPermission(p.name)).join(' · ')}`
      : 'Rol personalizado',
    panel: nameLower.includes('gestionar') || nameLower.includes('correlativo') ? 'admin' : 'colaborador',
    group: 'Otros',
  };
}

const PANEL_ORDER: Array<'colaborador' | 'admin' | 'sistema'> = ['colaborador', 'admin', 'sistema'];
const PANEL_TITLE: Record<string, string> = {
  colaborador: 'Panel colaborador (SIAF, expedientes, estadísticas)',
  admin: 'Panel administración (usuarios, catálogos, correlativos)',
  sistema: 'Acceso total',
};

const UserForm: React.FC<UserFormProps> = ({
  formState,
  handleChange,
  handleAutocompleteChange,
  handleSubmit,
  handleClearForm,
  editingId,
  unidadesMedicas,
  puestos,
  roles,
  onCancelToList,
}) => {
  const { screens } = useAppScreens();
  const [roleSearch, setRoleSearch] = useState('');
  const selectedPuesto = puestos.find((p) => p.id === formState.puestoId) || null;
  const selectedUnidadMedica = unidadesMedicas.find((u) => u.nombre === formState.unidadMedica) || null;
  const selectedRoleIds = formState.roleIds || [];
  const selectedRoles = roles.filter((r) => selectedRoleIds.includes(r.id));

  const rolesMeta = useMemo(
    () => roles.map((r) => resolveRoleMeta(r, screens)),
    [roles, screens]
  );

  const filteredRolesMeta = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return rolesMeta;
    return rolesMeta.filter((m) =>
      [m.title, m.description, m.group, m.role.name].join(' ').toLowerCase().includes(q)
    );
  }, [rolesMeta, roleSearch]);

  const rolesByPanel = useMemo(() => {
    const map: Record<string, Array<{ group: string; items: RoleMeta[] }>> = {
      colaborador: [],
      admin: [],
      sistema: [],
    };
    for (const panel of PANEL_ORDER) {
      const items = filteredRolesMeta
        .filter((m) => m.panel === panel)
        .sort((a, b) => a.group.localeCompare(b.group, 'es') || a.title.localeCompare(b.title, 'es'));
      const groups: Record<string, RoleMeta[]> = {};
      for (const item of items) {
        if (!groups[item.group]) groups[item.group] = [];
        groups[item.group].push(item);
      }
      map[panel] = Object.entries(groups).map(([group, groupItems]) => ({ group, items: groupItems }));
    }
    return map;
  }, [filteredRolesMeta]);

  const toggleRole = (roleId: number) => {
    const next = selectedRoleIds.includes(roleId)
      ? selectedRoleIds.filter((id) => id !== roleId)
      : [...selectedRoleIds, roleId];
    handleAutocompleteChange('roleIds', next);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ minWidth: 0, width: '100%', maxWidth: '100%' }}>
      <Typography variant="h6" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.5 }}>
        {editingId !== null ? 'Editar usuario' : 'Crear usuario'}
      </Typography>

      <Section title="A. Datos personales">
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            size="small"
            label="Nombres"
            name="nombres"
            value={formState.nombres}
            onChange={handleChange}
            required
            InputProps={{ startAdornment: <InputAdornment position="start"><AccountCircle fontSize="small" /></InputAdornment> }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            size="small"
            label="Apellidos"
            name="apellidos"
            value={formState.apellidos}
            onChange={handleChange}
            required
            InputProps={{ startAdornment: <InputAdornment position="start"><AccountCircle fontSize="small" /></InputAdornment> }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            size="small"
            label="DPI"
            name="dpi"
            value={formState.dpi}
            onChange={handleChange}
            required
            InputProps={{ startAdornment: <InputAdornment position="start"><Pin fontSize="small" /></InputAdornment> }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            size="small"
            label="NIT"
            name="nit"
            value={formState.nit}
            onChange={handleChange}
            required
            InputProps={{ startAdornment: <InputAdornment position="start"><Fingerprint fontSize="small" /></InputAdornment> }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            size="small"
            label="Teléfono"
            name="telefono"
            value={formState.telefono}
            onChange={handleChange}
            required
            InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment> }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            size="small"
            label="Correo institucional"
            name="correoInstitucional"
            type="email"
            value={formState.correoInstitucional}
            onChange={handleChange}
            required
            InputProps={{ startAdornment: <InputAdornment position="start"><AlternateEmail fontSize="small" /></InputAdornment> }}
          />
        </Grid>
      </Section>

      <Divider sx={{ mb: 2.5 }} />

      <Section title="B. Datos laborales">
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            size="small"
            label="Código de empleado"
            name="codigoEmpleado"
            value={formState.codigoEmpleado}
            onChange={handleChange}
            required
            InputProps={{ startAdornment: <InputAdornment position="start"><Badge fontSize="small" /></InputAdornment> }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            size="small"
            label="Renglón"
            name="renglon"
            value={formState.renglon}
            onChange={handleChange}
            required
            InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday fontSize="small" /></InputAdornment> }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            options={puestos}
            getOptionLabel={(option) => option.nombre}
            value={selectedPuesto}
            onChange={(_event, newValue) => {
              handleAutocompleteChange('puestoId', newValue ? newValue.id : 0);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Puesto"
                required
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start"><Work fontSize="small" /></InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            options={unidadesMedicas}
            getOptionLabel={(option) => `${option.nombre} (${option.departamento})`}
            value={selectedUnidadMedica}
            onChange={(_event, newValue) => {
              handleAutocompleteChange('unidadMedica', newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Unidad médica"
                required
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start"><Business fontSize="small" /></InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => option.nombre === value.nombre}
          />
        </Grid>
        {formState.departamentoDireccion && (
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              Departamento / dirección: <strong>{formState.departamentoDireccion}</strong>
            </Typography>
          </Grid>
        )}
      </Section>

      <Divider sx={{ mb: 2.5 }} />

      <Section title="C. Roles de acceso">
        <Grid item xs={12}>
          {roles.length === 0 ? (
            <Typography color="text.secondary">
              No hay roles. Créelos primero en Gestión de Roles.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
              <TextField
                size="small"
                placeholder="Buscar rol (ej. SIAF, expedientes, usuarios…)"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                sx={{ maxWidth: 480 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                <Typography variant="body2" fontWeight={700} sx={{ color: IGSS_COLORS.azulOscuro, mr: 0.5 }}>
                  Seleccionados ({selectedRoles.length}):
                </Typography>
                {selectedRoles.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Ninguno — elija al menos un rol
                  </Typography>
                ) : (
                  selectedRoles.map((r) => {
                    const meta = rolesMeta.find((m) => m.role.id === r.id);
                    return (
                      <Chip
                        key={r.id}
                        size="small"
                        label={meta?.title || r.name}
                        onDelete={() => toggleRole(r.id)}
                        sx={{ fontWeight: 600 }}
                      />
                    );
                  })
                )}
              </Box>

              {PANEL_ORDER.map((panel) => {
                const groups = rolesByPanel[panel] || [];
                if (groups.length === 0) return null;
                return (
                  <Box key={panel}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      sx={{ color: IGSS_COLORS.azulOscuro, mb: 1 }}
                    >
                      {PANEL_TITLE[panel]}
                    </Typography>
                    {groups.map(({ group, items }) => (
                      <Box key={`${panel}-${group}`} sx={{ mb: 1.5 }}>
                        {panel !== 'sistema' && (
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            color="text.secondary"
                            sx={{ textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mb: 0.75 }}
                          >
                            {group}
                          </Typography>
                        )}
                        <Grid container spacing={1.25}>
                          {items.map((meta) => {
                            const checked = selectedRoleIds.includes(meta.role.id);
                            return (
                              <Grid item xs={12} sm={6} md={4} key={meta.role.id}>
                                <Paper
                                  variant="outlined"
                                  onClick={() => toggleRole(meta.role.id)}
                                  sx={{
                                    p: 1.5,
                                    height: '100%',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    borderColor: checked ? IGSS_COLORS.azul : 'divider',
                                    borderWidth: checked ? 2 : 1,
                                    bgcolor: checked ? 'rgba(0,91,145,0.06)' : 'background.paper',
                                    transition: 'border-color .15s ease, background-color .15s ease',
                                    '&:hover': { borderColor: IGSS_COLORS.azulClaro },
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                                    <Checkbox checked={checked} tabIndex={-1} sx={{ p: 0.5, mt: -0.25 }} />
                                    <Box sx={{ minWidth: 0 }}>
                                      <Typography fontWeight={800} sx={{ lineHeight: 1.25 }}>
                                        {meta.title}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Paper>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Box>
                    ))}
                  </Box>
                );
              })}

              {filteredRolesMeta.length === 0 && (
                <Typography color="text.secondary">No hay roles con esa búsqueda.</Typography>
              )}
            </Box>
          )}
        </Grid>
      </Section>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          justifyContent: 'flex-end',
          gap: 1.25,
          pt: 1,
          position: { xs: 'sticky', sm: 'static' },
          bottom: 0,
          bgcolor: { xs: 'background.paper', sm: 'transparent' },
          py: { xs: 1.5, sm: 0 },
          borderTop: { xs: '1px solid', sm: 'none' },
          borderColor: 'divider',
          zIndex: 1,
        }}
      >
        {onCancelToList && (
          <Button type="button" variant="text" color="inherit" onClick={onCancelToList} fullWidth={false} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Volver al listado
          </Button>
        )}
        <Button
          type="button"
          variant="outlined"
          color="secondary"
          onClick={handleClearForm}
          startIcon={<ClearIcon />}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Limpiar
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {editingId !== null ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </Box>
    </Box>
  );
};

export default UserForm;
