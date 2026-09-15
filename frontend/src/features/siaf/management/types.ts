import type React from 'react';

export type BitacoraEntry = {
  id: number;
  tipo: string;
  comentario: string | null;
  fecha: string;
  usuario?: { nombres?: string; apellidos?: string };
  detalleAntes?: string | null;
  detalleDespues?: string | null;
};

export type AdjuntoRow = {
  id: number;
  nombreOriginal: string;
  tamanioBytes: number;
  mimeType?: string;
};

export type ViewingDoc = {
  id: number;
  nombreOriginal: string;
  mimeType?: string;
  url?: string;
};

export type SiafActionTarget = {
  backendId: number;
  correlativo: string;
};

export type SiafListItem = {
  id: string;
  backendId: number;
  date: string;
  unit: string;
  status: string;
  formData: Record<string, unknown>;
  documentCount: number;
  ultimoRechazo?: { comentario: string; fecha: string };
};

export type SiafPdfData = {
  fecha: string;
  correlativo: string;
  nombreUnidad: string;
  direccion: string;
  justificacion: string;
  items: Array<{ codigo: string; descripcion: string; cantidad: number }>;
  subproductos: Array<{ codigo: string; cantidad: number }>;
  totalSubproductoCantidad: number;
  nombreSolicitante: string;
  puestoSolicitante: string;
  unidadSolicitante: string;
  nombreAutoridad: string;
  puestoAutoridad: string;
  unidadAutoridad: string;
  areaUnidad: string;
  consistentItem: string;
};

export type ResumenEstado = {
  estado: string;
  total: number;
  color: string;
  bg: string;
  icon: React.ReactElement;
};
