import { In } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { User } from '../../entity/User';
import { ProductoCatalogo } from '../../entity/ProductoCatalogo';
import { SiafBitacora } from '../../entity/SiafSolicitud';
import { parseOrigen } from '../../services/catalogoOrigen';

export const ETIQUETAS_MOTIVO: Record<string, string> = {
  falta_documento: 'Falta documento',
  ortografia: 'Ortografía / redacción',
  mal_explicado: 'Mal explicado / poco claro',
  datos_incorrectos: 'Datos incorrectos o inconsistentes',
  otro: 'Otro',
};

export const MOTIVOS_VALIDOS = ['falta_documento', 'ortografia', 'mal_explicado', 'datos_incorrectos', 'otro'];

/** Las cantidades de subproductos deben sumar exactamente el total de bienes/servicios. */
export function validarTotalesSubproductos(
  items: Array<{ codigo?: string; cantidad?: number }> | undefined,
  subproductos: Array<{ codigo?: string; cantidad?: number }> | undefined,
): string | null {
  const sumaItems = (items || [])
    .filter((i) => String(i?.codigo ?? '').trim() !== '' && Number(i?.cantidad) > 0)
    .reduce((sum, i) => sum + Number(i.cantidad || 0), 0);
  const sumaSubs = (subproductos || [])
    .filter((s) => String(s?.codigo ?? '').trim() !== '' && Number(s?.cantidad) > 0)
    .reduce((sum, s) => sum + Number(s.cantidad || 0), 0);
  if (sumaItems <= 0) return null;
  if (sumaSubs > sumaItems) {
    return `La suma de cantidades de subproductos (${sumaSubs}) no puede exceder el total de bienes/servicios (${sumaItems}).`;
  }
  if (sumaSubs < sumaItems) {
    return `Debe distribuir la totalidad de bienes/servicios en subproductos. Asignado: ${sumaSubs} de ${sumaItems} (Disponible: ${sumaItems - sumaSubs}). El disponible debe quedar en 0.`;
  }
  return null;
}

export const resolverItemsSiafDesdeCatalogo = async (items: any[]) => {
  const productoCatalogoRepository = AppDataSource.getRepository(ProductoCatalogo);
  const resolved: any[] = [];
  for (const raw of items || []) {
    const codigo = String(raw?.codigo ?? '').trim();
    if (codigo === 'S/C') {
      resolved.push({ ...raw, codigo, catalogoOrigen: null });
      continue;
    }
    const origen = parseOrigen(raw?.catalogoOrigen);
    if (!origen || origen === 'SUBPRODUCTOS') {
      return { error: `Seleccione el catálogo MINFIN, SIBOFA o KORAX para el código "${codigo || 'vacío'}".` };
    }
    const producto = await productoCatalogoRepository.findOne({ where: { codigo, origen } });
    if (!producto) {
      return { error: `El código "${codigo}" no existe en el catálogo ${origen}.` };
    }
    const base = String(producto.descripcion ?? '');
    let descripcion = base;
    if (origen === 'KORAX') {
      const baseTrim = base.trim();
      const escritaTrim = String(raw?.descripcion ?? '').trim();
      if (!baseTrim) {
        descripcion = escritaTrim;
      } else if (escritaTrim.toLowerCase().startsWith(baseTrim.toLowerCase())) {
        const resto = escritaTrim.slice(baseTrim.length);
        descripcion = resto.trim() ? `${baseTrim}${resto}` : `${baseTrim} `;
      } else {
        descripcion = escritaTrim ? `${baseTrim} ${escritaTrim}` : `${baseTrim} `;
      }
    }
    resolved.push({
      ...raw,
      codigo: producto.codigo,
      descripcion,
      catalogoOrigen: origen,
    });
  }
  return { items: resolved };
};

/** Mapea entidades SiafBitacora al formato que espera el frontend (rechazos y correcciones). */
export function mapBitacoraToApi(entradas: SiafBitacora[]): any[] {
  return (entradas || []).map((b) => ({
    id: b.id,
    tipo: b.tipo || '',
    comentario: b.comentario ?? null,
    detalleAntes: b.detalleAntes ?? null,
    detalleDespues: b.detalleDespues ?? null,
    fecha: b.fecha,
    usuario: b.usuario ? { nombres: b.usuario.nombres, apellidos: b.usuario.apellidos } : null,
  }));
}

export async function loadBitacoraBySiafId(siafId: number): Promise<any[]> {
  const mainRows = await AppDataSource.query(
    `SELECT id, tipo, comentario, detalle_antes AS "detalleAntes", detalle_despues AS "detalleDespues", fecha, usuario_id FROM siaf_bitacora WHERE siaf_id = $1 ORDER BY fecha DESC`,
    [siafId]
  );
  const nullCorrecciones = await AppDataSource.query(
    `SELECT b.id, b.tipo, b.comentario, b.detalle_antes AS "detalleAntes", b.detalle_despues AS "detalleDespues", b.fecha, b.usuario_id
       FROM siaf_bitacora b
       WHERE b.tipo = 'correccion' AND b.siaf_id IS NULL
         AND EXISTS (SELECT 1 FROM siaf_bitacora r WHERE r.siaf_id = $1 AND r.tipo = 'rechazo' AND r.fecha < b.fecha LIMIT 1)
       ORDER BY b.fecha DESC`,
    [siafId]
  );
  const seenIds = new Set((mainRows || []).map((r: any) => r.id));
  const merged = [...(mainRows || [])];
  for (const r of nullCorrecciones || []) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      merged.push(r);
    }
  }
  merged.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const userIds = [...new Set(merged.map((r: any) => r.usuario_id).filter(Boolean))];
  const users = userIds.length ? await AppDataSource.getRepository(User).find({ where: { id: In(userIds) } }) : [];
  const userMap = new Map(users.map((u) => [u.id, { nombres: u.nombres, apellidos: u.apellidos }]));
  return merged.map((row: any) => ({
    id: row.id,
    tipo: String(row.tipo || ''),
    comentario: row.comentario ?? null,
    detalleAntes: row.detalleAntes ?? row.detalle_antes ?? null,
    detalleDespues: row.detalleDespues ?? row.detalle_despues ?? null,
    fecha: row.fecha,
    usuario: row.usuario_id ? (userMap.get(row.usuario_id) ?? { nombres: '', apellidos: '' }) : null,
  }));
}

/** Genera detalle "antes" y "después" comparando estado anterior y nuevo (para bitácora de corrección). */
export function buildDetalleCorreccion(
  oldState: { justificacion: string; direccion: string; consistenteItem: string; items: Array<{ codigo: string; descripcion: string; cantidad: number }>; subproductos: Array<{ codigo: string; cantidad: number }> },
  newState: { justificacion: string; direccion: string; consistenteItem: string; items: Array<{ codigo: string; descripcion: string; cantidad: number }>; subproductos: Array<{ codigo: string; cantidad: number }> }
): { detalleAntes: string; detalleDespues: string } {
  const lineasAntes: string[] = [];
  const lineasDespues: string[] = [];
  const trim = (s: string) => (s ?? '').toString().trim();

  if (trim(oldState.justificacion) !== trim(newState.justificacion)) {
    lineasAntes.push(`Justificación: ${(oldState.justificacion || '(vacío)').slice(0, 200)}${(oldState.justificacion || '').length > 200 ? '...' : ''}`);
    lineasDespues.push(`Justificación: ${(newState.justificacion || '(vacío)').slice(0, 200)}${(newState.justificacion || '').length > 200 ? '...' : ''}`);
  }
  if (trim(oldState.direccion) !== trim(newState.direccion)) {
    lineasAntes.push(`Dirección: ${(oldState.direccion || '(vacío)').slice(0, 150)}`);
    lineasDespues.push(`Dirección: ${(newState.direccion || '(vacío)').slice(0, 150)}`);
  }
  if (trim(oldState.consistenteItem) !== trim(newState.consistenteItem)) {
    lineasAntes.push(`Consistente: ${(oldState.consistenteItem || '(vacío)').slice(0, 150)}`);
    lineasDespues.push(`Consistente: ${(newState.consistenteItem || '(vacío)').slice(0, 150)}`);
  }

  const oldItems = oldState.items || [];
  const newItems = newState.items || [];
  for (let i = 0; i < Math.max(oldItems.length, newItems.length); i++) {
    const o = oldItems[i];
    const n = newItems[i];
    const codigoO = o ? String(o.codigo || '').trim() : '';
    const codigoN = n ? String(n.codigo || '').trim() : '';
    const descO = o ? String(o.descripcion || '').trim() : '';
    const descN = n ? String(n.descripcion || '').trim() : '';
    const cantO = o ? Number(o.cantidad) : 0;
    const cantN = n ? Number(n.cantidad) : 0;
    if (codigoO !== codigoN || descO !== descN || cantO !== cantN) {
      const etq = codigoN || codigoO || `Ítem ${i + 1}`;
      const descOA = descO.length > 50 ? descO.slice(0, 50) + '...' : descO;
      const descNA = descN.length > 50 ? descN.slice(0, 50) + '...' : descN;
      lineasAntes.push(`Ítem ${etq}: código "${codigoO}", descripción "${descOA || '(vacío)'}", cantidad ${cantO}`);
      lineasDespues.push(`Ítem ${etq}: código "${codigoN}", descripción "${descNA || '(vacío)'}", cantidad ${cantN}`);
    }
  }

  const oldSub = oldState.subproductos || [];
  const newSub = newState.subproductos || [];
  for (let i = 0; i < Math.max(oldSub.length, newSub.length); i++) {
    const o = oldSub[i];
    const n = newSub[i];
    const codigoO = o ? String(o.codigo || '').trim() : '';
    const codigoN = n ? String(n.codigo || '').trim() : '';
    const cantO = o ? Number(o.cantidad) : 0;
    const cantN = n ? Number(n.cantidad) : 0;
    if (codigoO !== codigoN || cantO !== cantN) {
      const etq = codigoN || codigoO || `Subproducto ${i + 1}`;
      lineasAntes.push(`Subproducto ${etq}: cantidad ${cantO}`);
      lineasDespues.push(`Subproducto ${etq}: cantidad ${cantN}`);
    }
  }

  const detalleAntes = lineasAntes.length ? lineasAntes.join('\n') : 'Sin cambios detectados en datos.';
  const detalleDespues = lineasDespues.length ? lineasDespues.join('\n') : 'Reenvío tras rechazo.';
  return { detalleAntes, detalleDespues };
}
