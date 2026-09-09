import { AppDataSource } from '../data-source';
import { UnidadMedica } from '../entity/UnidadMedica';
import { Expediente, ExpedienteDocumento, ExpedienteDocumentoVersion } from '../entity/Expediente';
import { ensureCorrelativoTables } from './ensureCorrelativoTables';

/**
 * Parches de esquema idempotentes (ADD COLUMN IF NOT EXISTS, índices, backfills).
 *
 * Sustituyen a los ALTER sueltos que vivían en index.ts. No reemplazan aún a
 * migraciones TypeORM formales: son el puente seguro mientras synchronize pasa
 * a ser opt-in (DB_SYNCHRONIZE=true solo en BD vacía / desarrollo).
 *
 * Cada bloque tolera "relation does not exist" para no tumbar el arranque si
 * alguna tabla aún no existe (p. ej. primer boot con synchronize).
 */
export async function ensureSchema(): Promise<void> {
  // Asegurar columnas de bitácora (detalle_antes, detalle_despues) para correcciones
  try {
    await AppDataSource.query(`ALTER TABLE siaf_bitacora ADD COLUMN IF NOT EXISTS detalle_antes TEXT`);
    await AppDataSource.query(`ALTER TABLE siaf_bitacora ADD COLUMN IF NOT EXISTS detalle_despues TEXT`);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al asegurar columnas bitácora:', e?.message);
  }

  // Columnas motivo_rechazo y motivos_rechazo en siaf_autorizaciones (uno o varios motivos para estadísticas)
  try {
    await AppDataSource.query(`ALTER TABLE siaf_autorizaciones ADD COLUMN IF NOT EXISTS motivo_rechazo VARCHAR(80)`);
    await AppDataSource.query(`ALTER TABLE siaf_autorizaciones ADD COLUMN IF NOT EXISTS motivos_rechazo TEXT`);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al agregar motivo_rechazo / motivos_rechazo:', e?.message);
  }

  // Columna comentario_rechazo en expedientes (rechazo por Dirección Departamental)
  try {
    await AppDataSource.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS comentario_rechazo TEXT`);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al agregar comentario_rechazo:', e?.message);
  }

  // Columna expediente_documento_id en expediente_bitacora (para tipo correccion)
  try {
    await AppDataSource.query(`ALTER TABLE expediente_bitacora ADD COLUMN IF NOT EXISTS expediente_documento_id INT`);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al agregar expediente_documento_id a bitácora:', e?.message);
  }
  // Columna expediente_documento_version_id (versión reemplazada, para "Ver documento reemplazado")
  try {
    await AppDataSource.query(`ALTER TABLE expediente_bitacora ADD COLUMN IF NOT EXISTS expediente_documento_version_id INT`);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al agregar expediente_documento_version_id a bitácora:', e?.message);
  }
  // Trazabilidad de motivos por versión exacta del documento.
  try {
    await AppDataSource.query(`ALTER TABLE expediente_bitacora_detalle ADD COLUMN IF NOT EXISTS expediente_documento_version_id INT`);
    await AppDataSource.query(`ALTER TABLE expediente_documento_versiones ADD COLUMN IF NOT EXISTS es_actual BOOLEAN NOT NULL DEFAULT FALSE`);
    await AppDataSource.query(`
      UPDATE expediente_documento_versiones v
      SET es_actual = TRUE
      FROM expediente_documentos d
      WHERE v.expediente_documento_id = d.id
        AND v."hashArchivo" = d."hashArchivo"
    `);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al asegurar versiones de documentos:', e?.message);
  }
  // Versiones creadas por el flujo anterior podían conservar solo el archivo
  // reemplazado. Se registra una única versión de recuperación para el archivo
  // vigente que aún no tenga representación; la condición evita duplicarla.
  try {
    const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
    const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
    const documentosSinVersionActual = await docRepo
      .createQueryBuilder('d')
      .where(`NOT EXISTS (
        SELECT 1 FROM expediente_documento_versiones v
        WHERE v.expediente_documento_id = d.id AND v.es_actual = TRUE
      )`)
      .getMany();

    for (const doc of documentosSinVersionActual) {
      const ultimaVersion = await versionRepo.findOne({
        where: { expedienteDocumentoId: doc.id },
        order: { numeroVersion: 'DESC' },
      });
      await versionRepo.save(versionRepo.create({
        expedienteDocumentoId: doc.id,
        numeroVersion: (ultimaVersion?.numeroVersion ?? 0) + 1,
        esActual: true,
        nombreArchivo: doc.nombreArchivo,
        rutaArchivo: doc.rutaArchivo,
        hashArchivo: doc.hashArchivo,
        tamanioBytes: doc.tamanioBytes,
        mimeType: doc.mimeType,
        subidoPorId: doc.subidoPorId,
      }));
    }
  } catch (e: any) {
    console.error('Aviso al recuperar versiones vigentes de documentos:', e?.message);
  }

  // Columnas opcionales de pantalla (si el usuario de BD no es dueño, se omiten sin romper)
  try {
    await AppDataSource.query(`ALTER TABLE permission ADD COLUMN IF NOT EXISTS screen_key VARCHAR`);
    await AppDataSource.query(`ALTER TABLE permission ADD COLUMN IF NOT EXISTS panel VARCHAR`);
  } catch (e: any) {
    // portal_app a menudo no es dueño de permission; no es crítico
  }

  try {
    await ensureCorrelativoTables();
  } catch (e: any) {
    console.error('Aviso al crear tablas de correlativos:', e?.message);
  }

  // Columnas de unidades médicas (código / dirección)
  try {
    await AppDataSource.query(`ALTER TABLE unidad_medica ADD COLUMN IF NOT EXISTS codigo VARCHAR(50)`);
    await AppDataSource.query(`ALTER TABLE unidad_medica ADD COLUMN IF NOT EXISTS direccion TEXT`);
    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_unidad_medica_codigo
      ON unidad_medica (codigo)
      WHERE codigo IS NOT NULL AND codigo <> ''
    `);
  } catch (e: any) {
    console.error('Aviso al agregar codigo/direccion a unidad_medica:', e?.message);
  }

  // Catálogo productos: origen MINFIN | SIBOFA
  try {
    await AppDataSource.query(`
      ALTER TABLE producto_catalogo
      ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'MINFIN'
    `);
    await AppDataSource.query(`
      ALTER TABLE producto_catalogo
      ADD COLUMN IF NOT EXISTS datos_originales JSONB
    `);
    await AppDataSource.query(`
      ALTER TABLE producto_catalogo
      ADD COLUMN IF NOT EXISTS columna_codigo VARCHAR(255)
    `);
    await AppDataSource.query(`
      ALTER TABLE producto_catalogo
      ADD COLUMN IF NOT EXISTS columnas_descripcion JSONB
    `);
    await AppDataSource.query(`
      UPDATE producto_catalogo SET origen = 'MINFIN' WHERE origen IS NULL OR origen = ''
    `);
    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_producto_catalogo_origen_codigo
      ON producto_catalogo (origen, codigo)
    `);
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS producto_catalogo_config (
        origen VARCHAR(20) PRIMARY KEY,
        encabezados JSONB NOT NULL DEFAULT '[]'::jsonb,
        columna_codigo VARCHAR(255) NOT NULL,
        columnas_descripcion JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e: any) {
    console.error('Aviso al agregar origen a producto_catalogo:', e?.message);
  }

  try {
    await AppDataSource.query(`
      ALTER TABLE siaf_items
      ADD COLUMN IF NOT EXISTS catalogo_origen VARCHAR(20)
    `);
  } catch (e: any) {
    console.error('Aviso al agregar catalogo_origen a siaf_items:', e?.message);
  }

  // Columnas origen expediente (unidad y municipio del creador, para filtro DAF)
  try {
    await AppDataSource.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS unidad_origen VARCHAR(255)`);
    await AppDataSource.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS municipio_origen VARCHAR(150)`);
    await AppDataSource.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS numero_orden_compra VARCHAR(100)`);
    await AppDataSource.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS numero_siaf VARCHAR(100)`);
    // Backfill unidad_origen para expedientes ya creados
    await AppDataSource.query(`
      UPDATE expedientes e SET unidad_origen = (SELECT u.unidad_medica FROM users u WHERE u.id = e.usuario_id LIMIT 1)
      WHERE e.unidad_origen IS NULL
    `).catch(() => {});
    // Backfill municipio_origen desde UnidadMedica (ej. "Palín, Escuintla")
    const expRepo = AppDataSource.getRepository(Expediente);
    const expsConUnidad = await expRepo
      .createQueryBuilder('e')
      .select(['e.id', 'e.unidadOrigen'])
      .where('e.municipioOrigen IS NULL')
      .andWhere('e.unidadOrigen IS NOT NULL')
      .getMany()
      .catch(() => []);
    if (expsConUnidad.length > 0) {
      const unidadRepo = AppDataSource.getRepository(UnidadMedica);
      for (const e of expsConUnidad) {
        const nombre = (e as any).unidadOrigen;
        if (!nombre) continue;
        const unidad = await unidadRepo.findOne({ where: { nombre }, relations: ['municipio', 'municipio.departamento'] }).catch(() => null);
        const dep = unidad?.municipio?.departamento?.nombre ?? unidad?.departamento ?? '';
        const texto = unidad?.municipio ? `${unidad.municipio.nombre}, ${dep}`.trim() : (dep || null);
        await expRepo.update({ id: e.id }, { municipioOrigen: texto } as any).catch(() => {});
      }
    }
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al agregar unidad_origen/municipio_origen:', e?.message);
  }

  // Asignar siaf_id a correcciones que lo tienen NULL (así se cargan en la bitácora por SIAF)
  try {
    const beforeCount = await AppDataSource.query(`SELECT COUNT(*) AS c FROM siaf_bitacora WHERE tipo = 'correccion' AND siaf_id IS NULL`);
    await AppDataSource.query(`
      UPDATE siaf_bitacora b
      SET siaf_id = COALESCE(
        (SELECT r.siaf_id FROM siaf_bitacora r WHERE r.tipo = 'rechazo' AND r.siaf_id IS NOT NULL AND r.fecha < b.fecha ORDER BY r.fecha DESC LIMIT 1),
        (SELECT r.siaf_id FROM siaf_bitacora r WHERE r.tipo = 'rechazo' AND r.siaf_id IS NOT NULL ORDER BY r.fecha ASC LIMIT 1)
      )
      WHERE b.tipo = 'correccion' AND b.siaf_id IS NULL
    `);
    const afterCount = await AppDataSource.query(`SELECT COUNT(*) AS c FROM siaf_bitacora WHERE tipo = 'correccion' AND siaf_id IS NULL`);
    const remaining = afterCount?.[0]?.c ?? 0;
    if (remaining === 0) {
      console.log('✅ Bitácora: correcciones con siaf_id NULL asignadas (rechazos y correcciones se muestran por SIAF).');
    } else if ((beforeCount?.[0]?.c ?? 0) > 0) {
      console.log(`⚠️ Bitácora: ${remaining} corrección(es) siguen con siaf_id NULL (se intentará mostrarlas por fecha al cargar bitácora).`);
    }
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al asignar siaf_id a correcciones:', e?.message);
  }
}
