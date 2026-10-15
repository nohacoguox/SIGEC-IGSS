/**
 * Catálogo de pantallas del sistema SIGEC-IGSS.
 * FUENTE DE VERDAD del contrato de pantallas/permisos.
 * El frontend consume GET /api/app-screens/catalog (y /app-screens para IDs).
 * Al agregar una pantalla nueva, añádala aquí y ejecute npm run seed-roles;
 * luego alinee el FALLBACK del frontend si hace falta.
 */
export type AppPanel = 'admin' | 'colaborador';

export interface AppScreenDefinition {
  /** Identificador único de la pantalla */
  key: string;
  /** Nombre del permiso en BD (slug) */
  permission: string;
  /** Etiqueta visible en UI */
  label: string;
  panel: AppPanel;
  /** Grupo en el menú lateral */
  group?: string;
  description: string;
}

export const APP_SCREENS: AppScreenDefinition[] = [
  // —— Panel administración ——
  {
    key: 'gestionar-usuarios',
    permission: 'gestionar-usuarios',
    label: 'Usuarios',
    panel: 'admin',
    group: 'Gestiones',
    description: 'Gestión de usuarios del sistema',
  },
  {
    key: 'gestionar-roles',
    permission: 'gestionar-roles',
    label: 'Roles',
    panel: 'admin',
    group: 'Gestiones',
    description: 'Gestión de roles y permisos',
  },
  {
    key: 'gestionar-areas',
    permission: 'gestionar-areas',
    label: 'Áreas',
    panel: 'admin',
    group: 'Gestiones',
    description: 'Gestión de áreas institucionales',
  },
  {
    key: 'gestionar-puestos',
    permission: 'gestionar-puestos',
    label: 'Puestos',
    panel: 'admin',
    group: 'Gestiones',
    description: 'Gestión de puestos de trabajo',
  },
  {
    key: 'gestionar-unidades-medicas',
    permission: 'gestionar-unidades-medicas',
    label: 'Unidades Médicas',
    panel: 'admin',
    group: 'Gestiones',
    description: 'Gestión de unidades médicas',
  },
  {
    key: 'gestionar-correlativos',
    permission: 'gestionar-correlativos',
    label: 'Correlativos',
    panel: 'admin',
    group: 'Gestiones',
    description: 'Configurar secuencia de correlativos SIAF y ver reservas en uso',
  },
  // —— Panel colaborador ——
  {
    key: 'listado-siaf',
    permission: 'listado-siaf',
    label: 'Listado de SIAF',
    panel: 'colaborador',
    group: 'Libro SIAF',
    description: 'Consultar el listado de solicitudes SIAF',
  },
  {
    key: 'crear-siaf',
    permission: 'crear-siaf',
    label: 'Crear SIAF',
    panel: 'colaborador',
    group: 'Libro SIAF',
    description: 'Crear y corregir solicitudes SIAF',
  },
  {
    key: 'listado-siaf-unidad-finalizados',
    permission: 'listado-siaf-unidad-finalizados',
    label: 'SIAF de mi unidad',
    panel: 'colaborador',
    group: 'Libro SIAF',
    description:
      'Director / Administrador de unidad: consulta en solo lectura los SIAF de su unidad en En revisión, Rechazado o Finalizado (sin borradores)',
  },
  {
    key: 'revisar-siaf-direccion-departamental',
    permission: 'revisar-siaf-direccion-departamental',
    label: 'Bandeja de Revisiones DAF — SIAF',
    panel: 'colaborador',
    group: 'Bandeja de Revisiones DAF',
    description: 'Revisión y aprobación de SIAF por el analista DAF',
  },
  {
    key: 'actualizar-codigos-productos',
    permission: 'actualizar-codigos-productos',
    label: 'Actualización de Códigos y Productos',
    panel: 'colaborador',
    description: 'Actualizar catálogo de códigos y productos (Excel)',
  },
  {
    key: 'estadisticas-tiempos',
    permission: 'estadisticas-tiempos',
    label: 'Mis estadísticas',
    panel: 'colaborador',
    group: 'Estadísticas',
    description:
      'Colaborador común: abre Análisis SIAF y Análisis de expedientes solo con sus propios trámites',
  },
  {
    key: 'ver-estadisticas-unidad',
    permission: 'ver-estadisticas-unidad',
    label: 'Estadísticas de mi unidad',
    panel: 'colaborador',
    group: 'Estadísticas',
    description:
      'Jefe / Administrador C: mismo análisis, limitado a la unidad médica del usuario (no ve otras unidades)',
  },
  {
    key: 'estadisticas-analista-daf',
    permission: 'estadisticas-analista-daf',
    label: 'Mis tiempos DAF',
    panel: 'colaborador',
    group: 'Estadísticas',
    description:
      'Analista DAF: tiempos de revisión propios (SIAF y expedientes), con clasificación por unidad médica de Escuintla',
  },
  {
    key: 'crear-expediente',
    permission: 'crear-expediente',
    label: 'Expedientes de Compras',
    panel: 'colaborador',
    group: 'Expedientes',
    description: 'Crear y administrar expedientes de compras',
  },
  {
    key: 'listado-expedientes-unidad',
    permission: 'listado-expedientes-unidad',
    label: 'Expedientes de mi unidad',
    panel: 'colaborador',
    group: 'Expedientes',
    description:
      'Director / Administrador de unidad: consulta en solo lectura los expedientes de su unidad en En revisión, Rechazado o Cerrado (sin abiertos/borradores)',
  },
  {
    key: 'revisar-expediente-direccion-departamental',
    permission: 'revisar-expediente-direccion-departamental',
    label: 'Bandeja de Revisiones DAF — Expedientes',
    panel: 'colaborador',
    group: 'Bandeja de Revisiones DAF',
    description: 'Revisar, aprobar o rechazar expedientes como analista DAF',
  },
];

/**
 * Permisos legacy → pantallas actuales.
 * ver-estadisticas y estadisticas-motivos solo equivalen a "Mis estadísticas" (personal),
 * nunca a vista de unidad.
 */
export const PERMISSION_ALIASES: Record<string, string[]> = {
  'listado-siaf': ['crear-siaf'],
  'estadisticas-tiempos': ['ver-estadisticas', 'estadisticas-motivos'],
  'gestionar-unidades-medicas': ['gestionar-areas'],
};

export function getScreenByKey(key: string): AppScreenDefinition | undefined {
  return APP_SCREENS.find((s) => s.key === key);
}

export function getScreenByPermission(permission: string): AppScreenDefinition | undefined {
  return APP_SCREENS.find((s) => s.permission === permission);
}
