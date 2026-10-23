export const KORAX_COLUMNAS = {
  codigo: 'Código',
  tipo: 'Tipo',
  subtipo: 'Subtipo',
  nombre: 'Nombre del procedimiento',
} as const;

export const KORAX_ENCABEZADOS = [
  KORAX_COLUMNAS.codigo,
  KORAX_COLUMNAS.tipo,
  KORAX_COLUMNAS.subtipo,
  KORAX_COLUMNAS.nombre,
];

/** Lo que se copia al SIAF. El espacio final queda para el texto "correspondiente...". */
export const KORAX_COLUMNAS_DESCRIPCION = [
  KORAX_COLUMNAS.subtipo,
  KORAX_COLUMNAS.nombre,
];

export type RegistroKorax = {
  codigo: string;
  descripcion: string;
  datosOriginales: Record<string, string>;
};

const celda = (value: unknown) => String(value ?? '').trim();

const normalizar = (value: unknown) =>
  celda(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function descripcionKorax(datos: Record<string, string>, columnas = KORAX_COLUMNAS_DESCRIPCION): string {
  const parts = columnas.map((columna) => celda(datos[columna])).filter(Boolean);
  return parts.length ? `${parts.join(' ')} ` : '';
}

function indiceEncabezado(encabezados: string[], ...fragmentos: string[]) {
  return encabezados.findIndex((header) => fragmentos.every((fragmento) => header.includes(fragmento)));
}

export function leerListadoKoraxXlsx(buffer: Buffer): RegistroKorax[] {
  let XLSX: any;
  try {
    XLSX = require('xlsx');
    if (XLSX.default?.read) XLSX = XLSX.default;
  } catch {
    throw new Error('No se pudo cargar el paquete xlsx. Ejecute en backend: npm install xlsx');
  }
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const nombreHoja = (workbook.SheetNames || []).find((nombre: string) => normalizar(nombre) === 'catalogo')
    || workbook.SheetNames?.[0];
  const sheet = nombreHoja ? workbook.Sheets[nombreHoja] : null;
  if (!sheet) throw new Error('El Excel de KORAX no tiene hojas.');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
  let headerIndex = -1;
  const limite = Math.min(rows.length, 30);
  for (let i = 0; i < limite; i++) {
    const encabezados = (rows[i] || []).map(normalizar);
    if (encabezados.some((header) => header.includes('codigo')) && encabezados.some((header) => header.includes('subtipo'))) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) throw new Error('No se encontró la hoja de catálogo KORAX con Código, Tipo, Subtipo y Nombre.');

  const encabezados = (rows[headerIndex] || []).map(normalizar);
  const codigoIdx = indiceEncabezado(encabezados, 'codigo');
  const tipoIdx = encabezados.findIndex((header) => header.includes('tipo') && !header.includes('sub'));
  const subtipoIdx = indiceEncabezado(encabezados, 'subtipo');
  const nombreIdx = encabezados.findIndex((header) => header.includes('nombre'));
  if (codigoIdx < 0 || subtipoIdx < 0 || nombreIdx < 0) {
    throw new Error('El Excel de KORAX no trae las columnas Código, Subtipo y Nombre.');
  }

  const map = new Map<string, RegistroKorax>();
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const codigo = celda(row[codigoIdx]);
    if (!codigo) continue;
    const datosOriginales: Record<string, string> = {
      [KORAX_COLUMNAS.codigo]: codigo,
      [KORAX_COLUMNAS.tipo]: tipoIdx >= 0 ? celda(row[tipoIdx]) : '',
      [KORAX_COLUMNAS.subtipo]: celda(row[subtipoIdx]),
      [KORAX_COLUMNAS.nombre]: celda(row[nombreIdx]),
    };
    map.set(codigo, {
      codigo,
      descripcion: descripcionKorax(datosOriginales),
      datosOriginales,
    });
  }
  const registros = Array.from(map.values());
  if (registros.length < 100) {
    throw new Error('El Excel no tiene el listado KORAX completo. No se modificó el catálogo.');
  }
  return registros;
}
