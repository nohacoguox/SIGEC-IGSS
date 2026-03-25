// frontend/src/components/SiafBook.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  FormControlLabel,
  Checkbox,
  Container,
  Divider,
  Tooltip,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSiaf } from '../context/SiafContext';
import { useThemeMode } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import api from '../api';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ApartmentIcon from '@mui/icons-material/Apartment';
import GroupIcon from '@mui/icons-material/Group';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { SiafPdfDocument } from './SiafPdfDocument';

type ItemTipo = 'bien' | 'servicio';

interface Item {
  codigo: string;
  descripcion: string;
  cantidad: number;
  tipo: ItemTipo;
}

interface Subproducto {
  codigo: string;
  cantidad: number;
}

interface Area {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

const SiafBook: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { addSiaf, updateSiaf, siafList, loadSiafs } = useSiaf();
  const { mode } = useThemeMode();
  const { showSuccess, showError, showWarning } = useNotification();
  const [fecha, setFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [correlativo, setCorrelativo] = useState<string>('');
  const [nombreUnidad, setNombreUnidad] = useState<string>('');
  const [direccion, setDireccion] = useState<string>('');
  const [justificacion, setJustificacion] = useState<string>('');
  const [areaUnidad, setAreaUnidad] = useState<string>('');
  const [areas, setAreas] = useState<Area[]>([]);
  
  const [items, setItems] = useState<Item[]>([{ codigo: '', descripcion: '', cantidad: 0, tipo: 'bien' }]);
  const [subproductos, setSubproductos] = useState<Subproducto[]>([{ codigo: '', cantidad: 0 }]);
  const [consistentItem, setConsistentItem] = useState<string>(''); // New state for the consistent item
  const [showConsistentField, setShowConsistentField] = useState<boolean>(false); // State to control visibility


  // New state for solicitante details
  const [nombreSolicitante, setNombreSolicitante] = useState<string>('');
  const [puestoSolicitante, setPuestoSolicitante] = useState<string>('');
  const [unidadSolicitante, setUnidadSolicitante] = useState<string>('');

  // New state for autoridad details
  const [nombreAutoridad, setNombreAutoridad] = useState<string>('');
  const [puestoAutoridad, setPuestoAutoridad] = useState<string>('');
  const [unidadAutoridad, setUnidadAutoridad] = useState<string>('');
  const [usuarioAutoridadId, setUsuarioAutoridadId] = useState<number | null>(null);
  const [directorAusente, setDirectorAusente] = useState<boolean>(false);
  const [usuarioEncargadoId, setUsuarioEncargadoId] = useState<number | null>(null);
  const [medicosUnidad, setMedicosUnidad] = useState<Array<{ id: number; nombres: string; apellidos: string; puesto?: { nombre: string }; unidadMedica: string }>>([]);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [adjuntos, setAdjuntos] = useState<Array<{ id: number; nombreOriginal: string; tamanioBytes: number; mimeType?: string }>>([]);
  const inputFileRef = React.useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ id: number; nombreOriginal: string; mimeType?: string; url?: string } | null>(null);
  /** Bitácora de rechazos y correcciones (solo en modo corregir) */
  const [bitacora, setBitacora] = useState<Array<{ id: number; tipo: string; comentario: string | null; fecha: string; usuario?: { nombres?: string; apellidos?: string }; detalleAntes?: string | null; detalleDespues?: string | null }>>([]);
  /** Estado del SIAF al cargar (para saber si viene rechazado y mostrar aviso de detección automática) */
  const [estadoSiafCargado, setEstadoSiafCargado] = useState<string | null>(null);

  // Cargar áreas desde el backend
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await api.get('/areas');
        // Filtrar solo las áreas activas
        const areasActivas = response.data.filter((area: Area) => area.activo);
        setAreas(areasActivas);
      } catch (error) {
        console.error('Error al cargar áreas:', error);
      }
    };

    fetchAreas();
  }, []);

  // Cargar información del usuario logueado y del director (solo prellenar autoridad cuando es formulario nuevo, no en corregir)
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/auth/me');
        const userData = response.data;

        // Prellenar los datos del solicitante con la información del usuario logueado
        setNombreSolicitante(`${userData.nombres} ${userData.apellidos}`);
        setPuestoSolicitante(userData.puesto?.nombre || '');
        setUnidadSolicitante(userData.unidadMedica);

        // Solo prellenar director cuando NO estamos editando/corrigiendo (evita sobrescribir encargado al abrir corregir)
        if (!id && userData.unidadMedica) {
          try {
            const directorResponse = await api.get(`/users/director/${encodeURIComponent(userData.unidadMedica)}`);
            const directorData = directorResponse.data;
            setNombreAutoridad(`${directorData.nombres} ${directorData.apellidos}`);
            setPuestoAutoridad(directorData.puesto?.nombre || '');
            setUnidadAutoridad(directorData.unidadMedica);
            setUsuarioAutoridadId(directorData.id);
          } catch (directorError: any) {
            console.warn('No se encontró director para esta unidad médica:', directorError.response?.data?.message || directorError.message);
          }
        }
      } catch (error) {
        console.error('Error al cargar información del usuario:', error);
      }
    };

    fetchCurrentUser();
  }, [id]);

  // Cuando "director ausente" está marcado, cargar médicos de la misma unidad para elegir encargado
  useEffect(() => {
    if (!directorAusente || !unidadSolicitante) {
      setMedicosUnidad([]);
      return;
    }
    const fetchMedicos = async () => {
      try {
        const res = await api.get(`/users/medicos-por-unidad/${encodeURIComponent(unidadSolicitante)}`);
        setMedicosUnidad(res.data || []);
      } catch (e) {
        console.error('Error al cargar médicos de la unidad:', e);
        setMedicosUnidad([]);
      }
    };
    fetchMedicos();
  }, [directorAusente, unidadSolicitante]);

  // Al desmarcar "ausente", restaurar datos del director
  const handleDirectorAusenteChange = (checked: boolean) => {
    setDirectorAusente(checked);
    if (!checked) {
      setUsuarioEncargadoId(null);
      if (unidadSolicitante) {
        api.get(`/users/director/${encodeURIComponent(unidadSolicitante)}`)
          .then((r) => {
            const d = r.data;
            setNombreAutoridad(`${d.nombres} ${d.apellidos}`);
            setPuestoAutoridad(d.puesto?.nombre || '');
            setUnidadAutoridad(d.unidadMedica);
            setUsuarioAutoridadId(d.id);
          })
          .catch(() => {});
      }
    }
  };

  // Cargar datos del SIAF si estamos en modo edición
  useEffect(() => {
    const loadSiafData = async () => {
      if (id) {
        try {
          const response = await api.get(`/siaf/${id}`);
          const siaf = response.data;

          setFecha(new Date(siaf.fecha).toISOString().split('T')[0]);
          setCorrelativo(siaf.correlativo);
          setNombreUnidad(siaf.nombreUnidad);
          setDireccion(siaf.direccion);
          setJustificacion(siaf.justificacion);
          setAreaUnidad(siaf.area?.nombre || '');
          setConsistentItem(siaf.consistenteItem || '');
          setShowConsistentField(!!siaf.consistenteItem);
          setNombreSolicitante(siaf.nombreSolicitante);
          setPuestoSolicitante(siaf.puestoSolicitante);
          setUnidadSolicitante(siaf.unidadSolicitante);
          const tieneEncargado = !!(siaf.usuarioEncargado || siaf.usuarioEncargadoId);
          setDirectorAusente(tieneEncargado);
          setUsuarioEncargadoId(siaf.usuarioEncargado?.id ?? siaf.usuarioEncargadoId ?? null);
          // Si tiene encargado, mostrar siempre los datos del encargado (no del director) para que el PDF sea correcto
          if (tieneEncargado && siaf.usuarioEncargado) {
            const enc = siaf.usuarioEncargado;
            setNombreAutoridad(`${enc.nombres || ''} ${enc.apellidos || ''}`.trim());
            setPuestoAutoridad('Encargado/a del Despacho de Dirección');
            setUnidadAutoridad(enc.unidadMedica || siaf.unidadAutoridad || '');
          } else {
            setNombreAutoridad(siaf.nombreAutoridad || '');
            setPuestoAutoridad(siaf.puestoAutoridad || '');
            setUnidadAutoridad(siaf.unidadAutoridad || '');
          }

          if (siaf.documentosAdjuntos && siaf.documentosAdjuntos.length > 0) {
            setAdjuntos(siaf.documentosAdjuntos.map((a: any) => ({
              id: a.id,
              nombreOriginal: a.nombreOriginal,
              tamanioBytes: a.tamanioBytes || 0,
              mimeType: a.mimeType,
            })));
          }

          if (siaf.items && siaf.items.length > 0) {
            setItems(siaf.items.map((item: any) => ({
              codigo: item.codigo ?? '',
              descripcion: item.descripcion ?? '',
              cantidad: item.cantidad ?? 0,
              tipo: (item.codigo === 'S/C' ? 'servicio' : 'bien') as ItemTipo
            })));
          }

          if (siaf.subproductos && siaf.subproductos.length > 0) {
            setSubproductos(siaf.subproductos.map((sub: any) => ({
              codigo: sub.codigo,
              cantidad: sub.cantidad
            })));
          }

          setEstadoSiafCargado(siaf.estado || null);
          setBitacora((siaf.bitacora || []).map((b: any) => ({
            id: b.id,
            tipo: b.tipo,
            comentario: b.comentario ?? null,
            fecha: b.fecha,
            usuario: b.usuario,
            detalleAntes: b.detalleAntes ?? null,
            detalleDespues: b.detalleDespues ?? null,
          })));
        } catch (error: any) {
          console.error('Error al cargar SIAF:', error);
          showError('Error al cargar la solicitud SIAF: ' + (error.response?.data?.message || error.message));
          navigate('/siaf-book');
        }
      }
    };

    loadSiafData();
  }, [id, navigate, showError]);

  useEffect(() => {
    if (!id) {
      setBitacora([]);
      setEstadoSiafCargado(null);
    }
  }, [id]);

  const handleItemChange = (index: number, field: keyof Item, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const handleCodigoBlur = async (index: number) => {
    if (items[index]?.tipo !== 'bien') return;
    const codigo = (items[index]?.codigo ?? '').trim();
    if (!codigo) return;
    try {
      const res = await api.get(`/catalogo-productos/codigo/${encodeURIComponent(codigo)}`);
      if (res.data?.descripcion != null) {
        const newItems = [...items];
        if (newItems[index]) newItems[index] = { ...newItems[index], descripcion: res.data.descripcion };
        setItems(newItems);
      }
    } catch {
      // Código no encontrado en catálogo: no cambiar descripción
    }
  };

  const handleItemTipoChange = (index: number, tipo: ItemTipo) => {
    const newItems = [...items];
    if (!newItems[index]) return;
    newItems[index] = { ...newItems[index], tipo };
    if (tipo === 'servicio') {
      newItems[index].codigo = 'S/C';
    } else {
      newItems[index].codigo = '';
      newItems[index].descripcion = '';
    }
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { codigo: '', descripcion: '', cantidad: 0, tipo: 'bien' }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };
  
  const handleSubproductoChange = (index: number, field: keyof Subproducto, value: string | number) => {
    const newSubproductos = [...subproductos];
    (newSubproductos[index] as any)[field] = value;
    setSubproductos(newSubproductos);
  };

  const handleAddSubproducto = () => {
    setSubproductos([...subproductos, { codigo: '', cantidad: 0 }]);
  };

  const handleRemoveSubproducto = (index: number) => {
    const newSubproductos = subproductos.filter((_, i) => i !== index);
    setSubproductos(newSubproductos);
  };

  const totalItemCantidad = items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
  const totalSubproductoCantidad = totalItemCantidad;

  const formData = {
      fecha, correlativo, nombreUnidad, direccion, justificacion, items, subproductos, totalSubproductoCantidad,
      nombreSolicitante, puestoSolicitante, unidadSolicitante,
      nombreAutoridad, puestoAutoridad, unidadAutoridad,
      areaUnidad, consistentItem,
  }

  /** Validación al crear/editar: todos los campos obligatorios excepto adjuntos. */
  const getValidationError = (): string | null => {
    if (!fecha?.trim()) return 'La fecha es obligatoria.';
    if (!correlativo?.trim()) return 'El correlativo es obligatorio.';
    if (!nombreUnidad?.trim()) return 'Debe seleccionar el nombre de la unidad ejecutora.';
    if (!areaUnidad?.trim()) return 'Debe seleccionar el área.';
    if (!direccion?.trim()) return 'La dirección es obligatoria.';
    if (!justificacion?.trim()) return 'La justificación de la solicitud es obligatoria.';

    const validItems = items.filter(
      (i) => (i.codigo?.trim() ?? '') !== '' && (i.descripcion?.trim() ?? '') !== '' && Number(i.cantidad) > 0
    );
    if (validItems.length === 0)
      return 'Debe agregar al menos un bien o servicio con código, descripción y cantidad mayor a 0.';

    const validSubs = subproductos.filter((s) => (s.codigo?.trim() ?? '') !== '');
    if (validSubs.length === 0) return 'Debe agregar al menos un subproducto con código.';

    if (!nombreSolicitante?.trim()) return 'El nombre del solicitante es obligatorio.';
    if (!puestoSolicitante?.trim()) return 'El puesto del solicitante es obligatorio.';
    if (!unidadSolicitante?.trim()) return 'La unidad del solicitante es obligatoria.';

    if (!nombreAutoridad?.trim()) return 'El nombre de la autoridad superior es obligatorio.';
    if (!puestoAutoridad?.trim()) return 'El puesto de la autoridad superior es obligatorio.';
    if (!unidadAutoridad?.trim()) return 'La unidad de la autoridad superior es obligatoria.';
    if (directorAusente && !usuarioEncargadoId) return 'Debe seleccionar al Encargado/a del Despacho de Dirección.';

    if (showConsistentField && !consistentItem?.trim())
      return 'Si agregó "Consistente", debe completar el campo.';

    return null;
  };

  const handleSave = async () => {
    const validationError = getValidationError();
    if (validationError) {
      showError(validationError);
      setOptionsOpen(false);
      return;
    }

    try {
      setOptionsOpen(false);

      // Encontrar el ID del área seleccionada
      const selectedArea = areas.find(area => area.nombre === areaUnidad);

      // Preparar datos para enviar al backend
      const siafData: Record<string, unknown> = {
        fecha,
        correlativo,
        nombreUnidad,
        direccion,
        areaId: selectedArea?.id || null,
        justificacion,
        nombreSolicitante,
        puestoSolicitante,
        unidadSolicitante,
        nombreAutoridad,
        puestoAutoridad,
        unidadAutoridad,
        usuarioAutoridadId: directorAusente ? null : usuarioAutoridadId,
        usuarioEncargadoId: directorAusente ? usuarioEncargadoId : null,
        consistentItem,
        items: items.filter(item => item.codigo && item.descripcion).map(({ codigo, descripcion, cantidad }) => ({ codigo, descripcion, cantidad })),
        subproductos: subproductos.filter(sub => sub.codigo),
      };

      // Determinar si es creación o actualización
      let response;
      let siafIdForAdjuntos: number;
      if (id) {
        response = await api.put(`/siaf/${id}`, siafData);
        siafIdForAdjuntos = parseInt(id, 10);
        if (response?.data?.bitacora && Array.isArray(response.data.bitacora)) {
          setBitacora(response.data.bitacora.map((b: any) => ({
            id: b.id,
            tipo: b.tipo,
            comentario: b.comentario ?? null,
            fecha: b.fecha,
            usuario: b.usuario,
            detalleAntes: b.detalleAntes ?? null,
            detalleDespues: b.detalleDespues ?? null,
          })));
        }
        showSuccess('Solicitud SIAF actualizada exitosamente');
        await loadSiafs();
        navigate('/siaf-book', {
          state: response?.data?.bitacora
            ? { bitacoraSiafId: parseInt(id!, 10), bitacora: response.data.bitacora }
            : undefined,
        });
      } else {
        response = await api.post('/siaf', siafData);
        siafIdForAdjuntos = response.data.siafId;

        if (response.data.pdfGenerated) {
          await loadSiafs();
          setPreviewOpen(true);
        } else {
          showWarning('Solicitud SIAF creada, pero hubo un problema al generar el PDF');
          await loadSiafs();
          navigate('/siaf-book');
        }
      }

      // Subir documentos adjuntos pendientes
      if (pendingFiles.length > 0 && siafIdForAdjuntos) {
        const token = localStorage.getItem('token');
        for (const file of pendingFiles) {
          const formData = new FormData();
          formData.append('archivo', file);
          await api.post(`/siaf/${siafIdForAdjuntos}/adjuntos`, formData, {
            headers: { 'Content-Type': 'multipart/form-data', Authorization: token ? `Bearer ${token}` : '' },
          });
        }
        setPendingFiles([]);
        if (id) {
          const updated = await api.get(`/siaf/${id}`);
          setAdjuntos((updated.data.documentosAdjuntos || []).map((a: any) => ({ id: a.id, nombreOriginal: a.nombreOriginal, tamanioBytes: a.tamanioBytes || 0, mimeType: a.mimeType })));
        }
      }

      // NO navegar aquí para permitir que la vista previa se muestre
      // await loadSiafs();
      // navigate('/siaf-book');

    } catch (error: any) {
      console.error('Error al guardar SIAF:', error);
      console.error('Error completo:', error.response);

      let errorMessage = 'Error desconocido';

      if (error.response) {
        // El servidor respondió con un código de error
        errorMessage = error.response.data?.message || `Error ${error.response.status}: ${error.response.statusText}`;

        if (error.response.status === 401) {
          errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          // Redirigir al login después de 2 segundos
          setTimeout(() => {
            localStorage.removeItem('token');
            navigate('/login');
          }, 2000);
        } else if (error.response.status === 404) {
          errorMessage = 'El endpoint del servidor no se encontró. Verifica que el backend esté corriendo correctamente.';
        } else if (error.response.status === 409 || errorMessage.includes('duplicada') || errorMessage.includes('Ya existe')) {
          errorMessage = `El correlativo "${correlativo}" ya existe en el sistema. Por favor, usa un correlativo diferente.`;
        }
      } else if (error.request) {
        // La petición se hizo pero no hubo respuesta
        errorMessage = 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo en http://localhost:3001';
      } else {
        // Algo pasó al configurar la petición
        errorMessage = error.message;
      }

      showError(`Error al crear solicitud SIAF: ${errorMessage}`);
      setOptionsOpen(true); // Reabrir el diálogo para que el usuario pueda intentar de nuevo
    }
  };

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          background: mode !== 'dark'
            ? 'linear-gradient(135deg, #F5F7FA 0%, #E8EDF2 100%)'
            : 'linear-gradient(135deg, #1A1A1A 0%, #0D0D0D 100%)',
          py: 4,
        }}
      >
        <Container maxWidth="lg">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Header */}
            <Paper
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 3,
                background: mode !== 'dark'
                  ? 'linear-gradient(135deg, #0066A1 0%, #004D7A 100%)'
                  : 'linear-gradient(135deg, #2E7FB0 0%, #1E5A7A 100%)',
                color: 'white',
                boxShadow: '0 8px 32px rgba(0, 102, 161, 0.3)',
              }}
              elevation={0}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: 2,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                    }}
                  >
                    <AssignmentIcon sx={{ fontSize: 36 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="h1" fontWeight="bold">
                      SIAF-A-01
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Solicitud de Compra de Bienes y/o Servicios
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => navigate('/colaborador-dashboard')}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.3)',
                    },
                  }}
                >
                  Volver
                </Button>
              </Box>
            </Paper>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Paper sx={{ p: 4, borderRadius: 3 }} elevation={3}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Todos los campos son obligatorios, excepto &quot;Adjuntar Documentos&quot;.
              </Typography>

              {/* Bitácora de rechazos y correcciones (solo en modo corregir) */}
              {id && bitacora.length > 0 && (
                <Card sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider' }} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" fontWeight="bold">
                        Bitácora de rechazos y correcciones
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Historial de motivos de rechazo y correcciones realizadas. Revise los comentarios para ajustar la solicitud.
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>Fecha</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Usuario</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Comentario / Motivo</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {bitacora.map((b) => (
                            <TableRow key={b.id}>
                              <TableCell>{new Date(b.fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                              <TableCell>
                                <Box
                                  component="span"
                                  sx={{
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: 1,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    bgcolor: b.tipo === 'rechazo' ? 'error.light' : b.tipo === 'correccion' ? 'info.light' : b.tipo === 'aprobado_dd' ? 'success.light' : 'success.light',
                                    color: b.tipo === 'rechazo' ? 'error.dark' : b.tipo === 'correccion' ? 'info.dark' : b.tipo === 'aprobado_dd' ? 'success.dark' : 'success.dark',
                                  }}
                                >
                                  {b.tipo === 'rechazo' ? 'Rechazo' : b.tipo === 'correccion' ? 'Corrección' : b.tipo === 'aprobado_dd' ? 'Aprobado (DD)' : 'Autorizado'}
                                </Box>
                              </TableCell>
                              <TableCell>
                                {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                              </TableCell>
                              <TableCell>
                                {b.tipo === 'correccion' && (b.detalleAntes || b.detalleDespues) ? (
                                  <Box component="span" sx={{ display: 'block' }}>
                                    {b.detalleAntes && <><strong>Antes:</strong> {b.detalleAntes}</>}
                                    {b.detalleAntes && b.detalleDespues && <br />}
                                    {b.detalleDespues && <><strong>Corregido a:</strong> {b.detalleDespues}</>}
                                  </Box>
                                ) : (b.comentario || '—')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}

              {/* Aviso: detección automática de correcciones cuando el SIAF estaba rechazado */}
              {id && estadoSiafCargado === 'rechazado' && (
                <Card sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'success.light', backgroundColor: 'success.light', color: 'success.dark' }} variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" fontWeight="medium">
                      El sistema registrará automáticamente qué cambió (justificación, ítems, cantidades, subproductos, consistente, etc.) al guardar. No es necesario escribir manualmente el detalle.
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Información General */}
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <CalendarTodayIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    Información General
                  </Typography>
                </Box>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Fecha"
                      type="date"
                      fullWidth
                      required
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Correlativo No."
                      fullWidth
                      required
                      value={correlativo}
                      onChange={(e) => setCorrelativo(e.target.value)}
                      disabled={!!id}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Datos de la Unidad Ejecutora */}
              <Box sx={{ mb: 4 }}>
                <Card
                  elevation={3}
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: 'none',
                  }}
                >
                  <Box
                    sx={{
                      background: mode !== 'dark'
                        ? 'linear-gradient(135deg, #0066A1 0%, #004D7A 100%)'
                        : 'linear-gradient(135deg, #2E7FB0 0%, #1E5A7A 100%)',
                      p: 2.5,
                      color: 'white',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          background: 'rgba(255, 255, 255, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2,
                        }}
                      >
                        <ApartmentIcon sx={{ fontSize: 28 }} />
                      </Box>
                      <Typography variant="h6" fontWeight="bold">
                        Datos de la Unidad Ejecutora
                      </Typography>
                    </Box>
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                      <Grid container spacing={2}>
                          <Grid item xs={12}>
                              <FormControl fullWidth required>
                                <InputLabel id="nombre-unidad-label">Nombre</InputLabel>
                                <Select
                                    labelId="nombre-unidad-label"
                                    value={nombreUnidad}
                                    label="Nombre *"
                                    onChange={(e) => {
                                      const selectedValue = e.target.value as string;
                                      setNombreUnidad(selectedValue);
                                      if (selectedValue === "210, Consultorio Palín, Escuintla") {
                                        setDireccion("Km. 36 CA-SUR, Boulevard Interior, Zona Industrial A Fracción A-82, Palín, Escuintla, Bodega 9 y 10");
                                      } else {
                                        setDireccion(""); // Clear address if another option is selected
                                      }
                                    }}
                                >
                                    <MenuItem value=""><em>Ninguno</em></MenuItem>
                                    <MenuItem value="210, Consultorio Palín, Escuintla">210, Consultorio Palín, Escuintla</MenuItem>
                                </Select>
                              </FormControl>
                          </Grid>
                          <Grid item xs={12}>
                            <FormControl fullWidth required>
                                <InputLabel id="area-unidad-label">Área</InputLabel>
                                <Select
                                    labelId="area-unidad-label"
                                    value={areaUnidad}
                                    label="Área *"
                                    onChange={(e) => setAreaUnidad(e.target.value as string)}
                                >
                                    <MenuItem value=""><em>Ninguno</em></MenuItem>
                                    {areas.map((area) => (
                                      <MenuItem key={area.id} value={area.nombre}>
                                        {area.nombre}
                                      </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12}>
                              <TextField label="Dirección *" fullWidth multiline rows={2} required value={direccion} onChange={(e) => setDireccion(e.target.value)} InputProps={{ readOnly: true }} disabled />
                          </Grid>
                      </Grid>
                  </CardContent>
                </Card>
              </Box>

              {/* Detalle de Bienes o Servicios */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>Detalle de Bienes o Servicios *</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Al menos un ítem con código, descripción y cantidad mayor a 0.</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: '18%', borderRight: '1px solid rgba(224, 224, 224, 1)' }}>Tipo</TableCell>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: '18%', borderRight: '1px solid rgba(224, 224, 224, 1)' }}>Código</TableCell>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: '36%', borderRight: '1px solid rgba(224, 224, 224, 1)' }}>Descripción</TableCell>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: '12%', textAlign: 'right', borderRight: '1px solid rgba(224, 224, 224, 1)' }}>Cantidad</TableCell>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: '10%', textAlign: 'right' }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)' }}>
                          <Select
                            size="small"
                            value={item.tipo}
                            onChange={(e) => handleItemTipoChange(index, e.target.value as ItemTipo)}
                            variant="standard"
                            fullWidth
                            sx={{ minWidth: 140 }}
                          >
                            <MenuItem value="bien">Bien/Producto</MenuItem>
                            <MenuItem value="servicio">Servicio</MenuItem>
                          </Select>
                        </TableCell>
                        <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)' }}>
                          {item.tipo === 'servicio' ? (
                            <TextField variant="standard" size="small" value="S/C" InputProps={{ readOnly: true }} fullWidth />
                          ) : (
                            <TextField variant="standard" size="small" value={item.codigo} onChange={(e) => handleItemChange(index, 'codigo', e.target.value)} onBlur={() => handleCodigoBlur(index)} placeholder="Código (al salir se carga la descripción)" />
                          )}
                        </TableCell>
                        <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)' }}>
                          {item.tipo === 'servicio' ? (
                            <TextField variant="standard" size="small" fullWidth value={item.descripcion} onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)} placeholder="Descripción del servicio" />
                          ) : (
                            <TextField variant="standard" size="small" fullWidth value={item.descripcion} InputProps={{ readOnly: true }} placeholder="Se completa al ingresar un código del catálogo" />
                          )}
                        </TableCell>
                        <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)' }}><TextField variant="standard" size="small" type="number" value={item.cantidad} onChange={(e) => handleItemChange(index, 'cantidad', Number(e.target.value))} /></TableCell>
                        <TableCell>
                          <IconButton color="error" onClick={() => handleRemoveItem(index)} disabled={items.length === 1}>
                            <RemoveCircleOutlineIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={handleAddItem} sx={{ mt: 2, mr: 2 }}>
                Añadir Fila
              </Button>
              <Button variant="outlined" onClick={() => setShowConsistentField(true)} sx={{ mt: 2 }}>
                Agregar Consistente
              </Button>
              {showConsistentField && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1" gutterBottom>Consistente:</Typography>
                  <TextField fullWidth multiline rows={2} value={consistentItem} onChange={(e) => setConsistentItem(e.target.value)} />
                </Box>
              )}
              </Box>

              {/* Detalle por Subproducto */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>Detalle por Subproducto *</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Al menos un subproducto con código.</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                      <TableRow>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold' }}>Código de Subproducto</TableCell>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', textAlign: 'right' }}>Cantidad</TableCell>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', textAlign: 'right' }}>Acciones</TableCell>
                      </TableRow>
                  </TableHead>
                  <TableBody>
                      {subproductos.map((sub, index) => (
                      <TableRow key={index}>
                          <TableCell><TextField variant="standard" size="small" value={sub.codigo} onChange={(e) => handleSubproductoChange(index, 'codigo', e.target.value)} /></TableCell>
                          <TableCell>
  <TextField
    variant="standard"
    size="small"
    type="number"
    value={totalSubproductoCantidad} // Display the calculated total
    disabled // Keep it non-editable
    InputProps={{ readOnly: true }} // Keep it read-only
  />
</TableCell>
                          <TableCell>
                          <IconButton color="error" onClick={() => handleRemoveSubproducto(index)} disabled={subproductos.length === 1}>
                              <RemoveCircleOutlineIcon />
                          </IconButton>
                          </TableCell>
                      </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
                <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={handleAddSubproducto} sx={{ mt: 2 }}>
                  Añadir Fila
                </Button>
              </Box>

              {/* Datos del Solicitante */}
              <Box sx={{ mb: 4 }}>
                <Card
                  elevation={3}
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: 'none',
                  }}
                >
                  <Box
                    sx={{
                      background: mode !== 'dark'
                        ? 'linear-gradient(135deg, #00A859 0%, #008044 100%)'
                        : 'linear-gradient(135deg, #2FA86B 0%, #1E6B47 100%)',
                      p: 2.5,
                      color: 'white',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          background: 'rgba(255, 255, 255, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2,
                        }}
                      >
                        <GroupIcon sx={{ fontSize: 28 }} />
                      </Box>
                      <Typography variant="h6" fontWeight="bold">
                        Datos del Solicitante
                      </Typography>
                    </Box>
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                      <Grid container spacing={2}>
                          <Grid item xs={12}>
                              <TextField 
                                label="Nombre del Solicitante *" 
                                fullWidth 
                                required
                                value={nombreSolicitante} 
                                onChange={(e) => setNombreSolicitante(e.target.value)}
                                InputProps={{ readOnly: true }}
                                disabled
                                helperText="Este campo se llena automáticamente con tu información"
                              />
                          </Grid>
                          <Grid item xs={12}>
                              <TextField 
                                label="Puesto del Solicitante *" 
                                fullWidth 
                                required
                                value={puestoSolicitante} 
                                onChange={(e) => setPuestoSolicitante(e.target.value)}
                                InputProps={{ readOnly: true }}
                                disabled
                                helperText="Este campo se llena automáticamente con tu información"
                              />
                          </Grid>
                          <Grid item xs={12}>
                              <TextField 
                                label="Unidad *" 
                                fullWidth 
                                required
                                value={unidadSolicitante} 
                                onChange={(e) => setUnidadSolicitante(e.target.value)}
                                InputProps={{ readOnly: true }}
                                disabled
                                helperText="Este campo se llena automáticamente con tu información"
                              />
                          </Grid>
                      </Grid>
                  </CardContent>
                </Card>
              </Box>

              {/* Datos de la Autoridad Superior */}
              <Box sx={{ mb: 4 }}>
                <Card
                  elevation={3}
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: 'none',
                  }}
                >
                  <Box
                    sx={{
                      background: mode !== 'dark'
                        ? 'linear-gradient(135deg, #F57C00 0%, #E65100 100%)'
                        : 'linear-gradient(135deg, #FB8C00 0%, #EF6C00 100%)',
                      p: 2.5,
                      color: 'white',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          background: 'rgba(255, 255, 255, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2,
                        }}
                      >
                        <GroupIcon sx={{ fontSize: 28 }} />
                      </Box>
                      <Typography variant="h6" fontWeight="bold">
                        Datos de la Autoridad Superior
                      </Typography>
                    </Box>
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                      <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={directorAusente}
                                  onChange={(e) => handleDirectorAusenteChange(e.target.checked)}
                                  color="primary"
                                  disabled={!!id}
                                />
                              }
                              label="¿Se encuentra ausente el director?"
                            />
                            {id && (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                En corrección no se puede cambiar: se mantiene la misma autoridad (Director o Encargado) que revisó la solicitud.
                              </Typography>
                            )}
                          </Grid>
                          {directorAusente && (
                            <Grid item xs={12}>
                              <FormControl fullWidth required>
                                <InputLabel id="encargado-label">Encargado/a del Despacho de Dirección</InputLabel>
                                <Select
                                  labelId="encargado-label"
                                  value={usuarioEncargadoId ?? ''}
                                  label="Encargado/a del Despacho de Dirección *"
                                  disabled={!!id}
                                  onChange={(e) => {
                                    const idVal = e.target.value as number;
                                    setUsuarioEncargadoId(idVal || null);
                                    const medico = medicosUnidad.find((m) => m.id === idVal);
                                    if (medico) {
                                      setNombreAutoridad(`${medico.nombres} ${medico.apellidos}`);
                                      setPuestoAutoridad('Encargado/a del Despacho de Dirección');
                                      setUnidadAutoridad(medico.unidadMedica);
                                    }
                                  }}
                                >
                                  <MenuItem value=""><em>Seleccione un médico de la unidad</em></MenuItem>
                                  {medicosUnidad.map((m) => (
                                    <MenuItem key={m.id} value={m.id}>
                                      {m.apellidos} {m.nombres} {m.puesto?.nombre ? `(${m.puesto.nombre})` : ''}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              {!id && (
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                  Solo se listan médicos de la misma unidad. Quien autorice esta solicitud será únicamente esta persona designada.
                                </Typography>
                              )}
                            </Grid>
                          )}
                          <Grid item xs={12}>
                              <TextField 
                                label="Nombre de la Autoridad *" 
                                fullWidth 
                                required
                                value={nombreAutoridad} 
                                onChange={(e) => setNombreAutoridad(e.target.value)}
                                InputProps={{ readOnly: true }}
                                disabled
                                helperText={directorAusente ? "Se completa al elegir al Encargado/a del Despacho" : "Este campo se llena automáticamente con el Director de tu unidad médica"}
                              />
                          </Grid>
                          <Grid item xs={12}>
                              <TextField 
                                label="Puesto de la Autoridad *" 
                                fullWidth 
                                required
                                value={puestoAutoridad} 
                                onChange={(e) => setPuestoAutoridad(e.target.value)}
                                InputProps={{ readOnly: true }}
                                disabled
                                helperText={directorAusente ? "Se muestra como Encargado/a del Despacho de Dirección" : "Este campo se llena automáticamente con el Director de tu unidad médica"}
                              />
                          </Grid>
                          <Grid item xs={12}>
                              <TextField 
                                label="Unidad *" 
                                fullWidth 
                                required
                                value={unidadAutoridad} 
                                onChange={(e) => setUnidadAutoridad(e.target.value)}
                                InputProps={{ readOnly: true }}
                                disabled
                                helperText="Este campo se llena automáticamente con el Director de tu unidad médica"
                              />
                          </Grid>
                      </Grid>
                  </CardContent>
                </Card>
              </Box>

              {/* Adjuntar Documentos (opcional) */}
              <Box sx={{ mb: 4 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AttachFileIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6">Adjuntar Documentos</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>(opcional)</Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        startIcon={<AttachFileIcon />}
                        onClick={() => inputFileRef.current?.click()}
                      >
                        Adjuntar Documentos
                      </Button>
                      <input
                        type="file"
                        ref={inputFileRef}
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files?.length) {
                            setPendingFiles(prev => [...prev, ...Array.from(files)]);
                            e.target.value = '';
                          }
                        }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Adjunte especificaciones técnicas, cotizaciones u otros soportes de esta solicitud (PDF, Word, Excel, imágenes).
                    </Typography>
                    {(pendingFiles.length > 0 || adjuntos.length > 0) && (
                      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ backgroundColor: 'action.hover' }}>
                              <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }} align="right">Tamaño</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }} align="right">Acciones</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {pendingFiles.map((file, index) => (
                              <TableRow key={`pending-${index}`}>
                                <TableCell>{file.name}</TableCell>
                                <TableCell align="right">{(file.size / 1024).toFixed(1)} KB</TableCell>
                                <TableCell align="right">
                                  <IconButton size="small" color="error" onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== index))}>
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                            {adjuntos.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell>{a.nombreOriginal}</TableCell>
                                <TableCell align="right">{((a.tamanioBytes || 0) / 1024).toFixed(1)} KB</TableCell>
                                <TableCell align="right">
                                  <Tooltip title="Visualizar">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                        onClick={async () => {
                                        try {
                                          const res = await api.get(`/siaf/adjuntos/${a.id}/descargar`, { responseType: 'blob' });
                                          const mime = a.mimeType || res.data?.type || 'application/pdf';
                                          const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
                                          setViewingDoc({ id: a.id, nombreOriginal: a.nombreOriginal, mimeType: mime, url });
                                          setViewerOpen(true);
                                        } catch (err) {
                                          console.error(err);
                                          showError('Error al cargar el documento');
                                        }
                                      }}
                                    >
                                      <VisibilityIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Descargar">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={async () => {
                                        try {
                                          const res = await api.get(`/siaf/adjuntos/${a.id}/descargar`, { responseType: 'blob' });
                                          const url = window.URL.createObjectURL(new Blob([res.data]));
                                          const link = document.createElement('a');
                                          link.href = url;
                                          link.setAttribute('download', a.nombreOriginal);
                                          document.body.appendChild(link);
                                          link.click();
                                          link.remove();
                                          window.URL.revokeObjectURL(url);
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }}
                                    >
                                      <DownloadIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  {id && (
                                    <Tooltip title="Eliminar">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={async () => {
                                          if (window.confirm(`¿Está seguro de eliminar "${a.nombreOriginal}"?`)) {
                                            try {
                                              await api.delete(`/siaf/adjuntos/${a.id}`);
                                              setAdjuntos(prev => prev.filter(adj => adj.id !== a.id));
                                            } catch (err: any) {
                                              if (err.response?.status === 404) {
                                                setAdjuntos(prev => prev.filter(adj => adj.id !== a.id));
                                                return;
                                              }
                                              console.error(err);
                                              showError('Error al eliminar el documento: ' + (err.response?.data?.message || err.message));
                                            }
                                          }
                                        }}
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </CardContent>
                </Card>
              </Box>

              {/* Justificación */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>Justificación *</Typography>
                <TextField
                  label="Justificación de la Solicitud"
                  fullWidth
                  required
                  multiline
                  rows={4}
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  inputProps={{ maxLength: 500 }}
                  helperText={`${justificacion.length}/500 caracteres`}
                />
              </Box>

              {/* Botón de Guardar */}
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Button 
                  variant="contained" 
                  size="large" 
                  color="primary" 
                  onClick={() => setOptionsOpen(true)} 
                  startIcon={<SaveIcon />}
                  sx={{
                    py: 1.5,
                    px: 4,
                    fontSize: '1.1rem',
                    boxShadow: '0 4px 12px rgba(0, 102, 161, 0.3)',
                  }}
                >
                  {id ? 'Actualizar y Generar SIAF' : 'Guardar y Generar SIAF'}
                </Button>
              </Box>
            </Paper>
          </motion.div>
        </Container>
      </Box>
      
      {/* Options Dialog */}
      <Dialog open={optionsOpen} onClose={() => setOptionsOpen(false)}>
        <DialogTitle>Opciones de Guardado</DialogTitle>
        <DialogContent>
            <Typography>¿Desea previsualizar el documento antes de generarlo?</Typography>
        </DialogContent>
        <DialogActions>

          <Button onClick={handleSave} color="primary" variant="contained">
            Visualizar y Descargar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle>Previsualización de SIAF</DialogTitle>
        <DialogContent sx={{ height: '80vh' }}>
          <PDFViewer width="100%" height="100%">
            <SiafPdfDocument data={formData} />
          </PDFViewer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPreviewOpen(false); navigate('/siaf-book'); }}>Cerrar</Button>
          <PDFDownloadLink
            document={<SiafPdfDocument data={formData} />}
            fileName="SIAF-A-01.pdf"
            style={{ textDecoration: 'none' }}
          >
            {({ loading }) => (
              <Button color="primary" variant="contained" disabled={loading}>
                {loading ? 'Generando PDF...' : 'Descargar PDF'}
              </Button>
            )}
          </PDFDownloadLink>
        </DialogActions>
      </Dialog>

      {/* Viewer Dialog para documentos adjuntos */}
      <Dialog open={viewerOpen} onClose={() => { setViewerOpen(false); if (viewingDoc?.url) window.URL.revokeObjectURL(viewingDoc.url); setViewingDoc(null); }} maxWidth="xl" fullWidth>
        <DialogTitle>{viewingDoc?.nombreOriginal || 'Visualizar Documento'}</DialogTitle>
        <DialogContent sx={{ height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 0 }}>
          {viewingDoc?.url && (
            <>
              {(viewingDoc.mimeType === 'application/pdf' || viewingDoc.nombreOriginal.toLowerCase().endsWith('.pdf')) ? (
                <iframe
                  src={`${viewingDoc.url}#toolbar=1`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={viewingDoc.nombreOriginal}
                />
              ) : viewingDoc.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(viewingDoc.nombreOriginal) ? (
                <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
                  <img
                    src={viewingDoc.url}
                    alt={viewingDoc.nombreOriginal}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </Box>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>No se puede visualizar este tipo de archivo</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Tipo: {viewingDoc.mimeType || 'desconocido'}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={async () => {
                      if (!viewingDoc) return;
                      try {
                        const res = await api.get(`/siaf/adjuntos/${viewingDoc.id}/descargar`, { responseType: 'blob' });
                        const url = window.URL.createObjectURL(new Blob([res.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', viewingDoc.nombreOriginal);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                  >
                    Descargar para abrir
                  </Button>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setViewerOpen(false); if (viewingDoc?.url) window.URL.revokeObjectURL(viewingDoc.url); setViewingDoc(null); }}>Cerrar</Button>
          {viewingDoc && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={async () => {
                if (!viewingDoc) return;
                try {
                  const res = await api.get(`/siaf/adjuntos/${viewingDoc.id}/descargar`, { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', viewingDoc.nombreOriginal);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  console.error(err);
                }
              }}
            >
              Descargar
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SiafBook;
