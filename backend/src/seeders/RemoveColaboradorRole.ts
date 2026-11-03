/** Elimina el rol "colaborador" (migración puntual). */
import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Role } from '../entity/Role';

async function removeColaboradorRole() {
  await AppDataSource.initialize();
  const roleRepository = AppDataSource.getRepository(Role);
  const role = await roleRepository.findOne({ where: { name: 'colaborador' } });
  if (role) {
    await roleRepository.remove(role);
    console.log('Rol "colaborador" eliminado.');
  } else {
    console.log('El rol "colaborador" no existe.');
  }
  await AppDataSource.destroy();
}

removeColaboradorRole().catch((err) => {
  console.error(err);
  process.exit(1);
});
