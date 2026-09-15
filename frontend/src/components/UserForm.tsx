import React from 'react';
import {
  Autocomplete, Box, Button, Divider, Grid, InputAdornment, TextField, Typography,
  SelectChangeEvent,
} from '@mui/material';
import {
  AccountCircle, AlternateEmail, Badge, Business, CalendarToday, Fingerprint, Phone, Pin, Work,
} from '@mui/icons-material';
import ClearIcon from '@mui/icons-material/Clear';
import SaveIcon from '@mui/icons-material/Save';
import { IGSS_COLORS } from '../theme/institutionalColors';

interface Role {
  id: number;
  name: string;
}

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

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {description}
      </Typography>
      <Grid container spacing={2}>
        {children}
      </Grid>
    </Box>
  );
}

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
  const selectedPuesto = puestos.find((p) => p.id === formState.puestoId) || null;
  const selectedUnidadMedica = unidadesMedicas.find((u) => u.nombre === formState.unidadMedica) || null;
  const selectedRoles = roles.filter((r) => (formState.roleIds || []).includes(r.id));

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ minWidth: 0, width: '100%', maxWidth: 960 }}>
      <Typography variant="h6" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, mb: 0.5 }}>
        {editingId !== null ? 'Editar usuario' : 'Crear usuario'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Los campos marcados son obligatorios. El acceso al sistema se define con los roles.
      </Typography>

      <Section title="A. Datos personales" description="Identificación y contacto del colaborador.">
        <Grid item xs={12} sm={6}>
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
        <Grid item xs={12} sm={6}>
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
        <Grid item xs={12} sm={6}>
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
        <Grid item xs={12} sm={6}>
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
        <Grid item xs={12} sm={6}>
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
        <Grid item xs={12} sm={6}>
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

      <Section title="B. Datos laborales" description="Código de acceso, puesto y unidad médica.">
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            size="small"
            label="Código de empleado"
            name="codigoEmpleado"
            value={formState.codigoEmpleado}
            onChange={handleChange}
            required
            helperText="Lo usa para iniciar sesión"
            InputProps={{ startAdornment: <InputAdornment position="start"><Badge fontSize="small" /></InputAdornment> }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
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
        <Grid item xs={12} sm={6}>
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
        <Grid item xs={12} sm={6}>
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

      <Section
        title="C. Roles de acceso"
        description="Elija uno o más roles. Cada rol abre un conjunto de pantallas (se configuran en Gestión de Roles)."
      >
        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={roles}
            getOptionLabel={(option) => option.name}
            value={selectedRoles}
            onChange={(_event, newValue) => {
              handleAutocompleteChange('roleIds', newValue.map((r) => r.id));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Roles"
                required={selectedRoles.length === 0}
                helperText={
                  roles.length === 0
                    ? 'No hay roles. Créelos primero en Gestión de Roles.'
                    : `${selectedRoles.length} rol(es) seleccionado(s)`
                }
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />
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
          bgcolor: { xs: IGSS_COLORS.blanco, sm: 'transparent' },
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
