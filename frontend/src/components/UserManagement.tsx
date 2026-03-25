import api from '../api';
import { useNotification } from '../context/NotificationContext';

// frontend/src/components/UserManagement.tsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

interface User {
  id: number;
  nombres: string;
  apellidos: string;
  dpi: string;
  nit: string;
  telefono: string;
  correoInstitucional: string;
  codigoEmpleado: string;
  renglon: string;
  puesto: string;
  unidadMedica: string;
}

const UserManagement: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [formState, setFormState] = useState<User>({
    id: 0,
    nombres: '',
    apellidos: '',
    dpi: '',
    nit: '',
    telefono: '',
    correoInstitucional: '',
    codigoEmpleado: '',
    renglon: '',
    puesto: '',
    unidadMedica: '',
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId !== null) {
      setUsers(users.map((user) => (user.id === editingId ? { ...formState, id: editingId } : user)));
      setEditingId(null);
    } else {
      setUsers([...users, { ...formState, id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1 }]);
    }
    handleClearForm();
  };

  const handleEdit = (id: number) => {
    const userToEdit = users.find((user) => user.id === id);
    if (userToEdit) {
      setFormState(userToEdit);
      setEditingId(id);
    }
  };

  const handleDelete = (id: number) => {
    setUsers(users.filter((user) => user.id !== id));
  };

  const handleResetPassword = async (id: number) => {
    if (window.confirm('¿Estás seguro de que deseas reiniciar la contraseña de este usuario?')) {
      try {
        await api.post(`/users/${id}/reset-password`);
        showSuccess('Contraseña reiniciada exitosamente a "123".');
      } catch (error) {
        console.error('Error al reiniciar la contraseña:', error);
        showError('Hubo un error al reiniciar la contraseña.');
      }
    }
  };

  const handleClearForm = () => {
    setFormState({
      id: 0,
      nombres: '',
      apellidos: '',
      dpi: '',
      nit: '',
      telefono: '',
      correoInstitucional: '',
      codigoEmpleado: '',
      renglon: '',
      puesto: '',
      unidadMedica: '',
    });
    setEditingId(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Gestión de Usuarios
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {editingId !== null ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
        </Typography>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nombres(s)"
                name="nombres"
                value={formState.nombres}
                onChange={handleChange}
                required
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
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Puesto"
                name="puesto"
                value={formState.puesto}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Unidad Médica en la que labora"
                name="unidadMedica"
                value={formState.unidadMedica}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <Button type="submit" variant="contained" color="primary" sx={{ mr: 2 }}>
                {editingId !== null ? 'Guardar Cambios' : 'Crear Usuario'}
              </Button>
              <Button type="button" variant="outlined" onClick={handleClearForm}>
                Limpiar Formulario
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Lista de Usuarios
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombres</TableCell>
                <TableCell>Apellidos</TableCell>
                <TableCell>DPI</TableCell>
                <TableCell>NIT</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Correo Institucional</TableCell>
                <TableCell>Código Empleado</TableCell>
                <TableCell>Renglón</TableCell>
                <TableCell>Puesto</TableCell>
                <TableCell>Unidad Médica</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.nombres}</TableCell>
                  <TableCell>{user.apellidos}</TableCell>
                  <TableCell>{user.dpi}</TableCell>
                  <TableCell>{user.nit}</TableCell>
                  <TableCell>{user.telefono}</TableCell>
                  <TableCell>{user.correoInstitucional}</TableCell>
                  <TableCell>{user.codigoEmpleado}</TableCell>
                  <TableCell>{user.renglon}</TableCell>
                  <TableCell>{user.puesto}</TableCell>
                  <TableCell>{user.unidadMedica}</TableCell>
                  <TableCell>
                    <IconButton color="primary" onClick={() => handleEdit(user.id)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="secondary" onClick={() => handleDelete(user.id)}>
                      <DeleteIcon />
                    </IconButton>
                    <IconButton color="default" onClick={() => handleResetPassword(user.id)}>
                      <VpnKeyIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default UserManagement;