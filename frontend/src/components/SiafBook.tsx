// frontend/src/components/SiafBook.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSiaf } from '../context/SiafContext';
import { useThemeMode } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { IGSS_COLORS } from '../theme/institutionalColors';
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
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import { PDFDownloadLink, PDFViewer, pdf } from '@react-pdf/renderer';
import { SiafPdfDocument } from './SiafPdfDocument';
import PdfViewerWithClick, { PdfMarker } from './PdfViewerWithClick';
import { limpiarComentarioBitacora, parseMarcadoresBitacora, SiafMarcaBitacora } from '../utils/siafBitacora';
import PlaceIcon from '@mui/icons-material/Place';

type ItemTipo = 'bien' | 'servicio';
type CatalogoOrigen = 'MINFIN' | 'SIBOFA';

type CatalogoSugerencia = {
  codigo: string;
  descripcion: string;
  origen: CatalogoOrigen;
};

interface Item {
  codigo: string;
  descripcion: string;
  cantidad: number;
  tipo: ItemTipo;
  catalogoOrigen: CatalogoOrigen | '';
}

interface Subproducto {
  codigo: string;
  cantidad: number;
  descripcion?: string;
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
  const [reservaId, setReservaId] = useState<number | null>(null);
  const [reservandoCorrelativo, setReservandoCorrelativo] = useState(false);
  const correlativoConsumidoRef = React.useRef(false);
  const reservaIdRef = React.useRef<number | null>(null);
  const [nombreUnidad, setNombreUnidad] = useState<string>('');
  const [direccion, setDireccion] = useState<string>('');
  const [justificacion, setJustificacion] = useState<string>('');
  const [areaUnidad, setAreaUnidad] = useState<string>('');
  const [areas, setAreas] = useState<Area[]>([]);
  /** Unidad médica ligada al usuario logueado (nombre en su perfil) */
  const [unidadUsuarioLigada, setUnidadUsuarioLigada] = useState<string>('');
  const [unidadesMedicas, setUnidadesMedicas] = useState<
    Array<{
      id: number;
      nombre: string;
      codigo?: string | null;
      direccion?: string | null;
      departamento?: string | null;
      municipio?: { nombre?: string; departamento?: { nombre?: string } | null } | null;
    }>
  >([]);
  
  const [items, setItems] = useState<Item[]>([
    { codigo: '', descripcion: '', cantidad: 0, tipo: 'bien', catalogoOrigen: '' },
  ]);
  const [catalogoSeleccionado, setCatalogoSeleccionado] = useState<CatalogoOrigen | ''>('');
  const [codigoOpciones, setCodigoOpciones] = useState<Record<number, CatalogoSugerencia[]>>({});
  const [codigoBuscando, setCodigoBuscando] = useState<Record<number, boolean>>({});
  const codigoSearchTimers = useRef<Record<number, number>>({});
  const [subproductos, setSubproductos] = useState<Subproducto[]>([{ codigo: '', cantidad: 0 }]);
  /** Lista completa del catálogo SUBPRODUCTOS para el combobox del SIAF */
  const [catalogoSubproductosLista, setCatalogoSubproductosLista] = useState<
    Array<{ codigo: string; descripcion: string }>
  >([]);
  const [catalogoSubproductosLoading, setCatalogoSubproductosLoading] = useState(false);
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

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIsDraft, setPreviewIsDraft] = useState(false);
  const [ortografiaOpen, setOrtografiaOpen] = useState(false);
  const [ortografiaLoading, setOrtografiaLoading] = useState(false);
  const [ortografiaTexto, setOrtografiaTexto] = useState('');
  const [ortografiaSugerencias, setOrtografiaSugerencias] = useState<
    Array<{
      original: string;
      replacement: string;
      options: string[];
      message: string;
      offset: number;
      length: number;
    }>
  >([]);
  /** Palabra elegida por sugerencia; cadena vacía = no corregir. */
  const [ortografiaElegidas, setOrtografiaElegidas] = useState<Record<number, string>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [adjuntos, setAdjuntos] = useState<Array<{ id: number; nombreOriginal: string; tamanioBytes: number; mimeType?: string }>>([]);
  const inputFileRef = React.useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ id: number; nombreOriginal: string; mimeType?: string; url?: string } | null>(null);
  /** Bitácora de rechazos y correcciones (solo en modo corregir) */
  const [bitacora, setBitacora] = useState<Array<{ id: number; tipo: string; comentario: string | null; fecha: string; usuario?: { nombres?: string; apellidos?: string }; detalleAntes?: string | null; detalleDespues?: string | null }>>([]);
  const [marcasViewerOpen, setMarcasViewerOpen] = useState(false);
  const [marcasViewerLoading, setMarcasViewerLoading] = useState(false);
  const [marcasViewerUrl, setMarcasViewerUrl] = useState<string | null>(null);
  const [marcasViewerList, setMarcasViewerList] = useState<SiafMarcaBitacora[]>([]);
  const marcasUrlRef = React.useRef<string | null>(null);
  /** Estado del SIAF al cargar (para saber si viene rechazado y mostrar aviso de detección automática) */
  const [estadoSiafCargado, setEstadoSiafCargado] = useState<string | null>(null);

  // Cargar áreas y unidades médicas desde el backend
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await api.get('/areas');
        const areasActivas = response.data.filter((area: Area) => area.activo);
        setAreas(areasActivas);
      } catch (error) {
        console.error('Error al cargar áreas:', error);
      }
    };
    const fetchUnidades = async () => {
      try {
        const response = await api.get('/unidades-medicas');
        setUnidadesMedicas(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error al cargar unidades médicas:', error);
      }
    };

    fetchAreas();
    fetchUnidades();
  }, []);

  const departamentoUnidad = (u: {
    departamento?: string | null;
    municipio?: { departamento?: { nombre?: string } | null } | null;
  }) => (u.departamento || u.municipio?.departamento?.nombre || '').trim();

  /** Formato institucional: 210, Consultorio de Palin, Escuintla */
  const labelUnidadMedica = (u: {
    nombre: string;
    codigo?: string | null;
    departamento?: string | null;
    municipio?: { departamento?: { nombre?: string } | null } | null;
  }) => {
    const parts: string[] = [];
    if (u.codigo?.trim()) parts.push(u.codigo.trim());
    parts.push(u.nombre.trim());
    const depto = departamentoUnidad(u);
    if (depto) parts.push(depto);
    return parts.join(', ');
  };

  const textoUnidadEjecutora = [nombreUnidad, areaUnidad].filter((p) => p?.trim()).join(' / ');

  const findUnidadEnCatalogo = (
    unidadNombre: string,
    list: typeof unidadesMedicas
  ) => {
    const n = (unidadNombre || '').trim().toLowerCase();
    if (!n || !list.length) return null;
    return (
      list.find((u) => u.nombre.trim().toLowerCase() === n) ||
      list.find((u) => labelUnidadMedica(u).toLowerCase() === n) ||
      list.find((u) => labelUnidadMedica(u).toLowerCase().includes(n)) ||
      list.find((u) => n.includes(u.nombre.trim().toLowerCase())) ||
      null
    );
  };

  // Crear SIAF: precargar unidad + dirección según la unidad ligada al usuario
  useEffect(() => {
    if (id) return; // en corrección se respeta lo guardado en el SIAF
    if (!unidadUsuarioLigada || unidadesMedicas.length === 0) return;
    const match = findUnidadEnCatalogo(unidadUsuarioLigada, unidadesMedicas);
    if (!match) {
      // Si no está en catálogo, al menos mostrar el nombre del perfil
      if (!nombreUnidad) setNombreUnidad(unidadUsuarioLigada);
      return;
    }
    const label = labelUnidadMedica(match);
    setNombreUnidad(label);
    setDireccion(match.direccion?.trim() || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, unidadUsuarioLigada, unidadesMedicas]);

  // Corrección: alinear etiqueta/dirección con el catálogo si aplica
  useEffect(() => {
    if (!id || !nombreUnidad || unidadesMedicas.length === 0) return;
    const match = unidadesMedicas.find(
      (u) =>
        labelUnidadMedica(u) === nombreUnidad ||
        u.nombre === nombreUnidad ||
        (u.codigo && nombreUnidad.startsWith(`${u.codigo},`)) ||
        nombreUnidad.includes(u.nombre)
    );
    if (!match) return;
    const label = labelUnidadMedica(match);
    if (label !== nombreUnidad) setNombreUnidad(label);
    if (match.direccion?.trim() && !direccion?.trim()) setDireccion(match.direccion.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, unidadesMedicas]);

  // Reservar correlativo automático al crear (no en modo corregir)
  // Regla: se reserva al entrar; se libera al Volver/salir sin guardar; solo se consume al Guardar.
  useEffect(() => {
    if (id) return;

    let cancelled = false;
    correlativoConsumidoRef.current = false;

    // Si Strict Mode desmontó hace un momento, cancelar la liberación pendiente
    const pending = (window as any).__siafLiberateTimer as number | undefined;
    if (pending) {
      window.clearTimeout(pending);
      (window as any).__siafLiberateTimer = undefined;
    }

    const reservar = async () => {
      setReservandoCorrelativo(true);
      try {
        // El backend reutiliza la reserva activa del mismo usuario si aún existe
        const res = await api.post('/correlativos/reservar');
        const rid = res.data.reservaId as number;
        const corr = res.data.correlativo as string;
        reservaIdRef.current = rid;
        if (cancelled) return;
        setCorrelativo(corr);
        setReservaId(rid);
        try {
          sessionStorage.setItem(
            'siaf_correlativo_reserva',
            JSON.stringify({ reservaId: rid, correlativo: corr })
          );
        } catch {
          /* ignore */
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          showError(
            err?.response?.data?.message ||
              'No se pudo asignar un correlativo automático. Reinicie el backend e intente de nuevo.'
          );
        }
      } finally {
        if (!cancelled) setReservandoCorrelativo(false);
      }
    };

    reservar();

    const liberarAlSalir = () => {
      const rid = reservaIdRef.current;
      if (!rid || correlativoConsumidoRef.current) return;
      try {
        sessionStorage.removeItem('siaf_correlativo_reserva');
      } catch {
        /* ignore */
      }
      const token = localStorage.getItem('token');
      try {
        fetch(`${api.defaults.baseURL}/correlativos/liberar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ reservaId: rid }),
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('beforeunload', liberarAlSalir);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', liberarAlSalir);
      const rid = reservaIdRef.current;
      if (!rid || correlativoConsumidoRef.current) return;
      // Diferir liberación: Strict Mode remonta en <500ms y debe conservar la misma reserva
      (window as any).__siafLiberateTimer = window.setTimeout(() => {
        (window as any).__siafLiberateTimer = undefined;
        if (correlativoConsumidoRef.current) return;
        if (reservaIdRef.current !== rid) return;
        api.post('/correlativos/liberar', { reservaId: rid }).catch(() => {});
        reservaIdRef.current = null;
        try {
          sessionStorage.removeItem('siaf_correlativo_reserva');
        } catch {
          /* ignore */
        }
      }, 500);
    };
  }, [id, showError]);

  const liberarYVolver = async () => {
    const rid = reservaIdRef.current;
    const pending = (window as any).__siafLiberateTimer as number | undefined;
    if (pending) {
      window.clearTimeout(pending);
      (window as any).__siafLiberateTimer = undefined;
    }
    if (rid && !correlativoConsumidoRef.current && !id) {
      try {
        await api.post('/correlativos/liberar', { reservaId: rid });
      } catch {
        /* ignore */
      }
      correlativoConsumidoRef.current = true;
      reservaIdRef.current = null;
      setReservaId(null);
      setCorrelativo('');
      try {
        sessionStorage.removeItem('siaf_correlativo_reserva');
      } catch {
        /* ignore */
      }
    }
    navigate('/siaf-book');
  };

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
        if (userData.unidadMedica) {
          setUnidadUsuarioLigada(String(userData.unidadMedica));
        }

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
    const unidad = (unidadSolicitante || unidadUsuarioLigada || '').trim();
    if (!directorAusente || !unidad) {
      setMedicosUnidad([]);
      return;
    }
    const fetchMedicos = async () => {
      try {
        const res = await api.get(`/users/medicos-por-unidad/${encodeURIComponent(unidad)}`);
        setMedicosUnidad(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error('Error al cargar médicos de la unidad:', e);
        setMedicosUnidad([]);
      }
    };
    fetchMedicos();
  }, [directorAusente, unidadSolicitante, unidadUsuarioLigada]);

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
            const mappedItems = siaf.items.map((item: any) => ({
              codigo: item.codigo ?? '',
              descripcion: item.descripcion ?? '',
              cantidad: item.cantidad ?? 0,
              tipo: (item.codigo === 'S/C' ? 'servicio' : 'bien') as ItemTipo,
              catalogoOrigen: item.catalogoOrigen ?? '',
            }));
            setItems(mappedItems);
            const catalogoCargado = mappedItems.find(
              (item: Item) => item.tipo === 'bien' && item.catalogoOrigen
            )?.catalogoOrigen;
            setCatalogoSeleccionado(catalogoCargado || '');
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
    if (!newItems[index]) return;
    (newItems[index] as any)[field] = value;
    // Al cambiar el código de un bien, limpiar descripción hasta consultar el catálogo
    if (field === 'codigo' && newItems[index].tipo === 'bien') {
      newItems[index].descripcion = '';
    }
    setItems(newItems);
  };

  const buscarCodigosCatalogo = (index: number, query: string, origen: CatalogoOrigen) => {
    if (codigoSearchTimers.current[index]) {
      window.clearTimeout(codigoSearchTimers.current[index]);
    }
    const q = query.trim();
    if (!q) {
      setCodigoOpciones((prev) => ({ ...prev, [index]: [] }));
      setCodigoBuscando((prev) => ({ ...prev, [index]: false }));
      return;
    }
    setCodigoBuscando((prev) => ({ ...prev, [index]: true }));
    codigoSearchTimers.current[index] = window.setTimeout(async () => {
      try {
        const res = await api.get('/catalogo-productos/buscar', {
          params: { origen, q, limit: 15 },
        });
        setCodigoOpciones((prev) => ({ ...prev, [index]: res.data?.items ?? [] }));
      } catch {
        setCodigoOpciones((prev) => ({ ...prev, [index]: [] }));
      } finally {
        setCodigoBuscando((prev) => ({ ...prev, [index]: false }));
      }
    }, 250);
  };

  const aplicarCodigoSeleccionado = (index: number, option: CatalogoSugerencia | null, inputValue?: string) => {
    setItems((prev) => {
      const newItems = [...prev];
      if (!newItems[index]) return prev;
      if (option) {
        newItems[index] = {
          ...newItems[index],
          codigo: option.codigo,
          descripcion: option.descripcion ?? '',
          cantidad: newItems[index].cantidad > 0 ? newItems[index].cantidad : 1,
        };
      } else if (typeof inputValue === 'string') {
        const codigo = inputValue.trim();
        newItems[index] = {
          ...newItems[index],
          codigo: inputValue,
          descripcion: '',
          cantidad: codigo
            ? (newItems[index].cantidad > 0 ? newItems[index].cantidad : 1)
            : newItems[index].cantidad,
        };
      }
      return newItems;
    });
    if (option) {
      setCodigoOpciones((prev) => ({ ...prev, [index]: [] }));
    }
  };

  const handleCodigoBlur = async (index: number) => {
    if (items[index]?.tipo !== 'bien') return;
    const origen = catalogoSeleccionado || items[index]?.catalogoOrigen;
    if (!origen) {
      showWarning('Seleccione primero el catálogo MINFIN o SIBOFA.');
      return;
    }
    const codigo = (items[index]?.codigo ?? '').trim();
    if (!codigo) {
      const newItems = [...items];
      if (newItems[index]) newItems[index] = { ...newItems[index], descripcion: '' };
      setItems(newItems);
      return;
    }
    // Si ya hay descripción (seleccionó una sugerencia), no volver a consultar.
    if ((items[index]?.descripcion ?? '').trim()) {
      if (Number(items[index]?.cantidad) <= 0) {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], cantidad: 1 };
        setItems(newItems);
      }
      return;
    }
    try {
      const res = await api.get(`/catalogo-productos/codigo/${encodeURIComponent(codigo)}`, {
        params: { origen },
      });
      if (res.data?.descripcion != null) {
        const newItems = [...items];
        if (newItems[index]) {
          newItems[index] = {
            ...newItems[index],
            descripcion: res.data.descripcion,
            cantidad: Number(newItems[index].cantidad) > 0 ? newItems[index].cantidad : 1,
          };
        }
        setItems(newItems);
      }
    } catch (error: any) {
      // Código no encontrado en catálogo: dejar descripción vacía
      const newItems = [...items];
      if (newItems[index]) newItems[index] = { ...newItems[index], descripcion: '' };
      setItems(newItems);
      showWarning(error.response?.data?.message || `Código no encontrado en el catálogo ${origen}.`);
    }
  };

  const handleCatalogoSeleccionadoChange = (catalogoOrigen: CatalogoOrigen | '') => {
    if (!catalogoOrigen) return;
    setCatalogoSeleccionado(catalogoOrigen);
    setItems((prev) =>
      prev.map((item) =>
        item.tipo === 'bien'
          ? { ...item, catalogoOrigen, codigo: '', descripcion: '' }
          : item
      )
    );
    setCodigoOpciones({});
  };

  const handleItemTipoChange = (index: number, tipo: ItemTipo) => {
    const newItems = [...items];
    if (!newItems[index]) return;
    if (tipo === 'servicio') {
      newItems[index] = {
        ...newItems[index],
        tipo,
        codigo: 'S/C',
        descripcion: '', // en blanco y editable
        catalogoOrigen: '',
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        tipo,
        codigo: '',
        descripcion: '', // se completa al elegir código del catálogo
        catalogoOrigen: catalogoSeleccionado,
      };
    }
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        codigo: '',
        descripcion: '',
        cantidad: 0,
        tipo: 'bien',
        catalogoOrigen: catalogoSeleccionado,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };
  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogoSubproductosLoading(true);
      try {
        const res = await api.get('/catalogo-productos/buscar', {
          params: { origen: 'SUBPRODUCTOS', q: '', limit: 500 },
        });
        if (cancelled) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setCatalogoSubproductosLista(
          items
            .map((p: any) => ({
              codigo: String(p.codigo || '').trim(),
              descripcion: String(p.descripcion || '').trim(),
            }))
            .filter((p: { codigo: string }) => p.codigo)
            .sort((a: { codigo: string }, b: { codigo: string }) => a.codigo.localeCompare(b.codigo, 'es'))
        );
      } catch {
        if (!cancelled) setCatalogoSubproductosLista([]);
      } finally {
        if (!cancelled) setCatalogoSubproductosLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddSubproducto = () => {
    setSubproductos((prev) => [...prev, { codigo: '', cantidad: 0 }]);
  };

  const handleRemoveSubproducto = (index: number) => {
    setSubproductos((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const aplicarSubproductoSeleccionado = (
    index: number,
    option: { codigo: string; descripcion: string } | null
  ) => {
    setSubproductos((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      if (!option) {
        next[index] = { ...next[index], codigo: '', descripcion: '' };
        return next;
      }
      if (next.some((s, i) => i !== index && s.codigo === option.codigo)) {
        showWarning(`El subproducto ${option.codigo} ya está seleccionado en otra fila.`);
        return prev;
      }
      next[index] = {
        ...next[index],
        codigo: option.codigo,
        descripcion: option.descripcion || '',
        cantidad: next[index].cantidad > 0 ? next[index].cantidad : 0,
      };
      return next;
    });
  };

  const totalItemCantidad = items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
  const totalSubproductoCantidad = subproductos.reduce((sum, s) => sum + Number(s.cantidad || 0), 0);

  const setCantidadSubproductoFila = (index: number, raw: string) => {
    const n = Math.max(0, Number(raw) || 0);
    setSubproductos((prev) => {
      const otherSum = prev
        .filter((_, i) => i !== index)
        .reduce((sum, s) => sum + Number(s.cantidad || 0), 0);
      const maxAllowed = Math.max(0, totalItemCantidad - otherSum);
      if (n > maxAllowed) {
        showWarning(
          `La suma de cantidades de subproductos no puede exceder el total de bienes/servicios (${totalItemCantidad}). Máximo en esta fila: ${maxAllowed}.`
        );
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index], cantidad: maxAllowed };
        return next;
      }
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], cantidad: n };
      return next;
    });
  };

  const handleRevisarOrtografia = async () => {
    const texto = justificacion.trim();
    if (!texto) {
      showWarning('Escriba la justificación antes de revisar la ortografía.');
      return;
    }
    setOrtografiaLoading(true);
    try {
      const { data } = await api.post('/ortografia/revisar', { texto });
      const sugerencias = Array.isArray(data?.suggestions) ? data.suggestions : [];
      if (sugerencias.length === 0) {
        showSuccess('No se encontraron correcciones ortográficas.');
        return;
      }
      setOrtografiaTexto(String(data.original || texto));
      setOrtografiaSugerencias(sugerencias);
      setOrtografiaElegidas(
        Object.fromEntries(sugerencias.map((s: any, i: number) => [i, s.replacement]))
      );
      setOrtografiaOpen(true);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'No se pudo revisar la ortografía.');
    } finally {
      setOrtografiaLoading(false);
    }
  };

  /** Aplica las palabras elegidas de atrás hacia adelante para no alterar los offsets. */
  const construirTextoCorregido = (): string => {
    let resultado = ortografiaTexto;
    const enOrden = ortografiaSugerencias
      .map((s, i) => ({ ...s, elegida: ortografiaElegidas[i] }))
      .filter((s) => s.elegida)
      .sort((a, b) => b.offset - a.offset);
    for (const s of enOrden) {
      resultado = resultado.slice(0, s.offset) + s.elegida + resultado.slice(s.offset + s.length);
    }
    return resultado;
  };

  const formData = {
      fecha, correlativo, nombreUnidad, direccion, justificacion, items, subproductos, totalSubproductoCantidad,
      nombreSolicitante, puestoSolicitante, unidadSolicitante,
      nombreAutoridad, puestoAutoridad, unidadAutoridad,
      areaUnidad, consistentItem,
  }

  const cerrarMarcasViewer = () => {
    setMarcasViewerOpen(false);
    setMarcasViewerList([]);
    if (marcasUrlRef.current) {
      URL.revokeObjectURL(marcasUrlRef.current);
      marcasUrlRef.current = null;
    }
    setMarcasViewerUrl(null);
  };

  const handleVerMarcasEnPdf = async (entry: { detalleAntes?: string | null }) => {
    const marcas = parseMarcadoresBitacora(entry.detalleAntes);
    if (marcas.length === 0) {
      showError('Este rechazo no tiene marcas en el documento.');
      return;
    }
    setMarcasViewerList(marcas);
    setMarcasViewerOpen(true);
    setMarcasViewerLoading(true);
    try {
      if (marcasUrlRef.current) {
        URL.revokeObjectURL(marcasUrlRef.current);
        marcasUrlRef.current = null;
      }
      const blob = await pdf(<SiafPdfDocument data={formData} />).toBlob();
      const url = URL.createObjectURL(blob);
      marcasUrlRef.current = url;
      setMarcasViewerUrl(url);
    } catch (e) {
      console.error(e);
      showError('No se pudo generar el PDF con las marcas.');
      cerrarMarcasViewer();
    } finally {
      setMarcasViewerLoading(false);
    }
  };

  const marcasViewerMarkers: PdfMarker[] = marcasViewerList.map((m, idx) => ({
    pageNumber: m.pagina,
    xPercent: m.xPercent,
    yPercent: m.yPercent,
    label: idx + 1,
  }));

  /** Validación al crear/editar: todos los campos obligatorios excepto adjuntos. */
  const getValidationError = (): string | null => {
    if (!fecha?.trim()) return 'La fecha es obligatoria.';
    if (!id && !reservaId) return 'Espere a que se asigne el correlativo automático.';
    if (!correlativo?.trim()) return 'El correlativo es obligatorio.';
    if (!nombreUnidad?.trim()) return 'Debe seleccionar el nombre de la unidad ejecutora.';
    if (!areaUnidad?.trim()) return 'Debe seleccionar el área.';
    if (!direccion?.trim()) return 'La dirección es obligatoria.';
    if (!justificacion?.trim()) return 'La justificación de la solicitud es obligatoria.';

    const hayBienes = items.some((i) => i.tipo === 'bien');
    if (hayBienes && !catalogoSeleccionado) {
      return 'Seleccione el catálogo MINFIN o SIBOFA antes de ingresar códigos.';
    }

    const validItems = items.filter(
      (i) => (i.codigo?.trim() ?? '') !== '' && (i.descripcion?.trim() ?? '') !== '' && Number(i.cantidad) > 0
    );
    if (validItems.length === 0)
      return 'Debe agregar al menos un bien o servicio con código, descripción y cantidad mayor a 0.';

    const validSubs = subproductos.filter((s) => (s.codigo?.trim() ?? '') !== '' && Number(s.cantidad) > 0);
    if (validSubs.length === 0) {
      return 'Seleccione al menos un subproducto e indique una cantidad mayor a 0.';
    }
    const sumaSubs = validSubs.reduce((sum, s) => sum + Number(s.cantidad || 0), 0);
    const sumaItems = items
      .filter((i) => (i.codigo?.trim() ?? '') !== '' && Number(i.cantidad) > 0)
      .reduce((sum, i) => sum + Number(i.cantidad || 0), 0);
    if (sumaSubs > sumaItems) {
      return `La suma de cantidades de subproductos (${sumaSubs}) no puede exceder el total de bienes/servicios (${sumaItems}).`;
    }

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
      return;
    }

    try {
      // Encontrar el ID del área seleccionada
      const selectedArea = areas.find(area => area.nombre === areaUnidad);

      // Preparar datos para enviar al backend
      const siafData: Record<string, unknown> = {
        fecha,
        correlativo,
        ...(id ? {} : { reservaId }),
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
        items: items
          .filter(item => item.codigo && item.descripcion)
          .map(({ codigo, descripcion, cantidad, tipo }) => ({
            codigo,
            descripcion,
            cantidad,
            catalogoOrigen: tipo === 'bien' ? (catalogoSeleccionado || null) : null,
          })),
        subproductos: subproductos.filter((sub) => sub.codigo && Number(sub.cantidad) > 0),
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
        showSuccess(
          estadoSiafCargado && estadoSiafCargado !== 'borrador'
            ? 'Cambios guardados. El SIAF volvió a Borrador para que decida si lo finaliza o lo envía nuevamente a revisión.'
            : 'Solicitud SIAF actualizada exitosamente'
        );
        await loadSiafs();
        navigate('/siaf-book', {
          state: response?.data?.bitacora
            ? { bitacoraSiafId: parseInt(id!, 10), bitacora: response.data.bitacora }
            : undefined,
        });
      } else {
        response = await api.post('/siaf', siafData);
        siafIdForAdjuntos = response.data.siafId;
        correlativoConsumidoRef.current = true;
        reservaIdRef.current = null;
        setReservaId(null);
        try {
          sessionStorage.removeItem('siaf_correlativo_reserva');
        } catch {
          /* ignore */
        }

        if (response.data.pdfGenerated) {
          await loadSiafs();
          setPreviewIsDraft(false);
          setPreviewOpen(true);
          showSuccess('SIAF guardado como borrador. Envíelo a revisión cuando lo necesite.');
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
    }
  };

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          background: mode !== 'dark' ? IGSS_COLORS.fondo : '#121212',
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
                background: mode !== 'dark' ? IGSS_COLORS.azul : IGSS_COLORS.azulOscuro,
                color: 'white',
                boxShadow: '0 8px 32px rgba(59, 107, 133, 0.3)',
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
                  onClick={() => { void liberarYVolver(); }}
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
                                  {b.tipo === 'rechazo' ? 'Rechazo' : b.tipo === 'correccion' ? 'Corrección' : b.tipo === 'aprobado_dd' ? 'Revisión favorable (DD)' : 'Revisado'}
                                </Box>
                              </TableCell>
                              <TableCell>
                                {b.usuario ? `${b.usuario.nombres || ''} ${b.usuario.apellidos || ''}`.trim() || '—' : '—'}
                              </TableCell>
                              <TableCell>
                                {b.tipo === 'correccion' && (b.detalleAntes || b.detalleDespues) && !String(b.detalleAntes || '').includes('"marcadores"') ? (
                                  <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                                    {b.detalleAntes && <><strong>Antes:</strong> {b.detalleAntes}</>}
                                    {b.detalleAntes && b.detalleDespues && <br />}
                                    {b.detalleDespues && <><strong>Corregido a:</strong> {b.detalleDespues}</>}
                                  </Box>
                                ) : (
                                  <Box>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                      {limpiarComentarioBitacora(b.comentario)}
                                    </Typography>
                                    {b.tipo === 'rechazo' && parseMarcadoresBitacora(b.detalleAntes).length > 0 && (
                                      <Button
                                        size="small"
                                        startIcon={<PlaceIcon />}
                                        onClick={() => handleVerMarcasEnPdf(b)}
                                        sx={{ mt: 0.75, textTransform: 'none', fontWeight: 600 }}
                                      >
                                        Ver marcas en el SIAF ({parseMarcadoresBitacora(b.detalleAntes).length})
                                      </Button>
                                    )}
                                  </Box>
                                )}
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
                      value={reservandoCorrelativo ? 'Asignando…' : correlativo}
                      InputProps={{ readOnly: true }}
                      disabled={!!id || reservandoCorrelativo}
                      helperText={
                        id
                          ? 'El correlativo no se modifica al corregir'
                          : 'Reservado mientras llena el formulario. Solo se confirma al «Guardar y Generar SIAF». Si vuelve atrás sin guardar, se libera.'
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'action.hover',
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
                      background: mode !== 'dark' ? IGSS_COLORS.azul : IGSS_COLORS.azulOscuro,
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
                                <InputLabel id="nombre-unidad-label">Unidad médica</InputLabel>
                                <Select
                                    labelId="nombre-unidad-label"
                                    value={nombreUnidad}
                                    label="Unidad médica *"
                                    disabled={!id}
                                    readOnly={!id}
                                    onChange={(e) => {
                                      // Solo editable al corregir un SIAF existente
                                      if (!id) return;
                                      const selectedValue = e.target.value as string;
                                      setNombreUnidad(selectedValue);
                                      const match = unidadesMedicas.find(
                                        (u) => labelUnidadMedica(u) === selectedValue || u.nombre === selectedValue
                                      );
                                      setDireccion(match?.direccion?.trim() || '');
                                    }}
                                >
                                    <MenuItem value=""><em>Ninguno</em></MenuItem>
                                    {unidadesMedicas.map((u) => {
                                      const label = labelUnidadMedica(u);
                                      return (
                                        <MenuItem key={u.id} value={label}>
                                          {label}
                                        </MenuItem>
                                      );
                                    })}
                                    {nombreUnidad &&
                                      !unidadesMedicas.some(
                                        (u) => labelUnidadMedica(u) === nombreUnidad || u.nombre === nombreUnidad
                                      ) && (
                                        <MenuItem value={nombreUnidad}>{nombreUnidad}</MenuItem>
                                      )}
                                </Select>
                              </FormControl>
                              {!id && (
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                  Se carga automáticamente según la unidad ligada a su usuario. Solo elija el área.
                                </Typography>
                              )}
                              {!id && unidadUsuarioLigada && !nombreUnidad && unidadesMedicas.length > 0 && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                                  No se encontró «{unidadUsuarioLigada}» en el catálogo de unidades. Verifique Gestión de Unidades Médicas.
                                </Typography>
                              )}
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
                          {textoUnidadEjecutora ? (
                            <Grid item xs={12}>
                              <Alert severity="info" sx={{ py: 0.5 }}>
                                Quedará en el SIAF como:{' '}
                                <strong>{textoUnidadEjecutora}</strong>
                              </Alert>
                            </Grid>
                          ) : null}
                          <Grid item xs={12}>
                              <TextField
                                label="Dirección *"
                                fullWidth
                                multiline
                                rows={2}
                                required
                                value={direccion}
                                InputProps={{ readOnly: true }}
                                disabled
                                helperText="Se completa automáticamente con la dirección de su unidad médica"
                              />
                          </Grid>
                      </Grid>
                  </CardContent>
                </Card>
              </Box>

              {/* Detalle de Bienes o Servicios */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>Detalle de Bienes o Servicios *</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Al menos un ítem con código, descripción y cantidad mayor a 0.
                </Typography>
                <TextField
                  select
                  size="small"
                  label="Catálogo de códigos"
                  value={catalogoSeleccionado}
                  onChange={(e) => handleCatalogoSeleccionadoChange(e.target.value as CatalogoOrigen | '')}
                  sx={{ mb: 2, minWidth: 280 }}
                  InputLabelProps={{ shrink: true }}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value="" disabled>
                    <em>Seleccione MINFIN o SIBOFA</em>
                  </MenuItem>
                  <MenuItem value="MINFIN">MINFIN</MenuItem>
                  <MenuItem value="SIBOFA">SIBOFA</MenuItem>
                </TextField>
              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                <Table sx={{ minWidth: 900, tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: 150, borderRight: '1px solid rgba(224, 224, 224, 1)' }}>Tipo</TableCell>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: 170, borderRight: '1px solid rgba(224, 224, 224, 1)' }}>Código</TableCell>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: 'auto', borderRight: '1px solid rgba(224, 224, 224, 1)' }}>Descripción</TableCell>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: 100, textAlign: 'right', borderRight: '1px solid rgba(224, 224, 224, 1)' }}>Cantidad</TableCell>
                      <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: 80, textAlign: 'right' }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', verticalAlign: 'top' }}>
                          <Select
                            size="small"
                            value={item.tipo}
                            onChange={(e) => handleItemTipoChange(index, e.target.value as ItemTipo)}
                            variant="standard"
                            fullWidth
                            sx={{ minWidth: 130 }}
                          >
                            <MenuItem value="bien">Bien/Producto</MenuItem>
                            <MenuItem value="servicio">Servicio</MenuItem>
                          </Select>
                        </TableCell>
                        <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', verticalAlign: 'top' }}>
                          {item.tipo === 'servicio' ? (
                            <TextField variant="standard" size="small" value="S/C" InputProps={{ readOnly: true }} fullWidth />
                          ) : (
                            <Autocomplete
                              freeSolo
                              value={null}
                              options={codigoOpciones[index] ?? []}
                              loading={!!codigoBuscando[index]}
                              disabled={!catalogoSeleccionado}
                              filterOptions={(x) => x}
                              getOptionLabel={(option) =>
                                typeof option === 'string' ? option : option.codigo
                              }
                              isOptionEqualToValue={(option, value) =>
                                option.codigo === (typeof value === 'string' ? value : value.codigo)
                              }
                              inputValue={item.codigo}
                              onInputChange={(_, value, reason) => {
                                if (reason === 'reset') return;
                                aplicarCodigoSeleccionado(index, null, value);
                                if (catalogoSeleccionado) {
                                  buscarCodigosCatalogo(index, value, catalogoSeleccionado);
                                }
                              }}
                              onChange={(_, value) => {
                                if (typeof value === 'string') {
                                  aplicarCodigoSeleccionado(index, null, value);
                                } else {
                                  aplicarCodigoSeleccionado(index, value);
                                }
                              }}
                              onBlur={() => handleCodigoBlur(index)}
                              renderOption={(props, option) => (
                                <li {...props} key={option.codigo}>
                                  <Box sx={{ py: 0.5 }}>
                                    <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                                      {option.codigo}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'normal' }}>
                                      {(option.descripcion || '').slice(0, 140)}
                                      {(option.descripcion || '').length > 140 ? '…' : ''}
                                    </Typography>
                                  </Box>
                                </li>
                              )}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  variant="standard"
                                  size="small"
                                  placeholder={catalogoSeleccionado ? 'Buscar código' : 'Elija catálogo'}
                                  InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                      <>
                                        {codigoBuscando[index] ? <CircularProgress color="inherit" size={14} /> : null}
                                        {params.InputProps.endAdornment}
                                      </>
                                    ),
                                  }}
                                />
                              )}
                              sx={{
                                width: '100%',
                                '& .MuiInputBase-input': {
                                  textOverflow: 'ellipsis',
                                },
                              }}
                              ListboxProps={{ style: { maxHeight: 280 } }}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', verticalAlign: 'top', minWidth: 420 }}>
                          {item.tipo === 'servicio' ? (
                            <TextField
                              variant="outlined"
                              size="small"
                              fullWidth
                              multiline
                              minRows={3}
                              maxRows={8}
                              value={item.descripcion}
                              onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                              placeholder="Escriba la descripción del servicio"
                              sx={{ '& .MuiInputBase-root': { alignItems: 'flex-start' } }}
                            />
                          ) : (
                            <TextField
                              variant="outlined"
                              size="small"
                              fullWidth
                              multiline
                              minRows={3}
                              maxRows={8}
                              value={item.descripcion}
                              InputProps={{ readOnly: true }}
                              placeholder="Se completa automáticamente con el catálogo"
                              title={item.descripcion || undefined}
                              sx={{
                                '& .MuiInputBase-root': { alignItems: 'flex-start', bgcolor: 'action.hover' },
                                '& .MuiInputBase-input': { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)', verticalAlign: 'top' }}>
                          <TextField variant="standard" size="small" type="number" value={item.cantidad} onChange={(e) => handleItemChange(index, 'cantidad', Number(e.target.value))} />
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
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

              {/* Detalle por Subproducto — combobox del catálogo */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>Detalle por Subproducto *</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Elija el subproducto desde el listado (combobox) e indique la cantidad. La suma no puede
                  exceder el total de bienes/servicios (<strong>{totalItemCantidad}</strong>).
                </Typography>

                <Alert
                  severity={totalSubproductoCantidad > totalItemCantidad ? 'error' : 'info'}
                  sx={{ mb: 1.5 }}
                >
                  Total bienes/servicios: <strong>{totalItemCantidad}</strong>
                  {' · '}
                  Asignado a subproductos: <strong>{totalSubproductoCantidad}</strong>
                  {' · '}
                  Disponible: <strong>{Math.max(0, totalItemCantidad - totalSubproductoCantidad)}</strong>
                </Alert>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', minWidth: 320 }}>
                          Código de Subproducto
                        </TableCell>
                        <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: 120 }} align="right">
                          Cantidad
                        </TableCell>
                        <TableCell sx={{ backgroundColor: 'white', fontWeight: 'bold', width: 80 }} align="right">
                          Acciones
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {subproductos.map((sub, index) => {
                        const selectedOption =
                          sub.codigo
                            ? {
                                codigo: sub.codigo,
                                descripcion:
                                  sub.descripcion ||
                                  catalogoSubproductosLista.find((c) => c.codigo === sub.codigo)?.descripcion ||
                                  '',
                              }
                            : null;
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <Autocomplete
                                size="small"
                                options={catalogoSubproductosLista}
                                loading={catalogoSubproductosLoading}
                                value={selectedOption}
                                getOptionLabel={(opt) =>
                                  opt.descripcion ? `${opt.codigo} — ${opt.descripcion}` : opt.codigo
                                }
                                isOptionEqualToValue={(a, b) => a.codigo === b.codigo}
                                filterOptions={(opts, state) => {
                                  const q = state.inputValue.trim().toLowerCase();
                                  if (!q) return opts;
                                  return opts.filter(
                                    (o) =>
                                      o.codigo.toLowerCase().includes(q) ||
                                      (o.descripcion || '').toLowerCase().includes(q)
                                  );
                                }}
                                onChange={(_, option) => aplicarSubproductoSeleccionado(index, option)}
                                noOptionsText={
                                  catalogoSubproductosLoading
                                    ? 'Cargando…'
                                    : catalogoSubproductosLista.length === 0
                                      ? 'No hay subproductos cargados en el catálogo'
                                      : 'Sin coincidencias'
                                }
                                renderOption={(props, option) => (
                                  <li {...props} key={option.codigo}>
                                    <Box sx={{ py: 0.25 }}>
                                      <Typography variant="body2" fontWeight={700}>{option.codigo}</Typography>
                                      {option.descripcion && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                          {option.descripcion}
                                        </Typography>
                                      )}
                                    </Box>
                                  </li>
                                )}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    variant="standard"
                                    placeholder="Elegir subproducto del catálogo…"
                                    InputProps={{
                                      ...params.InputProps,
                                      endAdornment: (
                                        <>
                                          {catalogoSubproductosLoading ? (
                                            <CircularProgress color="inherit" size={16} />
                                          ) : null}
                                          {params.InputProps.endAdornment}
                                        </>
                                      ),
                                    }}
                                  />
                                )}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                variant="standard"
                                size="small"
                                type="number"
                                value={sub.cantidad || ''}
                                onChange={(e) => setCantidadSubproductoFila(index, e.target.value)}
                                inputProps={{ min: 0, step: 1, style: { textAlign: 'right' } }}
                                disabled={!sub.codigo}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                color="error"
                                onClick={() => handleRemoveSubproducto(index)}
                                disabled={subproductos.length === 1}
                              >
                                <RemoveCircleOutlineIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Button
                  variant="outlined"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={handleAddSubproducto}
                  sx={{ mt: 2 }}
                >
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
                      background: mode !== 'dark' ? IGSS_COLORS.verde : IGSS_COLORS.verdeOscuro,
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
                      background: mode !== 'dark' ? IGSS_COLORS.azulClaro : IGSS_COLORS.azul,
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
                              <TextField
                                select
                                fullWidth
                                required
                                label="Encargado/a del Despacho de Dirección"
                                value={usuarioEncargadoId ?? ''}
                                disabled={!!id}
                                InputLabelProps={{ shrink: true }}
                                SelectProps={{ displayEmpty: true }}
                                onChange={(e) => {
                                  const idVal = Number(e.target.value);
                                  if (!idVal) {
                                    setUsuarioEncargadoId(null);
                                    return;
                                  }
                                  setUsuarioEncargadoId(idVal);
                                  const medico = medicosUnidad.find((m) => m.id === idVal);
                                  if (medico) {
                                    setNombreAutoridad(`${medico.nombres} ${medico.apellidos}`);
                                    setPuestoAutoridad('Encargado/a del Despacho de Dirección');
                                    setUnidadAutoridad(medico.unidadMedica || unidadSolicitante);
                                  }
                                }}
                              >
                                <MenuItem value="" disabled>
                                  <em>Seleccione un médico de la unidad</em>
                                </MenuItem>
                                {medicosUnidad.map((m) => (
                                  <MenuItem key={m.id} value={m.id}>
                                    {m.apellidos} {m.nombres}{m.puesto?.nombre ? ` (${m.puesto.nombre})` : ''}
                                  </MenuItem>
                                ))}
                              </TextField>
                              {!id && (
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                  Solo se listan usuarios con puesto de médico o doctor de la misma unidad médica ({unidadSolicitante || unidadUsuarioLigada || '—'}).
                                </Typography>
                              )}
                              {!id && directorAusente && medicosUnidad.length === 0 && (
                                <Alert severity="warning" sx={{ mt: 1 }}>
                                  No hay usuarios con puesto de médico o doctor registrados en esta unidad. Debe existir al menos uno en la misma unidad para designar encargado.
                                </Alert>
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                  <Typography variant="h6">Justificación *</Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={ortografiaLoading ? <CircularProgress size={16} color="inherit" /> : <SpellcheckIcon />}
                    onClick={handleRevisarOrtografia}
                    disabled={ortografiaLoading || !justificacion.trim()}
                  >
                    Revisar ortografía
                  </Button>
                </Box>
                <TextField
                  label="Justificación de la Solicitud"
                  fullWidth
                  required
                  multiline
                  rows={4}
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  inputProps={{ maxLength: 500, spellCheck: true }}
                  helperText={`${justificacion.length}/500 caracteres`}
                />
              </Box>

              {/* Botones: visualizar (sin guardar) y guardar */}
              <Box sx={{ textAlign: 'center', mt: 4, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  size="large"
                  color="primary"
                  onClick={() => {
                    setPreviewIsDraft(true);
                    setPreviewOpen(true);
                  }}
                  startIcon={<VisibilityIcon />}
                  sx={{
                    py: 1.5,
                    px: 4,
                    fontSize: '1.1rem',
                  }}
                >
                  Visualizar SIAF
                </Button>
                <Button 
                  variant="contained" 
                  size="large" 
                  color="primary" 
                  onClick={handleSave}
                  startIcon={<SaveIcon />}
                  sx={{
                    py: 1.5,
                    px: 4,
                    fontSize: '1.1rem',
                    boxShadow: '0 4px 12px rgba(59, 107, 133, 0.3)',
                  }}
                >
                  {id ? 'Actualizar y Generar SIAF' : 'Guardar y Generar SIAF'}
                </Button>
              </Box>
            </Paper>
          </motion.div>
        </Container>
      </Box>
      
      {/* Ortografía Dialog */}
      <Dialog
        open={ortografiaOpen}
        onClose={() => setOrtografiaOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Correcciones ortográficas ({ortografiaSugerencias.length})
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Elija la palabra correcta en cada caso. Si ninguna aplica, seleccione "No corregir".
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            {ortografiaSugerencias.map((s, idx) => (
              <Paper key={`${s.original}-${s.offset}`} variant="outlined" sx={{ p: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ textDecoration: 'line-through' }} color="error">
                    {s.original}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">→</Typography>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <Select
                      value={ortografiaElegidas[idx] ?? ''}
                      onChange={(e) =>
                        setOrtografiaElegidas((prev) => ({ ...prev, [idx]: String(e.target.value) }))
                      }
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>No corregir</em>
                      </MenuItem>
                      {s.options.map((opcion) => (
                        <MenuItem key={opcion} value={opcion}>
                          {opcion}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                {s.message ? (
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                    {s.message}
                  </Typography>
                ) : null}
              </Paper>
            ))}
          </Box>
          <Typography variant="subtitle2" gutterBottom>
            Texto corregido
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {construirTextoCorregido()}
            </Typography>
          </Paper>
          {construirTextoCorregido().length > 500 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              El texto corregido supera 500 caracteres. Acórtelo antes de guardar el SIAF.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrtografiaOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              setJustificacion(construirTextoCorregido().slice(0, 500));
              setOrtografiaOpen(false);
              showSuccess('Correcciones aplicadas a la justificación.');
            }}
          >
            Aplicar correcciones
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          {previewIsDraft ? 'Vista previa del SIAF (sin guardar)' : 'Previsualización de SIAF'}
        </DialogTitle>
        <DialogContent sx={{ height: '80vh' }}>
          {previewIsDraft && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Esta es solo una vista de cómo va quedando. No se guarda ni se genera el correlativo definitivo.
            </Typography>
          )}
          <PDFViewer width="100%" height="100%">
            <SiafPdfDocument data={formData} />
          </PDFViewer>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPreviewOpen(false);
              if (!previewIsDraft) navigate('/siaf-book');
            }}
          >
            Cerrar
          </Button>
          {!previewIsDraft && (
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
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={marcasViewerOpen}
        onClose={cerrarMarcasViewer}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { maxHeight: '95vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlaceIcon color="error" />
          Marcas de corrección — SIAF {correlativo || ''}
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 480 }}>
          <Box sx={{ flex: '1 1 62%', minWidth: 0, height: '70vh', borderRight: 1, borderColor: 'divider', overflow: 'auto', bgcolor: 'grey.100' }}>
            {marcasViewerLoading || !marcasViewerUrl ? (
              <Box display="flex" alignItems="center" justifyContent="center" height="100%" gap={1}>
                <Typography variant="body2" color="text.secondary">Cargando documento…</Typography>
              </Box>
            ) : (
              <PdfViewerWithClick
                fileUrl={marcasViewerUrl}
                markers={marcasViewerMarkers}
                minHeight={400}
                zoom={1}
              />
            )}
          </Box>
          <Box sx={{ flex: '0 0 38%', p: 2, overflow: 'auto', maxHeight: '70vh', bgcolor: '#f4f7fa' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Correcciones señaladas ({marcasViewerList.length})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {marcasViewerList.map((m, idx) => (
                <Paper key={m.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1.25 }}>
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        bgcolor: '#c62828',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.descripcion || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">Página {m.pagina}</Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={cerrarMarcasViewer} variant="outlined">Cerrar</Button>
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
