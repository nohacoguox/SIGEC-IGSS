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
  Chip,
  Divider,
  FormHelperText,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import api from '../api';
import {
  APP_SCREENS,
  AppScreenDefinition,
  getScreenLabelForPermission,
  groupScreensByGroup,
} from '../config/appScreens';

interface Permission {
  id: number;
  name: string;
  description: string;
  screenKey?: string | null;
  panel?: string | null;
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

interface AppScreenApi extends AppScreenDefinition {
  permissionId: number | null;
  registered: boolean;
}

type Order = 'asc' | 'desc';

const RoleManagementPage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [appScreens, setAppScreens] = useState<AppScreenApi[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<Permission[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [selectedScreens, setSelectedScreens] = useState<AppScreenApi[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof Role>('name');

  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [userRoles, setUserRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [loadingUserRoles, setLoadingUserRoles] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
    fetchAppScreens();
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const res = await api.get('/permissions');
      setPermissionsCatalog(res.data ?? []);
    } catch {
      setPermissionsCatalog([]);
    }
  };

  const fetchAppScreens = async () => {
    try {
      const res = await api.get('/app-screens');
      setAppScreens(res.data.screens ?? []);
    } catch {
      setAppScreens(APP_SCREENS.map((s) => ({ ...s, permissionId: null, registered: false })));
    }
  };

  const fetchUsers = async () => {
    const response = await api.get('/users');
    setUsers(response.data);
  };

  const fetchRoles = async () => {
    const response = await api.get('/roles');
    setRoles(response.data);
  };

  const screensByPanel = useMemo(() => {
    const admin = appScreens.filter((s) => s.panel === 'admin');
    const colaborador = appScreens.filter((s) => s.panel === 'colaborador');
    return { admin, colaborador };
  }, [appScreens]);

  const handleOpenDialog = (role: Role | null) => {
    setEditingRole(role);
    setRoleName(role ? role.name : '');
    setFormError('');
    if (role?.permissions?.length) {
      const permNames = new Set(role.permissions.map((p) => p.name));
      setSelectedScreens(appScreens.filter((s) => permNames.has(s.permission)));
    } else {
      setSelectedScreens([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRole(null);
    setRoleName('');
    setSelectedScreens([]);
    setFormError('');
  };

  const resolvePermissionIds = (screens: AppScreenApi[]): number[] => {
    const ids: number[] = [];
    for (const screen of screens) {
      if (screen.permissionId != null) {
        ids.push(screen.permissionId);
        continue;
      }
      const fromCatalog = permissionsCatalog.find((p) => p.name === screen.permission);
      if (fromCatalog) ids.push(fromCatalog.id);
    }
    return Array.from(new Set(ids));
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!roleName.trim()) {
      setFormError('Ingrese el nombre del rol');
      return;
    }
    if (selectedScreens.length === 0) {
      setFormError('Seleccione al menos una pantalla para vincular el rol');
      return;
    }

    let permissionIds = resolvePermissionIds(selectedScreens);

    // Si aún faltan IDs, recargar catálogo de permisos
    if (permissionIds.length === 0 || permissionIds.length < selectedScreens.length) {
      try {
        const res = await api.get('/permissions');
        const perms: Permission[] = res.data ?? [];
        setPermissionsCatalog(perms);
        permissionIds = selectedScreens
          .map((s) => s.permissionId ?? perms.find((p) => p.name === s.permission)?.id)
          .filter((id): id is number => id != null);
        permissionIds = Array.from(new Set(permissionIds));
      } catch {
        /* ignore */
      }
    }

    if (permissionIds.length === 0) {
      setFormError(
        'No se encontraron permisos para las pantallas seleccionadas. Reinicie el backend y vuelva a iniciar sesión.'
      );
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, { name: roleName.trim(), permissionIds });
      } else {
        await api.post('/roles', { name: roleName.trim(), permissionIds });
      }
      setSnackbar({
        open: true,
        message: editingRole ? 'Rol actualizado correctamente' : 'Rol creado y vinculado a pantalla(s)',
        severity: 'success',
      });
      fetchRoles();
      handleCloseDialog();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al guardar el rol';
      setFormError(msg);
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setSaving(false);
    }
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

  const paginatedRoles = sortedRoles.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const formatRoleScreens = (role: Role) => {
    if (!role.permissions?.length) return '—';
    return role.permissions
      .map((p) => getScreenLabelForPermission(p.name))
      .join(', ');
  };

  const renderScreenOption = (screen: AppScreenApi) => (
    <Box>
      <Typography variant="body2" fontWeight={600}>{screen.label}</Typography>
      <Typography variant="caption" color="text.secondary">
        {screen.panel === 'admin' ? 'Administración' : 'Colaborador'}
        {screen.group ? ` · ${screen.group}` : ''}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }} elevation={3}>
        <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonSearchIcon /> Asignar roles a un colaborador
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cada rol debe estar vinculado a una o más pantallas del sistema ({appScreens.length} pantallas disponibles).
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
                      label={
                        <Box>
                          <Typography variant="body2">{role.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{formatRoleScreens(role)}</Typography>
                        </Box>
                      }
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5">Catálogo de roles</Typography>
            <Typography variant="body2" color="text.secondary">
              {appScreens.length} pantallas: {screensByPanel.admin.length} administración, {screensByPanel.colaborador.length} colaborador
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog(null)}>
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
                <TableCell>Pantallas vinculadas</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRoles.map((role) => (
                <TableRow key={role.id} hover>
                  <TableCell>{role.name}</TableCell>
                  <TableCell>
                    {role.permissions?.length ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {role.permissions.map((p) => (
                          <Chip
                            key={p.id}
                            size="small"
                            label={getScreenLabelForPermission(p.name)}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    ) : (
                      '—'
                    )}
                  </TableCell>
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
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="Roles por página:"
        />

        <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="md">
          <DialogTitle>{editingRole ? 'Editar Rol' : 'Crear Rol'}</DialogTitle>
          <DialogContent dividers>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>
                {formError}
              </Alert>
            )}
            <TextField
              autoFocus
              margin="dense"
              label="Nombre del Rol"
              type="text"
              fullWidth
              variant="outlined"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              sx={{ mb: 3 }}
            />

            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Vincular a pantalla(s)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Seleccione las pantallas a las que tendrá acceso este rol. Cada pestaña del menú corresponde a una pantalla.
            </Typography>

            <Autocomplete
              multiple
              options={appScreens}
              value={selectedScreens}
              onChange={(_, val) => setSelectedScreens(val)}
              getOptionLabel={(opt) => opt.label}
              isOptionEqualToValue={(a, b) => a.key === b.key}
              groupBy={(opt) => `${opt.panel === 'admin' ? 'Administración' : 'Colaborador'}${opt.group ? ` · ${opt.group}` : ''}`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pantallas"
                  placeholder="Buscar pantalla..."
                  helperText={`${selectedScreens.length} pantalla(s) seleccionada(s)`}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.key}>
                  {renderScreenOption(option)}
                </li>
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.key}
                    label={option.label}
                    size="small"
                  />
                ))
              }
              sx={{ mb: 3 }}
            />

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Pantallas disponibles en el sistema
            </Typography>
            <Grid container spacing={2}>
              {(['admin', 'colaborador'] as const).map((panel) => {
                const panelScreens = appScreens.filter((s) => s.panel === panel);
                const grouped = groupScreensByGroup(panelScreens);
                return (
                  <Grid item xs={12} md={6} key={panel}>
                    <Typography variant="caption" fontWeight={700} color="primary">
                      {panel === 'admin' ? 'ADMINISTRACIÓN' : 'COLABORADOR'} ({panelScreens.length})
                    </Typography>
                    {Object.entries(grouped).map(([group, screens]) => (
                      <Box key={group} sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">{group}</Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1 }}>
                          {screens.map((s) => (
                            <li key={s.key}>
                              <Typography variant="body2">{s.label}</Typography>
                            </li>
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Grid>
                );
              })}
            </Grid>
            {selectedScreens.length === 0 && (
              <FormHelperText error sx={{ mt: 1 }}>
                Debe seleccionar al menos una pantalla
              </FormHelperText>
            )}
          </DialogContent>
          <DialogActions sx={{ p: '16px 24px' }}>
            <Button onClick={handleCloseDialog} color="secondary" disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} variant="contained" disabled={saving || !roleName.trim() || selectedScreens.length === 0}>
              {saving ? 'Guardando…' : editingRole ? 'Guardar Cambios' : 'Crear'}
            </Button>
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

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
        >
          <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
        </Snackbar>
      </Paper>
    </Box>
  );
};

export default RoleManagementPage;
