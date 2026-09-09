import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runUserRolesMigration } from './migrations/migrate-user-roles';
import { AppDataSource } from './data-source';
import { User } from './entity/User';
import { UnidadMedica } from './entity/UnidadMedica';
import { SiafSolicitud, SiafAutorizacion, SiafBitacora } from './entity/SiafSolicitud';
import { Expediente, ExpedienteDocumento, ExpedienteBitacora, ExpedienteDocumentoVersion } from './entity/Expediente';
import { ProductoCatalogo } from './entity/ProductoCatalogo';
import { ProductoCatalogoConfig } from './entity/ProductoCatalogoConfig';
import { Role } from './entity/Role';
import { In } from 'typeorm';
import { randomUUID } from 'crypto';
import { verifyToken, authorizeRoles, authorizeRolesOrPermissions } from './middleware/auth';
import { authRouter } from './modules/auth/routes';
import { rbacRouter } from './modules/rbac/routes';
import { catalogosRouter } from './modules/catalogos/routes';
import { siafRouter } from './modules/siaf/routes';
import { correlativosRouter } from './modules/correlativos/routes';
import { usuariosRouter } from './modules/usuarios/routes';
import { expedientesRouter } from './modules/expedientes/routes';
import { uploadMemory, CATALOGO_MAX_MB } from './middleware/upload';
import { parseOrigen, CatalogoOrigenApi } from './services/catalogoOrigen';
import { syncAppScreenPermissions } from './services/syncAppScreens';
import { ensureCorrelativoTables } from './services/ensureCorrelativoTables';
import { resolveAnalyticsScope } from './services/analyticsScope';
import {
  clasificarAlCorte,
  construirCierresMensuales,
  construirTrazabilidad,
  promediarTiemposDesdeHistoriales,
} from './services/expedienteAnalytics';
import {
  clasificarSiafAlCorte,
  construirCierresMensualesSiaf,
  construirTrazabilidadSiaf,
  promediarTiemposSiaf,
  unificarEventosSiaf,
} from './services/siafAnalytics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

let XLSX: any;
try {
  XLSX = require('xlsx');
  if (!XLSX.default && !XLSX.read) XLSX = require('xlsx');
  if (XLSX.default && XLSX.default.read) XLSX = XLSX.default;
} catch (e) {
  console.warn('xlsx no cargado al inicio:', (e as Error).message);
}

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

  // Catálogo de productos (código -> descripción): consulta para formulario SIAF; importación Excel solo con permiso
  const productoCatalogoRepository = AppDataSource.getRepository(ProductoCatalogo);

  type CatalogoTrabajo = {
    id: string;
    userId: number;
    tipo: 'IMPORTAR' | 'CONFIGURAR';
    progreso: number;
    estado: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
    mensaje: string;
    creadoEn: number;
  };
  const catalogoTrabajos = new Map<string, CatalogoTrabajo>();
  const updateCatalogoTrabajo = (
    id: string | null,
    cambios: Partial<Pick<CatalogoTrabajo, 'progreso' | 'estado' | 'mensaje'>>
  ) => {
    if (!id) return;
    const job = catalogoTrabajos.get(id);
    if (!job) return;
    Object.assign(job, cambios);
  };

  app.post('/api/catalogo-productos/trabajos', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), (req: Request, res: Response) => {
    const tipo = String(req.body?.tipo ?? '').toUpperCase();
    if (tipo !== 'IMPORTAR' && tipo !== 'CONFIGURAR') {
      return res.status(400).json({ message: 'Tipo de trabajo inválido.' });
    }
    const now = Date.now();
    for (const [id, job] of catalogoTrabajos) {
      if (now - job.creadoEn > 60 * 60 * 1000) catalogoTrabajos.delete(id);
    }
    const id = randomUUID();
    catalogoTrabajos.set(id, {
      id,
      userId: Number((req as any).user.userId),
      tipo,
      progreso: 1,
      estado: 'PENDIENTE',
      mensaje: 'Preparando proceso...',
      creadoEn: now,
    });
    res.status(201).json({ id });
  });

  app.get('/api/catalogo-productos/trabajos/:id', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), (req: Request, res: Response) => {
    const job = catalogoTrabajos.get(req.params.id);
    if (!job || job.userId !== Number((req as any).user.userId)) {
      return res.status(404).json({ message: 'Proceso no encontrado.' });
    }
    res.json(job);
  });

  app.get('/api/catalogo-productos/codigo/:codigo', verifyToken, async (req: Request, res: Response) => {
    try {
      const codigo = (req.params.codigo || '').trim();
      if (!codigo) {
        return res.status(400).json({ message: 'Código es requerido.' });
      }
      const origenFiltro = parseOrigen(req.query.origen);
      if (!origenFiltro) {
        return res.status(400).json({ message: 'Seleccione el catálogo MINFIN, SIBOFA o SUBPRODUCTOS.' });
      }
      const qb = productoCatalogoRepository
        .createQueryBuilder('p')
        .where('p.codigo = :codigo', { codigo })
        .andWhere('p.origen = :origen', { origen: origenFiltro });
      const producto = await qb.getOne();
      if (!producto) {
        return res.status(404).json({ message: 'Código no encontrado en el catálogo.' });
      }
      res.json({
        codigo: producto.codigo,
        descripcion: producto.descripcion ?? '',
        origen: producto.origen,
      });
    } catch (err: any) {
      console.error('Error al buscar código en catálogo:', err);
      res.status(500).json({ message: err?.message || 'Error al consultar el catálogo.' });
    }
  });

  // Autocompletado / listado de códigos para el formulario SIAF (cualquier usuario autenticado)
  app.get('/api/catalogo-productos/buscar', verifyToken, async (req: Request, res: Response) => {
    try {
      const origen = parseOrigen(req.query.origen);
      if (!origen) {
        return res.status(400).json({ message: 'Seleccione el catálogo MINFIN, SIBOFA o SUBPRODUCTOS.' });
      }
      const q = String(req.query.q ?? '').trim();
      const maxLimit = origen === 'SUBPRODUCTOS' ? 500 : 25;
      const defaultLimit = origen === 'SUBPRODUCTOS' && q.length < 1 ? 200 : 15;
      const limit = Math.min(maxLimit, Math.max(1, parseInt(String(req.query.limit ?? String(defaultLimit)), 10) || defaultLimit));
      // Para ítems MINFIN/SIBOFA se exige texto; para subproductos se permite listar sin filtro.
      if (q.length < 1 && origen !== 'SUBPRODUCTOS') {
        return res.json({ items: [] });
      }
      const qb = productoCatalogoRepository
        .createQueryBuilder('p')
        .select(['p.codigo', 'p.descripcion', 'p.origen'])
        .where('p.origen = :origen', { origen })
        .orderBy('p.codigo', 'ASC')
        .take(limit);
      if (q.length >= 1) {
        qb.andWhere('(p.codigo ILIKE :q OR p.descripcion ILIKE :q)', { q: `%${q}%` });
      }
      const found = await qb.getMany();
      const qLower = q.toLowerCase();
      const items = q
        ? [...found].sort((a, b) => {
            const aPrefix = a.codigo.toLowerCase().startsWith(qLower) ? 0 : 1;
            const bPrefix = b.codigo.toLowerCase().startsWith(qLower) ? 0 : 1;
            if (aPrefix !== bPrefix) return aPrefix - bPrefix;
            return a.codigo.localeCompare(b.codigo, 'es');
          })
        : found;
      res.json({
        items: items.map((p) => ({
          codigo: p.codigo,
          descripcion: p.descripcion ?? '',
          origen: p.origen,
        })),
      });
    } catch (err: any) {
      console.error('Error al buscar códigos del catálogo:', err);
      res.status(500).json({ message: err?.message || 'Error al buscar en el catálogo.' });
    }
  });

  const excelColumnLabel = (index: number) => {
    let value = index + 1;
    let label = '';
    while (value > 0) {
      value -= 1;
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26);
    }
    return label;
  };

  const buildUniqueHeaders = (row: any[]) => {
    const counts = new Map<string, number>();
    return row.map((value: any, index: number) => {
      const base = String(value ?? '').trim() || `Columna ${excelColumnLabel(index)}`;
      const count = (counts.get(base) ?? 0) + 1;
      counts.set(base, count);
      return count === 1 ? base : `${base} (${count})`;
    });
  };

  const normalizeCatalogHeader = (value: unknown) =>
    String(value ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();

  const detectCatalogHeaderRow = (rows: any[][]) => {
    let bestIndex = 0;
    let bestScore = -1;
    rows.slice(0, 20).forEach((row, index) => {
      const nonEmpty = (row || []).filter((cell: any) => String(cell ?? '').trim()).length;
      const hasCode = (row || []).some((cell: any) => normalizeCatalogHeader(cell).includes('codigo'));
      const score = nonEmpty + (hasCode ? 10 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  };

  const buildCatalogDescription = (data: Record<string, string>, columns: string[]) => {
    const parts = columns
      .map((column) => String(data[column] ?? '').trim().replace(/(?:\s*;\s*)+$/g, ''))
      .filter(Boolean);
    return parts.length ? `${parts.join('; ')};` : '';
  };

  app.post('/api/catalogo-productos/importar', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), uploadMemory.single('archivo'), async (req: Request, res: Response) => {
    const trabajoId = String(req.query.trabajoId ?? '') || null;
    const send500 = (msg: string) => {
      updateCatalogoTrabajo(trabajoId, { estado: 'ERROR', mensaje: msg });
      try { res.status(500).json({ message: msg }); } catch (_) {}
    };
    try {
      updateCatalogoTrabajo(trabajoId, {
        progreso: 26,
        estado: 'PROCESANDO',
        mensaje: 'Archivo recibido. Leyendo el Excel...',
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (!XLSX?.read || !XLSX?.utils) {
        return send500('No se pudo cargar el paquete xlsx. Ejecute en backend: npm install xlsx');
      }
      const origen = parseOrigen(req.body?.origen);
      if (!origen) {
        return res.status(400).json({ message: 'Debe indicar el catálogo de origen (MINFIN, SIBOFA o SUBPRODUCTOS).' });
      }
      const file = (req as any).file;
      const buffer = file?.buffer ?? file;
      if (!file || !buffer || !Buffer.isBuffer(buffer)) {
        return res.status(400).json({ message: 'Debe enviar un archivo Excel (campo: archivo).' });
      }
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      updateCatalogoTrabajo(trabajoId, { progreso: 35, mensaje: 'Excel leído. Analizando filas...' });
      await new Promise<void>((resolve) => setImmediate(resolve));
      const firstSheetName = workbook.SheetNames?.[0];
      if (!firstSheetName) {
        return res.status(400).json({ message: 'El archivo no contiene hojas.' });
      }
      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) {
        return res.status(400).json({ message: 'No se pudo leer la primera hoja.' });
      }
      // raw:false conserva el texto mostrado por Excel (incluidos ceros iniciales).
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as any[][];
      if (!Array.isArray(rows) || rows.length < 1) {
        return res.status(400).json({ message: 'El archivo no tiene filas.' });
      }

      const headerRowIndex = detectCatalogHeaderRow(rows);
      const headers = buildUniqueHeaders(rows[headerRowIndex] || []);
      const normalizedHeaders = headers.map(normalizeCatalogHeader);
      let codigoIdx = -1;
      if (origen === 'SUBPRODUCTOS') {
        codigoIdx = normalizedHeaders.findIndex(
          (header) => header.includes('codigo') && header.includes('subproduct')
        );
      }
      if (codigoIdx < 0) {
        codigoIdx = normalizedHeaders.findIndex((header) => header.includes('codigo') && header.includes('insumo'));
      }
      if (codigoIdx < 0) codigoIdx = normalizedHeaders.findIndex((header) => header.includes('codigo'));
      if (codigoIdx < 0) {
        return res.status(400).json({
          message: 'No se encontró automáticamente una columna de código en el archivo.',
        });
      }

      const configRepository = AppDataSource.getRepository(ProductoCatalogoConfig);
      const previousConfig = await configRepository.findOne({ where: { origen } });
      let selectedDescriptionColumns = (previousConfig?.columnasDescripcion ?? [])
        .filter((column) => headers.includes(column));
      // Primera carga de subproductos: usar columna de descripción si existe
      if (selectedDescriptionColumns.length === 0 && origen === 'SUBPRODUCTOS') {
        selectedDescriptionColumns = headers.filter((h) =>
          normalizeCatalogHeader(h).includes('descripcion')
        );
      }

      type RegistroImportado = {
        codigo: string;
        descripcion: string;
        datosOriginales: Record<string, string>;
      };
      const mapCodigo = new Map<string, RegistroImportado>();
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const rawCode = row[codigoIdx];
        const codigo = rawCode !== undefined && rawCode !== null ? String(rawCode).trim() : '';
        if (!codigo) continue;

        const datosOriginales = headers.reduce<Record<string, string>>((acc, header, index) => {
          acc[header] = String(row[index] ?? '').trim();
          return acc;
        }, {});
        const descripcion = buildCatalogDescription(datosOriginales, selectedDescriptionColumns);
        mapCodigo.set(codigo, { codigo, descripcion, datosOriginales });
        if (i % 5000 === 0) {
          const ratio = i / Math.max(rows.length, 1);
          updateCatalogoTrabajo(trabajoId, {
            progreso: Math.min(59, 36 + Math.round(ratio * 23)),
            mensaje: `Analizando filas: ${i.toLocaleString('es-GT')} de ${rows.length.toLocaleString('es-GT')}...`,
          });
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
      }
      const registros = Array.from(mapCodigo.values());
      if (registros.length === 0) {
        return res.status(400).json({
          message: 'No se encontraron filas con código válido.',
        });
      }

      const columnaCodigoNombre = headers[codigoIdx];
      updateCatalogoTrabajo(trabajoId, { progreso: 60, mensaje: 'Verificando códigos existentes...' });
      const existentes = await productoCatalogoRepository.find({
        where: { origen },
        select: { codigo: true },
      });
      const codigosExistentes = new Set(existentes.map((item) => item.codigo));
      const nuevos = registros.filter((item) => !codigosExistentes.has(item.codigo));
      const omitidos = registros.length - nuevos.length;

      updateCatalogoTrabajo(trabajoId, {
        progreso: 65,
        mensaje: `${nuevos.length.toLocaleString('es-GT')} códigos nuevos; ${omitidos.toLocaleString('es-GT')} ya existentes.`,
      });
      // La importación es incremental: nunca borra ni reemplaza códigos existentes.
      await AppDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(ProductoCatalogo);
        const configRepo = manager.getRepository(ProductoCatalogoConfig);
        const CHUNK = 500;
        for (let i = 0; i < nuevos.length; i += CHUNK) {
          const chunk = nuevos.slice(i, i + CHUNK).map((r) => ({
            origen,
            codigo: r.codigo,
            descripcion: r.descripcion,
            datosOriginales: r.datosOriginales,
            columnaCodigo: columnaCodigoNombre,
            columnasDescripcion: selectedDescriptionColumns,
          }));
          await repo.createQueryBuilder().insert().values(chunk).orIgnore().execute();
          updateCatalogoTrabajo(trabajoId, {
            progreso: Math.min(98, 65 + Math.round(((i + chunk.length) / Math.max(nuevos.length, 1)) * 33)),
            mensaje: `Guardando códigos nuevos: ${Math.min(i + chunk.length, nuevos.length).toLocaleString('es-GT')} de ${nuevos.length.toLocaleString('es-GT')}...`,
          });
        }
        await configRepo.save({
          origen,
          encabezados: headers,
          columnaCodigo: columnaCodigoNombre,
          columnasDescripcion: selectedDescriptionColumns,
        });
      });
      updateCatalogoTrabajo(trabajoId, {
        progreso: 100,
        estado: 'COMPLETADO',
        mensaje: `Completado: ${nuevos.length.toLocaleString('es-GT')} nuevos y ${omitidos.toLocaleString('es-GT')} existentes omitidos.`,
      });
      return res.json({
        message: `Catálogo ${origen}: ${nuevos.length.toLocaleString('es-GT')} códigos nuevos cargados y ${omitidos.toLocaleString('es-GT')} existentes omitidos.`,
        origen,
        nuevos: nuevos.length,
        omitidos,
        columnaCodigo: columnaCodigoNombre,
        encabezados: headers,
        columnasDescripcion: selectedDescriptionColumns,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('Error al importar catálogo:', err);
      if (!res.headersSent) send500(msg);
    }
  });

  app.get('/api/catalogo-productos/config', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), async (req: Request, res: Response) => {
    try {
      const origen = parseOrigen(req.query.origen);
      if (!origen) {
        return res.status(400).json({ message: 'Debe indicar origen=MINFIN, SIBOFA o SUBPRODUCTOS.' });
      }
      const config = await AppDataSource.getRepository(ProductoCatalogoConfig).findOne({ where: { origen } });
      res.json({
        origen,
        encabezados: config?.encabezados ?? [],
        columnaCodigo: config?.columnaCodigo ?? null,
        columnasDescripcion: config?.columnasDescripcion ?? [],
        updatedAt: config?.updatedAt ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Error al obtener la configuración del catálogo.' });
    }
  });

  app.put('/api/catalogo-productos/config', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), async (req: Request, res: Response) => {
    const trabajoId = String(req.query.trabajoId ?? '') || null;
    try {
      updateCatalogoTrabajo(trabajoId, {
        progreso: 2,
        estado: 'PROCESANDO',
        mensaje: 'Preparando actualización de descripciones...',
      });
      const origen = parseOrigen(req.body?.origen);
      if (!origen) {
        return res.status(400).json({ message: 'Debe indicar el catálogo MINFIN, SIBOFA o SUBPRODUCTOS.' });
      }
      const configRepository = AppDataSource.getRepository(ProductoCatalogoConfig);
      const config = await configRepository.findOne({ where: { origen } });
      if (!config) {
        return res.status(404).json({ message: `Primero cargue el archivo del catálogo ${origen}.` });
      }
      const requested: string[] = Array.isArray(req.body?.columnasDescripcion)
        ? req.body.columnasDescripcion.map((value: unknown) => String(value))
        : [];
      const columns: string[] = Array.from(new Set<string>(requested))
        .filter((column) => config.encabezados.includes(column));
      if (columns.length === 0) {
        return res.status(400).json({ message: 'Seleccione al menos una columna para la descripción.' });
      }

      await AppDataSource.transaction(async (manager) => {
        const rows: Array<{ id: number }> = await manager.query(
          `SELECT id FROM producto_catalogo WHERE origen = $1 ORDER BY id`,
          [origen]
        );
        const CHUNK = 5000;
        const columnsJson = JSON.stringify(columns);
        for (let i = 0; i < rows.length; i += CHUNK) {
          const ids = rows.slice(i, i + CHUNK).map((row) => row.id);
          await manager.query(
            `
              UPDATE producto_catalogo p
              SET descripcion = COALESCE((
                SELECT string_agg(
                  regexp_replace(trim(p.datos_originales ->> c.nombre), '(\\s*;\\s*)+$', '', 'g'),
                  '; ' ORDER BY c.orden
                ) || ';'
                FROM jsonb_array_elements_text($1::jsonb)
                  WITH ORDINALITY AS c(nombre, orden)
                WHERE NULLIF(trim(p.datos_originales ->> c.nombre), '') IS NOT NULL
              ), ''),
              columnas_descripcion = $1::jsonb
              WHERE p.id = ANY($2::int[])
            `,
            [columnsJson, ids]
          );
          const processed = Math.min(i + ids.length, rows.length);
          updateCatalogoTrabajo(trabajoId, {
            progreso: Math.min(99, 2 + Math.round((processed / Math.max(rows.length, 1)) * 97)),
            mensaje: `Actualizando descripciones: ${processed.toLocaleString('es-GT')} de ${rows.length.toLocaleString('es-GT')}...`,
          });
        }
        await manager.getRepository(ProductoCatalogoConfig).save({
          ...config,
          columnasDescripcion: columns,
        });
      });
      updateCatalogoTrabajo(trabajoId, {
        progreso: 100,
        estado: 'COMPLETADO',
        mensaje: `Descripciones del catálogo ${origen} actualizadas.`,
      });
      res.json({
        message: `Descripción del catálogo ${origen} actualizada correctamente.`,
        origen,
        columnasDescripcion: columns,
      });
    } catch (err: any) {
      console.error('Error al configurar descripción del catálogo:', err);
      updateCatalogoTrabajo(trabajoId, {
        estado: 'ERROR',
        mensaje: err?.message || 'Error al guardar la configuración.',
      });
      res.status(500).json({ message: err?.message || 'Error al guardar la configuración.' });
    }
  });

  app.get('/api/catalogo-productos/stats', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), async (req: Request, res: Response) => {
    try {
      const buildStats = async (origen: CatalogoOrigenApi) => {
        const total = await productoCatalogoRepository.count({ where: { origen } });
        const last = await productoCatalogoRepository.find({
          where: { origen },
          order: { createdAt: 'DESC' as const },
          take: 1,
        });
        return {
          total,
          ultimaActualizacion: last[0]?.createdAt ?? null,
          columnaCodigo: last[0]?.columnaCodigo ?? null,
          columnasDescripcion: last[0]?.columnasDescripcion ?? [],
        };
      };
      const origenFiltro = parseOrigen(req.query.origen);
      if (origenFiltro) {
        const s = await buildStats(origenFiltro);
        return res.json({ origen: origenFiltro, ...s });
      }
      const [minfin, sibofa, subproductos] = await Promise.all([
        buildStats('MINFIN'),
        buildStats('SIBOFA'),
        buildStats('SUBPRODUCTOS'),
      ]);
      res.json({
        MINFIN: minfin,
        SIBOFA: sibofa,
        SUBPRODUCTOS: subproductos,
        total: minfin.total + sibofa.total + subproductos.total,
      });
    } catch (err: any) {
      console.error('Error al obtener estadísticas del catálogo:', err);
      res.json({
        MINFIN: { total: 0, ultimaActualizacion: null },
        SIBOFA: { total: 0, ultimaActualizacion: null },
        SUBPRODUCTOS: { total: 0, ultimaActualizacion: null },
        total: 0,
      });
    }
  });

  // Listado paginado / búsqueda por catálogo (para visualizar códigos cargados)
  app.get('/api/catalogo-productos', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), async (req: Request, res: Response) => {
    try {
      const origen = parseOrigen(req.query.origen);
      if (!origen) {
        return res.status(400).json({ message: 'Debe indicar origen=MINFIN, SIBOFA o SUBPRODUCTOS.' });
      }
      const q = String(req.query.q ?? '').trim();
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25));
      const qb = productoCatalogoRepository
        .createQueryBuilder('p')
        .where('p.origen = :origen', { origen });
      if (q) {
        qb.andWhere('(p.codigo ILIKE :q OR p.descripcion ILIKE :q)', { q: `%${q}%` });
      }
      qb.orderBy('p.codigo', 'ASC');
      const total = await qb.getCount();
      const items = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();
      res.json({
        origen,
        total,
        page,
        limit,
        items: items.map((p) => ({
          id: p.id,
          codigo: p.codigo,
          descripcion: p.descripcion ?? '',
          origen: p.origen,
          datosOriginales: p.datosOriginales ?? {},
        })),
      });
    } catch (err: any) {
      console.error('Error al listar catálogo:', err);
      res.status(500).json({ message: err?.message || 'Error al listar el catálogo.' });
    }
  });

  // SIAF: solicitudes, revisión de Dirección Departamental, adjuntos y bitácora → src/modules/siaf
  app.use('/api/siaf', siafRouter);

  // Estadísticas de tiempos SIAF: tiempo promedio de revisión (generación → autorización/rechazo) y tiempo promedio de corrección (rechazo → corrección)
  app.get('/api/estadisticas/siaf-tiempos', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-tiempos']), async (req: Request, res: Response) => {
    const desde = new Date();
    const dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias || 90), 10) || 90));
    desde.setDate(desde.getDate() - dias);
    desde.setHours(0, 0, 0, 0);

    try {
      const autRepo = AppDataSource.getRepository(SiafAutorizacion);
      const bitacoraRepo = AppDataSource.getRepository(SiafBitacora);
      const siafRepo = AppDataSource.getRepository(SiafSolicitud);

      const autorizaciones = await autRepo
        .createQueryBuilder('aut')
        .innerJoinAndSelect('aut.siaf', 'siaf')
        .where('aut.fecha_autorizacion >= :desde', { desde })
        .getMany();

      const tiemposRevisionHoras: number[] = [];
      const tiemposAutorizacionHoras: number[] = [];
      for (const aut of autorizaciones) {
        const siaf = aut.siaf;
        if (!siaf?.createdAt) continue;
        const creado = new Date(siaf.createdAt).getTime();
        const decidido = new Date(aut.fechaAutorizacion).getTime();
        const horas = (decidido - creado) / (1000 * 60 * 60);
        if (horas >= 0) {
          tiemposRevisionHoras.push(horas);
          if (String(aut.accion).toLowerCase() === 'autorizado') {
            tiemposAutorizacionHoras.push(horas);
          }
        }
      }
      const promedioRevisionHoras = tiemposRevisionHoras.length > 0
        ? tiemposRevisionHoras.reduce((a, b) => a + b, 0) / tiemposRevisionHoras.length
        : null;
      const cantidadRevisados = tiemposRevisionHoras.length;
      const promedioAutorizacionHoras = tiemposAutorizacionHoras.length > 0
        ? tiemposAutorizacionHoras.reduce((a, b) => a + b, 0) / tiemposAutorizacionHoras.length
        : null;
      const cantidadAutorizados = tiemposAutorizacionHoras.length;

      const siafsConBitacora = await siafRepo
        .createQueryBuilder('s')
        .innerJoin('s.bitacora', 'b')
        .where('s.createdAt >= :desde', { desde })
        .getMany();
      const siafIds = [...new Set(siafsConBitacora.map((s) => s.id))];
      const tiemposCorreccionHoras: number[] = [];
      for (const siafId of siafIds) {
        const entradas = await bitacoraRepo
          .createQueryBuilder('b')
          .innerJoin('b.siaf', 'siaf')
          .where('siaf.id = :siafId', { siafId })
          .orderBy('b.fecha', 'ASC')
          .getMany();
        let fechaRechazo: Date | null = null;
        for (const e of entradas) {
          if (e.tipo === 'rechazo') fechaRechazo = new Date(e.fecha);
          if (e.tipo === 'correccion' && fechaRechazo) {
            const horas = (new Date(e.fecha).getTime() - fechaRechazo.getTime()) / (1000 * 60 * 60);
            if (horas >= 0) tiemposCorreccionHoras.push(horas);
            fechaRechazo = null;
          }
        }
      }
      const promedioCorreccionHoras = tiemposCorreccionHoras.length > 0
        ? tiemposCorreccionHoras.reduce((a, b) => a + b, 0) / tiemposCorreccionHoras.length
        : null;
      const cantidadConCorreccion = tiemposCorreccionHoras.length;

      const porSemana: { semana: string; promedioRevisionHoras: number; promedioAutorizacionHoras: number; promedioCorreccionHoras: number; cantidadRevisados: number; cantidadAutorizados: number; cantidadCorrecciones: number }[] = [];
      const semanalesRevision = new Map<string, number[]>();
      const semanalesAutorizacion = new Map<string, number[]>();
      const semanalesCorreccion = new Map<string, number[]>();
      const keySemana = (d: Date) => {
        const lunes = new Date(d);
        lunes.setDate(lunes.getDate() - ((d.getDay() + 6) % 7));
        return lunes.toISOString().slice(0, 10);
      };
      for (const aut of autorizaciones) {
        const siaf = aut.siaf;
        if (!siaf?.createdAt) continue;
        const decidido = new Date(aut.fechaAutorizacion);
        const creado = new Date(siaf.createdAt).getTime();
        const horas = (decidido.getTime() - creado) / (1000 * 60 * 60);
        if (horas >= 0) {
          const k = keySemana(decidido);
          if (!semanalesRevision.has(k)) semanalesRevision.set(k, []);
          semanalesRevision.get(k)!.push(horas);
          if (String(aut.accion).toLowerCase() === 'autorizado') {
            if (!semanalesAutorizacion.has(k)) semanalesAutorizacion.set(k, []);
            semanalesAutorizacion.get(k)!.push(horas);
          }
        }
      }
      const bitacoraTodas = await bitacoraRepo
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.siaf', 'siaf')
        .where('b.fecha >= :desde', { desde })
        .orderBy('b.fecha', 'ASC')
        .getMany();
      const fechaRechazoPorSiaf = new Map<number, Date>();
      for (const e of bitacoraTodas) {
        const siafId = (e.siaf as any)?.id;
        if (!siafId) continue;
        if (e.tipo === 'rechazo') fechaRechazoPorSiaf.set(siafId, new Date(e.fecha));
        if (e.tipo === 'correccion') {
          const fr = fechaRechazoPorSiaf.get(siafId);
          if (fr) {
            const horas = (new Date(e.fecha).getTime() - fr.getTime()) / (1000 * 60 * 60);
            if (horas >= 0) {
              const k = keySemana(new Date(e.fecha));
              if (!semanalesCorreccion.has(k)) semanalesCorreccion.set(k, []);
              semanalesCorreccion.get(k)!.push(horas);
            }
            fechaRechazoPorSiaf.delete(siafId);
          }
        }
      }
      const semanasSet = new Set([...semanalesRevision.keys(), ...semanalesCorreccion.keys(), ...semanalesAutorizacion.keys()]);
      const semanasOrdenadas = [...semanasSet].sort();
      for (const k of semanasOrdenadas) {
        const rev = semanalesRevision.get(k) ?? [];
        const aut = semanalesAutorizacion.get(k) ?? [];
        const corr = semanalesCorreccion.get(k) ?? [];
        porSemana.push({
          semana: k,
          promedioRevisionHoras: rev.length ? rev.reduce((a, b) => a + b, 0) / rev.length : 0,
          promedioAutorizacionHoras: aut.length ? aut.reduce((a, b) => a + b, 0) / aut.length : 0,
          promedioCorreccionHoras: corr.length ? corr.reduce((a, b) => a + b, 0) / corr.length : 0,
          cantidadRevisados: rev.length,
          cantidadAutorizados: aut.length,
          cantidadCorrecciones: corr.length,
        });
      }
      porSemana.sort((a, b) => a.semana.localeCompare(b.semana));

      res.json({
        dias,
        desde: desde.toISOString(),
        promedioRevisionHoras,
        promedioAutorizacionHoras,
        promedioCorreccionHoras,
        cantidadRevisados,
        cantidadAutorizados,
        cantidadConCorreccion,
        porSemana,
      });
    } catch (err: any) {
      console.error('Error al obtener estadísticas SIAF:', err?.message || err);
      if (err?.stack) console.error(err.stack);
      const message = err?.message || 'Error al obtener estadísticas.';
      res.status(500).json({ message });
    }
  });

  // Estadísticas: motivos de rechazo (conteo por categoría)
  const MOTIVOS_RECHAZO_ETIQUETAS: Record<string, string> = {
    falta_documento: 'Falta documento',
    ortografia: 'Ortografía / redacción',
    mal_explicado: 'Mal explicado / poco claro',
    datos_incorrectos: 'Datos incorrectos o inconsistentes',
    otro: 'Otro',
  };
  app.get('/api/estadisticas/motivos-rechazo', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-motivos']), async (req: Request, res: Response) => {
    try {
      const dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias || 90), 10) || 90));
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      desde.setHours(0, 0, 0, 0);

      const autRepo = AppDataSource.getRepository(SiafAutorizacion);
      const rechazos = await autRepo
        .createQueryBuilder('aut')
        .where('aut.accion = :accion', { accion: 'rechazado' })
        .andWhere('aut.fecha_autorizacion >= :desde', { desde })
        .select('aut.motivo_rechazo', 'motivoRechazo')
        .addSelect('aut.motivos_rechazo', 'motivosRechazo')
        .getRawMany();

      const conteo = new Map<string, number>();
      let sinClasificar = 0;
      for (const r of rechazos) {
        const raw = r as { motivoRechazo?: string | null; motivosRechazo?: string | null };
        let categorias: string[] = [];
        if (raw.motivosRechazo) {
          try {
            const arr = JSON.parse(raw.motivosRechazo);
            if (Array.isArray(arr)) categorias = arr.filter((c: any) => typeof c === 'string');
          } catch {
            categorias = [];
          }
        }
        if (categorias.length === 0 && raw.motivoRechazo) categorias = [raw.motivoRechazo];
        if (categorias.length === 0) {
          sinClasificar += 1;
          continue;
        }
        for (const motivo of categorias) {
          if (motivo && MOTIVOS_RECHAZO_ETIQUETAS[motivo] != null) {
            conteo.set(motivo, (conteo.get(motivo) ?? 0) + 1);
          } else {
            sinClasificar += 1;
          }
        }
      }
      const motivos = Object.keys(MOTIVOS_RECHAZO_ETIQUETAS).map((clave) => ({
        clave,
        etiqueta: MOTIVOS_RECHAZO_ETIQUETAS[clave],
        cantidad: conteo.get(clave) ?? 0,
      }));
      if (sinClasificar > 0) {
        motivos.push({ clave: 'sin_clasificar', etiqueta: 'Sin clasificar', cantidad: sinClasificar });
      }
      motivos.sort((a, b) => b.cantidad - a.cantidad);
      const total = rechazos.length;

      res.json({
        dias,
        desde: desde.toISOString(),
        motivos,
        sinClasificar,
        total,
        etiquetas: MOTIVOS_RECHAZO_ETIQUETAS,
      });
    } catch (err: any) {
      console.error('Error al obtener estadísticas motivos rechazo:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener estadísticas.' });
    }
  });

  // Indicadores del piloto PG2. Se calculan exclusivamente con el expediente
  // digital y su bitácora; no sustituyen la línea base documental n=25.
  app.get('/api/estadisticas/tesis-piloto', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-tiempos']), async (req: Request, res: Response) => {
    try {
      const dias = Math.min(3650, Math.max(1, parseInt(String(req.query.dias || 365), 10) || 365));
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      desde.setHours(0, 0, 0, 0);
      const expRepo = AppDataSource.getRepository(Expediente);
      const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
      const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
      const expedientes = (await expRepo.find({ relations: ['documentos'] }))
        .filter((e) => new Date(e.createdAt).getTime() >= desde.getTime())
        .filter((e) => !!e.numeroOrdenCompra && !!e.numeroSiaf);
      const ids = expedientes.map((e) => e.id);
      const bitacora = ids.length
        ? await bitacoraRepo.find({ where: { expedienteId: In(ids) }, relations: ['detalle'], order: { fecha: 'ASC' } })
        : [];
      const versiones = ids.length
        ? await versionRepo.find({ where: { expedienteDocumentoId: In(expedientes.flatMap((e) => (e.documentos || []).map((d) => d.id))) } })
        : [];
      const porExpediente = new Map<number, ExpedienteBitacora[]>();
      bitacora.forEach((evento) => {
        const eventos = porExpediente.get(evento.expedienteId) ?? [];
        eventos.push(evento);
        porExpediente.set(evento.expedienteId, eventos);
      });
      const versionesPorDocumento = new Map<number, number>();
      versiones.forEach((version) => {
        versionesPorDocumento.set(version.expedienteDocumentoId, (versionesPorDocumento.get(version.expedienteDocumentoId) ?? 0) + 1);
      });
      const diasHabilesEntre = (inicio: Date, fin: Date) => {
        if (fin < inicio) return null;
        const cursor = new Date(inicio);
        cursor.setHours(0, 0, 0, 0);
        const limite = new Date(fin);
        limite.setHours(0, 0, 0, 0);
        let total = 0;
        cursor.setDate(cursor.getDate() + 1); // mismo criterio: no contar el día inicial
        while (cursor <= limite) {
          const dia = cursor.getDay();
          if (dia !== 0 && dia !== 6) total += 1;
          cursor.setDate(cursor.getDate() + 1);
        }
        return total;
      };
      const ciclos: number[] = [];
      const observaciones: number[] = [];
      const rechazosFormales: number[] = [];
      const ciclosTotales: number[] = [];
      const primerasRespuestas: number[] = [];
      let devueltos = 0;
      let pasanMes = 0;
      let trazables = 0;
      let versionesDistinguibles = 0;

      for (const exp of expedientes) {
        const eventos = porExpediente.get(exp.id) ?? [];
        const envios = eventos.filter((e) => e.tipo === 'envio_revision');
        const rechazos = eventos.filter((e) => e.tipo === 'rechazo');
        const aprobacion = eventos.find((e) => e.tipo === 'aprobacion');
        const primeraResolucion = eventos.find((e) => e.tipo === 'rechazo' || e.tipo === 'aprobacion');
        const numeroCiclos = rechazos.length;
        const numeroObservaciones = rechazos.reduce((total, rechazo) => total + (rechazo.detalle?.length ?? 0), 0);
        ciclos.push(numeroCiclos);
        observaciones.push(numeroObservaciones);
        rechazosFormales.push(numeroCiclos);
        if (numeroCiclos > 0) devueltos += 1;

        const inicioRevision = envios[0]?.fecha ? new Date(envios[0].fecha) : null;
        const fin = aprobacion?.fecha ? new Date(aprobacion.fecha) : null;
        if (inicioRevision && primeraResolucion?.fecha) {
          const diasPrimeraRespuesta = diasHabilesEntre(inicioRevision, new Date(primeraResolucion.fecha));
          if (diasPrimeraRespuesta != null) primerasRespuestas.push(diasPrimeraRespuesta);
        }
        if (inicioRevision && fin) {
          const diasCiclo = diasHabilesEntre(inicioRevision, fin);
          if (diasCiclo != null) ciclosTotales.push(diasCiclo);
          if (inicioRevision.getMonth() !== fin.getMonth() || inicioRevision.getFullYear() !== fin.getFullYear()) pasanMes += 1;
        }

        const t1 = !!exp.numeroExpediente;
        const t2 = !!exp.createdAt;
        const t3 = !!exp.usuarioId;
        const t4 = envios.length > 0 && (rechazos.length === 0 || rechazos.every((r) => !!r.fecha));
        const t5 = !!exp.estado;
        if (t1 && t2 && t3 && t4 && t5) trazables += 1;
        const docs = exp.documentos || [];
        if (docs.length > 0 && docs.every((doc) => (versionesPorDocumento.get(doc.id) ?? 0) > 0)) versionesDistinguibles += 1;
      }

      const promedio = (valores: number[]) => valores.length
        ? valores.reduce((a, b) => a + b, 0) / valores.length
        : null;
      const n = expedientes.length;
      res.json({
        periodo: { dias, desde: desde.toISOString() },
        muestra: { total: n, meta: 25, identificados: n, pendientesParaMeta: Math.max(0, 25 - n) },
        lineaBase: {
          eficiencia: { promedioCiclos: 0.92, devueltosPorcentaje: 72, pasaronMes: 5 },
          calidad: { observacionesPromedio: 1.88, rechazosPor100: 12 },
          trazabilidad: { cumplePorcentaje: 28, minutosBusqueda: 10.72 },
          tiempos: { cicloDiasHabiles: 15.4, primeraRespuestaDiasHabiles: 2.52 },
        },
        piloto: {
          eficiencia: { promedioCiclos: promedio(ciclos), devueltosPorcentaje: n ? (devueltos / n) * 100 : null, pasaronMes: pasanMes },
          calidad: { observacionesPromedio: promedio(observaciones), rechazosPor100: n ? (rechazosFormales.reduce((a, b) => a + b, 0) / n) * 100 : null },
          trazabilidad: {
            cumplePorcentaje: n ? (trazables / n) * 100 : null,
            versionesDistinguiblesPorcentaje: n ? (versionesDistinguibles / n) * 100 : null,
            minutosBusqueda: null,
            notaMinutosBusqueda: 'Debe medirse con cronometraje conforme al instrumento V3; el sistema no puede inferir el tiempo humano de búsqueda.',
          },
          tiempos: { cicloDiasHabiles: promedio(ciclosTotales), primeraRespuestaDiasHabiles: promedio(primerasRespuestas) },
        },
      });
    } catch (err: any) {
      console.error('Error al obtener estadísticas del piloto:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener estadísticas del piloto.' });
    }
  });

  // Catálogos para selectores analíticos, filtrados por alcance del usuario.
  app.get('/api/estadisticas/filtros-analitica', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-tiempos', 'ver-estadisticas-unidad']), async (req: Request, res: Response) => {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const scopeResult = await resolveAnalyticsScope(req, userRepo);
      // Para armar el catálogo permitimos personal aunque unidad fallara por falta de unidad seleccionada.
      let ownerIds: number[] | null = null;
      let canViewUnidad = false;
      let canPickUnidad = false;
      let unidadesDisponibles: Array<{ nombre: string }> = [];
      let colaboradores: Array<{ id: number; etiqueta: string; unidadMedica: string }> = [];
      let alcanceMeta: any = { alcance: 'personal' };

      if (scopeResult.ok) {
        ownerIds = scopeResult.scope.ownerIds;
        canViewUnidad = scopeResult.scope.canViewUnidad;
        canPickUnidad = scopeResult.scope.canPickUnidad;
        alcanceMeta = {
          alcance: scopeResult.scope.alcance,
          unidadFiltro: scopeResult.scope.unidadFiltro,
          usuarioFiltroId: scopeResult.scope.usuarioFiltroId,
          viewerId: scopeResult.scope.viewerId,
          viewerNombre: scopeResult.scope.viewerNombre,
          unidadMedica: scopeResult.scope.unidadMedica,
          canViewUnidad,
          canPickUnidad,
        };
        if (canViewUnidad) {
          if (canPickUnidad) {
            unidadesDisponibles = (await AppDataSource.getRepository(UnidadMedica).find({
              select: ['nombre'],
              order: { nombre: 'ASC' },
            })).map((u) => ({ nombre: u.nombre }));
          } else if (scopeResult.scope.unidadMedica) {
            unidadesDisponibles = [{ nombre: scopeResult.scope.unidadMedica }];
          }
          const miembrosUnidad = scopeResult.scope.unidades.length
            ? await userRepo.find({
                where: { unidadMedica: In(scopeResult.scope.unidades) },
                select: ['id', 'nombres', 'apellidos', 'unidadMedica'],
                order: { apellidos: 'ASC' },
              })
            : [];
          colaboradores = miembrosUnidad.map((u) => ({
            id: u.id,
            etiqueta: `${u.nombres} ${u.apellidos}`.trim(),
            unidadMedica: u.unidadMedica,
          }));
        }
      } else if (scopeResult.status === 400 && String(req.query.alcance || '') === 'unidad') {
        // Super admin sin unidad aún: devolver catálogo de unidades para que elija.
        const roles: string[] = (req as any).user?.roles ?? [];
        const esSuper = roles.some((r) => String(r || '').toLowerCase() === 'super administrador');
        if (esSuper) {
          canViewUnidad = true;
          canPickUnidad = true;
          unidadesDisponibles = (await AppDataSource.getRepository(UnidadMedica).find({
            select: ['nombre'],
            order: { nombre: 'ASC' },
          })).map((u) => ({ nombre: u.nombre }));
          alcanceMeta = {
            alcance: 'unidad',
            canViewUnidad: true,
            canPickUnidad: true,
            requiereUnidad: true,
            message: scopeResult.message,
          };
          return res.json({
            ...alcanceMeta,
            unidades: unidadesDisponibles,
            colaboradores: [],
            expedientes: [],
            siafs: [],
          });
        }
        return res.status(scopeResult.status).json({ message: scopeResult.message });
      } else if (!scopeResult.ok) {
        return res.status(scopeResult.status).json({ message: scopeResult.message });
      }

      if (!ownerIds || ownerIds.length === 0) {
        return res.json({
          ...alcanceMeta,
          unidades: unidadesDisponibles,
          colaboradores,
          expedientes: [],
          siafs: [],
        });
      }

      const [expedientes, siafs] = await Promise.all([
        AppDataSource.getRepository(Expediente).find({
          where: { usuarioId: In(ownerIds) },
          select: ['id', 'numeroExpediente', 'titulo', 'numeroOrdenCompra', 'estado'],
          order: { numeroExpediente: 'DESC' },
        }),
        AppDataSource.getRepository(SiafSolicitud)
          .createQueryBuilder('s')
          .innerJoin('s.usuarioSolicitante', 'sol')
          .where('sol.id IN (:...ownerIds)', { ownerIds })
          .select(['s.id', 's.correlativo', 's.estado', 's.fecha', 's.createdAt'])
          .orderBy('s.createdAt', 'DESC')
          .getMany(),
      ]);

      res.json({
        ...alcanceMeta,
        unidades: unidadesDisponibles,
        colaboradores,
        expedientes: expedientes.map((exp) => ({
          id: exp.id,
          etiqueta: `${exp.numeroExpediente} · ${exp.titulo}${exp.numeroOrdenCompra ? ` · O.C. ${exp.numeroOrdenCompra}` : ''}`,
          estado: exp.estado,
        })),
        siafs: siafs.map((siaf) => ({
          id: siaf.id,
          etiqueta: `${siaf.correlativo} · ${siaf.fecha}`,
          estado: siaf.estado,
        })),
      });
    } catch (err: any) {
      console.error('Error al obtener filtros analíticos:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener los filtros analíticos.' });
    }
  });

  // Tablero operativo de expedientes: identifica demoras, rechazos, ciclos y
  // motivos para que el área pueda detectar cuellos de botella y tabular V1–V4.
  app.get('/api/estadisticas/expedientes-analitica', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-tiempos', 'ver-estadisticas-unidad']), async (req: Request, res: Response) => {
    try {
      const scopeResult = await resolveAnalyticsScope(req, AppDataSource.getRepository(User));
      if (!scopeResult.ok) return res.status(scopeResult.status).json({ message: scopeResult.message });
      const scope = scopeResult.scope;
      if (!scope.ownerIds.length) {
        return res.json({
          dias: 0,
          desde: new Date().toISOString(),
          hasta: new Date().toISOString(),
          agrupacion: 'mes',
          alcance: scope,
          general: {
            resumen: { total: 0, aprobados: 0, rechazadosAlCierre: 0, pendientesCorreccion: 0, pendientesRevisionDaf: 0 },
            cierreMensual: [],
            mesReferencia: null,
          },
          porExpediente: {
            tiempos: {
              primeraRespuestaHoras: null, correccionHoras: null, respuestaTrasReenvioHoras: null, cicloCompletoHoras: null,
              muestraPrimeraRespuesta: 0, muestraCorreccion: 0, muestraRespuestaTrasReenvio: 0, muestraCicloCompleto: 0,
            },
            ciclos: [],
            motivos: [],
            casos: [],
            trazabilidad: [],
            totalesEventos: { dictamenesRechazo: 0, correcciones: 0 },
          },
          resumen: { total: 0, enRevision: 0, aprobados: 0, rechazadosActuales: 0, tasaDevolucion: null, aprobacionPrimerEnvio: null, observacionesPromedio: null },
          tiempos: { primeraRespuestaHoras: null, correccionHoras: null, cicloCompletoHoras: null, muestraPrimeraRespuesta: 0, muestraCorreccion: 0, muestraCicloCompleto: 0 },
          ciclos: [],
          motivos: [],
          operadores: [],
          tendencia: [],
          cierreMensual: [],
          trazabilidad: [],
        });
      }

      const dias = Math.min(3650, Math.max(1, parseInt(String(req.query.dias || 90), 10) || 90));
      const fechaConsulta = (valor: unknown, finDelDia = false) => {
        if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
        const fecha = new Date(`${valor}T${finDelDia ? '23:59:59.999' : '00:00:00.000'}`);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
      };
      const hasta = fechaConsulta(req.query.hasta, true) ?? new Date();
      const desde = fechaConsulta(req.query.desde) ?? new Date(hasta);
      if (!fechaConsulta(req.query.desde)) desde.setDate(desde.getDate() - dias);
      desde.setHours(0, 0, 0, 0);
      if (desde.getTime() > hasta.getTime()) return res.status(400).json({ message: 'La fecha inicial no puede ser posterior a la fecha final.' });
      const expedienteId = parseInt(String(req.query.expedienteId || ''), 10);
      const filtrarExpediente = Number.isInteger(expedienteId) && expedienteId > 0;
      const agrupacion = ['dia', 'semana', 'mes', 'anio'].includes(String(req.query.agrupacion)) ? String(req.query.agrupacion) : 'semana';
      const expRepo = AppDataSource.getRepository(Expediente);
      const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);

      if (filtrarExpediente) {
        const dueño = await expRepo.findOne({ where: { id: expedienteId } });
        if (!dueño || !scope.ownerIds.includes(dueño.usuarioId)) {
          return res.status(403).json({ message: 'No tiene acceso a las estadísticas de ese expediente.' });
        }
      }

      const eventosDelPeriodo = filtrarExpediente
        ? await bitacoraRepo.find({
            where: { expedienteId },
            relations: ['detalle', 'usuario'],
            order: { fecha: 'ASC' },
          })
        : await bitacoraRepo
          .createQueryBuilder('b')
          .innerJoin('b.expediente', 'e')
          .leftJoinAndSelect('b.detalle', 'detalle')
          .leftJoinAndSelect('b.usuario', 'usuario')
          .where('b.fecha BETWEEN :desde AND :hasta', { desde, hasta })
          .andWhere('e.usuario_id IN (:...ownerIds)', { ownerIds: scope.ownerIds })
          .orderBy('b.fecha', 'ASC')
          .getMany();

      const idsActivos = new Set(eventosDelPeriodo.map((e) => e.expedienteId));
      const expedientesCreados = filtrarExpediente
        ? []
        : await expRepo.createQueryBuilder('e')
          .where('e.created_at BETWEEN :desde AND :hasta', { desde, hasta })
          .andWhere('e.usuario_id IN (:...ownerIds)', { ownerIds: scope.ownerIds })
          .getMany();
      // También casos abiertos creados antes del rango (pueden quedar rechazados al cierre).
      const abiertosPrevios = filtrarExpediente
        ? []
        : await expRepo.createQueryBuilder('e')
          .where('e.created_at < :desde', { desde })
          .andWhere('e.usuario_id IN (:...ownerIds)', { ownerIds: scope.ownerIds })
          .andWhere("e.estado IN ('abierto', 'en_proceso', 'rechazado')")
          .getMany();
      const ids = filtrarExpediente
        ? [expedienteId]
        : [...new Set([
          ...idsActivos,
          ...expedientesCreados.map((e) => e.id),
          ...abiertosPrevios.map((e) => e.id),
        ])];
      const expedientes = ids.length ? await expRepo.find({ where: { id: In(ids) } }) : [];

      // Historial completo de cada caso (necesario para cierres mensuales y trazabilidad).
      const historialCompleto = ids.length
        ? await bitacoraRepo.find({
            where: { expedienteId: In(ids) },
            relations: ['detalle', 'usuario'],
            order: { fecha: 'ASC' },
          })
        : [];
      const eventosPorExpediente = new Map<number, ExpedienteBitacora[]>();
      historialCompleto.forEach((evento) => {
        const lista = eventosPorExpediente.get(evento.expedienteId) ?? [];
        lista.push(evento);
        eventosPorExpediente.set(evento.expedienteId, lista);
      });

      const cierresMensuales = construirCierresMensuales(ids, eventosPorExpediente, desde, hasta);
      const tiempos = promediarTiemposDesdeHistoriales(eventosPorExpediente);

      const motivos = new Map<string, number>();
      const distribucionCiclos = [0, 0, 0, 0];
      let dictamenesRechazoTotal = 0;
      let correccionesTotales = 0;
      let pendientesCorreccionAhora = 0;
      let pendientesRevisionDafAhora = 0;
      let aprobadosAhora = 0;
      let rechazadosAlCierreAhora = 0;

      const listaPorExpediente = expedientes.map((exp) => {
        const historial = eventosPorExpediente.get(exp.id) ?? [];
        const rechazos = historial.filter((e) => e.tipo === 'rechazo');
        const aprobacion = historial.find((e) => e.tipo === 'aprobacion');
        const correcciones = historial.filter((e) => e.tipo === 'correccion');
        distribucionCiclos[Math.min(rechazos.length, 3)] += 1;
        dictamenesRechazoTotal += rechazos.length;
        correccionesTotales += correcciones.length;
        for (const rechazo of rechazos) {
          for (const detalle of rechazo.detalle ?? []) {
            const prefijo = (detalle.comentario || '').split(':')[0].trim();
            const motivo = ['Falta firma', 'Fecha incorrecta o faltante', 'Datos incompletos', 'Documento ilegible', 'No corresponde al tipo de documento'].includes(prefijo)
              ? prefijo
              : 'Otro / sin clasificar';
            motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1);
          }
        }
        const clase = clasificarAlCorte(historial, hasta);
        if (clase.resultado === 'aprobado') aprobadosAhora += 1;
        if (clase.resultado === 'pendiente_correccion') {
          pendientesCorreccionAhora += 1;
          rechazadosAlCierreAhora += 1;
        }
        if (clase.resultado === 'rechazado_al_cierre') rechazadosAlCierreAhora += 1;
        if (clase.resultado === 'pendiente_revision_daf') pendientesRevisionDafAhora += 1;

        return {
          id: exp.id,
          numeroExpediente: exp.numeroExpediente,
          titulo: exp.titulo,
          estado: exp.estado,
          resultadoAlCorte: clase.resultado,
          devoluciones: rechazos.length,
          correcciones: correcciones.length,
          aprobado: !!aprobacion,
          fechaAprobacion: aprobacion?.fecha ? new Date(aprobacion.fecha).toISOString() : null,
          trazabilidad: construirTrazabilidad(historial),
        };
      });

      const trazabilidadSeleccionada = filtrarExpediente
        ? (listaPorExpediente[0]?.trazabilidad ?? [])
        : [];

      const ultimoCierre = cierresMensuales[cierresMensuales.length - 1] ?? null;

      res.json({
        dias,
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        agrupacion,
        alcance: {
          modo: scope.alcance,
          unidad: scope.unidadFiltro,
          usuarioId: scope.usuarioFiltroId,
          canViewUnidad: scope.canViewUnidad,
          canPickUnidad: scope.canPickUnidad,
        },
        expedienteSeleccionado: filtrarExpediente ? expedienteId : null,
        // —— Estadísticas GENERALES (foto / cierre) ——
        general: {
          resumen: {
            total: expedientes.length,
            aprobados: aprobadosAhora,
            rechazadosAlCierre: rechazadosAlCierreAhora,
            pendientesCorreccion: pendientesCorreccionAhora,
            pendientesRevisionDaf: pendientesRevisionDafAhora,
            // Compatibilidad con KPIs previos
            enRevision: pendientesRevisionDafAhora,
            rechazadosActuales: pendientesCorreccionAhora,
          },
          cierreMensual: cierresMensuales,
          mesReferencia: ultimoCierre,
        },
        // —— Estadísticas POR EXPEDIENTE (ciclos, motivos, tiempos) ——
        porExpediente: {
          tiempos: {
            ...tiempos,
            // alias usados por la UI anterior
            muestraPrimeraRespuesta: tiempos.muestraPrimeraRespuesta,
            muestraCorreccion: tiempos.muestraCorreccion,
            muestraCicloCompleto: tiempos.muestraCicloCompleto,
          },
          ciclos: [
            { etiqueta: 'Sin devolución', cantidad: distribucionCiclos[0] },
            { etiqueta: '1 devolución', cantidad: distribucionCiclos[1] },
            { etiqueta: '2 devoluciones', cantidad: distribucionCiclos[2] },
            { etiqueta: '3 o más', cantidad: distribucionCiclos[3] },
          ],
          motivos: [...motivos.entries()].map(([motivo, cantidad]) => ({ motivo, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
          casos: filtrarExpediente ? listaPorExpediente : listaPorExpediente.slice(0, 50),
          trazabilidad: trazabilidadSeleccionada,
          totalesEventos: {
            dictamenesRechazo: dictamenesRechazoTotal,
            correcciones: correccionesTotales,
          },
        },
        // Campos planos de compatibilidad temporal con la UI vigente
        resumen: {
          total: expedientes.length,
          enRevision: pendientesRevisionDafAhora,
          aprobados: aprobadosAhora,
          rechazadosActuales: pendientesCorreccionAhora,
          expedientesConDevolucion: listaPorExpediente.filter((c) => c.devoluciones > 0).length,
          dictamenesRechazo: dictamenesRechazoTotal,
          correccionesTotales,
          tasaDevolucion: expedientes.length
            ? (listaPorExpediente.filter((c) => c.devoluciones > 0).length / expedientes.length) * 100
            : null,
          aprobacionPrimerEnvio: null,
          observacionesPromedio: null,
          pendientesCorreccion: pendientesCorreccionAhora,
          pendientesRevisionDaf: pendientesRevisionDafAhora,
          rechazadosAlCierre: rechazadosAlCierreAhora,
        },
        tiempos: {
          primeraRespuestaHoras: tiempos.primeraRespuestaHoras,
          correccionHoras: tiempos.correccionHoras,
          cicloCompletoHoras: tiempos.cicloCompletoHoras,
          respuestaTrasReenvioHoras: tiempos.respuestaTrasReenvioHoras,
          muestraPrimeraRespuesta: tiempos.muestraPrimeraRespuesta,
          muestraCorreccion: tiempos.muestraCorreccion,
          muestraCicloCompleto: tiempos.muestraCicloCompleto,
          muestraRespuestaTrasReenvio: tiempos.muestraRespuestaTrasReenvio,
        },
        ciclos: [
          { etiqueta: 'Sin devolución', cantidad: distribucionCiclos[0] },
          { etiqueta: '1 devolución', cantidad: distribucionCiclos[1] },
          { etiqueta: '2 devoluciones', cantidad: distribucionCiclos[2] },
          { etiqueta: '3 o más', cantidad: distribucionCiclos[3] },
        ],
        motivos: [...motivos.entries()].map(([motivo, cantidad]) => ({ motivo, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
        operadores: [],
        tendencia: cierresMensuales.map((row) => ({
          semana: `${row.mes}-01`,
          enviados: row.activos,
          conDevolucion: row.rechazadosAlCierre,
          aprobados: row.aprobados,
          pendientesCorreccion: row.pendientesCorreccion,
          pendientesRevisionDaf: row.pendientesRevisionDaf,
          primeraRespuestaHoras: null,
        })),
        cierreMensual: cierresMensuales,
        trazabilidad: trazabilidadSeleccionada,
      });
    } catch (err: any) {
      console.error('Error al obtener analítica de expedientes:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener analítica de expedientes.' });
    }
  });

  // Análisis SIAF: cierre mensual, por caso y motivos (espejo de expedientes).
  app.get('/api/estadisticas/daf-analitica', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-tiempos', 'ver-estadisticas-unidad']), async (req: Request, res: Response) => {
    try {
      const scopeResult = await resolveAnalyticsScope(req, AppDataSource.getRepository(User));
      if (!scopeResult.ok) return res.status(scopeResult.status).json({ message: scopeResult.message });
      const scope = scopeResult.scope;
      if (!scope.ownerIds.length) {
        return res.json({
          dias: 0,
          desde: new Date().toISOString(),
          hasta: new Date().toISOString(),
          general: {
            resumen: { total: 0, aprobados: 0, rechazadosAlCierre: 0, pendientesCorreccion: 0, pendientesRevisionDaf: 0 },
            cierreMensual: [],
          },
          porSiaf: {
            tiempos: {
              primeraRespuestaHoras: null, correccionHoras: null, respuestaTrasReenvioHoras: null, cicloCompletoHoras: null,
              muestraPrimeraRespuesta: 0, muestraCorreccion: 0, muestraRespuestaTrasReenvio: 0, muestraCicloCompleto: 0,
            },
            ciclos: [],
            motivos: [],
            casos: [],
            trazabilidad: [],
          },
          cierreMensual: [],
          motivos: [],
          trazabilidad: [],
        });
      }

      const dias = Math.min(3650, Math.max(1, parseInt(String(req.query.dias || 90), 10) || 90));
      const fechaConsulta = (valor: unknown, finDelDia = false) => {
        if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
        const fecha = new Date(`${valor}T${finDelDia ? '23:59:59.999' : '00:00:00.000'}`);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
      };
      const hasta = fechaConsulta(req.query.hasta, true) ?? new Date();
      const desde = fechaConsulta(req.query.desde) ?? new Date(hasta);
      if (!fechaConsulta(req.query.desde)) desde.setDate(desde.getDate() - dias);
      desde.setHours(0, 0, 0, 0);
      if (desde.getTime() > hasta.getTime()) return res.status(400).json({ message: 'La fecha inicial no puede ser posterior a la fecha final.' });
      const siafIdFiltro = parseInt(String(req.query.siafId || ''), 10);
      const filtrarSiaf = Number.isInteger(siafIdFiltro) && siafIdFiltro > 0;
      const siafRepo = AppDataSource.getRepository(SiafSolicitud);
      const autRepo = AppDataSource.getRepository(SiafAutorizacion);
      const bitacoraRepo = AppDataSource.getRepository(SiafBitacora);

      if (filtrarSiaf) {
        const siafDueño = await siafRepo.findOne({ where: { id: siafIdFiltro }, relations: ['usuarioSolicitante'] });
        const ownerId = siafDueño?.usuarioSolicitante?.id;
        if (!ownerId || !scope.ownerIds.includes(ownerId)) {
          return res.status(403).json({ message: 'No tiene acceso a las estadísticas de ese SIAF.' });
        }
      }

      const siafsBase = filtrarSiaf
        ? await siafRepo.find({ where: { id: siafIdFiltro }, relations: ['usuarioSolicitante'] })
        : await siafRepo
          .createQueryBuilder('s')
          .innerJoinAndSelect('s.usuarioSolicitante', 'sol')
          .where('sol.id IN (:...ownerIds)', { ownerIds: scope.ownerIds })
          .andWhere('(s.created_at BETWEEN :desde AND :hasta OR s.estado IN (:...abiertos))', {
            desde,
            hasta,
            abiertos: ['pendiente', 'rechazado', 'borrador', 'finalizado'],
          })
          .getMany();

      // Ampliar con SIAF que tuvieron decisión en el rango.
      const autEnRango = filtrarSiaf
        ? []
        : await autRepo.createQueryBuilder('aut')
          .innerJoinAndSelect('aut.siaf', 'siaf')
          .innerJoin('siaf.usuarioSolicitante', 'sol')
          .where('sol.id IN (:...ownerIds)', { ownerIds: scope.ownerIds })
          .andWhere('aut.fecha_autorizacion BETWEEN :desde AND :hasta', { desde, hasta })
          .getMany();

      const ids = [...new Set([
        ...siafsBase.map((s) => s.id),
        ...autEnRango.map((a) => a.siaf?.id).filter(Boolean) as number[],
      ])];
      const siafs = ids.length
        ? await siafRepo.find({ where: { id: In(ids) }, relations: ['usuarioSolicitante'] })
        : [];

      const autorizaciones = ids.length
        ? await autRepo.createQueryBuilder('aut')
          .innerJoinAndSelect('aut.siaf', 'siaf')
          .leftJoinAndSelect('aut.usuarioAutorizador', 'operador')
          .where('siaf.id IN (:...ids)', { ids })
          .orderBy('aut.fecha_autorizacion', 'ASC')
          .getMany()
        : [];
      const bitacora = ids.length
        ? await bitacoraRepo.createQueryBuilder('b')
          .innerJoinAndSelect('b.siaf', 'siaf')
          .leftJoinAndSelect('b.usuario', 'usuario')
          .where('siaf.id IN (:...ids)', { ids })
          .orderBy('b.fecha', 'ASC')
          .getMany()
        : [];

      const createdAtPorSiaf = new Map<number, Date>();
      siafs.forEach((s) => createdAtPorSiaf.set(s.id, new Date(s.createdAt)));
      const porSiaf = unificarEventosSiaf(autorizaciones, bitacora, createdAtPorSiaf);
      const cierresMensuales = construirCierresMensualesSiaf(ids, porSiaf, desde, hasta);
      const tiempos = promediarTiemposSiaf(porSiaf);

      const motivos = new Map<string, number>();
      const distribucionCiclos = [0, 0, 0, 0];
      let pendientesCorreccionAhora = 0;
      let pendientesRevisionDafAhora = 0;
      let aprobadosAhora = 0;
      let rechazadosAlCierreAhora = 0;

      const listaPorSiaf = siafs.map((siaf) => {
        const historial = porSiaf.get(siaf.id) ?? [];
        const rechazos = historial.filter((e) => e.tipo === 'rechazo');
        const aprobacion = historial.find((e) => e.tipo === 'aprobacion');
        const correcciones = historial.filter((e) => e.tipo === 'correccion');
        distribucionCiclos[Math.min(rechazos.length, 3)] += 1;
        for (const rechazo of rechazos) {
          for (const clave of rechazo.motivos ?? ['sin_clasificar']) {
            const etiqueta = MOTIVOS_RECHAZO_ETIQUETAS[clave] ?? (clave === 'sin_clasificar' ? 'Sin clasificar' : 'Otro');
            motivos.set(etiqueta, (motivos.get(etiqueta) ?? 0) + 1);
          }
        }
        const clase = clasificarSiafAlCorte(historial, hasta);
        if (clase.resultado === 'aprobado') aprobadosAhora += 1;
        if (clase.resultado === 'pendiente_correccion') {
          pendientesCorreccionAhora += 1;
          rechazadosAlCierreAhora += 1;
        }
        if (clase.resultado === 'rechazado_al_cierre') rechazadosAlCierreAhora += 1;
        if (clase.resultado === 'pendiente_revision_daf') pendientesRevisionDafAhora += 1;

        return {
          id: siaf.id,
          correlativo: siaf.correlativo,
          estado: siaf.estado,
          resultadoAlCorte: clase.resultado,
          devoluciones: rechazos.length,
          correcciones: correcciones.length,
          aprobado: !!aprobacion,
          fechaAprobacion: aprobacion?.fecha ? new Date(aprobacion.fecha).toISOString() : null,
          trazabilidad: construirTrazabilidadSiaf(historial),
        };
      });

      res.json({
        dias,
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        alcance: {
          modo: scope.alcance,
          unidad: scope.unidadFiltro,
          usuarioId: scope.usuarioFiltroId,
          canViewUnidad: scope.canViewUnidad,
          canPickUnidad: scope.canPickUnidad,
        },
        siafSeleccionado: filtrarSiaf ? siafIdFiltro : null,
        general: {
          resumen: {
            total: siafs.length,
            aprobados: aprobadosAhora,
            rechazadosAlCierre: rechazadosAlCierreAhora,
            pendientesCorreccion: pendientesCorreccionAhora,
            pendientesRevisionDaf: pendientesRevisionDafAhora,
          },
          cierreMensual: cierresMensuales,
        },
        porSiaf: {
          tiempos,
          ciclos: [
            { etiqueta: 'Sin devolución', cantidad: distribucionCiclos[0] },
            { etiqueta: '1 devolución', cantidad: distribucionCiclos[1] },
            { etiqueta: '2 devoluciones', cantidad: distribucionCiclos[2] },
            { etiqueta: '3 o más', cantidad: distribucionCiclos[3] },
          ],
          motivos: [...motivos.entries()].map(([motivo, cantidad]) => ({ motivo, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
          casos: filtrarSiaf ? listaPorSiaf : listaPorSiaf.slice(0, 50),
          trazabilidad: filtrarSiaf ? (listaPorSiaf[0]?.trazabilidad ?? []) : [],
        },
        cierreMensual: cierresMensuales,
        motivos: [...motivos.entries()].map(([motivo, cantidad]) => ({ motivo, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
        trazabilidad: filtrarSiaf ? (listaPorSiaf[0]?.trazabilidad ?? []) : [],
      });
    } catch (err: any) {
      console.error('Error al obtener analítica SIAF:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener analítica SIAF.' });
    }
  });

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