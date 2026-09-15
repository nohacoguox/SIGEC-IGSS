export type ItemTipo = 'bien' | 'servicio';
export type CatalogoOrigen = 'MINFIN' | 'SIBOFA';

export type CatalogoSugerencia = {
  codigo: string;
  descripcion: string;
  origen: CatalogoOrigen;
};

export interface Item {
  codigo: string;
  descripcion: string;
  cantidad: number;
  tipo: ItemTipo;
  catalogoOrigen: CatalogoOrigen | '';
}

export interface Subproducto {
  codigo: string;
  cantidad: number;
  descripcion?: string;
}

export interface Area {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export type UnidadMedicaCatalogo = {
  id: number;
  nombre: string;
  codigo?: string | null;
  direccion?: string | null;
  departamento?: string | null;
  municipio?: { nombre?: string; departamento?: { nombre?: string } | null } | null;
};

export type OrtografiaSugerencia = {
  original: string;
  replacement: string;
  options: string[];
  message: string;
  offset: number;
  length: number;
};

export type BitacoraEntry = {
  id: number;
  tipo: string;
  comentario: string | null;
  fecha: string;
  usuario?: { nombres?: string; apellidos?: string };
  detalleAntes?: string | null;
  detalleDespues?: string | null;
};

export type ViewingDoc = {
  id: number;
  nombreOriginal: string;
  mimeType?: string;
  url?: string;
};

export type AdjuntoRow = {
  id: number;
  nombreOriginal: string;
  tamanioBytes: number;
  mimeType?: string;
};

export type SiafFormData = {
  fecha: string;
  correlativo: string;
  nombreUnidad: string;
  direccion: string;
  justificacion: string;
  items: Item[];
  subproductos: Subproducto[];
  totalSubproductoCantidad: number;
  nombreSolicitante: string;
  puestoSolicitante: string;
  unidadSolicitante: string;
  nombreAutoridad: string;
  puestoAutoridad: string;
  unidadAutoridad: string;
  areaUnidad: string;
  consistentItem?: string;
};

export type ValidationFormState = {
  id?: string;
  reservaId: number | null;
  fecha: string;
  correlativo: string;
  nombreUnidad: string;
  areaUnidad: string;
  direccion: string;
  justificacion: string;
  items: Item[];
  subproductos: Subproducto[];
  catalogoSeleccionado: CatalogoOrigen | '';
  nombreSolicitante: string;
  puestoSolicitante: string;
  unidadSolicitante: string;
  nombreAutoridad: string;
  puestoAutoridad: string;
  unidadAutoridad: string;
  directorAusente: boolean;
  usuarioEncargadoId: number | null;
  showConsistentField: boolean;
  consistentItem: string;
};
