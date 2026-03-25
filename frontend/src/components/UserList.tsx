// frontend/src/components/UserList.tsx
import { motion } from 'framer-motion';
import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  TablePagination,
  Tooltip,
  TableSortLabel,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import LockResetIcon from '@mui/icons-material/LockReset';

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
}

type Order = 'asc' | 'desc';
type UserKey = keyof User;

const MotionTableRow = motion(TableRow);

const UserList: React.FC<UserListProps> = ({ users, handleEdit, handleDelete, handleResetPassword }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('nombres');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
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
      const value = searchField === 'roles' ? rolesDisplay(user.roles).toLowerCase() : String(user[searchField as keyof User] ?? '').toLowerCase();
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

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedUsers = sortedAndFilteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const headCells: { id: UserKey; label: string; numeric: boolean }[] = [
    { id: 'nombres', numeric: false, label: 'Nombres' },
    { id: 'apellidos', numeric: false, label: 'Apellidos' },
    { id: 'dpi', numeric: false, label: 'DPI' },
    { id: 'codigoEmpleado', numeric: false, label: 'Código Empleado' },
    { id: 'correoInstitucional', numeric: false, label: 'Correo Institucional' },
    { id: 'roles', numeric: false, label: 'Roles' },
  ];

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }} elevation={3}>
      <Typography variant="h6" gutterBottom>
        Lista de Usuarios
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
        <TextField
          label="Buscar"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          fullWidth
        />
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Campo</InputLabel>
          <Select
            value={searchField}
            label="Campo"
            onChange={(e) => setSearchField(e.target.value as string)}
          >
            <MenuItem value="nombres">Nombres</MenuItem>
            <MenuItem value="apellidos">Apellidos</MenuItem>
            <MenuItem value="codigoEmpleado">Código Empleado</MenuItem>
            <MenuItem value="dpi">DPI</MenuItem>
            <MenuItem value="roles">Roles</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {headCells.map((headCell) => (
                <TableCell
                  key={headCell.id}
                  sortDirection={orderBy === headCell.id ? order : false}
                >
                  <TableSortLabel
                    active={orderBy === headCell.id}
                    direction={orderBy === headCell.id ? order : 'asc'}
                    onClick={() => handleRequestSort(headCell.id)}
                  >
                    {headCell.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedUsers.map((user) => (
              <MotionTableRow
                key={user.id}
                whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.04)" }}
                transition={{ duration: 0.2 }}
              >
                <TableCell>{user.nombres}</TableCell>
                <TableCell>{user.apellidos}</TableCell>
                <TableCell>{user.dpi}</TableCell>
                <TableCell>{user.codigoEmpleado}</TableCell>
                <TableCell>{user.correoInstitucional}</TableCell>
                <TableCell>{rolesDisplay(user.roles)}</TableCell>
                <TableCell>
                  <Tooltip title="Ver Detalles">
                    <IconButton color="info" onClick={() => handleOpenDialog(user)}>
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Editar">
                    <IconButton color="primary" onClick={() => handleEdit(user.id)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton color="secondary" onClick={() => handleDelete(user.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Restablecer Contraseña">
                    <IconButton color="warning" onClick={() => handleResetPassword(user.id)}>
                      <LockResetIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </MotionTableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={sortedAndFilteredUsers.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Filas por página:"
      />

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ backgroundColor: 'primary.main', color: 'white' }}>
          Detalles del Usuario: {selectedUser?.nombres} {selectedUser?.apellidos}
        </DialogTitle>
        <DialogContent dividers>
          {selectedUser && (
            <Grid container spacing={2} sx={{ p: 2 }}>
              {Object.entries(selectedUser).map(([key, value]) => {
                if (key === 'roles') {
                  return (
                    <Grid item xs={12} sm={6} key={key}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Roles:</Typography>
                      <Typography variant="body2">{rolesDisplay(value as Role[])}</Typography>
                    </Grid>
                  );
                }
                let displayValue = String(value);
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  if ('name' in value) {
                    displayValue = (value as Role).name;
                  } else if ('nombre' in value) {
                    displayValue = (value as Puesto).nombre;
                  }
                }
                return (
                  <Grid item xs={12} sm={6} key={key}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{key.charAt(0).toUpperCase() + key.slice(1)}:</Typography>
                    <Typography variant="body2">{displayValue}</Typography>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="secondary">
            Cerrar
          </Button>
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
    </Paper>
  );
};

export default UserList;
