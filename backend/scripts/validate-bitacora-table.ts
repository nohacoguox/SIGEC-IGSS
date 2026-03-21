/**
 * Valida que la tabla siaf_bitacora exista y tenga las columnas detalle_antes y detalle_despues.
 * Si faltan, aplica ALTER TABLE. Ejecutar: npx ts-node scripts/validate-bitacora-table.ts
 */
import 'reflect-metadata';
import { AppDataSource } from '../src/data-source';

async function validate() {
  console.log('Conectando a la base de datos...');
  await AppDataSource.initialize();

  const q = AppDataSource.createQueryRunner();

  try {
    const tableExists = await q.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'siaf_bitacora'
      ) as "exists"`
    );
    if (!tableExists[0]?.exists) {
      console.log('❌ La tabla siaf_bitacora no existe. Con synchronize: true debería crearse al iniciar el backend.');
      return;
    }
    console.log('✅ Tabla siaf_bitacora existe.');

    const columns = await q.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'siaf_bitacora'
       ORDER BY ordinal_position`
    );
    const names = (columns as Array<{ column_name: string }>).map((c) => c.column_name);
    console.log('Columnas actuales:', names.join(', '));

    const needsAntes = !names.includes('detalle_antes');
    const needsDespues = !names.includes('detalle_despues');

    if (needsAntes || needsDespues) {
      console.log('Aplicando ALTER TABLE para añadir columnas faltantes...');
      if (needsAntes) await q.query('ALTER TABLE siaf_bitacora ADD COLUMN IF NOT EXISTS detalle_antes TEXT');
      if (needsDespues) await q.query('ALTER TABLE siaf_bitacora ADD COLUMN IF NOT EXISTS detalle_despues TEXT');
      console.log('✅ Columnas detalle_antes y/o detalle_despues añadidas.');
    } else {
      console.log('✅ Las columnas detalle_antes y detalle_despues ya existen.');
    }
  } finally {
    q.release();
    await AppDataSource.destroy();
    console.log('Conexión cerrada.');
  }
}

validate().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
