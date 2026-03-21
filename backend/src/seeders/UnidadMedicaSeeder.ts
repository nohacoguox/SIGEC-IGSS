import { AppDataSource } from '../data-source';
import { UnidadMedica } from '../entity/UnidadMedica';
import { unidadesMedicasData } from '../unidadMedicaData';

export async function seedUnidadMedica() {
  await AppDataSource.initialize();
  console.log('Data Source has been initialized for seeding!');

  const unidadMedicaRepository = AppDataSource.getRepository(UnidadMedica);

  for (const data of unidadesMedicasData) {
    // Check if a unit with the same name already exists to prevent duplicates on re-seeding
    const existingUnit = await unidadMedicaRepository.findOneBy({ nombre: data.nombre });
    if (!existingUnit) {
      const newUnidad = unidadMedicaRepository.create(data);
      await unidadMedicaRepository.save(newUnidad);
      console.log(`Seeded: ${newUnidad.nombre}`);
    } else {
      console.log(`Skipping existing unit: ${existingUnit.nombre}`);
    }
  }

  console.log('UnidadMedica seeding complete!');
  await AppDataSource.destroy();
}

// To run this seeder independently (e.g., via a separate npm script)
seedUnidadMedica().catch(error => console.error('UnidadMedica seeding failed:', error));
