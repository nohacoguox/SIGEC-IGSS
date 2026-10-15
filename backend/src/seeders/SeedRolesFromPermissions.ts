/**
 * Crea roles y permisos según el catálogo de pantallas (appScreens).
 * Cada pantalla = un permiso; cada permiso puede tener un rol homónimo.
 * Ejecutar: npm run seed-roles
 *
 * IMPORTANTE: no toca asignaciones usuario↔rol. Nunca renombra ni reutiliza
 * "super administrador" / "administrador". No buscar roles “por permiso”
 * (eso vaciaba permisos del super admin).
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

  const isProtectedRole = (name?: string | null) => {
    const n = String(name || '').toLowerCase().trim();
    return n === 'super administrador' || n === 'administrador';
  };

  for (const screen of APP_SCREENS) {
    const permission = await permissionRepository.findOne({ where: { name: screen.permission } });
    if (!permission) continue;

    // Solo buscar por nombre de pantalla o slug. NUNCA tomar un rol que ya tenga el
    // permiso (p. ej. super administrador): eso renombraba y vaciaba permisos.
    let role =
      (await roleRepository.findOne({ where: { name: screen.label }, relations: ['permissions'] })) ||
      (await roleRepository.findOne({ where: { name: screen.permission }, relations: ['permissions'] }));

    if (role && isProtectedRole(role.name)) {
      role = null;
    }

    if (!role) {
      role = roleRepository.create({ name: screen.label, permissions: [permission] });
      await roleRepository.save(role);
      console.log(`Rol creado: ${screen.label} (${screen.permission})`);
      continue;
    }

    let changed = false;
    // No renombrar roles protegidos ni roles que no sean el de esta pantalla
    if (!isProtectedRole(role.name) && role.name !== screen.label && role.name === screen.permission && screen.label) {
      role.name = screen.label;
      changed = true;
    }
    if (!role.permissions?.some((p) => p.id === permission.id)) {
      // Recargar permisos completos antes de guardar (evita wipe por joins parciales)
      const full = await roleRepository.findOne({ where: { id: role.id }, relations: ['permissions'] });
      role.permissions = [...(full?.permissions || role.permissions || []), permission];
      changed = true;
    }
    if (changed) {
      await roleRepository.save(role);
      console.log(`Rol actualizado: ${role.name} → ${screen.permission}`);
    }
  }

  // Permisos legado (solo acceso personal; ya no se crea el rol compuesto "Estadísticas")
  for (const legacy of [
    { name: 'ver-estadisticas', description: 'Legado: acceso personal a estadísticas (= Mis estadísticas)' },
    { name: 'estadisticas-motivos', description: 'Legado: motivos de rechazo (= Mis estadísticas)' },
  ]) {
    let perm = await permissionRepository.findOne({ where: { name: legacy.name } });
    if (!perm) {
      perm = permissionRepository.create(legacy);
      await permissionRepository.save(perm);
      console.log(`Permiso legado creado: ${legacy.name}`);
    }
  }

  // Eliminar rol compuesto antiguo si existe (evita asignar vista de unidad por error)
  const roleCompuesto = await roleRepository.findOne({ where: { name: 'Estadísticas' }, relations: ['permissions'] });
  if (roleCompuesto) {
    roleCompuesto.permissions = [];
    await roleRepository.save(roleCompuesto);
    await roleRepository.remove(roleCompuesto);
    console.log('Rol compuesto "Estadísticas" eliminado (usar Mis estadísticas / Estadísticas de mi unidad)');
  }

  // Rol compuesto práctico: Analista DAF = bandejas SIAF/Expedientes + Mis tiempos DAF
  const permsAnalistaDaf = [
    'revisar-siaf-direccion-departamental',
    'revisar-expediente-direccion-departamental',
    'estadisticas-analista-daf',
  ];
  const permEntities = (
    await Promise.all(permsAnalistaDaf.map((name) => permissionRepository.findOne({ where: { name } })))
  ).filter(Boolean) as Permission[];
  if (permEntities.length) {
    let rolAnalista = await roleRepository.findOne({
      where: { name: 'Analista DAF' },
      relations: ['permissions'],
    });
    if (!rolAnalista) {
      rolAnalista = roleRepository.create({ name: 'Analista DAF', permissions: permEntities });
      await roleRepository.save(rolAnalista);
      console.log('Rol compuesto creado: Analista DAF');
    } else {
      const ids = new Set((rolAnalista.permissions || []).map((p) => p.id));
      let changed = false;
      for (const p of permEntities) {
        if (!ids.has(p.id)) {
          rolAnalista.permissions = [...(rolAnalista.permissions || []), p];
          changed = true;
        }
      }
      if (changed) {
        await roleRepository.save(rolAnalista);
        console.log('Rol compuesto actualizado: Analista DAF');
      }
    }
  }

  await AppDataSource.destroy();
  console.log(`Seed finalizado. Pantallas registradas: ${APP_SCREENS.length}`);
}

seedRoles().catch((err) => {
  console.error(err);
  process.exit(1);
});
