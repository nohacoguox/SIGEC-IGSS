/**
 * Migración única: pasa de User.roleId (un rol) a User.roles (varios roles).
 * Se ejecuta automáticamente al iniciar el backend (index.ts).
 * También se puede ejecutar a mano: npm run migrate-user-roles
 */
import 'dotenv/config';
import { Client } from 'pg';

const dbSchema = process.env.DB_SCHEMA || 'sigec_igss';

function getConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'admin98',
    database: process.env.DB_NAME || 'igss',
    options: `-c search_path=${dbSchema},public`,
  };
}

export async function runUserRolesMigration(): Promise<void> {
  const client = new Client(getConfig());
  await client.connect();

  try {
    // En base de datos nueva, esta migración corre ANTES de TypeORM: aún no existen "user" ni "role".
    // TypeORM (synchronize) creará el esquema y la tabla user_roles desde @JoinTable en User.
    const tablesOk = await client.query(
      `
      SELECT COUNT(*)::int AS c FROM information_schema.tables
      WHERE table_schema = $1 AND table_name IN ('user', 'role')
    `,
      [dbSchema]
    );
    if (Number(tablesOk.rows[0]?.c ?? 0) < 2) {
      console.log(
        '📦 Migración user_roles: omitida (tablas user/role aún no existen; TypeORM las creará en el arranque).'
      );
      return;
    }

    const hasColumn = await client.query(
      `
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'user' AND column_name = 'roleId'
    `,
      [dbSchema]
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_roles" (
        "userId" integer NOT NULL,
        "roleId" integer NOT NULL,
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("userId", "roleId"),
        CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE
      )
    `);

    if (hasColumn.rowCount && hasColumn.rowCount > 0) {
      const existing = await client.query(`SELECT COUNT(*) as c FROM "user_roles"`);
      if (Number(existing.rows[0]?.c ?? 0) === 0) {
        await client.query(`
          INSERT INTO "user_roles" ("userId", "roleId")
          SELECT id, "roleId" FROM "user" WHERE "roleId" IS NOT NULL
        `);
        console.log('📦 Migración user_roles: datos copiados de user.roleId a user_roles.');
      }
      await client.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "roleId"`);
      console.log('📦 Migración user_roles: columna roleId eliminada de user.');
    }
  } finally {
    await client.end();
  }
}

async function main() {
  await runUserRolesMigration();
  console.log('Migración finalizada.');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
