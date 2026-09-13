/**
 * Tipos y helpers de pantallas SIGEC-IGSS.
 *
 * FUENTE DE VERDAD: backend/src/config/appScreens.ts
 * El frontend carga el catálogo desde GET /api/app-screens/catalog.
 * FALLBACK_* solo se usa si no hay sesión o falla la API (arranque / offline).
 * No agregue pantallas nuevas aquí primero: hágalo en el backend y vuelva a
 * sincronizar el fallback si hace falta.
 */
export type AppPanel = 'admin' | 'colaborador';

export interface AppScreenDefinition {
  key: string;
  permission: string;
  label: string;
  panel: AppPanel;
  group?: string;
  description: string;
}

/** Espejo de emergencia del backend; preferir siempre el catálogo de la API. */
export const FALLBACK_APP_SCREENS: AppScreenDefinition[] = [
  { key: 'gestionar-usuarios', permission: 'gestionar-usuarios', label: 'Usuarios', panel: 'admin', group: 'Gestiones', description: 'Gestión de usuarios del sistema' },
  { key: 'gestionar-roles', permission: 'gestionar-roles', label: 'Roles', panel: 'admin', group: 'Gestiones', description: 'Gestión de roles y permisos' },
  { key: 'gestionar-areas', permission: 'gestionar-areas', label: 'Áreas', panel: 'admin', group: 'Gestiones', description: 'Gestión de áreas institucionales' },
  { key: 'gestionar-puestos', permission: 'gestionar-puestos', label: 'Puestos', panel: 'admin', group: 'Gestiones', description: 'Gestión de puestos de trabajo' },
  { key: 'gestionar-unidades-medicas', permission: 'gestionar-unidades-medicas', label: 'Unidades Médicas', panel: 'admin', group: 'Gestiones', description: 'Gestión de unidades médicas' },
  { key: 'gestionar-correlativos', permission: 'gestionar-correlativos', label: 'Correlativos', panel: 'admin', group: 'Gestiones', description: 'Configurar secuencia de correlativos SIAF y ver reservas en uso' },
  { key: 'listado-siaf', permission: 'listado-siaf', label: 'Listado de SIAF', panel: 'colaborador', group: 'Libro SIAF', description: 'Consultar el listado de solicitudes SIAF' },
  { key: 'crear-siaf', permission: 'crear-siaf', label: 'Crear SIAF', panel: 'colaborador', group: 'Libro SIAF', description: 'Crear y corregir solicitudes SIAF' },
  { key: 'autorizar-siaf', permission: 'autorizar-siaf', label: 'Autorizar SIAF', panel: 'colaborador', description: 'Autorizar solicitudes SIAF pendientes' },
  { key: 'revisar-siaf-direccion-departamental', permission: 'revisar-siaf-direccion-departamental', label: 'Bandeja de Revisiones DAF — SIAF', panel: 'colaborador', group: 'Bandeja de Revisiones DAF', description: 'Revisión y aprobación de SIAF por el analista DAF' },
  { key: 'actualizar-codigos-productos', permission: 'actualizar-codigos-productos', label: 'Actualización de Códigos y Productos', panel: 'colaborador', description: 'Actualizar catálogo de códigos y productos (Excel)' },
  { key: 'estadisticas-tiempos', permission: 'estadisticas-tiempos', label: 'Análisis SIAF', panel: 'colaborador', group: 'Estadísticas', description: 'Análisis SIAF: cierre mensual, trazabilidad y motivos de rechazo' },
  { key: 'ver-estadisticas-unidad', permission: 'ver-estadisticas-unidad', label: 'Estadísticas de mi unidad', panel: 'colaborador', group: 'Estadísticas', description: 'Directores y jefes: actividad de toda la unidad y filtro por colaborador' },
  { key: 'crear-expediente', permission: 'crear-expediente', label: 'Expedientes de Compras', panel: 'colaborador', description: 'Crear y administrar expedientes de compras' },
  { key: 'revisar-expediente-direccion-departamental', permission: 'revisar-expediente-direccion-departamental', label: 'Bandeja de Revisiones DAF — Expedientes', panel: 'colaborador', group: 'Bandeja de Revisiones DAF', description: 'Revisar, aprobar o rechazar expedientes como analista DAF' },
];

/** @deprecated Usar FALLBACK_APP_SCREENS o useAppScreens().screens */
export const APP_SCREENS = FALLBACK_APP_SCREENS;

export const FALLBACK_PERMISSION_ALIASES: Record<string, string[]> = {
  'listado-siaf': ['crear-siaf'],
  'estadisticas-tiempos': ['ver-estadisticas'],
  'estadisticas-motivos': ['ver-estadisticas'],
  'gestionar-unidades-medicas': ['gestionar-areas'],
};

/** @deprecated Usar FALLBACK_PERMISSION_ALIASES o aliases del catálogo API */
export const PERMISSION_ALIASES = FALLBACK_PERMISSION_ALIASES;

let runtimeScreens: AppScreenDefinition[] = FALLBACK_APP_SCREENS;
let runtimeAliases: Record<string, string[]> = { ...FALLBACK_PERMISSION_ALIASES };

export function setAppScreensCatalog(
  screens: AppScreenDefinition[],
  aliases?: Record<string, string[]>
): void {
  runtimeScreens = screens?.length ? screens : FALLBACK_APP_SCREENS;
  if (aliases) runtimeAliases = aliases;
}

export function getAppScreensCatalog(): AppScreenDefinition[] {
  return runtimeScreens;
}

export function hasScreenAccess(userPermissions: string[], permission: string): boolean {
  if (userPermissions.includes(permission)) return true;
  const aliases = runtimeAliases[permission];
  return aliases?.some((a) => userPermissions.includes(a)) ?? false;
}

export function getScreensByPanel(panel: AppPanel): AppScreenDefinition[] {
  return runtimeScreens.filter((s) => s.panel === panel);
}

export function groupScreensByGroup(screens: AppScreenDefinition[]): Record<string, AppScreenDefinition[]> {
  return screens.reduce<Record<string, AppScreenDefinition[]>>((acc, screen) => {
    const group = screen.group ?? 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(screen);
    return acc;
  }, {});
}

export function getScreenLabelForPermission(permissionName: string): string {
  const screen = runtimeScreens.find((s) => s.permission === permissionName);
  return screen?.label ?? permissionName;
}
