import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';
import { Role } from '../entity/Role';

const ADMIN_CODIGO_EMPLEADO = 'admin';
const ROL_SUPER_ADMIN = 'super administrador';

async function assignAdminRole() {
  await AppDataSource.initialize();
  console.log('Conectado a la base de datos.');

  const userRepository = AppDataSource.getRepository(User);
  const roleRepository = AppDataSource.getRepository(Role);

  const role = await roleRepository.findOne({ where: { name: ROL_SUPER_ADMIN } });
  if (!role) {
    console.error(`No existe el rol "${ROL_SUPER_ADMIN}". Créalo primero en la aplicación.`);
    await AppDataSource.destroy();
    process.exit(1);
  }

  const user = await userRepository.findOne({
    where: { codigoEmpleado: ADMIN_CODIGO_EMPLEADO },
    relations: ['roles'],
  });
  if (!user) {
    console.error(`No existe un usuario con código de empleado "${ADMIN_CODIGO_EMPLEADO}".`);
    await AppDataSource.destroy();
    process.exit(1);
  }

  if (!user.roles) user.roles = [];
  if (!user.roles.some((r) => r.id === role.id)) {
    user.roles.push(role);
    await userRepository.save(user);
  }
  console.log(`Rol "${ROL_SUPER_ADMIN}" asignado al usuario admin (${user.nombres} ${user.apellidos}).`);

  await AppDataSource.destroy();
  console.log('Listo.');
}

assignAdminRole().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
