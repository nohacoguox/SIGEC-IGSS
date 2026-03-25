import React from 'react';
import { motion } from 'framer-motion';
import {
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import {
  AccountCircle, AlternateEmail, Badge, Business, CalendarToday, Fingerprint, Phone, Pin, Work,
} from '@mui/icons-material';
import SaveIcon from '@mui/icons-material/Save';
import ClearIcon from '@mui/icons-material/Clear';

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
}) => {
  const selectedPuesto = puestos.find(p => p.id === formState.puestoId) || null;
  const selectedUnidadMedica = unidadesMedicas.find(u => u.nombre === formState.unidadMedica) || null;
  const selectedRoles = roles.filter(r => (formState.roleIds || []).includes(r.id));
  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }} elevation={3}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, textAlign: 'center' }}>
        {editingId !== null ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
      </Typography>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Nombres(s)"
              name="nombres"
              value={formState.nombres}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><AccountCircle /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Apellido(s)"
              name="apellidos"
              value={formState.apellidos}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><AccountCircle /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="DPI"
              name="dpi"
              value={formState.dpi}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><Pin /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="NIT"
              name="nit"
              value={formState.nit}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><Fingerprint /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Teléfono"
              name="telefono"
              value={formState.telefono}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><Phone /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Correo Electrónico Institucional"
              name="correoInstitucional"
              type="email"
              value={formState.correoInstitucional}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><AlternateEmail /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Código de Empleado"
              name="codigoEmpleado"
              value={formState.codigoEmpleado}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><Badge /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Renglón"
              name="renglon"
              value={formState.renglon}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><CalendarToday /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={puestos}
              getOptionLabel={(option) => option.nombre}
              value={selectedPuesto}
              onChange={(event, newValue) => {
                handleAutocompleteChange('puestoId', newValue ? newValue.id : 0);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Puesto"
                  required
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <Work />
                        </InputAdornment>
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
              onChange={(event, newValue) => {
                handleAutocompleteChange('unidadMedica', newValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Unidad Médica"
                  required
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <Business />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
              isOptionEqualToValue={(option, value) => option.nombre === value.nombre}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              multiple
              options={roles}
              getOptionLabel={(option) => option.name}
              value={selectedRoles}
              onChange={(event, newValue) => {
                handleAutocompleteChange('roleIds', newValue.map((r) => r.id));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Roles"
                  required={selectedRoles.length === 0}
                  helperText="Puede seleccionar uno o varios roles."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <Work />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          </Grid>
          <Grid item xs={12} container justifyContent="flex-end" spacing={2} sx={{ mt: 2 }}>
            <Grid item>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button type="submit" variant="contained" color="primary" startIcon={<SaveIcon />}>
                  {editingId !== null ? 'Guardar Cambios' : 'Crear Usuario'}
                </Button>
              </motion.div>
            </Grid>
            <Grid item>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button type="button" variant="outlined" color="secondary" onClick={handleClearForm} startIcon={<ClearIcon />}>
                  Limpiar
                </Button>
              </motion.div>
            </Grid>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
};

export default UserForm;
