export type MunicipioOption = { id: number; nombre: string };

export type ExpedienteRevision = {
  id: number;
  numeroExpediente: string;
  titulo: string;
  descripcion: string | null;
  numeroOrdenCompra?: string | null;
  estado: string;
  fechaApertura: string;
  municipioOrigen?: string | null;
  unidadOrigen?: string | null;
  usuario?: { nombres?: string; apellidos?: string; unidadMedica?: string };
  /** Solo en lista "Revisados": última acción (aprobación/rechazo) hecha por el analista. */
  ultimaAccionPorMi?: { tipo: string; fecha?: string } | null;
};

export type DocEnDetalle = {
  id: number;
  tipoDocumento: string;
  nombreArchivo: string;
  mimeType?: string;
  versionActualId?: number | null;
  enUltimoRechazo?: boolean;
};

export type RechazoEntry = {
  categoria: string;
  descripcion: string;
  pagina?: number | null;
  xPercent?: number | null;
  yPercent?: number | null;
};

export type DialogNuevaMarcaState = {
  open: boolean;
  pagina: number;
  xPercent: number;
  yPercent: number;
  categoria: string;
  descripcion: string;
};

export type VerDetalleData = {
  expedienteId: number;
  numeroExpediente: string;
  titulo: string;
  descripcion: string | null;
  numeroOrdenCompra?: string | null;
  documentos: DocEnDetalle[];
};

export type BitacoraListEntry = {
  id: number;
  tipo: string;
  fecha: string;
  comentario: string | null;
  usuario: { nombres?: string; apellidos?: string } | null;
  expedienteDocumentoId?: number | null;
  documentoReemplazo?: { nombreArchivo: string; mimeType: string };
  /** Versión que quedó como respaldo (el archivo que fue reemplazado). */
  documentoReemplazado?: { versionId: number; nombreArchivo: string; mimeType: string };
  detalle: Array<{
    expedienteDocumentoId?: number;
    nombreDocumento: string;
    comentario: string;
    corregido?: boolean;
  }>;
};
