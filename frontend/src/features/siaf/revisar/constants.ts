export const MOTIVOS_RECHAZO_OPTS = [
  { valor: 'falta_documento', etiqueta: 'Falta documento' },
  { valor: 'ortografia', etiqueta: 'Ortografía / redacción' },
  { valor: 'mal_explicado', etiqueta: 'Mal explicado / poco claro' },
  { valor: 'datos_incorrectos', etiqueta: 'Datos incorrectos o inconsistentes' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export function etiquetaMotivo(valor: string): string {
  return MOTIVOS_RECHAZO_OPTS.find((m) => m.valor === valor)?.etiqueta || valor || 'Otro';
}
