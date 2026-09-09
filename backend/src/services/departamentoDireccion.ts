import { AppDataSource } from '../data-source';
import { User } from '../entity/User';
import { UnidadMedica } from '../entity/UnidadMedica';

// Resuelve el departamento del usuario DD: departamentoDireccionEntidad (tabla), luego texto departamentoDireccion, luego desde Unidad Médica.
export async function resolveDepartamentoDireccion(user: User): Promise<string | null> {
  const deptoEntidad = (user as any).departamentoDireccionEntidad;
  if (deptoEntidad?.nombre) return deptoEntidad.nombre.trim();
  let depto = (user.departamentoDireccion || '').trim();
  if (depto) return depto;
  const unidadNombre = (user.unidadMedica || '').trim();
  if (!unidadNombre) return null;
  const unidadRepo = AppDataSource.getRepository(UnidadMedica);
  const unidad = await unidadRepo.findOne({ where: { nombre: unidadNombre }, relations: ['municipio', 'municipio.departamento'] });
  return unidad?.municipio?.departamento?.nombre ?? unidad?.departamento ?? null;
}
