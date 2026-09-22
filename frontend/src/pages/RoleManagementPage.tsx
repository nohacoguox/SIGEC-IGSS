import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, Grid, IconButton,
  Paper, Snackbar, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TableSortLabel, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import BadgeIcon from '@mui/icons-material/Badge';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SecurityIcon from '@mui/icons-material/Security';
import api from '../api';
import {
  AppScreenDefinition,
  getScreenLabelForPermission,
  groupScreensByGroup,
} from '../config/appScreens';
import { useAppScreens } from '../context/AppScreensContext';
import { useThemeMode } from '../context/ThemeContext';
import { IGSS_COLORS } from '../theme/institutionalColors';

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
  const { mode } = useThemeMode();
  const { screens: catalogScreens } = useAppScreens();
  const [mainTab, setMainTab] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [appScreens, setAppScreens] = useState<AppScreenApi[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<Permission[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [selectedScreenKeys, setSelectedScreenKeys] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof Role>('name');
  const [roleSearch, setRoleSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [savedRoleIds, setSavedRoleIds] = useState<number[]>([]);
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
      setAppScreens(catalogScreens.map((s) => ({ ...s, permissionId: null, registered: false })));
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

  const screensByPanel = useMemo(() => ({
    admin: appScreens.filter((s) => s.panel === 'admin'),
    colaborador: appScreens.filter((s) => s.panel === 'colaborador'),
  }), [appScreens]);

  const selectedScreens = useMemo(
    () => appScreens.filter((s) => selectedScreenKeys.includes(s.key)),
    [appScreens, selectedScreenKeys]
  );

  const assignmentDirty = useMemo(() => {
    if (!selectedUser) return false;
    if (selectedRoleIds.length !== savedRoleIds.length) return true;
    const a = [...selectedRoleIds].sort();
    const b = [...savedRoleIds].sort();
    return a.some((id, i) => id !== b[i]);
  }, [selectedUser, selectedRoleIds, savedRoleIds]);

  const handleOpenDialog = (role: Role | null) => {
    setEditingRole(role);
    setRoleName(role ? role.name : '');
    setFormError('');
    if (role?.permissions?.length) {
      const permNames = new Set(role.permissions.map((p) => p.name));
      setSelectedScreenKeys(appScreens.filter((s) => permNames.has(s.permission)).map((s) => s.key));
    } else {
      setSelectedScreenKeys([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRole(null);
    setRoleName('');
    setSelectedScreenKeys([]);
    setFormError('');
  };

  const toggleScreen = (key: string) => {
    setSelectedScreenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const togglePanelScreens = (panel: 'admin' | 'colaborador', checked: boolean) => {
    const keys = screensByPanel[panel].map((s) => s.key);
    setSelectedScreenKeys((prev) => {
      if (checked) return Array.from(new Set([...prev, ...keys]));
      return prev.filter((k) => !keys.includes(k));
    });
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
      setFormError('Seleccione al menos una pantalla para este rol');
      return;
    }

    let permissionIds = resolvePermissionIds(selectedScreens);
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
        message: editingRole ? 'Rol actualizado' : 'Rol creado. Ya puede asignarlo a colaboradores.',
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
      setSelectedRoleIds([]);
      setSavedRoleIds([]);
      return;
    }
    setLoadingUserRoles(true);
    try {
      const res = await api.get(`/users/${user.id}/roles`);
      const rolesList: Role[] = res.data.roles ?? [];
      const ids = rolesList.map((r) => r.id);
      setSelectedRoleIds(ids);
      setSavedRoleIds(ids);
    } catch {
      setSelectedRoleIds([]);
      setSavedRoleIds([]);
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
      setSavedRoleIds([...selectedRoleIds]);
      setSnackbar({ open: true, message: 'Roles del colaborador guardados', severity: 'success' });
      fetchUsers();
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
      if (selectedUser) handleUserSelect(selectedUser);
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

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    const base = q
      ? roles.filter((r) =>
          r.name.toLowerCase().includes(q)
          || r.permissions?.some((p) => getScreenLabelForPermission(p.name).toLowerCase().includes(q))
        )
      : roles;
    return [...base].sort((a, b) => {
      const isAsc = order === 'asc';
      if (a[orderBy] < b[orderBy]) return isAsc ? -1 : 1;
      if (a[orderBy] > b[orderBy]) return isAsc ? 1 : -1;
      return 0;
    });
  }, [roles, roleSearch, order, orderBy]);

  const paginatedRoles = filteredRoles.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const screenCountLabel = (role: Role) => {
    const n = role.permissions?.length ?? 0;
    return n === 1 ? '1 pantalla' : `${n} pantallas`;
  };

  const renderScreenChecklist = (panel: 'admin' | 'colaborador') => {
    const panelScreens = screensByPanel[panel];
    const grouped = groupScreensByGroup(panelScreens);
    const allKeys = panelScreens.map((s) => s.key);
    const selectedCount = allKeys.filter((k) => selectedScreenKeys.includes(k)).length;
    const allChecked = panelScreens.length > 0 && selectedCount === panelScreens.length;
    const indeterminate = selectedCount > 0 && selectedCount < panelScreens.length;

    return (
      <Paper
        variant="outlined"
        sx={{ p: 1.75, height: '100%', borderRadius: 2, borderColor: 'divider' }}
      >
        <FormControlLabel
          sx={{ mb: 0.5, ml: 0 }}
          control={
            <Checkbox
              checked={allChecked}
              indeterminate={indeterminate}
              onChange={(e) => togglePanelScreens(panel, e.target.checked)}
            />
          }
          label={
            <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
              {panel === 'admin' ? 'Panel administración' : 'Panel colaborador'}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 600 }}>
                {selectedCount}/{panelScreens.length}
              </Typography>
            </Typography>
          }
        />
        <Divider sx={{ mb: 1 }} />
        {Object.entries(grouped).map(([group, screens]) => (
          <Box key={group} sx={{ mb: 1.25 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.25 }}>
              {group}
            </Typography>
            {screens.map((s) => (
              <FormControlLabel
                key={s.key}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  mx: 0,
                  mb: 0.25,
                  '& .MuiFormControlLabel-label': { mt: 0.35 },
                }}
                control={
                  <Checkbox
                    size="small"
                    checked={selectedScreenKeys.includes(s.key)}
                    onChange={() => toggleScreen(s.key)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{s.label}</Typography>
                    {s.description && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.3 }}>
                        {s.description}
                      </Typography>
                    )}
                  </Box>
                }
              />
            ))}
          </Box>
        ))}
      </Paper>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
      <Alert
        severity="info"
        icon={<InfoOutlinedIcon />}
        sx={{
          borderRadius: 2,
          ...(mode === 'dark'
            ? {}
            : {
                bgcolor: 'rgba(0,91,145,0.06)',
                color: IGSS_COLORS.textoOscuro,
                '& .MuiAlert-icon': { color: IGSS_COLORS.azul },
              }),
        }}
      >
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.35 }}>
          Cómo funciona el acceso
        </Typography>
        <Typography variant="body2">
          Un <strong>rol</strong> es un paquete de pantallas. Primero cree o edite roles (paso 1),
          luego asígnelos a cada colaborador (paso 2). El menú que ve cada persona depende de los roles que tenga.
        </Typography>
      </Alert>

      <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={mainTab}
          onChange={(_, v) => setMainTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 52,
            px: 1,
            bgcolor: 'rgba(0,91,145,0.03)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 52 },
            '& .Mui-selected': { color: `${IGSS_COLORS.azulOscuro} !important` },
            '& .MuiTabs-indicator': { height: 3, bgcolor: IGSS_COLORS.azul },
          }}
        >
          <Tab icon={<SecurityIcon fontSize="small" />} iconPosition="start" label="1. Definir roles" />
          <Tab icon={<AssignmentIndIcon fontSize="small" />} iconPosition="start" label="2. Asignar a colaboradores" />
        </Tabs>

        {mainTab === 0 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
              <Box sx={{ minWidth: 0, maxWidth: 640 }}>
                <Typography variant="h6" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro }}>
                  Catálogo de roles
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                  Defina el nombre del rol y marque las pantallas que podrá abrir quien lo tenga.
                  Hay {appScreens.length} pantallas ({screensByPanel.admin.length} de administración y {screensByPanel.colaborador.length} de colaborador).
                </Typography>
              </Box>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog(null)}>
                Crear rol
              </Button>
            </Box>

            <TextField
              size="small"
              placeholder="Buscar por nombre de rol o pantalla…"
              value={roleSearch}
              onChange={(e) => { setRoleSearch(e.target.value); setPage(0); }}
              sx={{ mb: 2, maxWidth: 420, width: '100%' }}
            />

            {roles.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Aún no hay roles. Cree el primero (por ejemplo «Analista DAF» o «Colaborador unidad») y luego asígnelo en el paso 2.
              </Alert>
            ) : (
              <>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: IGSS_COLORS.azulOscuro, '& th': { color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' } }}>
                        <TableCell sortDirection={orderBy === 'name' ? order : false}>
                          <TableSortLabel
                            active={orderBy === 'name'}
                            direction={orderBy === 'name' ? order : 'asc'}
                            onClick={() => handleRequestSort('name')}
                            sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#fff !important' } }}
                          >
                            Rol
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>Acceso (pantallas)</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedRoles.map((role) => (
                        <TableRow key={role.id} hover>
                          <TableCell sx={{ verticalAlign: 'top', minWidth: 160 }}>
                            <Typography fontWeight={700}>{role.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{screenCountLabel(role)}</Typography>
                          </TableCell>
                          <TableCell>
                            {role.permissions?.length ? (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 560 }}>
                                {role.permissions.slice(0, 6).map((p) => (
                                  <Chip key={p.id} size="small" label={getScreenLabelForPermission(p.name)} variant="outlined" />
                                ))}
                                {role.permissions.length > 6 && (
                                  <Chip size="small" label={`+${role.permissions.length - 6} más`} color="primary" variant="outlined" />
                                )}
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">Sin pantallas</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Tooltip title="Editar pantallas del rol">
                              <IconButton aria-label="edit" onClick={() => handleOpenDialog(role)} size="small">
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar rol">
                              <IconButton aria-label="delete" onClick={() => setRoleToDelete(role)} color="error" size="small">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredRoles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3}>
                            <Typography variant="body2" color="text.secondary">Ningún rol coincide con la búsqueda.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[5, 8, 15, 25]}
                  component="div"
                  count={filteredRoles.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  labelRowsPerPage="Filas:"
                />
              </>
            )}
          </Box>
        )}

        {mainTab === 1 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ mb: 2.5, maxWidth: 720 }}>
              <Typography variant="h6" fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonSearchIcon /> Asignar roles a un colaborador
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                Busque a la persona y marque los roles que debe tener. Puede combinar varios roles; el acceso es la unión de sus pantallas.
              </Typography>
            </Box>

            {roles.length === 0 && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                No hay roles definidos. Vaya al paso 1 y cree al menos uno antes de asignar.
                <Button size="small" sx={{ ml: 1, textTransform: 'none', fontWeight: 700 }} onClick={() => setMainTab(0)}>
                  Ir a definir roles
                </Button>
              </Alert>
            )}

            <Autocomplete
              options={users}
              getOptionLabel={(opt) => `${opt.nombres} ${opt.apellidos} (${opt.codigoEmpleado})`}
              value={selectedUser}
              onChange={(_, val) => handleUserSelect(val)}
              loading={loadingUserRoles}
              disabled={roles.length === 0}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Buscar colaborador"
                  placeholder="Nombre o código de empleado"
                  helperText={selectedUser ? 'Marque o desmarque roles y pulse Guardar' : 'Seleccione un colaborador para continuar'}
                />
              )}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              sx={{ maxWidth: 520, mb: 2.5 }}
            />

            {selectedUser && (
              <>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.75,
                    mb: 2,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    flexWrap: 'wrap',
                    bgcolor: 'rgba(0,91,145,0.04)',
                  }}
                >
                  <BadgeIcon sx={{ color: IGSS_COLORS.azul }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={800}>
                      {selectedUser.nombres} {selectedUser.apellidos}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Código {selectedUser.codigoEmpleado} · {selectedRoleIds.length} rol(es) seleccionados
                      {assignmentDirty ? ' · cambios sin guardar' : ''}
                    </Typography>
                  </Box>
                  {assignmentDirty && (
                    <Chip size="small" color="warning" label="Sin guardar" sx={{ fontWeight: 700 }} />
                  )}
                </Paper>

                <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                  {roles.map((role) => {
                    const checked = selectedRoleIds.includes(role.id);
                    return (
                      <Grid item xs={12} sm={6} md={4} key={role.id}>
                        <Paper
                          variant="outlined"
                          onClick={() => handleUserRoleToggle(role.id)}
                          sx={{
                            p: 1.5,
                            height: '100%',
                            borderRadius: 2,
                            cursor: 'pointer',
                            borderColor: checked ? IGSS_COLORS.azul : 'divider',
                            borderWidth: checked ? 2 : 1,
                            bgcolor: checked ? 'action.selected' : 'background.paper',
                            transition: 'border-color .15s ease, background-color .15s ease',
                            '&:hover': { borderColor: IGSS_COLORS.azulClaro },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                            <Checkbox checked={checked} tabIndex={-1} sx={{ p: 0.5, mt: -0.25 }} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={800} sx={{ lineHeight: 1.25 }}>{role.name}</Typography>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                                {screenCountLabel(role)}
                              </Typography>
                              {role.permissions?.length > 0 && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    mt: 0.75,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {role.permissions.map((p) => getScreenLabelForPermission(p.name)).join(' · ')}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    onClick={handleSaveUserRoles}
                    disabled={!assignmentDirty}
                  >
                    Guardar roles del colaborador
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    disabled={!assignmentDirty}
                    onClick={() => setSelectedRoleIds([...savedRoleIds])}
                  >
                    Descartar cambios
                  </Button>
                </Box>
              </>
            )}
          </Box>
        )}
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 800, color: IGSS_COLORS.azulOscuro }}>
          {editingRole ? 'Editar rol' : 'Crear rol'}
        </DialogTitle>
        <DialogContent dividers>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>
              {formError}
            </Alert>
          )}

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
            Paso A — Nombre
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Nombre del rol"
            placeholder="Ej. Analista DAF, Jefe de unidad, Colaborador compras"
            type="text"
            fullWidth
            variant="outlined"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            sx={{ mb: 2.5 }}
          />

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            Paso B — Pantallas permitidas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Marque las opciones del menú que podrá ver quien tenga este rol.
            Seleccionadas: <strong>{selectedScreenKeys.length}</strong>
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>{renderScreenChecklist('admin')}</Grid>
            <Grid item xs={12} md={6}>{renderScreenChecklist('colaborador')}</Grid>
          </Grid>

          {selectedScreenKeys.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
              Debe marcar al menos una pantalla.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: '16px 24px' }}>
          <Button onClick={handleCloseDialog} color="secondary" disabled={saving}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={saving || !roleName.trim() || selectedScreenKeys.length === 0}
          >
            {saving ? 'Guardando…' : editingRole ? 'Guardar cambios' : 'Crear rol'}
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
    </Box>
  );
};

export default RoleManagementPage;
