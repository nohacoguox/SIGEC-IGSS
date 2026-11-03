/** Fecha de hoy en zona horaria local, formato YYYY-MM-DD (toISOString usaría UTC). */
export function fechaLocalHoy(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

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
