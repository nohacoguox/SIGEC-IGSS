import {
  Alert, Box, Button, SelectChangeEvent, Snackbar, Tab, Tabs, Typography, Paper,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import api from '../api';
import UserForm from './UserForm';
import UserList from './UserList';
import { IGSS_COLORS } from '../theme/institutionalColors';

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

const emptyForm = {
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
};

const UserManagementContainer: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [unidadesMedicas, setUnidadesMedicas] = useState<UnidadMedica[]>([]);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tab, setTab] = useState(0);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const fetchUsers = async () => {
    try {
      const response = await api.get(API_URL);
      setUsers(response.data);
    } catch (err: any) {
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

  const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
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

  const handleClearForm = () => {
    setFormState(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { roleIds, ...userPayload } = formState;
      if (editingId !== null) {
        await api.put(`${API_URL}/${editingId}`, userPayload);
        await api.put(`${API_URL}/${editingId}/roles`, { roleIds: roleIds || [] });
        setSnackbarMessage('Usuario actualizado correctamente.');
        setSnackbarSeverity('success');
      } else {
        const { data: newUser } = await api.post(API_URL, userPayload);
        if (newUser?.id && (roleIds?.length ?? 0) > 0) {
          await api.put(`${API_URL}/${newUser.id}/roles`, { roleIds });
        }
        setSnackbarMessage('Usuario creado. Ya puede iniciar sesión con su código de empleado.');
        setSnackbarSeverity('success');
      }
      fetchUsers();
      handleClearForm();
      setSnackbarOpen(true);
      setTab(0);
    } catch (error: any) {
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
      setTab(1);
    }
  };

  const handleNewUser = () => {
    handleClearForm();
    setTab(1);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`${API_URL}/${id}`);
      setSnackbarMessage('Usuario eliminado.');
      setSnackbarSeverity('success');
      fetchUsers();
    } catch (err: any) {
      setSnackbarMessage(`Error al eliminar el usuario: ${err.message || ''}`);
      setSnackbarSeverity('error');
    }
    setSnackbarOpen(true);
  };

  const handleResetPassword = async (id: number) => {
    try {
      await api.post(`users/${id}/reset-password`);
      setSnackbarMessage('Contraseña restablecida. La temporal es: 123 (el usuario deberá cambiarla).');
      setSnackbarSeverity('success');
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error al restablecer la contraseña';
      setSnackbarMessage(msg);
      setSnackbarSeverity('error');
    }
    setSnackbarOpen(true);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0, width: '100%', maxWidth: '100%' }}>
      <Alert
        severity="info"
        icon={<InfoOutlinedIcon />}
        sx={{
          borderRadius: 2,
          bgcolor: 'rgba(0,91,145,0.06)',
          color: IGSS_COLORS.textoOscuro,
          '& .MuiAlert-icon': { color: IGSS_COLORS.azul },
        }}
      >
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.35 }}>
          Cómo administrar usuarios
        </Typography>
        <Typography variant="body2">
          En el <strong>listado</strong> busque, edite o restablezca contraseñas.
          En <strong>crear / editar</strong> complete los datos y asigne roles (las pantallas del menú dependen de esos roles).
        </Typography>
      </Alert>

      <Paper
        elevation={2}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
            px: { xs: 1, sm: 2 },
            bgcolor: 'rgba(0,91,145,0.03)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 52,
              minWidth: 0,
              maxWidth: '100%',
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 52 },
              '& .Mui-selected': { color: `${IGSS_COLORS.azulOscuro} !important` },
              '& .MuiTabs-indicator': { height: 3, bgcolor: IGSS_COLORS.azul },
            }}
          >
            <Tab icon={<PeopleOutlineIcon fontSize="small" />} iconPosition="start" label="1. Listado" />
            <Tab
              icon={<PersonAddAltIcon fontSize="small" />}
              iconPosition="start"
              label={editingId != null ? '2. Editando usuario' : '2. Crear usuario'}
            />
          </Tabs>
          {tab === 0 && (
            <Button
              variant="contained"
              size="small"
              startIcon={<PersonAddAltIcon />}
              onClick={handleNewUser}
              sx={{ mb: 1, mr: { xs: 0.5, sm: 1 }, whiteSpace: 'nowrap' }}
            >
              Nuevo
            </Button>
          )}
        </Box>

        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            {tab === 0
              ? `${users.length} usuario(s) registrados. Use la búsqueda o las acciones de cada fila.`
              : editingId != null
                ? 'Modifique los datos y guarde. Los roles definen qué pantallas verá al iniciar sesión.'
                : 'Complete los datos obligatorios. Tras crear, el colaborador inicia con su código de empleado.'}
          </Typography>
        </Box>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Box sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0 }}>
              {tab === 0 && (
                <UserList
                  users={users}
                  handleEdit={handleEdit}
                  handleDelete={handleDelete}
                  handleResetPassword={handleResetPassword}
                  onCreateNew={handleNewUser}
                />
              )}
              {tab === 1 && (
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
                  onCancelToList={() => { handleClearForm(); setTab(0); }}
                />
              )}
            </Box>
          </motion.div>
        </AnimatePresence>
      </Paper>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ width: { xs: '92%', sm: 'auto' } }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }} elevation={6}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagementContainer;
