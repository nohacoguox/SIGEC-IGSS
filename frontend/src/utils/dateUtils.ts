/**
 * Formatea una fecha (YYYY-MM-DD o ISO) a día-mes-año (DD-MM-YYYY).
 */
export function formatFechaDMA(fecha: string): string {
  if (!fecha || typeof fecha !== 'string') return '';
  const part = fecha.split('T')[0];
  const [y, m, d] = part.split('-');
  if (!d || !m || !y) return fecha;
  return `${d}-${m}-${y}`;
}
