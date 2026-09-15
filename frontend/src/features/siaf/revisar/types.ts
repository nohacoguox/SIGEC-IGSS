import type { SiafMarcaBitacora } from '../../../utils/siafBitacora';

export interface SiafItem {
  id: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
}

export interface SiafSubproducto {
  id: string;
  codigo?: string;
  cantidad: number;
}

export interface SiafAdjunto {
  id: number;
  nombreOriginal: string;
  tamanioBytes: number;
  mimeType?: string;
}

export interface SiafSolicitud {
  id: string;
  correlativo: string;
  fecha: string;
  nombreSolicitante: string;
  puestoSolicitante: string;
  nombreUnidad: string;
  areaUnidad: string;
  direccion: string;
  unidadSolicitante: string;
  justificacion: string;
  nombreAutoridad: string;
  puestoAutoridad: string;
  unidadAutoridad: string;
  consistentItem: string;
  items: SiafItem[];
  subproductos: SiafSubproducto[];
  documentosAdjuntos?: SiafAdjunto[];
  /** true si el expediente fue rechazado y el solicitante lo corrigió y reenvió */
  esCorreccion?: boolean;
}

export interface MetaDD {
  unidadAsignada: string;
  departamento: string;
  departamentoId?: number | null;
}

export interface Municipio {
  id: number;
  nombre: string;
}

export interface SiafHistorialItem {
  id: number;
  correlativo: string;
  fecha: string;
  nombreSolicitante: string;
  puestoSolicitante: string;
  nombreUnidad: string;
  areaUnidad: string;
  estado: string;
  fechaDecision: string;
  comentario: string | null;
  siaf: any;
}

/** Una fila por expediente (SIAF) con estado actual y cantidad de rechazos */
export interface HistorialUnificadoItem {
  backendId: number;
  correlativo: string;
  fecha: string;
  nombreSolicitante: string;
  puestoSolicitante: string;
  nombreUnidad: string;
  areaUnidad: string;
  estadoActual: string;
  fechaUltimaDecision: string;
  cantidadRechazos: number;
  siaf: any;
}

export interface BitacoraEntry {
  id: number;
  tipo: string;
  comentario: string | null;
  fecha: string;
  usuario?: { nombres?: string; apellidos?: string };
  detalleAntes?: string | null;
  detalleDespues?: string | null;
}

export type MarcaCorreccion = SiafMarcaBitacora;

export type MotivoRechazoDraft = {
  categoria: string;
  descripcion: string;
};

export type DialogNuevaMarcaState = {
  open: boolean;
  pagina: number;
  xPercent: number;
  yPercent: number;
  categoria: string;
  descripcion: string;
};

export type ViewingDoc = {
  id: number;
  nombreOriginal: string;
  mimeType?: string;
  url?: string;
};

export type AdjuntoComparar = {
  id: number;
  nombreOriginal: string;
  mimeType?: string;
  url: string;
};
