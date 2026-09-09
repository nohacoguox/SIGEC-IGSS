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
import { ProductoCatalogo } from './entity/ProductoCatalogo';
import { ProductoCatalogoConfig } from './entity/ProductoCatalogoConfig';
import { Role } from './entity/Role';
import { randomUUID } from 'crypto';
import { verifyToken, authorizeRoles } from './middleware/auth';
import { authRouter } from './modules/auth/routes';
import { rbacRouter } from './modules/rbac/routes';
import { catalogosRouter } from './modules/catalogos/routes';
import { siafRouter } from './modules/siaf/routes';
import { correlativosRouter } from './modules/correlativos/routes';
import { usuariosRouter } from './modules/usuarios/routes';
import { expedientesRouter } from './modules/expedientes/routes';
import { estadisticasRouter } from './modules/estadisticas/routes';
import { uploadMemory, CATALOGO_MAX_MB } from './middleware/upload';
import { parseOrigen, CatalogoOrigenApi } from './services/catalogoOrigen';
import { syncAppScreenPermissions } from './services/syncAppScreens';
import { ensureCorrelativoTables } from './services/ensureCorrelativoTables';

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