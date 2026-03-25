import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tooltip,
  TableSortLabel,
  Autocomplete,
  Snackbar,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import api from '../api';

interface Permission {
  id: number;
  name: string;
  description: string;
}

interface Role {
  id: number;
  name: string;
  permissions: Permission[];
}

interface UserOption {
  id: number;
  nombres: string;
  apellidos: string;
  codigoEmpleado: string;
  roles?: Role[];
}

type Order = 'asc' | 'desc';

const RoleManagementPage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof Role>('name');

  // Asignar roles a colaborador
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [userRoles, setUserRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [loadingUserRoles, setLoadingUserRoles] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const response = await api.get('/users');
    setUsers(response.data);
  };

  const fetchRoles = async () => {
    const response = await api.get('/roles');
    setRoles(response.data);
  };

  const handleOpenDialog = (role: Role | null) => {
    setEditingRole(role);
    setRoleName(role ? role.name : '');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRole(null);
    setRoleName('');
  };

  const handleSubmit = async () => {
    if (editingRole) {
      await api.put(`/roles/${editingRole.id}`, { name: roleName });
    } else {
      await api.post('/roles', { name: roleName, permissionIds: [] });
    }
    fetchRoles();
    handleCloseDialog();
  };

  const handleUserSelect = async (user: UserOption | null) => {
    setSelectedUser(user);
    if (!user) {
      setUserRoles([]);
      setSelectedRoleIds([]);
      return;
    }
    setLoadingUserRoles(true);
    try {
      const res = await api.get(`/users/${user.id}/roles`);
      const rolesList: Role[] = res.data.roles ?? [];
      setUserRoles(rolesList);
      setSelectedRoleIds(rolesList.map((r) => r.id));
    } catch {
      setUserRoles([]);
      setSelectedRoleIds([]);
      setSnackbar({ open: true, message: 'Error al cargar los roles del usuario', severity: 'error' });
    } finally {
      setLoadingUserRoles(false);
    }
  };

  const handleUserRoleToggle = (roleId: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSaveUserRoles = async () => {
    if (!selectedUser) return;
    try {
      await api.put(`/users/${selectedUser.id}/roles`, { roleIds: selectedRoleIds });
      setSnackbar({ open: true, message: 'Roles actualizados correctamente', severity: 'success' });
      fetchUsers();
      const res = await api.get(`/users/${selectedUser.id}/roles`);
      setUserRoles(res.data.roles ?? []);
    } catch {
      setSnackbar({ open: true, message: 'Error al guardar los roles', severity: 'error' });
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      await api.delete(`/roles/${roleToDelete.id}`);
      setSnackbar({ open: true, message: `Rol "${roleToDelete.name}" eliminado`, severity: 'success' });
      setRoleToDelete(null);
      fetchRoles();
      fetchUsers();
    } catch {
      setSnackbar({ open: true, message: 'Error al eliminar el rol', severity: 'error' });
      setRoleToDelete(null);
    }
  };

  const handleRequestSort = (property: keyof Role) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => {
      const isAsc = order === 'asc';
      if (a[orderBy] < b[orderBy]) return isAsc ? -1 : 1;
      if (a[orderBy] > b[orderBy]) return isAsc ? 1 : -1;
      return 0;
    });
  }, [roles, order, orderBy]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedRoles = sortedRoles.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }} elevation={3}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonSearchIcon /> Asignar roles a un colaborador
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <Autocomplete
              options={users}
              getOptionLabel={(opt) => `${opt.nombres} ${opt.apellidos} (${opt.codigoEmpleado})`}
              value={selectedUser}
              onChange={(_, val) => handleUserSelect(val)}
              loading={loadingUserRoles}
              renderInput={(params) => (
                <TextField {...params} label="Buscar colaborador" placeholder="Nombre o código de empleado" />
              )}
              isOptionEqualToValue={(a, b) => a.id === b.id}
            />
          </Grid>
          {selectedUser && (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Roles asignados a {selectedUser.nombres} {selectedUser.apellidos}:
                </Typography>
                <FormGroup row>
                  {roles.map((role) => (
                    <FormControlLabel
                      key={role.id}
                      control={
                        <Checkbox
                          checked={selectedRoleIds.includes(role.id)}
                          onChange={() => handleUserRoleToggle(role.id)}
                        />
                      }
                      label={role.name}
                    />
                  ))}
                </FormGroup>
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={handleSaveUserRoles}>
                  Guardar roles del colaborador
                </Button>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 } }} elevation={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Catálogo de roles</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog(null)}
        >
          Crear Rol
        </Button>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sortDirection={orderBy === 'name' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleRequestSort('name')}
                >
                  Rol
                </TableSortLabel>
              </TableCell>
              <TableCell>Permisos</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedRoles.map((role) => (
              <TableRow key={role.id} hover>
                <TableCell>{role.name}</TableCell>
                <TableCell>{role.permissions?.map((p) => p.description).join(', ') || '—'}</TableCell>
                <TableCell>
                  <Tooltip title="Editar Rol">
                    <IconButton edge="end" aria-label="edit" onClick={() => handleOpenDialog(role)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar Rol">
                    <IconButton edge="end" aria-label="delete" onClick={() => setRoleToDelete(role)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={roles.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Roles por página:"
      />
      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingRole ? 'Editar Rol' : 'Crear Rol'}</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            margin="dense"
            label="Nombre del Rol"
            type="text"
            fullWidth
            variant="outlined"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: '16px 24px' }}>
          <Button onClick={handleCloseDialog} color="secondary">Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained">{editingRole ? 'Guardar Cambios' : 'Crear'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!roleToDelete} onClose={() => setRoleToDelete(null)}>
        <DialogTitle>Eliminar rol</DialogTitle>
        <DialogContent>
          ¿Eliminar el rol &quot;{roleToDelete?.name}&quot;? Se quitará de todos los usuarios que lo tengan.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleToDelete(null)}>Cancelar</Button>
          <Button onClick={handleDeleteRole} color="error" variant="contained">Eliminar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Paper>
    </Box>
  );
};

export default RoleManagementPage;