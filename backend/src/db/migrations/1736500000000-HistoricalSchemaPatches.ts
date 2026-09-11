import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Primera migración formal: consolida los parches DDL que antes corrían en
 * ensureSchema / index.ts (ADD COLUMN IF NOT EXISTS, índices, tablas auxiliares).
 *
 * Es idempotente: en una BD ya actualizada no cambia nada; TypeORM solo la
 * registra en `typeorm_migrations`. Si la tabla aún no existe (BD vacía antes
 * de synchronize), se omite el statement sin tumbar el arranque.
 *
 * down() es intencionalmente vacío: revertir columnas históricas en producción
 * con datos no es seguro. Los cambios futuros sí deben tener down reversible.
 */
export class HistoricalSchemaPatches1736500000000 implements MigrationInterface {
  name = 'HistoricalSchemaPatches1736500000000';

  // Sin transacción global: un ALTER sin permiso de dueño no debe abortar el resto
  // (mismo criterio tolerante que ensureSchema en arranques previos).
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const q = async (sql: string) => {
      try {
        await queryRunner.query(sql);
      } catch (e: any) {
        const msg = e?.message || '';
        if (/does not exist/i.test(msg)) return;
        // portal_app a veces no es dueño de permission / tablas heredadas
        if (/must be owner|permission denied|debe ser dueño/i.test(msg)) return;
        throw e;
      }
    };

    await q(`ALTER TABLE siaf_bitacora ADD COLUMN IF NOT EXISTS detalle_antes TEXT`);
    await q(`ALTER TABLE siaf_bitacora ADD COLUMN IF NOT EXISTS detalle_despues TEXT`);

    await q(`ALTER TABLE siaf_autorizaciones ADD COLUMN IF NOT EXISTS motivo_rechazo VARCHAR(80)`);
    await q(`ALTER TABLE siaf_autorizaciones ADD COLUMN IF NOT EXISTS motivos_rechazo TEXT`);

    await q(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS comentario_rechazo TEXT`);
    await q(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS unidad_origen VARCHAR(255)`);
    await q(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS municipio_origen VARCHAR(150)`);
    await q(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS numero_orden_compra VARCHAR(100)`);
    await q(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS numero_siaf VARCHAR(100)`);

    await q(`ALTER TABLE expediente_bitacora ADD COLUMN IF NOT EXISTS expediente_documento_id INT`);
    await q(`ALTER TABLE expediente_bitacora ADD COLUMN IF NOT EXISTS expediente_documento_version_id INT`);
    await q(`ALTER TABLE expediente_bitacora_detalle ADD COLUMN IF NOT EXISTS expediente_documento_version_id INT`);
    await q(`ALTER TABLE expediente_documento_versiones ADD COLUMN IF NOT EXISTS es_actual BOOLEAN NOT NULL DEFAULT FALSE`);

    await q(`ALTER TABLE permission ADD COLUMN IF NOT EXISTS screen_key VARCHAR`);
    await q(`ALTER TABLE permission ADD COLUMN IF NOT EXISTS panel VARCHAR`);

    await q(`ALTER TABLE unidad_medica ADD COLUMN IF NOT EXISTS codigo VARCHAR(50)`);
    await q(`ALTER TABLE unidad_medica ADD COLUMN IF NOT EXISTS direccion TEXT`);
    await q(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_unidad_medica_codigo
      ON unidad_medica (codigo)
      WHERE codigo IS NOT NULL AND codigo <> ''
    `);

    await q(`ALTER TABLE producto_catalogo ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'MINFIN'`);
    await q(`ALTER TABLE producto_catalogo ADD COLUMN IF NOT EXISTS datos_originales JSONB`);
    await q(`ALTER TABLE producto_catalogo ADD COLUMN IF NOT EXISTS columna_codigo VARCHAR(255)`);
    await q(`ALTER TABLE producto_catalogo ADD COLUMN IF NOT EXISTS columnas_descripcion JSONB`);
    await q(`UPDATE producto_catalogo SET origen = 'MINFIN' WHERE origen IS NULL OR origen = ''`);
    await q(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_producto_catalogo_origen_codigo
      ON producto_catalogo (origen, codigo)
    `);
    await q(`
      CREATE TABLE IF NOT EXISTS producto_catalogo_config (
        origen VARCHAR(20) PRIMARY KEY,
        encabezados JSONB NOT NULL DEFAULT '[]'::jsonb,
        columna_codigo VARCHAR(255) NOT NULL,
        columnas_descripcion JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await q(`ALTER TABLE siaf_items ADD COLUMN IF NOT EXISTS catalogo_origen VARCHAR(20)`);

    // Marca versiones actuales cuando el hash coincide con el documento vigente
    await q(`
      UPDATE expediente_documento_versiones v
      SET es_actual = TRUE
      FROM expediente_documentos d
      WHERE v.expediente_documento_id = d.id
        AND v."hashArchivo" = d."hashArchivo"
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: no eliminar columnas históricas con datos.
  }
}
