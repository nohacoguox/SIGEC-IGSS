import { AppDataSource } from '../data-source';

/**
 * Crea/repara tablas de correlativos cuando DB_SYNCHRONIZE=false.
 */
export async function ensureCorrelativoTables(): Promise<void> {
  if (!AppDataSource.isInitialized) return;

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS siaf_correlativo_config (
      id SERIAL PRIMARY KEY,
      siguiente_numero INT NOT NULL DEFAULT 1,
      numero_inicio INT NOT NULL DEFAULT 1,
      digitos INT NOT NULL DEFAULT 0,
      minutos_reserva INT NOT NULL DEFAULT 120,
      anio_actual INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS siaf_correlativo_reservas (
      id SERIAL PRIMARY KEY,
      numero INT NOT NULL DEFAULT 0,
      correlativo VARCHAR(50) NOT NULL DEFAULT '',
      usuario_id INT NOT NULL DEFAULT 0,
      estado VARCHAR(20) NOT NULL DEFAULT 'reservado',
      token VARCHAR(64) NULL,
      reservado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expira_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      liberado_en TIMESTAMPTZ NULL,
      consumido_en TIMESTAMPTZ NULL
    )
  `);

  const alterReservas = [
    `ALTER TABLE siaf_correlativo_reservas ADD COLUMN IF NOT EXISTS numero INT NOT NULL DEFAULT 0`,
    `ALTER TABLE siaf_correlativo_reservas ADD COLUMN IF NOT EXISTS correlativo VARCHAR(50) NOT NULL DEFAULT ''`,
    `ALTER TABLE siaf_correlativo_reservas ADD COLUMN IF NOT EXISTS usuario_id INT NOT NULL DEFAULT 0`,
    `ALTER TABLE siaf_correlativo_reservas ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'reservado'`,
    `ALTER TABLE siaf_correlativo_reservas ADD COLUMN IF NOT EXISTS token VARCHAR(64) NULL`,
    `ALTER TABLE siaf_correlativo_reservas ADD COLUMN IF NOT EXISTS reservado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE siaf_correlativo_reservas ADD COLUMN IF NOT EXISTS expira_en TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE siaf_correlativo_reservas ADD COLUMN IF NOT EXISTS liberado_en TIMESTAMPTZ NULL`,
    `ALTER TABLE siaf_correlativo_reservas ADD COLUMN IF NOT EXISTS consumido_en TIMESTAMPTZ NULL`,
  ];
  for (const sql of alterReservas) {
    try {
      await AppDataSource.query(sql);
    } catch (e: any) {
      if (!/already exists|duplicate|dueño|owner/i.test(e?.message || '')) {
        console.warn('[correlativos]', e?.message);
      }
    }
  }

  // Columnas heredadas (token / expires_at): relajar NOT NULL y sincronizar
  const softenLegacy = [
    `ALTER TABLE siaf_correlativo_reservas ALTER COLUMN token DROP NOT NULL`,
    `ALTER TABLE siaf_correlativo_reservas ALTER COLUMN expires_at DROP NOT NULL`,
    `ALTER TABLE siaf_correlativo_reservas ALTER COLUMN reserved_at DROP NOT NULL`,
    `ALTER TABLE siaf_correlativo_reservas ALTER COLUMN created_at DROP NOT NULL`,
  ];
  for (const sql of softenLegacy) {
    try {
      await AppDataSource.query(sql);
    } catch {
      /* columna no existe o sin permiso */
    }
  }

  try {
    await AppDataSource.query(`
      UPDATE siaf_correlativo_reservas
      SET token = md5(random()::text || clock_timestamp()::text)
      WHERE token IS NULL
    `);
  } catch {
    /* ignore */
  }
  try {
    await AppDataSource.query(`
      ALTER TABLE siaf_correlativo_reservas ALTER COLUMN token SET DEFAULT md5(random()::text)
    `);
  } catch {
    /* ignore */
  }

  // Preferible: eliminar columna legada si tenemos permiso
  try {
    const hasExpires = await AppDataSource.query(`
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class cl ON cl.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = current_schema()
        AND cl.relname = 'siaf_correlativo_reservas'
        AND a.attname = 'expires_at'
        AND a.attnum > 0 AND NOT a.attisdropped
      LIMIT 1
    `);
    if (hasExpires?.length) {
      try {
        await AppDataSource.query(`
          UPDATE siaf_correlativo_reservas
          SET expires_at = COALESCE(expires_at, expira_en, NOW())
          WHERE expires_at IS NULL
        `);
      } catch {
        /* ignore */
      }
      try {
        await AppDataSource.query(`
          ALTER TABLE siaf_correlativo_reservas ALTER COLUMN expires_at DROP NOT NULL
        `);
      } catch {
        /* ignore */
      }
      try {
        await AppDataSource.query(`
          ALTER TABLE siaf_correlativo_reservas ALTER COLUMN expires_at SET DEFAULT NOW()
        `);
      } catch {
        /* ignore */
      }
      try {
        await AppDataSource.query(`
          ALTER TABLE siaf_correlativo_reservas DROP COLUMN expires_at
        `);
        console.log('[correlativos] Columna legada expires_at eliminada');
      } catch (e: any) {
        console.warn('[correlativos] No se pudo eliminar expires_at:', e?.message);
      }
    }
  } catch {
    /* ignore */
  }

  const alterConfig = [
    `ALTER TABLE siaf_correlativo_config ADD COLUMN IF NOT EXISTS siguiente_numero INT NOT NULL DEFAULT 1`,
    `ALTER TABLE siaf_correlativo_config ADD COLUMN IF NOT EXISTS numero_inicio INT NOT NULL DEFAULT 1`,
    `ALTER TABLE siaf_correlativo_config ADD COLUMN IF NOT EXISTS digitos INT NOT NULL DEFAULT 0`,
    `ALTER TABLE siaf_correlativo_config ADD COLUMN IF NOT EXISTS minutos_reserva INT NOT NULL DEFAULT 120`,
    `ALTER TABLE siaf_correlativo_config ADD COLUMN IF NOT EXISTS anio_actual INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT`,
    `ALTER TABLE siaf_correlativo_config ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE siaf_correlativo_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  ];
  for (const sql of alterConfig) {
    try {
      await AppDataSource.query(sql);
    } catch {
      /* ignore */
    }
  }

  try {
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_siaf_correlativo_reservas_estado_numero
      ON siaf_correlativo_reservas (estado, numero)
    `);
  } catch (e: any) {
    console.warn('[correlativos] índice:', e?.message);
  }

  // Unicidad global de correlativo impide reutilizar números liberados → reemplazar por índice parcial
  try {
    await AppDataSource.query(`
      ALTER TABLE siaf_correlativo_reservas
      DROP CONSTRAINT IF EXISTS uq_siaf_correlativo_reservas_correlativo
    `);
  } catch (e: any) {
    console.warn('[correlativos] drop unique correlativo:', e?.message);
  }
  try {
    await AppDataSource.query(`
      DROP INDEX IF EXISTS uq_siaf_correlativo_reservas_correlativo
    `);
  } catch {
    /* ignore */
  }
  try {
    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_siaf_correlativo_reservas_activo
      ON siaf_correlativo_reservas (correlativo)
      WHERE estado = 'reservado'
    `);
  } catch (e: any) {
    console.warn('[correlativos] índice único parcial:', e?.message);
  }

  const rows = await AppDataSource.query(`SELECT id FROM siaf_correlativo_config LIMIT 1`);
  if (!rows?.length) {
    const year = new Date().getFullYear();
    await AppDataSource.query(
      `
      INSERT INTO siaf_correlativo_config (siguiente_numero, numero_inicio, digitos, minutos_reserva, anio_actual)
      VALUES (1, 1, 0, 120, $1)
    `,
      [year]
    );
  }

  console.log('[correlativos] Tablas de secuencia/reservas listas (formato número/año)');
}
