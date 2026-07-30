/**
 * Paleta institucional IGSS (manual de identidad visual).
 * Azul, verde, gris y blanco — tonos sólidos, sin degradados difuminados.
 */
export const IGSS_COLORS = {
  azul: '#3B6B85',
  azulOscuro: '#325A72',
  azulClaro: '#4F8199',
  verde: '#6B8E38',
  verdeOscuro: '#5A7830',
  verdeClaro: '#7DA048',
  gris: '#D1D5D6',
  grisOscuro: '#B8BDBE',
  blanco: '#FFFFFF',
  textoOscuro: '#2C3E50',
  fondo: '#F5F7FA',
  fondoClaro: '#E8EDF2',
  error: '#C62828',
} as const;

export type IgssColorKey = keyof typeof IGSS_COLORS;
