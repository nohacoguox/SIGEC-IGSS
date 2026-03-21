/**
 * Crea los roles: crear-siaf, autorizar-siaf, gestionar-usuarios, gestionar-roles.
 * Cada rol tiene el permiso del mismo nombre.
 * Ejecutar: npm run seed-roles
 */
import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Role } from '../entity/Role';
import { Permission } from '../entity/Permission';

const ROLES_TO_CREATE = [
  { name: 'crear-siaf', description: 'Crear solicitudes SIAF' },
  { name: 'autorizar-siaf', description: 'Autorizar solicitudes SIAF' },
  { name: 'gestionar-usuarios', description: 'Gestión de usuarios' },
  { name: 'gestionar-roles', description: 'Gestión de roles' },
  { name: 'gestionar-areas', description: 'Gestión de áreas' },
  { name: 'gestionar-puestos', description: 'Gestión de puestos' },
  { name: 'actualizar-codigos-productos', description: 'Actualización de códigos y productos (catálogo Excel)' },
  { name: 'revisar-siaf-direccion-departamental', description: 'Revisión y aprobación final SIAF por Dirección Departamental (por departamento)' },
  { name: 'crear-expediente', description: 'Creación de expedientes de compras' },
  { name: 'revisar-expediente-direccion-departamental', description: 'Revisar, aprobar o rechazar expedientes en Dirección Departamental' },
];

async function seedRoles() {
  await AppDataSource.initialize();
  const roleRepository = AppDataSource.getRepository(Role);
  const permissionRepository = AppDataSource.getRepository(Permission);

  for (const { name, description } of ROLES_TO_CREATE) {
    let permission = await permissionRepository.findOne({ where: { name } });
    if (!permission) {
      permission = permissionRepository.create({ name, description });
      await permissionRepository.save(permission);
      console.log(`Permiso creado: ${name}`);
    }

    let role = await roleRepository.findOne({
      where: { name },
      relations: ['permissions'],
    });
    if (!role) {
      role = roleRepository.create({ name, permissions: [permission] });
      await roleRepository.save(role);
      console.log(`Rol creado: ${name}`);
    } else if (!role.permissions?.some((p) => p.id === permission.id)) {
      role.permissions = [...(role.permissions || []), permission];
      await roleRepository.save(role);
      console.log(`Rol "${name}" actualizado con permiso ${name}`);
    }
  }

  // Asegurar que "super administrador" tenga todos los permisos (incl. gestionar-areas y gestionar-puestos)
  const superAdmin = await roleRepository.findOne({
    where: { name: 'super administrador' },
    relations: ['permissions'],
  });
  if (superAdmin) {
    const allPerms = await permissionRepository.find();
    const missing = allPerms.filter((p) => !superAdmin.permissions?.some((sp) => sp.id === p.id));
    if (missing.length > 0) {
      superAdmin.permissions = [...(superAdmin.permissions || []), ...missing];
      await roleRepository.save(superAdmin);
      console.log(`Rol "super administrador" actualizado con ${missing.length} permiso(s) adicional(es).`);
    }
  }

  // Permiso y rol "Estadísticas" (módulo general; incluye estadísticas SIAF y otras)
  let permEstadisticas = await permissionRepository.findOne({ where: { name: 'ver-estadisticas' } });
  if (!permEstadisticas) {
    permEstadisticas = permissionRepository.create({ name: 'ver-estadisticas', description: 'Ver módulo de estadísticas (SIAF y otras)' });
    await permissionRepository.save(permEstadisticas);
    console.log('Permiso creado: ver-estadisticas');
  }
  let roleEstadisticas = await roleRepository.findOne({ where: { name: 'Estadísticas' }, relations: ['permissions'] });
  if (!roleEstadisticas) {
    roleEstadisticas = roleRepository.create({ name: 'Estadísticas', permissions: [permEstadisticas] });
    await roleRepository.save(roleEstadisticas);
    console.log('Rol creado: Estadísticas');
  } else if (!roleEstadisticas.permissions?.some((p) => p.id === permEstadisticas.id)) {
    roleEstadisticas.permissions = [...(roleEstadisticas.permissions || []), permEstadisticas];
    await roleRepository.save(roleEstadisticas);
    console.log('Rol "Estadísticas" actualizado con permiso ver-estadisticas.');
  }

  // Asignar permiso a roles con nombre amigable (Gestión de Puestos, Gestión de Áreas)
  const permPuestos = await permissionRepository.findOne({ where: { name: 'gestionar-puestos' } });
  const permAreas = await permissionRepository.findOne({ where: { name: 'gestionar-areas' } });
  for (const { roleName, permission } of [
    { roleName: 'Gestión de Puestos', permission: permPuestos },
    { roleName: 'Gestión de Áreas', permission: permAreas },
  ]) {
    if (!permission) continue;
    const role = await roleRepository.findOne({
      where: { name: roleName },
      relations: ['permissions'],
    });
    if (role && !role.permissions?.some((p) => p.id === permission.id)) {
      role.permissions = [...(role.permissions || []), permission];
      await roleRepository.save(role);
      console.log(`Rol "${roleName}" actualizado con permiso "${permission.name}".`);
    }
  }

  await AppDataSource.destroy();
  console.log('Seed de roles finalizado.');
}

seedRoles().catch((err) => {
  console.error(err);
  process.exit(1);
});
