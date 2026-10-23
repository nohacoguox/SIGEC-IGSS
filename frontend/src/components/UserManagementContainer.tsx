import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  SelectChangeEvent, Snackbar, Tab, Tabs, Typography, Paper,
} from '@mui/material';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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
  const [roles, setRoles] = useState<{ id: number; name: string; permissions?: { id: number; name: string }[] }[]>([]);
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tab, setTab] = useState(0);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [createdCredentials, setCreatedCredentials] = useState<{
    codigoEmpleado: string;
    temporaryPassword: string;
    correoInstitucional: string;
    emailSent: boolean;
    emailError: string | null;
  } | null>(null);

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
        const tempPassword = String(newUser?.temporaryPassword || '');
        const emailSent = Boolean(newUser?.emailSent);
        const emailError = newUser?.emailError ? String(newUser.emailError) : null;
        setCreatedCredentials({
          codigoEmpleado: String(newUser?.codigoEmpleado || userPayload.codigoEmpleado || ''),
          temporaryPassword: tempPassword,
          correoInstitucional: String(newUser?.correoInstitucional || userPayload.correoInstitucional || ''),
          emailSent,
          emailError,
        });
        setSnackbarMessage(
          emailSent
            ? 'Usuario creado. Contraseña temporal mostrada y enviada al correo institucional.'
            : 'Usuario creado. Revise la contraseña temporal en pantalla (el correo no se envió).'
        );
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

        {tab === 0 && (
          <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary">
              {users.length} usuario(s) registrados
            </Typography>
          </Box>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 }, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
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

      <Dialog
        open={Boolean(createdCredentials)}
        onClose={() => setCreatedCredentials(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Usuario creado — credenciales temporales</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Código de empleado</Typography>
          <Typography
            component="code"
            sx={{
              display: 'block',
              mb: 2,
              px: 1.5,
              py: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              fontFamily: 'Consolas, monospace',
              fontSize: '1.05rem',
            }}
          >
            {createdCredentials?.codigoEmpleado || '—'}
          </Typography>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Contraseña temporal</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography
              component="code"
              sx={{
                flex: 1,
                px: 1.5,
                py: 1,
                bgcolor: 'action.hover',
                borderRadius: 1,
                fontFamily: 'Consolas, monospace',
                fontSize: '1.15rem',
                fontWeight: 700,
                letterSpacing: 0.5,
                wordBreak: 'break-all',
              }}
            >
              {createdCredentials?.temporaryPassword || '—'}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              disabled={!createdCredentials?.temporaryPassword}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(createdCredentials?.temporaryPassword || '');
                  setSnackbarMessage('Contraseña copiada al portapapeles.');
                  setSnackbarSeverity('success');
                  setSnackbarOpen(true);
                } catch {
                  setSnackbarMessage('No se pudo copiar. Seleccione el texto manualmente.');
                  setSnackbarSeverity('error');
                  setSnackbarOpen(true);
                }
              }}
            >
              Copiar
            </Button>
          </Box>
          {createdCredentials?.emailSent ? (
            <Alert severity="success">
              Correo enviado a <strong>{createdCredentials.correoInstitucional}</strong> con la contraseña temporal.
            </Alert>
          ) : (
            <Alert severity="warning">
              No se envió el correo
              {createdCredentials?.correoInstitucional
                ? ` a ${createdCredentials.correoInstitucional}`
                : ''}
              {createdCredentials?.emailError ? `: ${createdCredentials.emailError}` : '.'}
              {' '}Entregue la contraseña de forma segura al colaborador.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCreatedCredentials(null)}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagementContainer;
