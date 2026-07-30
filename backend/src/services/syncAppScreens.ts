import { AppDataSource } from '../data-source';
import { Permission } from '../entity/Permission';
import { Role } from '../entity/Role';
import { APP_SCREENS, PERMISSION_ALIASES } from '../config/appScreens';

/**
 * Asegura que todos los permisos del catálogo de pantallas existan en BD
 * y que super administrador los tenga todos.
 */
export async function syncAppScreenPermissions(): Promise<void> {
  if (!AppDataSource.isInitialized) return;

  const permissionRepository = AppDataSource.getRepository(Permission);
  const roleRepository = AppDataSource.getRepository(Role);

  for (const screen of APP_SCREENS) {
    let permission = await permissionRepository.findOne({ where: { name: screen.permission } });
    if (!permission) {
      permission = permissionRepository.create({
        name: screen.permission,
        description: screen.description,
      });
      await permissionRepository.save(permission);
      console.log(`[sync] Permiso creado: ${screen.permission}`);
    } else if (permission.description !== screen.description) {
      permission.description = screen.description;
      await permissionRepository.save(permission);
    }
  }

  for (const [newPerm, legacyPerms] of Object.entries(PERMISSION_ALIASES)) {
    const newPermission = await permissionRepository.findOne({ where: { name: newPerm } });
    if (!newPermission) continue;

    for (const legacyName of legacyPerms) {
      const legacyPermission = await permissionRepository.findOne({ where: { name: legacyName } });
      if (!legacyPermission) continue;

      const rolesWithLegacy = await roleRepository
        .createQueryBuilder('role')
        .innerJoin('role.permissions', 'perm', 'perm.id = :legacyId', { legacyId: legacyPermission.id })
        .leftJoinAndSelect('role.permissions', 'permissions')
        .getMany();

      for (const role of rolesWithLegacy) {
        if (!role.permissions?.some((p) => p.id === newPermission.id)) {
          role.permissions = [...(role.permissions || []), newPermission];
          await roleRepository.save(role);
          console.log(`[sync] Rol "${role.name}" actualizado con permiso ${newPerm} (desde ${legacyName})`);
        }
      }
    }
  }

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
      console.log(`[sync] super administrador: +${missing.length} permiso(s)`);
    }
  }
}
