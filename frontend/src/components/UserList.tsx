import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, Grid, IconButton, InputLabel, MenuItem, Paper, Select, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TableSortLabel, TextField, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import LockResetIcon from '@mui/icons-material/LockReset';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import { IGSS_COLORS } from '../theme/institutionalColors';
import { tableScrollSx } from '../theme/institutionalStyles';

interface Role {
  id: number;
  name: string;
}

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
  roles?: Role[];
}

function rolesDisplay(roles: Role[] | undefined): string {
  if (!roles?.length) return 'Sin asignar';
  return roles.map((r) => r.name).join(', ');
}

interface UserListProps {
  users: User[];
  handleEdit: (id: number) => void;
  handleDelete: (id: number) => void;
  handleResetPassword: (id: number) => void;
  onCreateNew?: () => void;
}

type Order = 'asc' | 'desc';
type UserKey = keyof User;

const FIELD_LABELS: Record<string, string> = {
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  dpi: 'DPI',
  nit: 'NIT',
  telefono: 'Teléfono',
  correoInstitucional: 'Correo institucional',
  codigoEmpleado: 'Código empleado',
  renglon: 'Renglón',
  puesto: 'Puesto',
  unidadMedica: 'Unidad médica',
  roles: 'Roles',
  id: 'ID',
};

const UserList: React.FC<UserListProps> = ({
  users, handleEdit, handleDelete, handleResetPassword, onCreateNew,
}) => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('nombres');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<UserKey>('nombres');

  const handleOpenDialog = (user: User) => {
    setSelectedUser(user);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(null);
  };

  const handleRequestSort = (property: UserKey) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedAndFilteredUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      if (!searchTerm) return true;
      const value = searchField === 'roles'
        ? rolesDisplay(user.roles).toLowerCase()
        : String(user[searchField as keyof User] ?? '').toLowerCase();
      return value.includes(searchTerm.toLowerCase());
    });

    return filtered.sort((a, b) => {
      const isAsc = order === 'asc';
      const aVal = orderBy === 'roles' ? rolesDisplay(a.roles) : (a[orderBy] as any);
      const bVal = orderBy === 'roles' ? rolesDisplay(b.roles) : (b[orderBy] as any);
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      if (aStr < bStr) return isAsc ? -1 : 1;
      if (aStr > bStr) return isAsc ? 1 : -1;
      return 0;
    });
  }, [users, searchTerm, searchField, order, orderBy]);

  const paginatedUsers = sortedAndFilteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const headCells: { id: UserKey; label: string }[] = [
    { id: 'nombres', label: 'Nombre' },
    { id: 'codigoEmpleado', label: 'Código' },
    { id: 'correoInstitucional', label: 'Correo' },
    { id: 'roles', label: 'Roles' },
  ];

  const ActionButtons = ({ user, compact = false }: { user: User; compact?: boolean }) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, justifyContent: compact ? 'flex-start' : 'flex-end' }}>
      <Tooltip title="Ver detalles">
        <IconButton size="small" color="info" onClick={() => handleOpenDialog(user)} aria-label="Ver detalles">
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Editar">
        <IconButton size="small" color="primary" onClick={() => handleEdit(user.id)} aria-label="Editar">
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Restablecer contraseña">
        <IconButton size="small" color="warning" onClick={() => setUserToReset(user)} aria-label="Restablecer contraseña">
          <LockResetIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Eliminar">
        <IconButton size="small" color="error" onClick={() => setUserToDelete(user)} aria-label="Eliminar">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  const RolesChips = ({ roles }: { roles?: Role[] }) => {
    if (!roles?.length) {
      return <Chip size="small" label="Sin roles" variant="outlined" />;
    }
    const shown = roles.slice(0, 2);
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {shown.map((r) => (
          <Chip key={r.id} size="small" label={r.name} variant="outlined" />
        ))}
        {roles.length > 2 && (
          <Chip size="small" label={`+${roles.length - 2}`} color="primary" variant="outlined" />
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ minWidth: 0, width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
          mb: 2,
          alignItems: { sm: 'center' },
        }}
      >
        <TextField
          size="small"
          label="Buscar"
          placeholder="Escriba para filtrar…"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          sx={{ flex: 1, minWidth: 0, width: '100%' }}
        />
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 }, width: { xs: '100%', sm: 'auto' } }}>
          <InputLabel>Buscar en</InputLabel>
          <Select
            value={searchField}
            label="Buscar en"
            onChange={(e) => { setSearchField(e.target.value as string); setPage(0); }}
          >
            <MenuItem value="nombres">Nombres</MenuItem>
            <MenuItem value="apellidos">Apellidos</MenuItem>
            <MenuItem value="codigoEmpleado">Código empleado</MenuItem>
            <MenuItem value="dpi">DPI</MenuItem>
            <MenuItem value="correoInstitucional">Correo</MenuItem>
            <MenuItem value="roles">Roles</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {users.length === 0 ? (
        <Alert
          severity="info"
          sx={{ borderRadius: 2 }}
          action={
            onCreateNew ? (
              <Button color="inherit" size="small" startIcon={<PersonAddAltIcon />} onClick={onCreateNew}>
                Crear primero
              </Button>
            ) : undefined
          }
        >
          Aún no hay usuarios registrados.
        </Alert>
      ) : sortedAndFilteredUsers.length === 0 ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Ningún usuario coincide con la búsqueda.
        </Alert>
      ) : isNarrow ? (
        <Grid container spacing={1.5}>
          {paginatedUsers.map((user) => (
            <Grid item xs={12} key={user.id}>
              <Paper
                variant="outlined"
                sx={{ p: 1.75, borderRadius: 2, minWidth: 0 }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={800} sx={{ color: IGSS_COLORS.azulOscuro, wordBreak: 'break-word' }}>
                      {user.nombres} {user.apellidos}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Código {user.codigoEmpleado}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, wordBreak: 'break-all' }}>
                      {user.correoInstitucional}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <RolesChips roles={user.roles} />
                    </Box>
                  </Box>
                  <ActionButtons user={user} compact />
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer sx={tableScrollSx}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: IGSS_COLORS.azulOscuro, '& th': { color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' } }}>
                {headCells.map((headCell) => (
                  <TableCell key={headCell.id} sortDirection={orderBy === headCell.id ? order : false}>
                    <TableSortLabel
                      active={orderBy === headCell.id}
                      direction={orderBy === headCell.id ? order : 'asc'}
                      onClick={() => handleRequestSort(headCell.id)}
                      sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#fff !important' } }}
                    >
                      {headCell.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedUsers.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell sx={{ minWidth: 160 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {user.nombres} {user.apellidos}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">DPI {user.dpi}</Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.codigoEmpleado}</TableCell>
                  <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={user.correoInstitucional}>
                    {user.correoInstitucional}
                  </TableCell>
                  <TableCell><RolesChips roles={user.roles} /></TableCell>
                  <TableCell align="right"><ActionButtons user={user} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {sortedAndFilteredUsers.length > 0 && (
        <TablePagination
          rowsPerPageOptions={[5, 8, 15, 25]}
          component="div"
          count={sortedAndFilteredUsers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="Filas:"
          sx={{
            '.MuiTablePagination-toolbar': { flexWrap: 'wrap', gap: 1, px: 0 },
            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { mb: 0 },
          }}
        />
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth fullScreen={isNarrow}>
        <DialogTitle sx={{ fontWeight: 800, color: IGSS_COLORS.azulOscuro, bgcolor: 'rgba(0,91,145,0.04)' }}>
          {selectedUser?.nombres} {selectedUser?.apellidos}
        </DialogTitle>
        <DialogContent dividers>
          {selectedUser && (
            <Grid container spacing={1.75} sx={{ pt: 0.5 }}>
              {Object.entries(selectedUser).map(([key, value]) => {
                if (key === 'id') return null;
                if (key === 'roles') {
                  return (
                    <Grid item xs={12} sm={6} key={key}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>Roles</Typography>
                      <Box sx={{ mt: 0.5 }}><RolesChips roles={value as Role[]} /></Box>
                    </Grid>
                  );
                }
                let displayValue = String(value ?? '—');
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  if ('nombre' in value) displayValue = (value as Puesto).nombre;
                  else if ('name' in value) displayValue = (value as Role).name;
                }
                return (
                  <Grid item xs={12} sm={6} key={key}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {FIELD_LABELS[key] || key}
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{displayValue}</Typography>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cerrar</Button>
          <Button
            onClick={() => {
              if (selectedUser) {
                handleCloseDialog();
                handleEdit(selectedUser.id);
              }
            }}
            color="primary"
            variant="contained"
            startIcon={<EditIcon />}
          >
            Editar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!userToDelete} onClose={() => setUserToDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle>Eliminar usuario</DialogTitle>
        <DialogContent>
          ¿Eliminar a <strong>{userToDelete?.nombres} {userToDelete?.apellidos}</strong>? Esta acción no se puede deshacer.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserToDelete(null)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (userToDelete) {
                handleDelete(userToDelete.id);
                setUserToDelete(null);
              }
            }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!userToReset} onClose={() => setUserToReset(null)} fullWidth maxWidth="xs">
        <DialogTitle>Restablecer contraseña</DialogTitle>
        <DialogContent>
          ¿Restablecer la contraseña de <strong>{userToReset?.nombres} {userToReset?.apellidos}</strong>?
          Quedará temporalmente en <strong>123</strong> y deberá cambiarla al iniciar sesión.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserToReset(null)}>Cancelar</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => {
              if (userToReset) {
                handleResetPassword(userToReset.id);
                setUserToReset(null);
              }
            }}
          >
            Restablecer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserList;
