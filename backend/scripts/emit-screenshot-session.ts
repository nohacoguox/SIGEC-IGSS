/**
 * Emite JWT local para capturas de prototipo (desarrollo).
 * Uso: npx ts-node scripts/emit-screenshot-session.ts
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import { AppDataSource } from '../src/data-source';
import { User } from '../src/entity/User';

async function main() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);
  const users = await userRepo.find({ relations: ['roles', 'roles.permissions'] });
  if (!users.length) throw new Error('No hay usuarios en BD');

  const ranked = [...users].sort((a, b) => {
    const score = (u: User) => {
      const names = (u.roles || []).map((r) => (r.name || '').toLowerCase());
      if (names.some((n) => n.includes('super admin'))) return 0;
      if (names.some((n) => n.includes('admin'))) return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  const user = ranked[0];
  const roles = (user.roles || []).map((r) => r.name);
  const permissions = Array.from(
    new Set((user.roles || []).flatMap((r) => (r.permissions || []).map((p) => p.name)))
  );

  const token = jwt.sign(
    {
      userId: user.id,
      codigoEmpleado: user.codigoEmpleado,
      roles,
      permissions,
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '12h' }
  );

  const outDir = path.join(__dirname, '../../scripts/recorrido_prototipo');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, '.demo-session.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({
      token,
      userName: [user.nombres, user.apellidos].filter(Boolean).join(' ') || 'Usuario',
      role: roles[0] || null,
      roles,
      permissions,
    }),
    'utf8'
  );

  console.log(`OK userId=${user.id} roles=${roles.join('|')} perms=${permissions.length}`);
  console.log(`Sesión escrita en ${outPath}`);
  await AppDataSource.destroy();
}

main().catch(async (e) => {
  console.error(e);
  try { await AppDataSource.destroy(); } catch {}
  process.exit(1);
});
