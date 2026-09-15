export type ExpedienteRow = {
  id: number;
  numeroExpediente: string;
  titulo: string;
  tipoExpediente: string;
  estado: string;
  fechaApertura: string;
  descripcion?: string | null;
  numeroOrdenCompra?: string | null;
  numeroSiaf?: string | null;
};

export type DocumentoRow = {
  id: number;
  tipoDocumento: string;
  nombreArchivo: string;
  descripcion: string | null;
  fechaSubida: string;
  tamanioBytes: number;
  mimeType: string;
};

export type UltimoRechazo = {
  id: number;
  fecha: string;
  comentario: string | null;
  usuario: { nombres?: string; apellidos?: string } | null;
  detalle: Array<{
    expedienteDocumentoId: number;
    nombreDocumento: string;
    comentario: string;
    pagina?: number | null;
    xPercent?: number | null;
    yPercent?: number | null;
    documentoVersionIdParaMarca?: number;
  }>;
};

export type BitacoraEntry = {
  id: number;
  tipo: string;
  comentario: string | null;
  fecha: string;
  usuario?: { nombres?: string; apellidos?: string } | null;
  expedienteDocumentoId?: number | null;
  documentoReemplazo?: { nombreArchivo: string; mimeType: string };
  /** Versión que quedó como respaldo (el archivo que fue reemplazado). */
  documentoReemplazado?: { versionId: number; nombreArchivo: string; mimeType: string };
  detalle?: Array<{
    expedienteDocumentoId?: number;
    nombreDocumento: string;
    mimeType?: string;
    comentario: string;
    corregido?: boolean;
    pagina?: number | null;
    xPercent?: number | null;
    yPercent?: number | null;
    documentoVersionIdParaMarca?: number;
  }>;
};

export type DocumentoVersionRow = {
  id: number;
  numeroVersion: number;
  esActual: boolean;
  nombreArchivo: string;
  fechaSubida: string;
  tamanioBytes: number;
  subidoPor?: { nombres?: string; apellidos?: string } | null;
  observaciones?: Array<{
    comentario: string;
    pagina?: number | null;
    fecha?: string | null;
    usuario?: { nombres?: string; apellidos?: string } | null;
  }>;
};

export type ViewingDoc = {
  url: string;
  nombreOriginal: string;
  mimeType: string;
  expedienteId: number;
  docId: number;
};

export type VerMarcaData = {
  nombreDocumento: string;
  mimeType: string;
  xPercent: number;
  yPercent: number;
  pagina?: number | null;
  comentario: string;
};
