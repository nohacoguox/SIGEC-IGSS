import {
  Alert, Box, SelectChangeEvent, Snackbar, Tab, Tabs, Paper,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import api from '../api';
import UserForm from './UserForm';
import UserList from './UserList';

const API_URL = 'users';
const UNIDADES_MEDICAS_API_URL = 'unidades-medicas';
const PUESTOS_API_URL = 'puestos';
const ROLES_API_URL = 'roles';

interface Puesto {
  id: number;
  nombre: string;
}

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
  puesto: Puesto;
  unidadMedica: string;
  departamentoDireccion?: string | null;
  roles?: { id: number; name: string }[];
}

interface UnidadMedica {
  nombre: string;
  departamento: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const UserManagementContainer: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [unidadesMedicas, setUnidadesMedicas] = useState<UnidadMedica[]>([]);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [formState, setFormState] = useState({
    nombres: '',
    apellidos: '',
    dpi: '',
    nit: '',
    telefono: '',
    correoInstitucional: '',
    codigoEmpleado: '',
    renglon: '',
    puestoId: 0,
    unidadMedica: '',
    roleIds: [] as number[],
    departamentoDireccion: '' as string,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [value, setValue] = useState(0);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const fetchUsers = async () => {
    try {
      const response = await api.get(API_URL);
      setUsers(response.data);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setSnackbarMessage(`Error al cargar los usuarios: ${err.message || ''}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const fetchUnidadesMedicas = async () => {
    try {
      const response = await api.get(UNIDADES_MEDICAS_API_URL);
      setUnidadesMedicas(response.data);
    } catch (err: any) {
      console.error("Error fetching unidades medicas:", err);
      setSnackbarMessage(`Error al cargar las unidades médicas: ${err.message || ''}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const fetchPuestos = async () => {
    try {
      const response = await api.get(PUESTOS_API_URL);
      setPuestos(response.data);
    } catch (err: any) {
      console.error("Error fetching puestos:", err);
      setSnackbarMessage(`Error al cargar los puestos: ${err.message || ''}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.get(ROLES_API_URL);
      setRoles(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.error("Error fetching roles:", err);
      setSnackbarMessage(`Error al cargar los roles: ${err.message || ''}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUnidadesMedicas();
    fetchPuestos();
    fetchRoles();
  }, []);

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const handleChangeTab = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>) => {
    const { name, value: val } = e.target;
    setFormState({ ...formState, [name]: name === 'puestoId' ? Number(val) : val });
  };

  const handleAutocompleteChange = (name: string, value: any) => {
    if (name === 'unidadMedica') {
      setFormState({
        ...formState,
        unidadMedica: value?.nombre ?? '',
        departamentoDireccion: value?.departamento ?? '',
      });
      return;
    }
    if (name === 'roleIds') {
      setFormState({ ...formState, roleIds: Array.isArray(value) ? value : [] });
      return;
    }
    setFormState({ ...formState, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { roleIds, ...userPayload } = formState;
      if (editingId !== null) {
        await api.put(`${API_URL}/${editingId}`, userPayload);
        await api.put(`${API_URL}/${editingId}/roles`, { roleIds: roleIds || [] });
        setSnackbarMessage('Usuario modificado exitosamente.');
        setSnackbarSeverity('success');
      } else {
        const { data: newUser } = await api.post(API_URL, userPayload);
        if (newUser?.id && (roleIds?.length ?? 0) > 0) {
          await api.put(`${API_URL}/${newUser.id}/roles`, { roleIds });
        }
        setSnackbarMessage('Usuario creado exitosamente.');
        setSnackbarSeverity('success');
      }
      fetchUsers();
      handleClearForm();
      setSnackbarOpen(true);
      setValue(1);
    } catch (error: any) {
      console.error("Error submitting form:", error);
      setSnackbarMessage(error.response?.data?.message || 'Error al guardar el usuario.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleEdit = (id: number) => {
    const userToEdit = users.find((user) => user.id === id);
    if (userToEdit) {
      const { id: userId, roles: userRoles, puesto, ...formData } = userToEdit as any;
      setFormState({
        ...formData,
        puestoId: puesto ? puesto.id : 0,
        roleIds: (userRoles || []).map((r: { id: number }) => r.id),
        departamentoDireccion: formData.departamentoDireccion ?? '',
      });
      setEditingId(userId);
      setValue(0);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`${API_URL}/${id}`);
      setSnackbarMessage('Usuario eliminado exitosamente.');
      setSnackbarSeverity('success');
      fetchUsers();
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setSnackbarMessage(`Error al eliminar el usuario: ${err.message || ''}`);
      setSnackbarSeverity('error');
    }
    setSnackbarOpen(true);
  };

  const handleClearForm = () => {
    setFormState({
      nombres: '',
      apellidos: '',
      dpi: '',
      nit: '',
      telefono: '',
      correoInstitucional: '',
      codigoEmpleado: '',
      renglon: '',
      puestoId: 0,
      unidadMedica: '',
      roleIds: [],
      departamentoDireccion: '',
    });
    setEditingId(null);
  };

  const handleResetPassword = async (id: number) => {
    try {
      await api.post(`users/${id}/reset-password`);
      setSnackbarMessage('Contraseña restablecida exitosamente. La nueva contraseña es: 123');
      setSnackbarSeverity('success');
      fetchUsers();
    } catch (err: any) {
      console.error('Error resetting password:', err);
      const msg = err.response?.data?.message || err.message || 'Error al restablecer la contraseña';
      setSnackbarMessage(msg);
      setSnackbarSeverity('error');
    }
    setSnackbarOpen(true);
  };

  return (
    <Paper elevation={3} sx={{ p: 2, width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={value}
          onChange={handleChangeTab}
          aria-label="user management tabs"
          variant="fullWidth"
        >
          <Tab label="Creación/Edición de Usuario" {...a11yProps(0)} />
          <Tab label="Listado de Usuarios" {...a11yProps(1)} />
        </Tabs>
      </Box>
      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <TabPanel value={value} index={0}>
            <UserForm
              formState={formState}
              handleChange={handleChange}
              handleAutocompleteChange={handleAutocompleteChange}
              handleSubmit={handleSubmit}
              handleClearForm={handleClearForm}
              editingId={editingId}
              unidadesMedicas={unidadesMedicas}
              puestos={puestos}
              roles={roles}
            />
          </TabPanel>
          <TabPanel value={value} index={1}>
            <UserList
              users={users}
              handleEdit={handleEdit}
              handleDelete={handleDelete}
              handleResetPassword={handleResetPassword}
            />
          </TabPanel>
        </motion.div>
      </AnimatePresence>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ width: { xs: '90%', sm: 'auto' } }}
      >
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.3 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.5 }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }} elevation={6}>
            {snackbarMessage}
          </Alert>
        </motion.div>
      </Snackbar>
    </Paper>
  );
};

export default UserManagementContainer;