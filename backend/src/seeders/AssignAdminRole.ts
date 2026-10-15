import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';
import { Role } from '../entity/Role';
import { Permission } from '../entity/Permission';

const ADMIN_CODIGO_EMPLEADO = 'admin';
const ROL_SUPER_ADMIN = 'super administrador';

async function ensureSuperAdminRole() {
  const roleRepository = AppDataSource.getRepository(Role);
  const permissionRepository = AppDataSource.getRepository(Permission);
  const allPerms = await permissionRepository.find();
  if (allPerms.length === 0) {
    throw new Error('No hay permisos. Ejecute primero: npm run seed-roles');
  }
  let role = await roleRepository.findOne({
    where: { name: ROL_SUPER_ADMIN },
    relations: ['permissions'],
  });
  if (!role) {
    role = roleRepository.create({ name: ROL_SUPER_ADMIN, permissions: [...allPerms] });
    await roleRepository.save(role);
    console.log(`Rol "${ROL_SUPER_ADMIN}" creado con ${allPerms.length} permiso(s).`);
  } else {
    const missing = allPerms.filter((p) => !(role!.permissions || []).some((sp) => sp.id === p.id));
    if (missing.length > 0) {
      role.permissions = [...(role.permissions || []), ...missing];
      await roleRepository.save(role);
      console.log(`Rol "${ROL_SUPER_ADMIN}" actualizado (+${missing.length} permisos).`);
    }
  }
  return roleRepository.findOneOrFail({ where: { name: ROL_SUPER_ADMIN }, relations: ['permissions'] });
}

async function assignAdminRole() {
  await AppDataSource.initialize();
  console.log('Conectado a la base de datos.');

  const userRepository = AppDataSource.getRepository(User);
  const role = await ensureSuperAdminRole();

  let user = await userRepository.findOne({
    where: { codigoEmpleado: ADMIN_CODIGO_EMPLEADO },
    relations: ['roles'],
  });
  if (!user) {
    const all = await userRepository.find({ relations: ['roles'] });
    user =
      all.find((u) => /admin/i.test(u.codigoEmpleado || '')) ||
      all.find((u) => /administrador/i.test(`${u.nombres} ${u.apellidos}`)) ||
      null;
  }
  if (!user) {
    console.error(`No existe un usuario admin (codigo "${ADMIN_CODIGO_EMPLEADO}").`);
    await AppDataSource.destroy();
    process.exit(1);
  }

  if (!user.roles) user.roles = [];
  if (!user.roles.some((r) => r.id === role.id)) {
    user.roles.push(role);
    await userRepository.save(user);
  }
  console.log(
    `Rol "${ROL_SUPER_ADMIN}" asignado a ${user.codigoEmpleado} (${user.nombres} ${user.apellidos}).`
  );
  console.log(`Roles actuales: ${(user.roles || []).map((r) => r.name).join(', ')}`);

  await AppDataSource.destroy();
  console.log('Listo.');
}

assignAdminRole().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
