/**
 * Catálogo de pantallas SIGEC-IGSS (espejo del backend).
 * Cada pestaña del menú corresponde a una pantalla = un permiso.
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

export const APP_SCREENS: AppScreenDefinition[] = [
  { key: 'gestionar-usuarios', permission: 'gestionar-usuarios', label: 'Usuarios', panel: 'admin', group: 'Gestiones', description: 'Gestión de usuarios del sistema' },
  { key: 'gestionar-roles', permission: 'gestionar-roles', label: 'Roles', panel: 'admin', group: 'Gestiones', description: 'Gestión de roles y permisos' },
  { key: 'gestionar-areas', permission: 'gestionar-areas', label: 'Áreas', panel: 'admin', group: 'Gestiones', description: 'Gestión de áreas institucionales' },
  { key: 'gestionar-puestos', permission: 'gestionar-puestos', label: 'Puestos', panel: 'admin', group: 'Gestiones', description: 'Gestión de puestos de trabajo' },
  { key: 'gestionar-unidades-medicas', permission: 'gestionar-unidades-medicas', label: 'Unidades Médicas', panel: 'admin', group: 'Gestiones', description: 'Gestión de unidades médicas' },
  { key: 'gestionar-correlativos', permission: 'gestionar-correlativos', label: 'Correlativos', panel: 'admin', group: 'Gestiones', description: 'Configurar secuencia de correlativos SIAF y ver reservas en uso' },
  { key: 'listado-siaf', permission: 'listado-siaf', label: 'Listado de SIAF', panel: 'colaborador', group: 'Libro SIAF', description: 'Consultar el listado de solicitudes SIAF' },
  { key: 'crear-siaf', permission: 'crear-siaf', label: 'Crear SIAF', panel: 'colaborador', group: 'Libro SIAF', description: 'Crear y corregir solicitudes SIAF' },
  { key: 'autorizar-siaf', permission: 'autorizar-siaf', label: 'Autorizar SIAF', panel: 'colaborador', description: 'Autorizar solicitudes SIAF pendientes' },
  { key: 'revisar-siaf-direccion-departamental', permission: 'revisar-siaf-direccion-departamental', label: 'Revisión Dirección Departamental', panel: 'colaborador', description: 'Revisión y aprobación final SIAF por Dirección Departamental' },
  { key: 'actualizar-codigos-productos', permission: 'actualizar-codigos-productos', label: 'Actualización de Códigos y Productos', panel: 'colaborador', description: 'Actualizar catálogo de códigos y productos (Excel)' },
  { key: 'estadisticas-tiempos', permission: 'estadisticas-tiempos', label: 'Tiempos SIAF', panel: 'colaborador', group: 'Estadísticas', description: 'Estadísticas de tiempos de revisión, autorización y corrección' },
  { key: 'estadisticas-motivos', permission: 'estadisticas-motivos', label: 'Motivos de rechazo', panel: 'colaborador', group: 'Estadísticas', description: 'Estadísticas de motivos de rechazo SIAF' },
  { key: 'crear-expediente', permission: 'crear-expediente', label: 'Creación de Expediente', panel: 'colaborador', description: 'Crear y administrar expedientes de compras' },
  { key: 'revisar-expediente-direccion-departamental', permission: 'revisar-expediente-direccion-departamental', label: 'Revisión Expedientes (DD)', panel: 'colaborador', description: 'Revisar, aprobar o rechazar expedientes en Dirección Departamental' },
];

/** Permisos legacy que otorgan acceso equivalente */
export const PERMISSION_ALIASES: Record<string, string[]> = {
  'listado-siaf': ['crear-siaf'],
  'estadisticas-tiempos': ['ver-estadisticas'],
  'estadisticas-motivos': ['ver-estadisticas'],
  'gestionar-unidades-medicas': ['gestionar-areas'],
};

export function hasScreenAccess(userPermissions: string[], permission: string): boolean {
  if (userPermissions.includes(permission)) return true;
  const aliases = PERMISSION_ALIASES[permission];
  return aliases?.some((a) => userPermissions.includes(a)) ?? false;
}

export function getScreensByPanel(panel: AppPanel): AppScreenDefinition[] {
  return APP_SCREENS.filter((s) => s.panel === panel);
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
  const screen = APP_SCREENS.find((s) => s.permission === permissionName);
  return screen?.label ?? permissionName;
}
