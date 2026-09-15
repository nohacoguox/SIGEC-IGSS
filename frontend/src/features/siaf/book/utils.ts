import type {
  OrtografiaSugerencia,
  UnidadMedicaCatalogo,
  ValidationFormState,
} from './types';

export function departamentoUnidad(u: {
  departamento?: string | null;
  municipio?: { departamento?: { nombre?: string } | null } | null;
}): string {
  return (u.departamento || u.municipio?.departamento?.nombre || '').trim();
}

/** Formato institucional: 210, Consultorio de Palin, Escuintla */
export function labelUnidadMedica(u: {
  nombre: string;
  codigo?: string | null;
  departamento?: string | null;
  municipio?: { departamento?: { nombre?: string } | null } | null;
}): string {
  const parts: string[] = [];
  if (u.codigo?.trim()) parts.push(u.codigo.trim());
  parts.push(u.nombre.trim());
  const depto = departamentoUnidad(u);
  if (depto) parts.push(depto);
  return parts.join(', ');
}

export function findUnidadEnCatalogo(
  unidadNombre: string,
  list: UnidadMedicaCatalogo[],
): UnidadMedicaCatalogo | null {
  const n = (unidadNombre || '').trim().toLowerCase();
  if (!n || !list.length) return null;
  return (
    list.find((u) => u.nombre.trim().toLowerCase() === n) ||
    list.find((u) => labelUnidadMedica(u).toLowerCase() === n) ||
    list.find((u) => labelUnidadMedica(u).toLowerCase().includes(n)) ||
    list.find((u) => n.includes(u.nombre.trim().toLowerCase())) ||
    null
  );
}

/** Aplica las palabras elegidas de atrás hacia adelante para no alterar los offsets. */
export function construirTextoCorregido(
  ortografiaTexto: string,
  ortografiaSugerencias: OrtografiaSugerencia[],
  ortografiaElegidas: Record<number, string>,
): string {
  let resultado = ortografiaTexto;
  const enOrden = ortografiaSugerencias
    .map((s, i) => ({ ...s, elegida: ortografiaElegidas[i] }))
    .filter((s) => s.elegida)
    .sort((a, b) => b.offset - a.offset);
  for (const s of enOrden) {
    resultado = resultado.slice(0, s.offset) + s.elegida + resultado.slice(s.offset + s.length);
  }
  return resultado;
}

/** Validación al crear/editar: todos los campos obligatorios excepto adjuntos. */
export function getValidationError(state: ValidationFormState): string | null {
  const {
    id,
    reservaId,
    fecha,
    correlativo,
    nombreUnidad,
    areaUnidad,
    direccion,
    justificacion,
    items,
    subproductos,
    catalogoSeleccionado,
    nombreSolicitante,
    puestoSolicitante,
    unidadSolicitante,
    nombreAutoridad,
    puestoAutoridad,
    unidadAutoridad,
    directorAusente,
    usuarioEncargadoId,
    showConsistentField,
    consistentItem,
  } = state;

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
    (i) => (i.codigo?.trim() ?? '') !== '' && (i.descripcion?.trim() ?? '') !== '' && Number(i.cantidad) > 0,
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
}
