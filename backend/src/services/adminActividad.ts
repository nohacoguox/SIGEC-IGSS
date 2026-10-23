import { Request } from 'express';
import { AppDataSource } from '../data-source';

export async function asegurarTablaActividadAdmin(): Promise<void> {
  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS admin_actividad (
      id SERIAL PRIMARY KEY,
      fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      usuario_id INT NULL,
      usuario VARCHAR(200) NOT NULL DEFAULT '',
      texto TEXT NOT NULL
    )
  `);
  await AppDataSource.query(`ALTER TABLE admin_actividad ALTER COLUMN texto TYPE TEXT`);
}

function listarNombres(nombres: string[]): string {
  const limpios = nombres.map((nombre) => nombre.trim()).filter(Boolean);
  if (limpios.length <= 1) return limpios[0] || '';
  if (limpios.length === 2) return `${limpios[0]} y ${limpios[1]}`;
  return `${limpios.slice(0, -1).join(', ')} y ${limpios[limpios.length - 1]}`;
}

function pluralDe(singular: string): string {
  if (singular === 'rol') return 'roles';
  if (singular === 'permiso') return 'permisos';
  if (singular === 'área') return 'áreas';
  return `${singular}s`;
}

/** Frases solo de los campos cuyo valor cambió. Si nada cambió, devuelve null. */
export function describirCambios(cambios: Array<{ etiqueta: string; antes: unknown; despues: unknown }>): string | null {
  const frases = cambios.flatMap((cambio) => {
    const antes = cambio.antes == null ? '' : String(cambio.antes).trim();
    const despues = cambio.despues == null ? '' : String(cambio.despues).trim();
    if (antes === despues) return [];
    return [`cambió ${cambio.etiqueta} de «${antes || 'vacío'}» a «${despues || 'vacío'}»`];
  });
  return frases.length ? frases.join('; ') : null;
}

/** Altas y bajas de una lista (roles, permisos, áreas). Si el conjunto es el mismo, devuelve null. */
export function describirAltasBajas(agregados: string[], quitados: string[], singular: string): string | null {
  const altas = agregados.map((nombre) => nombre.trim()).filter(Boolean);
  const bajas = quitados.map((nombre) => nombre.trim()).filter(Boolean);
  const partes: string[] = [];
  if (altas.length === 1) partes.push(`agregó el ${singular} ${altas[0]}`);
  else if (altas.length > 1) partes.push(`agregó los ${pluralDe(singular)} ${listarNombres(altas)}`);
  if (bajas.length === 1) partes.push(`quitó el ${singular} ${bajas[0]}`);
  else if (bajas.length > 1) partes.push(`quitó los ${pluralDe(singular)} ${listarNombres(bajas)}`);
  return partes.length ? partes.join(' y ') : null;
}

export function listar(nombres: string[]): string {
  return listarNombres(nombres);
}

/** Registra un cambio hecho desde el panel de administración. No interrumpe la acción si falla. */
export async function registrarActividadAdmin(req: Request, texto: string): Promise<void> {
  try {
    const userId = Number((req as any).user?.userId);
    const idValido = Number.isFinite(userId) && userId > 0;
    let usuario = '';
    if (idValido) {
      const rows = await AppDataSource.query(
        `SELECT TRIM(BOTH ' ' FROM COALESCE(nombres, '') || ' ' || COALESCE(apellidos, '')) AS nombre FROM "user" WHERE id = $1`,
        [userId]
      );
      usuario = String(rows?.[0]?.nombre || '').trim();
    }
    const limpio = texto.replace(/\s+/g, ' ').trim().slice(0, 2000);
    if (!limpio) return;
    await AppDataSource.query(
      `INSERT INTO admin_actividad (usuario_id, usuario, texto) VALUES ($1, $2, $3)`,
      [idValido ? userId : null, usuario.slice(0, 200), limpio]
    );
  } catch (error: any) {
    console.error('Aviso al registrar actividad de administración:', error?.message);
  }
}
