/**
 * Crea roles y permisos según el catálogo de pantallas (appScreens).
 * Cada pantalla = un permiso; cada permiso puede tener un rol homónimo.
 * Ejecutar: npm run seed-roles
 */
import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Role } from '../entity/Role';
import { Permission } from '../entity/Permission';
import { APP_SCREENS } from '../config/appScreens';
import { syncAppScreenPermissions } from '../services/syncAppScreens';

async function seedRoles() {
  await AppDataSource.initialize();
  await syncAppScreenPermissions();

  const roleRepository = AppDataSource.getRepository(Role);
  const permissionRepository = AppDataSource.getRepository(Permission);

  for (const screen of APP_SCREENS) {
    const permission = await permissionRepository.findOne({ where: { name: screen.permission } });
    if (!permission) continue;

    let role = await roleRepository.findOne({
      where: { name: screen.permission },
      relations: ['permissions'],
    });
    if (!role) {
      role = roleRepository.create({ name: screen.permission, permissions: [permission] });
      await roleRepository.save(role);
      console.log(`Rol creado: ${screen.permission} → ${screen.label}`);
    } else if (!role.permissions?.some((p) => p.id === permission.id)) {
      role.permissions = [...(role.permissions || []), permission];
      await roleRepository.save(role);
      console.log(`Rol "${screen.permission}" actualizado con permiso.`);
    }
  }

  // Rol legado ver-estadisticas (compatibilidad)
  let permLegacyStats = await permissionRepository.findOne({ where: { name: 'ver-estadisticas' } });
  if (!permLegacyStats) {
    permLegacyStats = permissionRepository.create({
      name: 'ver-estadisticas',
      description: 'Ver módulo de estadísticas (legacy)',
    });
    await permissionRepository.save(permLegacyStats);
  }

  let roleEstadisticas = await roleRepository.findOne({ where: { name: 'Estadísticas' }, relations: ['permissions'] });
  const permTiempos = await permissionRepository.findOne({ where: { name: 'estadisticas-tiempos' } });
  const permMotivos = await permissionRepository.findOne({ where: { name: 'estadisticas-motivos' } });
  if (!roleEstadisticas && permTiempos && permMotivos) {
    roleEstadisticas = roleRepository.create({
      name: 'Estadísticas',
      permissions: [permTiempos, permMotivos, permLegacyStats],
    });
    await roleRepository.save(roleEstadisticas);
    console.log('Rol creado: Estadísticas (tiempos + motivos)');
  }

  await AppDataSource.destroy();
  console.log(`Seed finalizado. Pantallas registradas: ${APP_SCREENS.length}`);
}

seedRoles().catch((err) => {
  console.error(err);
  process.exit(1);
});
