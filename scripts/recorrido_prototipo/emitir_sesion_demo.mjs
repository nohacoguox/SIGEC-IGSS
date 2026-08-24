/**
 * Emite un JWT local válido para capturas (solo entorno de desarrollo).
 * No imprime secretos; escribe el token en un archivo temporal.
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../../backend');

// Cargar .env del backend
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const jwt = require(path.join(backendRoot, 'node_modules/jsonwebtoken'));
const { DataSource } = require(path.join(backendRoot, 'node_modules/typeorm'));

async function main() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no definido en backend/.env');
  }

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || process.env.DB_USERNAME || 'portal_app',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || process.env.DB_DATABASE || 'igss',
    schema: process.env.DB_SCHEMA || 'sigec_igss',
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  const rows = await ds.query(`
    SELECT u.id, u.nombres, u.apellidos, u.codigo_empleado AS "codigoEmpleado",
           COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
           COALESCE(array_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL), '{}') AS permissions
    FROM "user" u
    LEFT JOIN user_roles_role ur ON ur."userId" = u.id
    LEFT JOIN role r ON r.id = ur."roleId"
    LEFT JOIN role_permissions_permission rp ON rp."roleId" = r.id
    LEFT JOIN permission p ON p.id = rp."permissionId"
    GROUP BY u.id
    ORDER BY CASE WHEN bool_or(lower(r.name) LIKE '%super admin%') THEN 0 ELSE 1 END, u.id
    LIMIT 1
  `);

  if (!rows.length) {
    throw new Error('No hay usuarios en la base de datos');
  }

  const user = rows[0];
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  const token = jwt.sign(
    {
      userId: user.id,
      codigoEmpleado: user.codigoEmpleado,
      roles,
      permissions,
    },
    secret,
    { expiresIn: '12h' }
  );

  const out = {
    token,
    userName: [user.nombres, user.apellidos].filter(Boolean).join(' ') || 'Usuario',
    role: roles[0] || 'super administrador',
    roles,
    permissions,
  };

  const outPath = path.join(__dirname, '.demo-session.json');
  fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');
  console.log(`Sesión lista para capturas: userId=${user.id} role=${out.role} perms=${permissions.length}`);
  await ds.destroy();
}

main().catch(async (err) => {
  console.error(err.message || err);
  process.exit(1);
});
