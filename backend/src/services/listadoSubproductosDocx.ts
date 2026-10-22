/** Lector del listado oficial de productos y subproductos (Word .docx).
 *  La tabla trae el servicio, luego el producto (P) y sus subproductos (SP). */

import { inflateRawSync } from 'zlib';

export const SUBPRODUCTO_COLUMNAS = {
  codigo: 'Código de subproducto',
  descripcion: 'Descripción',
  producto: 'Código de producto',
  servicio: 'Servicio',
  tipo: 'Tipo',
} as const;

export const SUBPRODUCTO_ENCABEZADOS: string[] = [
  SUBPRODUCTO_COLUMNAS.codigo,
  SUBPRODUCTO_COLUMNAS.descripcion,
  SUBPRODUCTO_COLUMNAS.producto,
  SUBPRODUCTO_COLUMNAS.servicio,
  SUBPRODUCTO_COLUMNAS.tipo,
];

export const SUBPRODUCTO_COLUMNAS_DESCRIPCION = [SUBPRODUCTO_COLUMNAS.descripcion];

export type SubproductoListado = {
  codigo: string;
  descripcion: string;
  producto: string;
  servicio: string;
  tipo: 'SP';
};

const CODIGO_PRODUCTO = /^\d{3}-\d{3}$/;
const CODIGO_SUBPRODUCTO = /^\d{3}-\d{3}-\d{4}$/;

const decodeXml = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

export const extraerDocumentoDocx = (buffer: Buffer): string => {
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.toString('utf8', nameStart, nameStart + nameLength);
    const dataStart = nameStart + nameLength + extraLength;
    if ((flags & 0x8) !== 0 && compressedSize === 0) {
      throw new Error('El Word no trae el tamaño de word/document.xml. Guárdelo de nuevo como .docx.');
    }
    if (name === 'word/document.xml') {
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return data.toString('utf8');
      if (method === 8) return inflateRawSync(data).toString('utf8');
      throw new Error('El Word usa una compresión no soportada.');
    }
    offset = dataStart + compressedSize;
  }
  throw new Error('El archivo no es un Word .docx del listado de subproductos.');
};

const textoCelda = (cellXml: string) => {
  const parts: string[] = [];
  const pattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cellXml))) parts.push(decodeXml(match[1]));
  return parts.join('').replace(/\s+/g, ' ').trim();
};

const filasDeTabla = (documentXml: string): string[][] => {
  const table = documentXml.split(/<w:tbl>/)[1]?.split('</w:tbl>')[0] ?? '';
  if (!table) return [];
  return table.split(/<w:tr[\s>]/).slice(1).map((row) =>
    row.split(/<w:tc[\s>]/).slice(1).map((cell) => textoCelda(cell.split('</w:tc>')[0]))
  );
};

const clasificar = (celdas: string[]) => {
  const limpias = celdas.map((celda) => celda.trim()).filter(Boolean);
  if (!limpias.length) return null;
  const tipo = limpias.find((celda) => celda === 'P' || celda === 'SP');
  const codigo = limpias.find((celda) => CODIGO_PRODUCTO.test(celda) || CODIGO_SUBPRODUCTO.test(celda));
  const descripcion = limpias.find((celda) => celda !== tipo && celda !== codigo) ?? '';
  if (!tipo && !codigo && limpias.length === 1) return { kind: 'servicio' as const, nombre: limpias[0] };
  if (tipo === 'P' && codigo && CODIGO_PRODUCTO.test(codigo)) {
    return { kind: 'P' as const, codigo, descripcion };
  }
  if (tipo === 'SP' && codigo && CODIGO_SUBPRODUCTO.test(codigo)) {
    return { kind: 'SP' as const, codigo, descripcion };
  }
  return null;
};

export const subproductoToDatos = (item: SubproductoListado): Record<string, string> => ({
  [SUBPRODUCTO_COLUMNAS.codigo]: item.codigo,
  [SUBPRODUCTO_COLUMNAS.descripcion]: item.descripcion,
  [SUBPRODUCTO_COLUMNAS.producto]: item.producto,
  [SUBPRODUCTO_COLUMNAS.servicio]: item.servicio,
  [SUBPRODUCTO_COLUMNAS.tipo]: item.tipo,
});

export function leerListadoSubproductosDocx(buffer: Buffer): SubproductoListado[] {
  const filas = filasDeTabla(extraerDocumentoDocx(buffer));
  let servicio = '';
  let producto = '';
  const porCodigo = new Map<string, SubproductoListado>();
  for (const fila of filas) {
    const item = clasificar(fila);
    if (!item) continue;
    if (item.kind === 'servicio') {
      servicio = item.nombre;
      continue;
    }
    if (item.kind === 'P') {
      producto = item.codigo;
      continue;
    }
    const productoDeCodigo = item.codigo.slice(0, 7);
    porCodigo.set(item.codigo, {
      codigo: item.codigo,
      descripcion: item.descripcion,
      producto: producto && item.codigo.startsWith(`${producto}-`) ? producto : productoDeCodigo,
      servicio,
      tipo: 'SP',
    });
  }
  return Array.from(porCodigo.values());
}
