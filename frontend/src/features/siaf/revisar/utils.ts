import type { PdfMarker } from '../../../components/PdfViewerWithClick';
import type {
  BitacoraEntry,
  HistorialUnificadoItem,
  MarcaCorreccion,
  SiafHistorialItem,
  SiafSolicitud,
} from './types';

export function transformSiaf(siaf: any, esCorreccion?: boolean): SiafSolicitud {
  return {
    id: siaf.id.toString(),
    correlativo: siaf.correlativo,
    fecha: new Date(siaf.fecha).toISOString().split('T')[0],
    nombreSolicitante: siaf.nombreSolicitante || `${siaf.usuarioSolicitante?.nombres || ''} ${siaf.usuarioSolicitante?.apellidos || ''}`.trim() || 'N/A',
    puestoSolicitante: siaf.puestoSolicitante || siaf.usuarioSolicitante?.puesto?.nombre || 'N/A',
    nombreUnidad: siaf.nombreUnidad || siaf.area?.nombre || 'N/A',
    areaUnidad: siaf.area?.nombre || 'N/A',
    direccion: siaf.direccion || '',
    unidadSolicitante: siaf.unidadSolicitante || siaf.area?.nombre || 'N/A',
    justificacion: siaf.justificacion || '',
    nombreAutoridad: siaf.nombreAutoridad || '',
    puestoAutoridad: siaf.puestoAutoridad || '',
    unidadAutoridad: siaf.unidadAutoridad || '',
    consistentItem: siaf.consistenteItem || siaf.consistentItem || '',
    items: (siaf.items || []).map((i: any) => ({ id: i.id?.toString(), codigo: i.codigo || '', descripcion: i.descripcion || '', cantidad: Number(i.cantidad || 0) })),
    subproductos: (siaf.subproductos || []).map((s: any) => ({ id: s.id?.toString(), codigo: s.codigo || '', cantidad: Number(s.cantidad || 0) })),
    documentosAdjuntos: (siaf.documentosAdjuntos || []).map((a: any) => ({ id: a.id, nombreOriginal: a.nombreOriginal, tamanioBytes: a.tamanioBytes || 0, mimeType: a.mimeType })),
    esCorreccion: esCorreccion ?? false,
  };
}

/** Agrupa el historial por SIAF (id) y deja una fila por expediente con estado actual y cantidad de rechazos */
export function unificarHistorial(historial: SiafHistorialItem[]): HistorialUnificadoItem[] {
  const byId = new Map<number, SiafHistorialItem[]>();
  for (const item of historial) {
    const sid = item.siaf?.id ?? item.id;
    const id = typeof sid === 'number' ? sid : Number(sid);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push(item);
  }
  const result: HistorialUnificadoItem[] = [];
  byId.forEach((items, backendId) => {
    const ordered = [...items].sort((a, b) => new Date(b.fechaDecision).getTime() - new Date(a.fechaDecision).getTime());
    const primero = ordered[0];
    const cantidadRechazos = items.filter((i) => String(i.estado).toLowerCase() !== 'autorizado').length;
    result.push({
      backendId,
      correlativo: primero.correlativo,
      fecha: primero.fecha,
      nombreSolicitante: primero.nombreSolicitante,
      puestoSolicitante: primero.puestoSolicitante,
      nombreUnidad: primero.nombreUnidad,
      areaUnidad: primero.areaUnidad,
      estadoActual: primero.estado,
      fechaUltimaDecision: primero.fechaDecision,
      cantidadRechazos,
      siaf: primero.siaf,
    });
  });
  return result.sort((a, b) => new Date(b.fechaUltimaDecision).getTime() - new Date(a.fechaUltimaDecision).getTime());
}

export function buildSiafPdfData(siaf: SiafSolicitud) {
  return {
    fecha: siaf.fecha,
    correlativo: siaf.correlativo,
    nombreUnidad: siaf.nombreUnidad,
    direccion: siaf.direccion || '',
    justificacion: siaf.justificacion,
    items: siaf.items.map((i) => ({ codigo: i.codigo || '', descripcion: i.descripcion || '', cantidad: Number(i.cantidad || 0) })),
    subproductos: siaf.subproductos.map((s) => ({ codigo: String(s.codigo ?? ''), cantidad: Number(s.cantidad || 0) })),
    totalSubproductoCantidad: siaf.subproductos.reduce((sum, s) => sum + Number(s.cantidad || 0), 0),
    nombreSolicitante: siaf.nombreSolicitante,
    puestoSolicitante: siaf.puestoSolicitante,
    unidadSolicitante: siaf.unidadSolicitante || siaf.nombreUnidad,
    nombreAutoridad: siaf.nombreAutoridad || '',
    puestoAutoridad: siaf.puestoAutoridad || '',
    unidadAutoridad: siaf.unidadAutoridad || '',
    areaUnidad: siaf.areaUnidad || siaf.nombreUnidad,
    consistentItem: siaf.consistentItem,
  };
}

export function mapBitacoraEntry(b: any): BitacoraEntry {
  return {
    id: b.id,
    tipo: b.tipo,
    comentario: b.comentario ?? null,
    fecha: b.fecha,
    usuario: b.usuario,
    detalleAntes: b.detalleAntes ?? null,
    detalleDespues: b.detalleDespues ?? null,
  };
}

export function buildMarkersVisibles(
  marcasCorreccion: MarcaCorreccion[],
  marcasHistorialVista: MarcaCorreccion[],
  marcaActivaId: string | null,
): PdfMarker[] {
  const fromDraft = marcasCorreccion.map((m, idx) => ({
    pageNumber: m.pagina,
    xPercent: m.xPercent,
    yPercent: m.yPercent,
    label: idx + 1,
    active: m.id === marcaActivaId,
  }));
  const fromHist = marcasHistorialVista.map((m, idx) => ({
    pageNumber: m.pagina,
    xPercent: m.xPercent,
    yPercent: m.yPercent,
    label: `H${idx + 1}`,
    active: false,
  }));
  return [...fromHist, ...fromDraft];
}

export function mapHistorialItem(item: any): SiafHistorialItem {
  return {
    id: item.id,
    correlativo: item.correlativo,
    fecha: item.fecha ? new Date(item.fecha).toISOString().split('T')[0] : '',
    nombreSolicitante: item.nombreSolicitante || 'N/A',
    puestoSolicitante: item.puestoSolicitante || 'N/A',
    nombreUnidad: item.nombreUnidad || 'N/A',
    areaUnidad: item.areaUnidad || 'N/A',
    estado: item.estado || '',
    fechaDecision: item.fechaDecision ? new Date(item.fechaDecision).toISOString() : '',
    comentario: item.comentario ?? null,
    siaf: item.siaf,
  };
}
