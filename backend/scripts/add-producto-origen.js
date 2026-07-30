require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const schema = process.env.DB_SCHEMA || 'sigec_igss';
  const tryClient = async (user, password) => {
    const c = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user,
      password,
      database: process.env.DB_NAME,
    });
    await c.connect();
    await c.query(`SET search_path TO ${schema}`);
    await c.query(`ALTER TABLE producto_catalogo ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'MINFIN'`);
    await c.query(`ALTER TABLE producto_catalogo ADD COLUMN IF NOT EXISTS datos_originales JSONB`);
    await c.query(`ALTER TABLE producto_catalogo ADD COLUMN IF NOT EXISTS columna_codigo VARCHAR(255)`);
    await c.query(`ALTER TABLE producto_catalogo ADD COLUMN IF NOT EXISTS columnas_descripcion JSONB`);
    await c.query(`UPDATE producto_catalogo SET origen = 'MINFIN' WHERE origen IS NULL OR origen = ''`);
    await c.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_producto_catalogo_origen_codigo
      ON producto_catalogo (origen, codigo)
    `);
    await c.query(`
      CREATE TABLE IF NOT EXISTS producto_catalogo_config (
        origen VARCHAR(20) PRIMARY KEY,
        encabezados JSONB NOT NULL DEFAULT '[]'::jsonb,
        columna_codigo VARCHAR(255) NOT NULL,
        columnas_descripcion JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await c.query(`ALTER TABLE siaf_items ADD COLUMN IF NOT EXISTS catalogo_origen VARCHAR(20)`);
    const cols = await c.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'producto_catalogo'
       ORDER BY ordinal_position`,
      [schema]
    );
    console.log(`[${user}] OK columns:`, cols.rows.map((r) => r.column_name).join(', '));
    await c.end();
  };

  try {
    await tryClient(process.env.DB_USER, process.env.DB_PASSWORD);
  } catch (e) {
    console.error(`[${process.env.DB_USER}] fail:`, e.message);
    try {
      await tryClient('postgres', 'admin98');
    } catch (e2) {
      console.error('[postgres] fail:', e2.message);
      process.exit(1);
    }
  }
})();
