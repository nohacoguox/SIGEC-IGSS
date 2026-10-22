/** Lector del Listado Básico de Medicamentos (Farmacoterapia / IGSS).
 *  El PDF repite el encabezado en cada hoja. Las columnas quedan en rangos
 *  de X estables; un renglón de medicamento se reconoce por el nivel romano
 *  y el código numérico. */

export const SIBOFA_COLUMNAS = {
  nivel: 'Nivel',
  codigo: 'Código',
  nombre: 'Nombre Genérico (DCI)',
  forma: 'Forma, concentración y presentación',
  via: 'Vía de administración',
  unidades: 'Unidades de despacho',
  comentarios: 'Comentarios',
} as const;

export const SIBOFA_ENCABEZADOS: string[] = [
  SIBOFA_COLUMNAS.nivel,
  SIBOFA_COLUMNAS.codigo,
  SIBOFA_COLUMNAS.nombre,
  SIBOFA_COLUMNAS.forma,
  SIBOFA_COLUMNAS.via,
  SIBOFA_COLUMNAS.unidades,
  SIBOFA_COLUMNAS.comentarios,
];

export const SIBOFA_COLUMNAS_DESCRIPCION = [
  SIBOFA_COLUMNAS.nombre,
  SIBOFA_COLUMNAS.forma,
];

export type MedicamentoListado = {
  nivel: string;
  codigo: string;
  nombre: string;
  forma: string;
  via: string;
  unidades: string;
  comentarios: string;
};

type PdfItem = { str: string; x: number; y: number };

const ROMAN = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/;
const CODIGO = /^\d{2,10}$/;

const COL = {
  nivel: [0, 78],
  codigo: [78, 118],
  nombre: [118, 250],
  forma: [250, 468],
  via: [468, 552],
  unidades: [552, 605],
  comentarios: [605, 2000],
} as const;

const columnText = (items: PdfItem[], x0: number, x1: number) =>
  items
    .filter((item) => item.x >= x0 && item.x < x1)
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((item) => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const isHeaderOrFooter = (items: PdfItem[]) => {
  if (items.some((item) => item.y >= 476)) return true;
  const text = items.map((item) => item.str).join(' ');
  return /Listado Básico|Departamento de Farmacoterapia|Subgerencia de Prestaciones|Página\s+\d+/i.test(text);
};

const isSection = (items: PdfItem[]) => {
  const left = columnText(items, 0, 118);
  if (/^\d+(\.\d+)*\s+\S/.test(left)) return true;
  const hasCode = CODIGO.test(columnText(items, COL.codigo[0], COL.codigo[1]));
  const hasRoman = ROMAN.test(columnText(items, COL.nivel[0], COL.nivel[1]));
  const startsLeft = items.some((item) => item.x < 80);
  return startsLeft && !hasCode && !hasRoman && items.every((item) => item.x < 400);
};

const isAnchor = (items: PdfItem[]) =>
  ROMAN.test(columnText(items, COL.nivel[0], COL.nivel[1])) &&
  CODIGO.test(columnText(items, COL.codigo[0], COL.codigo[1]));

const clusterLines = (items: PdfItem[]) => {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfItem[][] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    const lastY = last?.[0]?.y ?? 0;
    if (last && Math.abs(lastY - item.y) <= 1.6) last.push(item);
    else lines.push([item]);
  }
  return lines.map((line) => {
    const unique: PdfItem[] = [];
    for (const item of line) {
      const dup = unique.some(
        (other) => other.str === item.str && Math.abs(other.x - item.x) < 2
      );
      if (!dup) unique.push(item);
    }
    return unique;
  });
};

const recordFromBand = (band: PdfItem[][]): MedicamentoListado => {
  const items = band.flat();
  return {
    nivel: columnText(items, COL.nivel[0], COL.nivel[1]),
    codigo: columnText(items, COL.codigo[0], COL.codigo[1]),
    nombre: columnText(items, COL.nombre[0], COL.nombre[1]),
    forma: columnText(items, COL.forma[0], COL.forma[1]),
    via: columnText(items, COL.via[0], COL.via[1]),
    unidades: columnText(items, COL.unidades[0], COL.unidades[1]),
    comentarios: columnText(items, COL.comentarios[0], COL.comentarios[1]),
  };
};

const recordsOnPage = (items: PdfItem[]) => {
  const lines = clusterLines(items).filter((line) => !isHeaderOrFooter(line) && !isSection(line));
  const anchorIndexes = lines
    .map((line, index) => (isAnchor(line) ? index : -1))
    .filter((index) => index >= 0);
  const groups = anchorIndexes.map(() => [] as number[]);
  const assigned = new Set<number>();
  anchorIndexes.forEach((lineIndex, position) => {
    const anchorY = lines[lineIndex][0].y;
    const nextIndex = anchorIndexes[position + 1];
    const nextY = nextIndex === undefined ? -100 : lines[nextIndex][0].y;
    const yTop = anchorY + 12;
    const yBottom = nextY + 8;
    lines.forEach((line, index) => {
      if (index !== lineIndex && anchorIndexes.includes(index)) return;
      if (assigned.has(index)) return;
      const y = line[0].y;
      if (y <= yTop && y > yBottom) {
        groups[position].push(index);
        assigned.add(index);
      }
    });
  });
  let grew = true;
  while (grew) {
    grew = false;
    lines.forEach((line, index) => {
      if (assigned.has(index)) return;
      const hasCode = line.some(
        (item) => item.x >= COL.codigo[0] && item.x < COL.codigo[1] && CODIGO.test(item.str)
      );
      if (hasCode) return;
      const y = line[0].y;
      let bestPosition = -1;
      let bestGap = 13;
      groups.forEach((group, position) => {
        const maxY = Math.max(...group.map((itemIndex) => lines[itemIndex][0].y));
        const gapAbove = y - maxY;
        if (gapAbove > 0 && gapAbove < bestGap) {
          bestGap = gapAbove;
          bestPosition = position;
        }
      });
      if (bestPosition >= 0) {
        groups[bestPosition].push(index);
        assigned.add(index);
        grew = true;
      }
    });
  }
  return groups
    .map((group) => recordFromBand(group.map((index) => lines[index])))
    .filter((record) => CODIGO.test(record.codigo));
};

export const medicamentoToDatos = (item: MedicamentoListado): Record<string, string> => ({
  [SIBOFA_COLUMNAS.nivel]: item.nivel,
  [SIBOFA_COLUMNAS.codigo]: item.codigo,
  [SIBOFA_COLUMNAS.nombre]: item.nombre,
  [SIBOFA_COLUMNAS.forma]: item.forma,
  [SIBOFA_COLUMNAS.via]: item.via,
  [SIBOFA_COLUMNAS.unidades]: item.unidades,
  [SIBOFA_COLUMNAS.comentarios]: item.comentarios,
});

// tsc con module commonjs convierte import() en require(). pdf.mjs es ESM y
// Node rechaza ese require. new Function conserva el import() dinámico.
const importarEsm = new Function('especificador', 'return import(especificador)') as (
  especificador: string
) => Promise<any>;

export async function leerListadoMedicamentosPdf(buffer: Buffer): Promise<MedicamentoListado[]> {
  const pdfjs = await importarEsm('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
  const doc = await pdfjs
    .getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      useSystemFonts: true,
    } as any)
    .promise;
  const byCode = new Map<string, MedicamentoListado>();
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const raw of content.items as Array<{ str?: string; transform?: number[]; width?: number }>) {
      const str = String(raw.str ?? '').trim();
      if (!str || !raw.transform) continue;
      items.push({ str, x: raw.transform[4], y: raw.transform[5] });
    }
    for (const record of recordsOnPage(items)) {
      byCode.set(record.codigo, record);
    }
  }
  return Array.from(byCode.values());
}
