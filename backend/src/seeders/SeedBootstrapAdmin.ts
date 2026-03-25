/**
 * Crea el primer usuario administrador cuando la BD solo tiene tablas (sin usuarios).
 *
 * Prerrequisitos:
 *   1. Esquema y tablas creados (backend arrancado al menos una vez con DB_SYNCHRONIZE o migraciones).
 *   2. Permisos y roles base:  npm run seed-roles
 *
 * Variables opcionales en backend/.env (si no se definen, usa valores por defecto solo para entorno de prueba):
 *   BOOTSTRAP_ADMIN_CODE=admin
 *   BOOTSTRAP_ADMIN_PASSWORD=CambiarEstaClave123!
 *   BOOTSTRAP_NOMBRES=Administrador
 *   BOOTSTRAP_APELLIDOS=SIGEC
 *   BOOTSTRAP_DPI=0000000000001
 *   BOOTSTRAP_NIT=000000-0
 *   BOOTSTRAP_TELEFONO=00000000
 *   BOOTSTRAP_CORREO=sigec.bootstrap@local
 *
 * Uso:  npm run seed-bootstrap-admin
 *
 * Idempotente: si ya existe al menos un usuario en "user", no hace nada (salvo FORCE_BOOTSTRAP_ADMIN=1).
 */
import 'reflect-metadata';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';
import { Credential } from '../entity/Credential';
import { Role } from '../entity/Role';
import { Permission } from '../entity/Permission';
import { Puesto } from '../entity/Puesto';

const ROL_SUPER = 'super administrador';

async function ensureSuperAdministradorRole(roleRepository: ReturnType<typeof AppDataSource.getRepository<Role>>, permissionRepository: ReturnType<typeof AppDataSource.getRepository<Permission>>) {
  let role = await roleRepository.findOne({ where: { name: ROL_SUPER }, relations: ['permissions'] });
  const allPerms = await permissionRepository.find();
  if (allPerms.length === 0) {
    throw new Error(
      'No hay permisos en la BD. Ejecuta primero: npm run seed-roles'
    );
  }
  if (!role) {
    role = roleRepository.create({ name: ROL_SUPER, permissions: [...allPerms] });
    await roleRepository.save(role);
    console.log(`Rol "${ROL_SUPER}" creado con ${allPerms.length} permiso(s).`);
  } else {
    const missing = allPerms.filter((p) => !role!.permissions?.some((sp) => sp.id === p.id));
    if (missing.length > 0) {
      role.permissions = [...(role.permissions || []), ...missing];
      await roleRepository.save(role);
      console.log(`Rol "${ROL_SUPER}" actualizado con ${missing.length} permiso(s) faltante(s).`);
    } else {
      console.log(`Rol "${ROL_SUPER}" ya existía con todos los permisos.`);
    }
  }
  return roleRepository.findOneOrFail({ where: { name: ROL_SUPER }, relations: ['permissions'] });
}

async function ensurePuestoBootstrap(puestoRepository: ReturnType<typeof AppDataSource.getRepository<Puesto>>) {
  const nombre = 'BOOTSTRAP (solo instalación)';
  let p = await puestoRepository.findOne({ where: { nombre } });
  if (!p) {
    const any = await puestoRepository.find({ take: 1 });
    if (any.length > 0) {
      return any[0];
    }
    p = puestoRepository.create({ nombre, activo: true });
    await puestoRepository.save(p);
    console.log(`Puesto creado: "${nombre}"`);
  }
  return p;
}

async function main() {
  await AppDataSource.initialize();
  const userRepository = AppDataSource.getRepository(User);
  const credentialRepository = AppDataSource.getRepository(Credential);
  const roleRepository = AppDataSource.getRepository(Role);
  const permissionRepository = AppDataSource.getRepository(Permission);
  const puestoRepository = AppDataSource.getRepository(Puesto);

  const existingUsers = await userRepository.count();
  const force = process.env.FORCE_BOOTSTRAP_ADMIN === '1';
  if (existingUsers > 0 && !force) {
    console.log(`Ya existen ${existingUsers} usuario(s). No se crea otro admin. (Usa FORCE_BOOTSTRAP_ADMIN=1 solo si sabes lo que haces.)`);
    await AppDataSource.destroy();
    process.exit(0);
  }

  if (existingUsers > 0 && force) {
    console.warn('FORCE_BOOTSTRAP_ADMIN=1: se intentará crear un usuario adicional (puede fallar por DPI/NIT/código únicos).');
  }

  const codigoEmpleado = process.env.BOOTSTRAP_ADMIN_CODE || 'admin';
  const plainPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'CambiarEstaClave123!';
  const nombres = process.env.BOOTSTRAP_NOMBRES || 'Administrador';
  const apellidos = process.env.BOOTSTRAP_APELLIDOS || 'SIGEC';
  const dpi = process.env.BOOTSTRAP_DPI || '0000000000001';
  const nit = process.env.BOOTSTRAP_NIT || '000000-0';
  const telefono = process.env.BOOTSTRAP_TELEFONO || '00000000';
  const correoInstitucional = process.env.BOOTSTRAP_CORREO || 'sigec.bootstrap@local';
  const renglon = process.env.BOOTSTRAP_RENGLON || 'N/A';
  const unidadMedica = process.env.BOOTSTRAP_UNIDAD_MEDICA || 'Sistema';

  const superRole = await ensureSuperAdministradorRole(roleRepository, permissionRepository);
  const puesto = await ensurePuestoBootstrap(puestoRepository);

  const dup = await userRepository.findOne({ where: [{ codigoEmpleado }, { dpi }, { nit }, { correoInstitucional }] });
  if (dup) {
    throw new Error(
      `Ya existe un usuario que colisiona (código/DPI/NIT/correo). Ajusta BOOTSTRAP_* en .env o borra datos de prueba.`
    );
  }

  const hashed = await bcrypt.hash(plainPassword, 10);

  const user = userRepository.create({
    nombres,
    apellidos,
    dpi,
    nit,
    telefono,
    correoInstitucional,
    codigoEmpleado,
    renglon,
    puesto,
    unidadMedica,
    departamentoDireccion: null,
    departamentoDireccionEntidad: null,
    roles: [superRole],
  });
  const saved = await userRepository.save(user);

  const cred = credentialRepository.create({
    codigoEmpleado,
    password: hashed,
    userId: saved.id,
    isTempPassword: true,
  });
  await credentialRepository.save(cred);

  console.log('');
  console.log('--- Usuario de arranque creado ---');
  console.log(`  Código de empleado (login): ${codigoEmpleado}`);
  console.log(`  Contraseña temporal:        ${plainPassword}`);
  console.log('  Cambia la contraseña al entrar (marcada como temporal).');
  console.log('--- No compartas estas credenciales en producción ---');
  console.log('');

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
