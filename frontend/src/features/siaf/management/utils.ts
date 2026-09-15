import type { ResumenEstado, SiafListItem, SiafPdfData } from './types';
import { estadoConfig, SIAF_ESTADOS } from './constants';

export function buildPdfDataFromForm(formData: Record<string, unknown>): SiafPdfData {
  const items = (formData.items as Array<Record<string, unknown>> | undefined) || [];
  const subproductos = (formData.subproductos as Array<Record<string, unknown>> | undefined) || [];

  return {
    fecha: formData.fecha ? String(formData.fecha).split('T')[0] : '',
    correlativo: String(formData.correlativo || ''),
    nombreUnidad: String(formData.nombreUnidad || ''),
    direccion: String(formData.direccion || ''),
    justificacion: String(formData.justificacion || ''),
    items: items.map((i) => ({
      codigo: String(i.codigo || ''),
      descripcion: String(i.descripcion || ''),
      cantidad: Number(i.cantidad || 0),
    })),
    subproductos: subproductos.map((s) => ({
      codigo: String(s.codigo ?? ''),
      cantidad: Number(s.cantidad || 0),
    })),
    totalSubproductoCantidad: subproductos.reduce((sum, s) => sum + Number(s.cantidad || 0), 0),
    nombreSolicitante: String(formData.nombreSolicitante || ''),
    puestoSolicitante: String(formData.puestoSolicitante || ''),
    unidadSolicitante: String(formData.unidadSolicitante || formData.nombreUnidad || ''),
    nombreAutoridad: String(formData.nombreAutoridad || ''),
    puestoAutoridad: String(formData.puestoAutoridad || ''),
    unidadAutoridad: String(formData.unidadAutoridad || ''),
    areaUnidad: String(formData.nombreUnidad || ''),
    consistentItem: String(formData.consistentItem || ''),
  };
}

export function buildResumen(siafList: SiafListItem[]): ResumenEstado[] {
  return SIAF_ESTADOS.map((estado) => ({
    estado,
    total: siafList.filter((s) => s.status === estado).length,
    ...estadoConfig[estado],
  }));
}
