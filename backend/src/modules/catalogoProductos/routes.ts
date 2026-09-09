import { Request, Response, Router } from 'express';
import { randomUUID } from 'crypto';
import { AppDataSource } from '../../data-source';
import { ProductoCatalogo } from '../../entity/ProductoCatalogo';
import { ProductoCatalogoConfig } from '../../entity/ProductoCatalogoConfig';
import { verifyToken, authorizeRoles } from '../../middleware/auth';
import { uploadMemory } from '../../middleware/upload';
import { parseOrigen, CatalogoOrigenApi } from '../../services/catalogoOrigen';

let XLSX: any;
try {
  XLSX = require('xlsx');
  if (!XLSX.default && !XLSX.read) XLSX = require('xlsx');
  if (XLSX.default && XLSX.default.read) XLSX = XLSX.default;
} catch (e) {
  console.warn('xlsx no cargado al inicio:', (e as Error).message);
}

// El router se monta en /api/catalogo-productos. El orden de declaración
// importa: la ruta genérica '/' queda al final para no capturar las demás.
export const catalogoProductosRouter = Router();

// El repositorio se resuelve al atender la petición: a nivel de módulo se
// evaluaría al importar, antes de AppDataSource.initialize(), y TypeORM
// lanzaría "Connection is not established" al arrancar.
const getProductoCatalogoRepository = () => AppDataSource.getRepository(ProductoCatalogo);

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
// El manejador de errores de index.ts también reporta el fallo en el trabajo.
export const updateCatalogoTrabajo = (
  id: string | null,
  cambios: Partial<Pick<CatalogoTrabajo, 'progreso' | 'estado' | 'mensaje'>>
) => {
  if (!id) return;
  const job = catalogoTrabajos.get(id);
  if (!job) return;
  Object.assign(job, cambios);
};

catalogoProductosRouter.post('/trabajos', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), (req: Request, res: Response) => {
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

catalogoProductosRouter.get('/trabajos/:id', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), (req: Request, res: Response) => {
  const job = catalogoTrabajos.get(req.params.id);
  if (!job || job.userId !== Number((req as any).user.userId)) {
    return res.status(404).json({ message: 'Proceso no encontrado.' });
  }
  res.json(job);
});

catalogoProductosRouter.get('/codigo/:codigo', verifyToken, async (req: Request, res: Response) => {
  try {
    const codigo = (req.params.codigo || '').trim();
    if (!codigo) {
      return res.status(400).json({ message: 'Código es requerido.' });
    }
    const origenFiltro = parseOrigen(req.query.origen);
    if (!origenFiltro) {
      return res.status(400).json({ message: 'Seleccione el catálogo MINFIN, SIBOFA o SUBPRODUCTOS.' });
    }
    const qb = getProductoCatalogoRepository()
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
catalogoProductosRouter.get('/buscar', verifyToken, async (req: Request, res: Response) => {
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
    const qb = getProductoCatalogoRepository()
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

catalogoProductosRouter.post('/importar', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), uploadMemory.single('archivo'), async (req: Request, res: Response) => {
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
    const existentes = await getProductoCatalogoRepository().find({
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

catalogoProductosRouter.get('/config', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), async (req: Request, res: Response) => {
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

catalogoProductosRouter.put('/config', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), async (req: Request, res: Response) => {
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

catalogoProductosRouter.get('/stats', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), async (req: Request, res: Response) => {
  try {
    const buildStats = async (origen: CatalogoOrigenApi) => {
      const total = await getProductoCatalogoRepository().count({ where: { origen } });
      const last = await getProductoCatalogoRepository().find({
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
catalogoProductosRouter.get('/', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), async (req: Request, res: Response) => {
  try {
    const origen = parseOrigen(req.query.origen);
    if (!origen) {
      return res.status(400).json({ message: 'Debe indicar origen=MINFIN, SIBOFA o SUBPRODUCTOS.' });
    }
    const q = String(req.query.q ?? '').trim();
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25));
    const qb = getProductoCatalogoRepository()
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
