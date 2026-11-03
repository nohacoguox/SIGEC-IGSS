/**
 * Restablece la contraseña de un usuario (por defecto codigoEmpleado=admin).
 * Uso:
 *   npx ts-node scripts/reset-admin-password.ts
 *   npx ts-node scripts/reset-admin-password.ts miCodigo NuevaClave123!
 */
import 'reflect-metadata';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../src/data-source';
import { User } from '../src/entity/User';
import { Credential } from '../src/entity/Credential';

async function main() {
  const codigo = (process.argv[2] || process.env.BOOTSTRAP_ADMIN_CODE || 'admin').trim();
  const nueva = (process.argv[3] || 'Admin123!').trim();

  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);
  const credRepo = AppDataSource.getRepository(Credential);

  const users = await userRepo.find({ relations: ['roles', 'credentials'] });
  console.log('Usuarios en BD:');
  for (const u of users) {
    const roles = (u.roles || []).map((r) => r.name).join(', ') || '(sin rol)';
    console.log(`  - ${u.codigoEmpleado} | ${u.nombres} ${u.apellidos} | ${roles}`);
  }

  const user = await userRepo.findOne({
    where: { codigoEmpleado: codigo },
    relations: ['credentials'],
  });
  if (!user) {
    console.error(`\nNo encontré usuario con codigoEmpleado="${codigo}".`);
    console.error('Pasa el código como argumento, ej: npx ts-node scripts/reset-admin-password.ts 12345 Admin123!');
    process.exit(1);
  }

  const hashed = await bcrypt.hash(nueva, 10);
  let cred = user.credentials;
  if (!cred) {
    cred = credRepo.create({
      codigoEmpleado: user.codigoEmpleado,
      password: hashed,
      isTempPassword: true,
      user,
    });
  } else {
    cred.password = hashed;
    cred.isTempPassword = true;
  }
  await credRepo.save(cred);

  console.log(`\nOK. Usuario "${codigo}" → contraseña temporal: ${nueva}`);
  console.log('Al entrar te pedirá cambiarla (isTempPassword=true).');
  await AppDataSource.destroy();
}

main().catch(async (e) => {
  console.error(e);
  try { await AppDataSource.destroy(); } catch { /* ignore */ }
  process.exit(1);
});
