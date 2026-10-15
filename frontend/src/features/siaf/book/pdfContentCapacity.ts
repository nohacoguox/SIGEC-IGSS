/**
 * Estimación de capacidad del bloque de ítems del PDF SIAF
 * (hasta la línea que separa de subproductos — el “tope” visual).
 * Debe mantenerse alineada con SiafPdfDocument / PdfGeneratorService.
 */
export const SIAF_PDF_CONTENT_BLOCK_HEIGHT = 292;
/** paddingTop + paddingBottom del bloque de contenido */
export const SIAF_PDF_CONTENT_PADDING = 4;
export const SIAF_PDF_ROW_GAP = 5;
/** Altura mínima de una línea (FONT_TABLE 9 + 2) */
export const SIAF_PDF_LINE_HEIGHT = 11;
/** Caracteres por línea en columna Descripción (~65% del ancho útil), conservador */
export const SIAF_PDF_CHARS_PER_LINE = 72;

export function estimateTextHeight(text: string): number {
  const raw = String(text ?? '');
  if (!raw.trim()) return SIAF_PDF_LINE_HEIGHT;
  const paragraphs = raw.split(/\r?\n/);
  let lines = 0;
  for (const p of paragraphs) {
    lines += Math.max(1, Math.ceil(Math.max(p.length, 1) / SIAF_PDF_CHARS_PER_LINE));
  }
  return Math.max(SIAF_PDF_LINE_HEIGHT, lines * SIAF_PDF_LINE_HEIGHT);
}

export function estimateItemRowHeight(descripcion: string): number {
  return estimateTextHeight(descripcion || ' ') + SIAF_PDF_ROW_GAP;
}

export function estimateConsistenteRowHeight(consistente: string): number {
  return estimateTextHeight(`Consiste en: ${consistente || ''}`) + SIAF_PDF_ROW_GAP;
}

export function getPdfItemsCapacity(params: {
  items: { descripcion?: string }[];
  showConsistentField?: boolean;
  consistentItem?: string;
}): { used: number; usable: number; remaining: number; isOverflow: boolean } {
  const usable = SIAF_PDF_CONTENT_BLOCK_HEIGHT - SIAF_PDF_CONTENT_PADDING;
  let used = 0;
  for (const item of params.items) {
    used += estimateItemRowHeight(item.descripcion || '');
  }
  if (params.showConsistentField) {
    used += estimateConsistenteRowHeight(params.consistentItem || '');
  }
  return {
    used,
    usable,
    remaining: usable - used,
    isOverflow: used > usable,
  };
}

/** ¿Cabe una fila vacía adicional (una línea de descripción)? */
export function canAddItemRow(params: {
  items: { descripcion?: string }[];
  showConsistentField?: boolean;
  consistentItem?: string;
}): boolean {
  const { remaining } = getPdfItemsCapacity(params);
  return remaining >= estimateItemRowHeight('');
}

/** ¿Cabe la fila "Consiste en: …"? */
export function canAddConsistente(params: {
  items: { descripcion?: string }[];
  consistentItem?: string;
}): boolean {
  const { remaining } = getPdfItemsCapacity({
    items: params.items,
    showConsistentField: false,
  });
  return remaining >= estimateConsistenteRowHeight(params.consistentItem || '');
}

/** ¿Cabe actualizar la descripción de la fila `index` sin pasar el tope? */
export function canFitItemDescription(
  items: { descripcion?: string }[],
  index: number,
  newDescripcion: string,
  showConsistentField?: boolean,
  consistentItem?: string,
): boolean {
  const projected = items.map((item, i) =>
    i === index ? { ...item, descripcion: newDescripcion } : item,
  );
  return !getPdfItemsCapacity({
    items: projected,
    showConsistentField,
    consistentItem,
  }).isOverflow;
}

export const PDF_ITEMS_FULL_MESSAGE =
  'No hay espacio suficiente en el área de bienes/servicios del PDF (llegó al tope antes de subproductos). Elimine o acorte alguna fila para continuar.';

export const PDF_CONSISTENTE_FULL_MESSAGE =
  'No hay espacio suficiente en el PDF para agregar el Consistente. Elimine o acorte alguna fila de bienes/servicios.';
