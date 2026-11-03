/** Nombre en Forma A-01: unidad, luego espacio, "/", espacio y el área. */
export function formatNombreUnidadConArea(
  nombreUnidad?: string | null,
  area?: string | null,
): string {
  const nombre = String(nombreUnidad || '').trim();
  const areaNombre = String(area || '').trim();
  if (!areaNombre || areaNombre.toUpperCase() === 'N/A') return nombre;
  if (!nombre) return areaNombre;
  const sufijo = ` / ${areaNombre}`;
  if (
    nombre.toLowerCase().endsWith(sufijo.toLowerCase()) ||
    nombre.toLowerCase().endsWith(`/${areaNombre.toLowerCase()}`)
  ) {
    return nombre;
  }
  return `${nombre}${sufijo}`;
}
