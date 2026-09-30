import { PDFDocument } from 'pdf-lib';

/**
 * Extrae un rango inclusivo de páginas (1-based) de un PDF.
 */
export async function extractPdfPageRange(
  sourcePdf: Buffer,
  paginaInicio: number,
  paginaFin: number
): Promise<Buffer> {
  const src = await PDFDocument.load(sourcePdf, { ignoreEncryption: true });
  const total = src.getPageCount();
  if (total < 1) throw new Error('El PDF de origen no tiene páginas.');

  const inicio = Math.max(1, Math.min(paginaInicio, total));
  const fin = Math.max(inicio, Math.min(paginaFin, total));

  const out = await PDFDocument.create();
  const indices = Array.from({ length: fin - inicio + 1 }, (_, i) => inicio - 1 + i);
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  return Buffer.from(bytes);
}

export async function getPdfPageCount(sourcePdf: Buffer): Promise<number> {
  const src = await PDFDocument.load(sourcePdf, { ignoreEncryption: true });
  return src.getPageCount();
}
