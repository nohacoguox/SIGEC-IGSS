/** Compara unidad médica aunque el texto no sea idéntico (con/sin código, etc.). */
export function mismaUnidadMedica(a?: string | null, b?: string | null): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  const stripCodigo = (s: string) => s.replace(/^\d+\s*,\s*/, '').trim();
  const na = norm(String(a || ''));
  const nb = norm(String(b || ''));
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const sa = stripCodigo(na);
  const sb = stripCodigo(nb);
  if (!sa || !sb) return false;
  return sa === sb || sa.includes(sb) || sb.includes(sa);
}

/** Estados visibles para Director/Administrador de unidad (sin borrador/abierto). */
export const ESTADOS_EXPEDIENTE_UNIDAD = ['en_proceso', 'rechazado', 'cerrado', 'aprobado', 'archivado'];
