import { AppDataSource } from '../data-source';
import { UnidadMedica } from '../entity/UnidadMedica';
import { unidadesMedicasData } from '../unidadMedicaData';

export async function seedUnidadMedica() {
  await AppDataSource.initialize();
  console.log('Data Source has been initialized for seeding!');

  const unidadMedicaRepository = AppDataSource.getRepository(UnidadMedica);

  for (const data of unidadesMedicasData) {
    const existingUnit = await unidadMedicaRepository.findOneBy({ nombre: data.nombre });
    if (!existingUnit) {
      const newUnidad = unidadMedicaRepository.create({
        nombre: data.nombre,
        departamento: data.departamento ?? null,
        telefonos: data.telefonos ?? '',
        codigo: (data as any).codigo ?? null,
        direccion: (data as any).direccion ?? null,
      });
      await unidadMedicaRepository.save(newUnidad);
      console.log(`Seeded: ${newUnidad.nombre}`);
    } else {
      let changed = false;
      if (!(existingUnit as any).codigo && (data as any).codigo) {
        (existingUnit as any).codigo = (data as any).codigo;
        changed = true;
      }
      if (!(existingUnit as any).direccion && (data as any).direccion) {
        (existingUnit as any).direccion = (data as any).direccion;
        changed = true;
      }
      if (changed) {
        await unidadMedicaRepository.save(existingUnit);
        console.log(`Updated: ${existingUnit.nombre}`);
      } else {
        console.log(`Skipping existing unit: ${existingUnit.nombre}`);
      }
    }
  }

  console.log('UnidadMedica seeding complete!');
  await AppDataSource.destroy();
}

// To run this seeder independently (e.g., via a separate npm script)
seedUnidadMedica().catch(error => console.error('UnidadMedica seeding failed:', error));
