import type { AnalyticsFilter } from './AnalyticsFilterPanel';

const fechaLocal = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const rangoDesdeDias = (dias: number) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fechaLocal(fecha);
};

export const fechaHoy = () => fechaLocal(new Date());

export type AnalyticsRoleMode = 'personal' | 'unidad' | 'ambos' | 'super';

/**
 * Quién ve qué según permisos (sin adivinar en la UI):
 * - solo Mis estadísticas → personal fijo
 * - solo Estadísticas de mi unidad → unidad fija
 * - ambos → puede cambiar; por defecto unidad
 * - super admin → elige unidad
 */
export function resolveAnalyticsRoleMode(opts: {
  isSuperAdmin: boolean;
  hasMisEstadisticas: boolean;
  hasUnidad: boolean;
}): AnalyticsRoleMode {
  if (opts.isSuperAdmin) return 'super';
  if (opts.hasUnidad && opts.hasMisEstadisticas) return 'ambos';
  if (opts.hasUnidad) return 'unidad';
  return 'personal';
}

export function defaultAlcance(mode: AnalyticsRoleMode): 'personal' | 'unidad' {
  if (mode === 'personal') return 'personal';
  return 'unidad';
}

export function createDefaultAnalyticsFilter(mode: AnalyticsRoleMode): AnalyticsFilter {
  const dias = 90;
  return {
    dias,
    desde: rangoDesdeDias(dias),
    hasta: fechaHoy(),
    agrupacion: 'mes',
    alcance: defaultAlcance(mode),
  };
}

export function etiquetaModo(mode: AnalyticsRoleMode, alcance: 'personal' | 'unidad'): string {
  if (mode === 'super') return alcance === 'unidad' ? 'Super admin · unidad' : 'Super admin · personal';
  if (alcance === 'unidad') return 'Estadísticas de mi unidad';
  return 'Mis estadísticas';
}
