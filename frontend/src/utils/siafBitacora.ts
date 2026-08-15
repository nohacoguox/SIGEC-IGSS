/** Utilidades de bitácora SIAF: comentarios legibles y marcas en PDF. */

export type SiafMarcaBitacora = {
  id: string;
  categoria: string;
  descripcion: string;
  pagina: number;
  xPercent: number;
  yPercent: number;
};

const RE_MARCA_COORDS = /\s*\[marca pág\.\s*\d+\s*@\s*[\d.]+%\s*,\s*[\d.]+%\]/gi;

/** Quita coordenadas técnicas del texto de bitácora y formatea motivos en líneas. */
export function limpiarComentarioBitacora(comentario: string | null | undefined): string {
  if (!comentario) return '—';
  let t = String(comentario).replace(RE_MARCA_COORDS, '').trim();
  // Separar motivos unidos por " | " en líneas más legibles
  if (t.includes(' | ')) {
    t = t.replace(/\s*\|\s*/g, '\n');
  }
  return t || '—';
}

export function parseMarcadoresBitacora(detalleAntes?: string | null): SiafMarcaBitacora[] {
  if (!detalleAntes || !String(detalleAntes).trim().startsWith('{')) return [];
  try {
    const parsed = JSON.parse(detalleAntes);
    const arr = Array.isArray(parsed?.marcadores) ? parsed.marcadores : [];
    return arr
      .filter((m: any) => m && (m.xPercent != null || m.yPercent != null))
      .map((m: any, idx: number) => ({
        id: `hist-${idx}-${m.pagina ?? 1}-${m.xPercent}-${m.yPercent}`,
        categoria: typeof m.categoria === 'string' ? m.categoria : 'otro',
        descripcion: String(m.descripcion ?? ''),
        pagina: Number(m.pagina) || 1,
        xPercent: Number(m.xPercent) || 0,
        yPercent: Number(m.yPercent) || 0,
      }));
  } catch {
    return [];
  }
}

export function esDetalleMarcadoresJson(detalleAntes?: string | null): boolean {
  return !!detalleAntes && String(detalleAntes).trim().startsWith('{') && parseMarcadoresBitacora(detalleAntes).length >= 0
    && String(detalleAntes).includes('marcadores');
}
