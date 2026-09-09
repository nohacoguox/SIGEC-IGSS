import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runUserRolesMigration } from './migrations/migrate-user-roles';
import { AppDataSource } from './data-source';
import { User } from './entity/User';
import { UnidadMedica } from './entity/UnidadMedica';
import { SiafSolicitud } from './entity/SiafSolicitud';
import { Expediente, ExpedienteDocumento, ExpedienteDocumentoVersion } from './entity/Expediente';
import { Role } from './entity/Role';
import { verifyToken } from './middleware/auth';
import { authRouter } from './modules/auth/routes';
import { rbacRouter } from './modules/rbac/routes';
import { catalogosRouter } from './modules/catalogos/routes';
import { siafRouter } from './modules/siaf/routes';
import { correlativosRouter } from './modules/correlativos/routes';
import { usuariosRouter } from './modules/usuarios/routes';
import { expedientesRouter } from './modules/expedientes/routes';
import { estadisticasRouter } from './modules/estadisticas/routes';
import { catalogoProductosRouter, updateCatalogoTrabajo } from './modules/catalogoProductos/routes';
import { CATALOGO_MAX_MB } from './middleware/upload';
import { syncAppScreenPermissions } from './services/syncAppScreens';
import { ensureCorrelativoTables } from './services/ensureCorrelativoTables';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Migración user_roles (automática al iniciar) y luego conexión TypeORM
runUserRolesMigration()
  .then(() => AppDataSource.initialize())
  .then(async () => {
  console.log('✅ Base de datos conectada exitosamente');

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

  try {
    await syncAppScreenPermissions();
  } catch (e: any) {
    console.error('Aviso al sincronizar permisos de pantallas:', e?.message);
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

  // Test database connection
  try {
    const userCount = await AppDataSource.getRepository(User).count();
    console.log(`📊 Usuarios en base de datos: ${userCount}`);
  } catch (error) {
    console.error('❌ Error al verificar base de datos:', error);
  }

  // Ortografía: revisa texto con LanguageTool (español) y propone correcciones
  const TERMINOS_INSTITUCIONALES = new Set(
    ['siaf', 'igss', 'minfin', 'sibofa', 'daf', 'dd', 'a-01', 's/c'].map((t) => t.toLowerCase())
  );

  const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const distanciaEdicion = (a: string, b: string): number => {
    const filas = a.length + 1;
    const cols = b.length + 1;
    let previa = Array.from({ length: cols }, (_, j) => j);
    for (let i = 1; i < filas; i++) {
      const actual = [i];
      for (let j = 1; j < cols; j++) {
        const costo = a[i - 1] === b[j - 1] ? 0 : 1;
        actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + costo);
      }
      previa = actual;
    }
    return previa[cols - 1];
  };

  /** true si `corta` se obtiene de `larga` quitando letras (typo por letra omitida). */
  const esSubsecuencia = (corta: string, larga: string): boolean => {
    let i = 0;
    for (let j = 0; j < larga.length && i < corta.length; j++) {
      if (corta[i] === larga[j]) i++;
    }
    return i === corta.length;
  };

  /** Letras que el usuario escribió y el candidato no contiene (cuenta repeticiones). */
  const letrasFaltantes = (base: string, candidato: string): number => {
    const disponibles = new Map<string, number>();
    for (const letra of candidato) disponibles.set(letra, (disponibles.get(letra) ?? 0) + 1);
    let faltantes = 0;
    for (const letra of base) {
      const quedan = disponibles.get(letra) ?? 0;
      if (quedan > 0) disponibles.set(letra, quedan - 1);
      else faltantes++;
    }
    return faltantes;
  };

  /**
   * LanguageTool ordena por similitud fonética, así que "reqiere" sugiere "refiere"
   * antes que "requiere". Se reordena favoreciendo los typos más probables al teclear:
   * el candidato debe conservar las letras que sí se escribieron.
   */
  const ordenarSugerencias = (original: string, candidatos: string[]): string[] => {
    const base = sinTildes(original);
    return candidatos
      .map((candidato) => {
        const comparado = sinTildes(candidato);
        let puntaje = distanciaEdicion(base, comparado);
        puntaje += letrasFaltantes(base, comparado) * 1.5;
        if (esSubsecuencia(base, comparado)) puntaje -= 2;
        if (base[0] === comparado[0]) puntaje -= 0.5;
        if (base.length === comparado.length) puntaje -= 0.25;
        return { candidato, puntaje };
      })
      .sort((a, b) => a.puntaje - b.puntaje)
      .map((x) => x.candidato);
  };

  app.post('/api/ortografia/revisar', verifyToken, async (req: Request, res: Response) => {
    try {
      const texto = String(req.body?.texto ?? '').trim();
      if (!texto) {
        return res.status(400).json({ message: 'El texto a revisar es obligatorio.' });
      }
      if (texto.length > 2000) {
        return res.status(400).json({ message: 'El texto no puede superar 2000 caracteres.' });
      }

      const body = new URLSearchParams();
      body.set('text', texto);
      body.set('language', 'es');
      body.set('enabledOnly', 'false');

      const ltRes = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!ltRes.ok) {
        const detalle = await ltRes.text().catch(() => '');
        console.error('LanguageTool error:', ltRes.status, detalle);
        return res.status(502).json({
          message: 'No se pudo revisar la ortografía en este momento. Intente de nuevo en unos segundos.',
        });
      }

      const data: any = await ltRes.json();
      const matches = Array.isArray(data?.matches) ? data.matches : [];

      type Suggestion = {
        original: string;
        replacement: string;
        options: string[];
        message: string;
        offset: number;
        length: number;
      };

      const suggestions: Suggestion[] = [];
      for (const match of matches) {
        const offset = Number(match?.offset);
        const length = Number(match?.length);
        if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) continue;

        const original = texto.slice(offset, offset + length);
        if (!original) continue;
        if (TERMINOS_INSTITUCIONALES.has(original.toLowerCase())) continue;

        const candidatos: string[] = (Array.isArray(match?.replacements) ? match.replacements : [])
          .map((r: any) => String(r?.value ?? '').trim())
          .filter((v: string) => v && v !== original);
        if (candidatos.length === 0) continue;

        const options = ordenarSugerencias(original, Array.from(new Set(candidatos))).slice(0, 6);

        suggestions.push({
          original,
          replacement: options[0],
          options,
          message: String(match?.message || 'Corrección sugerida'),
          offset,
          length,
        });
      }

      // Aplicar de atrás hacia adelante para no alterar offsets
      let corrected = texto;
      const applied = [...suggestions].sort((a, b) => b.offset - a.offset);
      for (const s of applied) {
        corrected = corrected.slice(0, s.offset) + s.replacement + corrected.slice(s.offset + s.length);
      }

      return res.json({
        original: texto,
        corrected,
        suggestions: suggestions.sort((a, b) => a.offset - b.offset),
        count: suggestions.length,
      });
    } catch (e: any) {
      console.error('Error en /api/ortografia/revisar:', e?.message || e);
      return res.status(500).json({ message: 'Error al revisar ortografía.' });
    }
  });

  // Auth endpoints (login, recuperación y cambio de contraseña) → src/modules/auth
  app.use('/api/auth', authRouter);

  // Roles, permisos y catálogo de pantallas → src/modules/rbac
  app.use('/api', rbacRouter);

  // Correlativos SIAF y de expedientes (secuencia, reservas y configuración) → src/modules/correlativos
  app.use('/api/correlativos', correlativosRouter);

  // Estadísticas del dashboard (admin)
  app.get('/api/dashboard/stats', verifyToken, async (req: Request, res: Response) => {
    try {
      const [totalUsers, totalRoles, totalReports] = await Promise.all([
        AppDataSource.getRepository(User).count(),
        AppDataSource.getRepository(Role).count(),
        AppDataSource.getRepository(SiafSolicitud).count(),
      ]);
      res.json({ totalUsers, totalRoles, totalReports });
    } catch (error) {
      console.error('Error al obtener estadísticas del dashboard:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas del dashboard' });
    }
  });

  // Expedientes: CRUD, revisión DAF, documentos y versiones → src/modules/expedientes
  app.use('/api/expedientes', expedientesRouter);

  // Usuarios: alta, edición, roles asignados, director y personal médico → src/modules/usuarios
  app.use('/api/users', usuariosRouter);

  // Puestos, departamentos, municipios, unidades médicas y áreas → src/modules/catalogos
  app.use('/api', catalogosRouter);

  // Catálogo de productos MINFIN/SIBOFA: consulta, importación Excel y configuración → src/modules/catalogoProductos
  app.use('/api/catalogo-productos', catalogoProductosRouter);

  // SIAF: solicitudes, revisión de Dirección Departamental, adjuntos y bitácora → src/modules/siaf
  app.use('/api/siaf', siafRouter);

  // Estadísticas y analítica (SIAF, expedientes y DAF) → src/modules/estadisticas
  app.use('/api/estadisticas', estadisticasRouter);

  // Manejo de errores (p. ej. multer o errores no capturados en rutas)
  app.use((err: any, req: Request, res: Response, _next: Function) => {
    console.error('Error en petición:', err);
    if (res.headersSent) return;
    const isFileTooLarge = err?.code === 'LIMIT_FILE_SIZE' || err?.message?.includes('File too large');
    const msg = isFileTooLarge
      ? `Archivo demasiado grande. Límite: ${CATALOGO_MAX_MB} MB. Comprima el Excel o use un archivo más pequeño.`
      : (err?.message || String(err));
    updateCatalogoTrabajo(String(req.query?.trabajoId ?? '') || null, {
      estado: 'ERROR',
      mensaje: msg,
    });
    res.status(isFileTooLarge ? 413 : 500).json({ message: msg });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📡 API disponible en http://localhost:${PORT}/api`);
  });

}).catch(error => {
  console.error('❌ Error al conectar con la base de datos:', error);
  process.exit(1);
});

export default app;