import { Request, Response, Router } from 'express';
import { In, DeepPartial } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { User } from '../../entity/User';
import { UnidadMedica } from '../../entity/UnidadMedica';
import { Departamento } from '../../entity/Departamento';
import {
  Expediente,
  ExpedienteDocumento,
  ExpedienteBitacora,
  ExpedienteBitacoraDetalle,
  ExpedienteDocumentoVersion,
} from '../../entity/Expediente';
import { verifyToken, authorizeRolesOrPermissions } from '../../middleware/auth';
import { uploadMemory } from '../../middleware/upload';
import { fileStorageService } from '../../services/FileStorageService';
import { resolveDepartamentoDireccion } from '../../services/departamentoDireccion';
import { asignarCorrelativoExpediente } from '../../services/ExpedienteCorrelativoService';
import { extractPdfPageRange, getPdfPageCount } from '../../services/PdfPageSplitService';
import { ESTADOS_EXPEDIENTE_UNIDAD, mismaUnidadMedica } from '../../services/unidadMedicaMatch';

const TITULOS_EXPEDIENTE_VALIDOS = ['Bien/Producto', 'Servicio'];

/** Documento PDF único con todo el expediente; luego se categoriza por rangos de páginas. */
export const TIPO_DOCUMENTO_PAQUETE = 'Expediente completo (paquete)';

function tienePermisoExpedientesUnidad(req: Request): boolean {
  const permissions: string[] = (req as any).user?.permissions ?? [];
  const roles: string[] = (req as any).user?.roles ?? [];
  if (permissions.includes('listado-expedientes-unidad')) return true;
  if (roles.some((r) => String(r || '').toLowerCase() === 'super administrador')) return true;
  return roles.some((r) =>
    ['Expedientes de mi unidad', 'listado-expedientes-unidad'].includes(String(r || ''))
  );
}

/** Lectura solo de expedientes de la unidad del viewer (estados no abiertos). */
async function puedeLeerExpedienteComoUnidad(req: Request, exp: Expediente): Promise<boolean> {
  if (!tienePermisoExpedientesUnidad(req)) return false;
  if (!ESTADOS_EXPEDIENTE_UNIDAD.includes(String(exp.estado || ''))) return false;
  const userId = (req as any).user?.userId as number | undefined;
  if (!userId) return false;
  const viewer = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
  if (!viewer) return false;
  const unidad = (viewer.unidadMedica || '').trim();
  if (!unidad) return false;
  let ownerUnidad: string | null | undefined = (exp as any).usuario?.unidadMedica;
  if (ownerUnidad == null && exp.usuarioId) {
    const owner = await AppDataSource.getRepository(User).findOne({
      where: { id: exp.usuarioId },
      select: ['id', 'unidadMedica'],
    });
    ownerUnidad = owner?.unidadMedica;
  }
  return mismaUnidadMedica(exp.unidadOrigen, unidad) || mismaUnidadMedica(ownerUnidad, unidad);
}

// El router se monta en /api/expedientes. El orden de declaración importa:
// para-revision-departamental, revisados-departamental y /unidad deben quedar antes de
// /:id para que Express no las interprete como un id.
export const expedientesRouter = Router();

// Expedientes: listar (del usuario) y crear (crear solo con permiso crear-expediente)
expedientesRouter.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const repo = AppDataSource.getRepository(Expediente);
    const expedientes = await repo.find({
      where: { usuarioId: userId },
      relations: ['usuario'],
      order: { createdAt: 'DESC' },
    });
    res.json(expedientes);
  } catch (err: any) {
    console.error('Error al listar expedientes:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al listar expedientes.' });
  }
});

expedientesRouter.post('/', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['crear-expediente']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const { tipoExpediente, titulo, descripcion, numeroOrdenCompra, numeroSiaf } = req.body || {};
    const tipo = typeof tipoExpediente === 'string' ? tipoExpediente.trim() : 'Compras';
    const tit = typeof titulo === 'string' ? titulo.trim() : '';
    const desc = typeof descripcion === 'string' ? descripcion.trim() : '';
    const oc = typeof numeroOrdenCompra === 'string' ? numeroOrdenCompra.trim() : '';
    const siaf = typeof numeroSiaf === 'string' ? numeroSiaf.trim() : '';
    if (!tit) return res.status(400).json({ message: 'El título es obligatorio. Elija Bien/Producto o Servicio.' });
    if (!TITULOS_EXPEDIENTE_VALIDOS.includes(tit)) return res.status(400).json({ message: 'El título debe ser "Bien/Producto" o "Servicio".' });
    if (!desc) return res.status(400).json({ message: 'La descripción es obligatoria.' });
    if (!oc) return res.status(400).json({ message: 'El número de orden de compra (O.C.) es obligatorio.' });
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const repo = AppDataSource.getRepository(Expediente);
    const numero = await asignarCorrelativoExpediente();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const exp = repo.create({
      numeroExpediente: numero,
      usuarioId: userId,
      usuario: user,
      tipoExpediente: tipo || 'Compras',
      titulo: tit,
      descripcion: desc,
      numeroOrdenCompra: oc,
      numeroSiaf: siaf || null,
      estado: 'abierto',
      fechaApertura: hoy,
      fechaCierre: null,
    } as unknown as DeepPartial<Expediente>);
    const nombreUnidad = (user.unidadMedica || '').trim();
    (exp as any).unidadOrigen = nombreUnidad || null;
    if (nombreUnidad) {
      const unidadRepo = AppDataSource.getRepository(UnidadMedica);
      const unidad = await unidadRepo.findOne({ where: { nombre: nombreUnidad }, relations: ['municipio', 'municipio.departamento'] });
      const dep = unidad?.municipio?.departamento?.nombre ?? unidad?.departamento ?? '';
      (exp as any).municipioOrigen = unidad?.municipio ? `${unidad.municipio.nombre}, ${dep}`.trim() : (dep || null);
    } else {
      (exp as any).municipioOrigen = null;
    }
    await repo.save(exp);
    res.status(201).json(exp);
  } catch (err: any) {
    console.error('Error al crear expediente:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al crear expediente.' });
  }
});

// Expedientes pendientes de revisión por Dirección Departamental (estado en_proceso).
// El analista DAF ve TODOS los expedientes en_proceso; el filtro por municipio en el frontend es opcional (por origen).
expedientesRouter.get('/para-revision-departamental', verifyToken, authorizeRolesOrPermissions(['super administrador', 'revisar-siaf-direccion-departamental'], ['revisar-expediente-direccion-departamental']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId }, relations: ['departamentoDireccionEntidad'] });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const depto = await resolveDepartamentoDireccion(user);
    const repo = AppDataSource.getRepository(Expediente);
    const lista = await repo.find({
      where: { estado: 'en_proceso' },
      relations: ['usuario'],
      order: { createdAt: 'DESC' },
    });
    const deptoRepo = AppDataSource.getRepository(Departamento);
    const deptoEntidad = depto ? await deptoRepo.findOne({ where: { nombre: depto } }) : null;
    res.json({
      expedientes: lista,
      meta: { departamento: depto ?? '', departamentoId: deptoEntidad?.id ?? null },
    });
  } catch (err: any) {
    console.error('Error al listar expedientes para revisión:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al listar expedientes.' });
  }
});

// Expedientes ya revisados por el analista DAF (él fue quien aprobó o rechazó por última vez).
expedientesRouter.get('/revisados-departamental', verifyToken, authorizeRolesOrPermissions(['super administrador', 'revisar-siaf-direccion-departamental'], ['revisar-expediente-direccion-departamental']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
    const entradas = await bitacoraRepo.find({
      where: { tipo: In(['aprobacion', 'rechazo']) },
      select: ['id', 'expedienteId', 'fecha', 'tipo', 'usuarioId'],
      order: { expedienteId: 'ASC', fecha: 'DESC' },
    });
    const ultimaAccionPorExpediente = new Map<number, { tipo: string; fecha: Date; usuarioId: number }>();
    for (const b of entradas) {
      if (!ultimaAccionPorExpediente.has(b.expedienteId)) {
        ultimaAccionPorExpediente.set(b.expedienteId, { tipo: b.tipo, fecha: b.fecha, usuarioId: b.usuarioId });
      }
    }
    const expedienteIdsRevisadosPorMi: number[] = [];
    const expedienteIdToLatest = new Map<number, { tipo: string; fecha: Date }>();
    for (const [expId, accion] of ultimaAccionPorExpediente) {
      if (accion.usuarioId === userId) {
        expedienteIdsRevisadosPorMi.push(expId);
        expedienteIdToLatest.set(expId, { tipo: accion.tipo, fecha: accion.fecha });
      }
    }
    if (expedienteIdsRevisadosPorMi.length === 0) {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId }, relations: ['departamentoDireccionEntidad'] });
      const depto = user ? await resolveDepartamentoDireccion(user) : '';
      const deptoEntidad = depto ? await AppDataSource.getRepository(Departamento).findOne({ where: { nombre: depto } }) : null;
      return res.json({ expedientes: [], meta: { departamento: depto ?? '', departamentoId: deptoEntidad?.id ?? null } });
    }
    const repo = AppDataSource.getRepository(Expediente);
    const expedientes = await repo.find({
      where: { id: In(expedienteIdsRevisadosPorMi), estado: In(['cerrado', 'rechazado']) },
      relations: ['usuario'],
      order: { updatedAt: 'DESC' },
    });
    const lista = expedientes.map((e: any) => ({
      ...e,
      ultimaAccionPorMi: expedienteIdToLatest.get(e.id) || null,
    }));
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId }, relations: ['departamentoDireccionEntidad'] });
    const depto = user ? await resolveDepartamentoDireccion(user) : '';
    const deptoRepo = AppDataSource.getRepository(Departamento);
    const deptoEntidad = depto ? await deptoRepo.findOne({ where: { nombre: depto } }) : null;
    res.json({
      expedientes: lista,
      meta: { departamento: depto ?? '', departamentoId: deptoEntidad?.id ?? null },
    });
  } catch (err: any) {
    console.error('Error al listar expedientes revisados:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al listar expedientes revisados.' });
  }
});

/**
 * Director / Administrador de unidad: expedientes de su unidad en
 * En revisión / Rechazado / Cerrado (y estados equivalentes; no abiertos). Solo lectura.
 */
expedientesRouter.get(
  '/unidad',
  verifyToken,
  authorizeRolesOrPermissions(
    ['super administrador', 'Expedientes de mi unidad'],
    ['listado-expedientes-unidad']
  ),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId as number;
      const userRepo = AppDataSource.getRepository(User);
      const viewer = await userRepo.findOne({ where: { id: userId } });
      if (!viewer) return res.status(404).json({ message: 'Usuario no encontrado.' });

      const roles: string[] = (req as any).user?.roles ?? [];
      const isSuper = roles.some((r) => String(r || '').toLowerCase() === 'super administrador');
      let unidad = (viewer.unidadMedica || '').trim();
      if (isSuper && typeof req.query.unidad === 'string' && req.query.unidad.trim()) {
        unidad = req.query.unidad.trim();
      }
      if (!unidad) {
        return res.status(400).json({
          message: 'Su usuario no tiene unidad médica asignada. Asígnele una unidad en Gestión de Usuarios.',
        });
      }

      const todosUsuarios = await userRepo.find({ select: ['id', 'unidadMedica'] });
      const ownerIds = todosUsuarios
        .filter((u) => mismaUnidadMedica(u.unidadMedica, unidad))
        .map((u) => u.id);

      const repo = AppDataSource.getRepository(Expediente);
      const qb = repo
        .createQueryBuilder('exp')
        .leftJoinAndSelect('exp.usuario', 'usuario')
        .where('exp.estado IN (:...estados)', { estados: ESTADOS_EXPEDIENTE_UNIDAD })
        .orderBy('exp.createdAt', 'DESC');

      if (ownerIds.length > 0) {
        qb.andWhere(
          `(exp.usuarioId IN (:...ownerIds) OR exp.unidadOrigen ILIKE :unidadLike)`,
          { ownerIds, unidadLike: `%${unidad}%` }
        );
      } else {
        qb.andWhere(`exp.unidadOrigen ILIKE :unidadLike`, { unidadLike: `%${unidad}%` });
      }

      const lista = await qb.getMany();
      const filtradas = lista.filter((e) => {
        const ownerUnidad = (e as any).usuario?.unidadMedica;
        return (
          mismaUnidadMedica(e.unidadOrigen, unidad) ||
          mismaUnidadMedica(ownerUnidad, unidad) ||
          (ownerIds.length > 0 && ownerIds.includes(e.usuarioId))
        );
      });

      const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
      const conUltimoRechazo = await Promise.all(
        filtradas.map(async (e) => {
          let ultimoRechazo: { comentario: string | null; fecha: Date } | null = null;
          if (e.estado === 'rechazado') {
            const rechazo = await bitacoraRepo.findOne({
              where: { expedienteId: e.id, tipo: 'rechazo' },
              order: { fecha: 'DESC' },
            });
            if (rechazo) {
              ultimoRechazo = { comentario: rechazo.comentario, fecha: rechazo.fecha };
            }
          }
          return { ...e, ultimoRechazo };
        })
      );

      res.json(conUltimoRechazo);
    } catch (err: any) {
      console.error('Error al obtener expedientes de la unidad:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener los expedientes de la unidad.' });
    }
  }
);

// Enviar expediente a revisión (solo creador con crear-expediente)
expedientesRouter.post('/:id/enviar-revision', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['crear-expediente']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
    const repo = AppDataSource.getRepository(Expediente);
    const exp = await repo.findOne({ where: { id, usuarioId: userId } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    if (exp.estado !== 'abierto' && exp.estado !== 'rechazado') return res.status(400).json({ message: 'Solo se puede enviar a revisión un expediente en estado abierto o rechazado (tras corrección).' });
    const esReenvio = exp.estado === 'rechazado';
    exp.estado = 'en_proceso';
    exp.comentarioRechazo = null;
    await repo.save(exp);
    await AppDataSource.getRepository(ExpedienteBitacora).save(
      AppDataSource.getRepository(ExpedienteBitacora).create({
        expedienteId: id,
        tipo: 'envio_revision',
        usuarioId: userId,
        comentario: esReenvio
          ? 'Expediente reenviado a revisión DAF después de corregir observaciones.'
          : 'Expediente enviado a revisión DAF.',
      } as any)
    );
    res.json(exp);
  } catch (err: any) {
    console.error('Error al enviar expediente a revisión:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al enviar.' });
  }
});

// Aprobar expediente (Dirección Departamental). Acepta body.comentario opcional para la bitácora.
expedientesRouter.post('/:id/aprobar', verifyToken, authorizeRolesOrPermissions(['super administrador', 'revisar-siaf-direccion-departamental'], ['revisar-expediente-direccion-departamental']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
    const body = (req as any).body || {};
    const comentarioAprobacion = typeof body.comentario === 'string' ? body.comentario.trim() || null : null;
    const repo = AppDataSource.getRepository(Expediente);
    const exp = await repo.findOne({ where: { id } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    if (exp.estado !== 'en_proceso') return res.status(400).json({ message: 'Solo se puede aprobar un expediente en revisión.' });
    exp.estado = 'cerrado';
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    exp.fechaCierre = hoy;
    exp.comentarioRechazo = null;
    await repo.save(exp);
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    if (user) {
      const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
      const bitacora = bitacoraRepo.create({
        expedienteId: id,
        tipo: 'aprobacion',
        usuarioId: userId,
        usuario: user,
        comentario: comentarioAprobacion || 'Aprobado por Dirección Departamental.',
      });
      await bitacoraRepo.save(bitacora);
    }
    res.json(exp);
  } catch (err: any) {
    console.error('Error al aprobar expediente:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al aprobar.' });
  }
});

// Rechazar expediente (Dirección Departamental). Acepta comentario general y comentarios por documento; registra bitácora.
expedientesRouter.post('/:id/rechazar', verifyToken, authorizeRolesOrPermissions(['super administrador', 'revisar-siaf-direccion-departamental'], ['revisar-expediente-direccion-departamental']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
    const body = (req as any).body || {};
    const comentario = typeof body.comentario === 'string' ? body.comentario.trim() || null : null;
    const comentariosPorDocumento = Array.isArray(body.comentariosPorDocumento) ? body.comentariosPorDocumento : [];
    const repo = AppDataSource.getRepository(Expediente);
    const exp = await repo.findOne({ where: { id } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    if (exp.estado !== 'en_proceso') return res.status(400).json({ message: 'Solo se puede rechazar un expediente en revisión.' });
    exp.estado = 'rechazado';
    const resumenRechazo = comentario || (comentariosPorDocumento.length > 0 ? 'Rechazado con observaciones por documento.' : null);
    exp.comentarioRechazo = resumenRechazo;
    await repo.save(exp);
    const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
    const bitacora = bitacoraRepo.create({
      expedienteId: id,
      tipo: 'rechazo',
      usuarioId: userId,
      comentario: comentario ?? null,
    } as any);
    const saved = await bitacoraRepo.save(bitacora);
    const bitacoraGuardada = Array.isArray(saved) ? saved[0] : saved;
    const detalleRepo = AppDataSource.getRepository(ExpedienteBitacoraDetalle);
    const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
    const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
    for (const item of comentariosPorDocumento) {
      const docId = item.documentoId != null ? parseInt(String(item.documentoId), 10) : NaN;
      const texto = typeof item.comentario === 'string' ? item.comentario.trim() : '';
      if (!isNaN(docId) && texto) {
        const doc = await docRepo.findOne({ where: { id: docId, expedienteId: id } });
        if (doc) {
          const requestedVersionId = item.documentoVersionId != null ? parseInt(String(item.documentoVersionId), 10) : NaN;
          const versionRevisada = !isNaN(requestedVersionId)
            ? await versionRepo.findOne({ where: { id: requestedVersionId, expedienteDocumentoId: docId } })
            : await versionRepo.findOne({ where: { expedienteDocumentoId: docId, esActual: true } });
          const pagina = item.pagina != null ? parseInt(String(item.pagina), 10) : null;
          const xPercent = item.xPercent != null ? Number(item.xPercent) : null;
          const yPercent = item.yPercent != null ? Number(item.yPercent) : null;
          const det = detalleRepo.create({
            bitacoraId: bitacoraGuardada.id,
            expedienteDocumentoId: docId,
            expedienteDocumentoVersionId: versionRevisada?.id ?? null,
            nombreDocumento: doc.nombreArchivo || null,
            comentario: texto,
            pagina: pagina ?? undefined,
            xPercent: xPercent ?? undefined,
            yPercent: yPercent ?? undefined,
          } as any);
          await detalleRepo.save(det);
        }
      }
    }
    res.json(exp);
  } catch (err: any) {
    console.error('Error al rechazar expediente:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al rechazar.' });
  }
});

// Actualizar expediente (solo si no está aprobado/cerrado/archivado)
expedientesRouter.put('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
    const { tipoExpediente, titulo, descripcion, numeroOrdenCompra, numeroSiaf } = req.body || {};
    const repo = AppDataSource.getRepository(Expediente);
    const exp = await repo.findOne({ where: { id, usuarioId: userId } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    const estadosNoEditables = ['en_proceso', 'cerrado', 'aprobado', 'archivado'];
    if (estadosNoEditables.includes(exp.estado)) return res.status(400).json({ message: exp.estado === 'en_proceso' ? 'No se puede editar el expediente mientras está en revisión. Espere aprobación o rechazo.' : 'No se puede editar un expediente ya aprobado o cerrado.' });
    const tipo = typeof tipoExpediente === 'string' ? tipoExpediente.trim() : exp.tipoExpediente;
    const tit = typeof titulo === 'string' ? titulo.trim() : exp.titulo;
    if (tit && !TITULOS_EXPEDIENTE_VALIDOS.includes(tit)) return res.status(400).json({ message: 'El título debe ser "Bien/Producto" o "Servicio".' });
    const nuevoTipo = tipo || exp.tipoExpediente;
    const nuevoTit = tit || exp.titulo;
    if (typeof descripcion === 'string' && !descripcion.trim()) {
      return res.status(400).json({ message: 'La descripción es obligatoria.' });
    }
    if (typeof numeroOrdenCompra === 'string' && !numeroOrdenCompra.trim()) {
      return res.status(400).json({ message: 'El número de orden de compra (O.C.) es obligatorio.' });
    }
    const nuevaDesc = typeof descripcion === 'string' ? descripcion.trim() : exp.descripcion;
    const nuevaOc = typeof numeroOrdenCompra === 'string' ? numeroOrdenCompra.trim() : exp.numeroOrdenCompra;
    const nuevoSiaf = typeof numeroSiaf === 'string' ? numeroSiaf.trim() || null : exp.numeroSiaf;
    if (!nuevaDesc) return res.status(400).json({ message: 'La descripción es obligatoria.' });
    if (!nuevaOc) return res.status(400).json({ message: 'El número de orden de compra (O.C.) es obligatorio.' });
    await repo.update(
      { id, usuarioId: userId },
      { tipoExpediente: nuevoTipo, titulo: nuevoTit, descripcion: nuevaDesc, numeroOrdenCompra: nuevaOc, numeroSiaf: nuevoSiaf } as any
    );
    const actualizado = await repo.findOne({ where: { id } });
    res.json(actualizado ?? exp);
  } catch (err: any) {
    console.error('Error al actualizar expediente:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al actualizar expediente.' });
  }
});

// Expediente por ID (con documentos) — del usuario o en revisión por DD
expedientesRouter.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userPermissions: string[] = (req as any).user?.permissions ?? [];
    const userRoles: string[] = (req as any).user?.roles ?? [];
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
    const repo = AppDataSource.getRepository(Expediente);
    let exp = await repo.findOne({
      where: { id },
      relations: ['documentos', 'documentos.subidoPor', 'usuario'],
    });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
    const versionesActuales = exp.documentos?.length
      ? await versionRepo.find({ where: { expedienteDocumentoId: In(exp.documentos.map((d) => d.id)), esActual: true } })
      : [];
    const versionActualPorDocumento = new Map(versionesActuales.map((v) => [v.expedienteDocumentoId, v.id]));
    (exp.documentos || []).forEach((doc: any) => {
      doc.versionActualId = versionActualPorDocumento.get(doc.id) ?? null;
    });
    const esPropietario = exp.usuarioId === userId;
    const esAnalistaDAF = userPermissions.includes('revisar-expediente-direccion-departamental') || userRoles.includes('revisar-siaf-direccion-departamental');
    const puedeRevisar = esAnalistaDAF && (exp.estado === 'en_proceso' || exp.estado === 'rechazado' || exp.estado === 'cerrado');
    const puedeUnidad = await puedeLeerExpedienteComoUnidad(req, exp);
    if (!esPropietario && !puedeRevisar && !puedeUnidad) return res.status(403).json({ message: 'No tiene acceso a este expediente.' });
    let ultimoRechazo: any = null;
    const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
    const bitacoraRechazo = await bitacoraRepo.findOne({
      where: { expedienteId: id, tipo: 'rechazo' },
      relations: ['detalle', 'detalle.expedienteDocumento', 'usuario'],
      order: { fecha: 'DESC' },
    });
    const idsEnUltimoRechazo = new Set<number>();
    if (bitacoraRechazo) {
      (bitacoraRechazo.detalle || []).forEach((d: any) => { if (d.expedienteDocumentoId != null) idsEnUltimoRechazo.add(d.expedienteDocumentoId); });
      const fechaRechazo = bitacoraRechazo.fecha ? new Date(bitacoraRechazo.fecha).getTime() : 0;
      const correccionesPosteriores = await bitacoraRepo.find({
        where: { expedienteId: id, tipo: 'correccion' },
        order: { fecha: 'ASC' },
      });
      const docIdToVersionId = new Map<number, number>();
      for (const c of correccionesPosteriores) {
        if (c.expedienteDocumentoVersionId != null && c.expedienteDocumentoId != null && c.fecha && new Date(c.fecha).getTime() > fechaRechazo && !docIdToVersionId.has(c.expedienteDocumentoId)) {
          docIdToVersionId.set(c.expedienteDocumentoId, c.expedienteDocumentoVersionId);
        }
      }
      ultimoRechazo = {
        id: bitacoraRechazo.id,
        fecha: bitacoraRechazo.fecha,
        comentario: bitacoraRechazo.comentario,
        usuario: bitacoraRechazo.usuario ? { nombres: bitacoraRechazo.usuario.nombres, apellidos: bitacoraRechazo.usuario.apellidos } : null,
        detalle: (bitacoraRechazo.detalle || []).map((d: any) => ({
          expedienteDocumentoId: d.expedienteDocumentoId,
          nombreDocumento: d.expedienteDocumento?.nombreArchivo || d.expedienteDocumento?.tipoDocumento || d.nombreDocumento || '',
          comentario: d.comentario,
          pagina: d.pagina != null ? Number(d.pagina) : null,
          xPercent: d.xPercent != null ? Number(d.xPercent) : null,
          yPercent: d.yPercent != null ? Number(d.yPercent) : null,
          documentoVersionIdParaMarca: d.expedienteDocumentoVersionId
            ?? (d.expedienteDocumentoId != null ? docIdToVersionId.get(d.expedienteDocumentoId) : undefined),
        })),
      };
    }
    const expJson: any = { ...exp };
    if (expJson.documentos && Array.isArray(expJson.documentos)) {
      expJson.documentos = expJson.documentos.map((doc: any) => ({
        ...doc,
        enUltimoRechazo: idsEnUltimoRechazo.has(doc.id),
      }));
    }
    res.json({ ...expJson, ultimoRechazo });
  } catch (err: any) {
    console.error('Error al obtener expediente:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al obtener expediente.' });
  }
});

// Bitácora del expediente (rechazos y aprobaciones) — mismo acceso que GET expediente
expedientesRouter.get('/:id/bitacora', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userPermissions: string[] = (req as any).user?.permissions ?? [];
    const userRoles: string[] = (req as any).user?.roles ?? [];
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
    const expRepo = AppDataSource.getRepository(Expediente);
    const exp = await expRepo.findOne({ where: { id } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    const esPropietario = exp.usuarioId === userId;
    const esAnalistaDAF = userPermissions.includes('revisar-expediente-direccion-departamental') || userRoles.includes('revisar-siaf-direccion-departamental');
    const puedeUnidad = await puedeLeerExpedienteComoUnidad(req, exp);
    const puedeVerBitacora =
      esPropietario ||
      (esAnalistaDAF && (exp.estado === 'en_proceso' || exp.estado === 'rechazado' || exp.estado === 'cerrado')) ||
      puedeUnidad;
    if (!puedeVerBitacora) return res.status(403).json({ message: 'No tiene acceso a la bitácora de este expediente.' });
    const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
    // Incluir todos los tipos: rechazo, aprobacion, correccion (reemplazo de documento)
    let filas = await bitacoraRepo.find({
      where: { expedienteId: id },
      relations: ['detalle', 'detalle.expedienteDocumento', 'usuario'],
      order: { fecha: 'DESC' },
    });

    // Si el expediente está rechazado pero no hay registros en bitácora (rechazo anterior a la implementación de bitácora),
    // se arma una entrada de respaldo a partir de comentarioRechazo para que el usuario vea el motivo.
    if ((!filas || filas.length === 0) && exp.estado === 'rechazado') {
      const fechaRef = exp.updatedAt || exp.createdAt || new Date();
      filas = [{
        id: 0,
        tipo: 'rechazo',
        fecha: fechaRef,
        comentario: (exp as any).comentarioRechazo || 'Expediente rechazado. (Registro anterior a la bitácora; el motivo puede estar en el detalle del expediente.)',
        usuario: null,
        detalle: [],
      }] as any;
    }

    const fechaRechazo = (b: any) => b.fecha ? new Date(b.fecha).getTime() : 0;
    const docIdsCorreccion = [...new Set((filas || []).filter((f: any) => f.tipo === 'correccion' && f.expedienteDocumentoId != null).map((f: any) => f.expedienteDocumentoId))];
    const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
    const docsCorreccion = docIdsCorreccion.length > 0
      ? await docRepo.find({ where: { id: In(docIdsCorreccion) }, select: ['id', 'nombreArchivo', 'mimeType', 'tipoDocumento'] })
      : [];
    const docCorreccionMap = new Map(docsCorreccion.map((d: any) => [d.id, { nombreArchivo: d.nombreArchivo || d.tipoDocumento || 'Documento', mimeType: d.mimeType || 'application/octet-stream' }]));
    const versionIdsCorreccion = [...new Set((filas || []).filter((f: any) => f.tipo === 'correccion' && f.expedienteDocumentoVersionId != null).map((f: any) => f.expedienteDocumentoVersionId))];
    const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
    const versionesReemplazadas = versionIdsCorreccion.length > 0
      ? await versionRepo.find({ where: { id: In(versionIdsCorreccion) }, select: ['id', 'nombreArchivo', 'mimeType'] })
      : [];
    const versionReemplazadaMap = new Map(versionesReemplazadas.map((v: any) => [v.id, { versionId: v.id, nombreArchivo: v.nombreArchivo || 'Documento', mimeType: v.mimeType || 'application/octet-stream' }]));
    const bitacora = (filas || []).map((b: any) => {
      const esRechazo = b.tipo === 'rechazo';
      const esCorreccion = b.tipo === 'correccion';
      const docActual = esCorreccion && b.expedienteDocumentoId != null ? docCorreccionMap.get(b.expedienteDocumentoId) : null;
      const docReemplazado = esCorreccion && b.expedienteDocumentoVersionId != null ? versionReemplazadaMap.get(b.expedienteDocumentoVersionId) : null;
      return {
        id: b.id,
        tipo: b.tipo,
        fecha: b.fecha,
        comentario: b.comentario ?? null,
        usuario: b.usuario ? { nombres: b.usuario.nombres, apellidos: b.usuario.apellidos } : null,
        expedienteDocumentoId: b.expedienteDocumentoId ?? null,
        documentoReemplazo: docActual ?? undefined,
        documentoReemplazado: docReemplazado ?? undefined,
        detalle: (b.detalle || []).map((d: any) => {
          const docId = d.expedienteDocumentoId;
          const correccionesPosteriores = (filas || []).filter((f: any) =>
            esRechazo && f.tipo === 'correccion' && f.expedienteDocumentoId === docId && fechaRechazo(f) > fechaRechazo(b)
          );
          const correccionQueReemplazoRechazado = correccionesPosteriores.length > 0
            ? correccionesPosteriores.reduce((min: any, f: any) => fechaRechazo(f) < fechaRechazo(min) ? f : min)
            : null;
          const corregido = !!correccionQueReemplazoRechazado;
          const rawVersionId = d.expedienteDocumentoVersionId ?? correccionQueReemplazoRechazado?.expedienteDocumentoVersionId;
          const documentoVersionIdParaMarca = (rawVersionId != null && Number(rawVersionId) > 0)
            ? Number(rawVersionId)
            : undefined;
          return {
            expedienteDocumentoId: docId,
            nombreDocumento: d.nombreDocumento || d.expedienteDocumento?.nombreArchivo || d.expedienteDocumento?.tipoDocumento || 'Documento',
            mimeType: d.expedienteDocumento?.mimeType || 'application/octet-stream',
            comentario: d.comentario || '',
            pagina: d.pagina != null ? Number(d.pagina) : null,
            xPercent: d.xPercent != null ? Number(d.xPercent) : null,
            yPercent: d.yPercent != null ? Number(d.yPercent) : null,
            corregido,
            documentoVersionIdParaMarca,
          };
        }),
      };
    });
    res.json(bitacora);
  } catch (err: any) {
    console.error('Error al obtener bitácora del expediente:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al obtener bitácora.' });
  }
});

// Listar documentos de un expediente (incluido en GET /expedientes/:id)
// Subir documento a un expediente
expedientesRouter.post('/:id/documentos', verifyToken, uploadMemory.single('archivo'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const expedienteId = parseInt(req.params.id);
    if (isNaN(expedienteId)) return res.status(400).json({ message: 'ID de expediente inválido.' });
    const file = (req as any).file;
    if (!file || !file.buffer) return res.status(400).json({ message: 'Debe enviar un archivo (campo "archivo").' });
    const expRepo = AppDataSource.getRepository(Expediente);
    const exp = await expRepo.findOne({ where: { id: expedienteId } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    if (exp.usuarioId !== userId) return res.status(403).json({ message: 'No puede agregar documentos a este expediente.' });
    if (exp.estado === 'en_proceso') return res.status(400).json({ message: 'No puede agregar documentos mientras el expediente está en revisión. Espere aprobación o rechazo.' });
    const tipoDocumento = typeof (req as any).body?.tipoDocumento === 'string' ? (req as any).body.tipoDocumento.trim() : 'Otro';
    const descripcionDoc = typeof (req as any).body?.descripcion === 'string' ? (req as any).body.descripcion.trim() || null : null;
    const nombreOriginal = file.originalname || `documento-${Date.now()}`;
    const pdfInfo = await fileStorageService.saveExpedienteDocument(file.buffer, exp.numeroExpediente, nombreOriginal);
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
    const doc = docRepo.create({
      expedienteId: exp.id,
      expediente: exp,
      tipoDocumento: tipoDocumento || 'Otro',
      nombreArchivo: nombreOriginal,
      rutaArchivo: pdfInfo.filePath,
      mimeType: file.mimetype || 'application/octet-stream',
      tamanioBytes: pdfInfo.size,
      hashArchivo: pdfInfo.hash,
      subidoPorId: userId,
      subidoPor: user,
      descripcion: descripcionDoc,
    });
    await docRepo.save(doc);
    const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
    const v1 = versionRepo.create({
      expedienteDocumentoId: doc.id,
      expedienteDocumento: doc,
      numeroVersion: 1,
      esActual: true,
      nombreArchivo: nombreOriginal,
      rutaArchivo: pdfInfo.filePath,
      hashArchivo: pdfInfo.hash,
      tamanioBytes: pdfInfo.size,
      mimeType: file.mimetype || 'application/octet-stream',
      subidoPorId: userId,
      subidoPor: user,
    });
    await versionRepo.save(v1);
    res.status(201).json(doc);
  } catch (err: any) {
    console.error('Error al subir documento al expediente:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al subir el documento.' });
  }
});

/**
 * Categoriza un PDF paquete: crea un documento por cada rango de páginas (tipo SIAF, Factura, etc.).
 * Body: { secciones: [{ tipoDocumento, paginaInicio, paginaFin, descripcion? }] }
 */
expedientesRouter.post('/:id/documentos/:docId/categorizar', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const expedienteId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    if (isNaN(expedienteId) || isNaN(docId)) return res.status(400).json({ message: 'Parámetros inválidos.' });

    const expRepo = AppDataSource.getRepository(Expediente);
    const exp = await expRepo.findOne({ where: { id: expedienteId } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    if (exp.usuarioId !== userId) return res.status(403).json({ message: 'No puede categorizar documentos de este expediente.' });
    if (exp.estado === 'en_proceso') {
      return res.status(400).json({ message: 'No puede categorizar mientras el expediente está en revisión.' });
    }

    const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
    const origen = await docRepo.findOne({ where: { id: docId, expedienteId } });
    if (!origen) return res.status(404).json({ message: 'Documento paquete no encontrado.' });
    if (origen.tipoDocumento !== TIPO_DOCUMENTO_PAQUETE) {
      return res.status(400).json({
        message: `Solo se puede categorizar un documento de tipo «${TIPO_DOCUMENTO_PAQUETE}».`,
      });
    }
    const mime = (origen.mimeType || '').toLowerCase();
    if (!mime.includes('pdf') && !String(origen.nombreArchivo || '').toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ message: 'El paquete debe ser un archivo PDF.' });
    }

    const seccionesRaw = Array.isArray((req as any).body?.secciones) ? (req as any).body.secciones : [];
    if (!seccionesRaw.length) {
      return res.status(400).json({ message: 'Indique al menos una sección (tipo + páginas).' });
    }

    type Seccion = { tipoDocumento: string; paginaInicio: number; paginaFin: number; descripcion: string | null };
    const secciones: Seccion[] = [];
    for (const s of seccionesRaw) {
      const tipoDocumento = typeof s?.tipoDocumento === 'string' ? s.tipoDocumento.trim() : '';
      const paginaInicio = Number(s?.paginaInicio);
      const paginaFin = Number(s?.paginaFin);
      const descripcion = typeof s?.descripcion === 'string' ? s.descripcion.trim() || null : null;
      if (!tipoDocumento) return res.status(400).json({ message: 'Cada sección debe tener tipoDocumento.' });
      if (tipoDocumento === TIPO_DOCUMENTO_PAQUETE) {
        return res.status(400).json({ message: 'No use el tipo paquete en las secciones categorizadas.' });
      }
      if (!Number.isFinite(paginaInicio) || !Number.isFinite(paginaFin) || paginaInicio < 1 || paginaFin < 1) {
        return res.status(400).json({ message: 'paginaInicio y paginaFin deben ser enteros >= 1.' });
      }
      if (paginaFin < paginaInicio) {
        return res.status(400).json({ message: `En «${tipoDocumento}», la página final no puede ser menor que la inicial.` });
      }
      secciones.push({ tipoDocumento, paginaInicio: Math.floor(paginaInicio), paginaFin: Math.floor(paginaFin), descripcion });
    }

    const sourceBuffer = await fileStorageService.readExpedienteDocument(origen.rutaArchivo);
    const totalPages = await getPdfPageCount(sourceBuffer);
    for (const s of secciones) {
      if (s.paginaInicio > totalPages || s.paginaFin > totalPages) {
        return res.status(400).json({
          message: `El PDF tiene ${totalPages} página(s). Revise el rango de «${s.tipoDocumento}».`,
        });
      }
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);

    const creados: ExpedienteDocumento[] = [];
    for (const s of secciones) {
      const slice = await extractPdfPageRange(sourceBuffer, s.paginaInicio, s.paginaFin);
      const safeTipo = s.tipoDocumento.replace(/[^\w\-áéíóúÁÉÍÓÚñÑ ]+/gi, '').slice(0, 60) || 'documento';
      const nombreOriginal = `${safeTipo}-p${s.paginaInicio}-${s.paginaFin}.pdf`;
      const pdfInfo = await fileStorageService.saveExpedienteDocument(slice, exp.numeroExpediente, nombreOriginal);
      const descRango = `Páginas ${s.paginaInicio}–${s.paginaFin}.`;
      const doc = docRepo.create({
        expedienteId: exp.id,
        expediente: exp,
        tipoDocumento: s.tipoDocumento,
        nombreArchivo: nombreOriginal,
        rutaArchivo: pdfInfo.filePath,
        mimeType: 'application/pdf',
        tamanioBytes: pdfInfo.size,
        hashArchivo: pdfInfo.hash,
        subidoPorId: userId,
        subidoPor: user,
        descripcion: s.descripcion ? `${s.descripcion} (${descRango})` : descRango,
      });
      await docRepo.save(doc);
      const v1 = versionRepo.create({
        expedienteDocumentoId: doc.id,
        expedienteDocumento: doc,
        numeroVersion: 1,
        esActual: true,
        nombreArchivo: nombreOriginal,
        rutaArchivo: pdfInfo.filePath,
        hashArchivo: pdfInfo.hash,
        tamanioBytes: pdfInfo.size,
        mimeType: 'application/pdf',
        subidoPorId: userId,
        subidoPor: user,
      });
      await versionRepo.save(v1);
      creados.push(doc);
    }

    await AppDataSource.getRepository(ExpedienteBitacora).save(
      AppDataSource.getRepository(ExpedienteBitacora).create({
        expedienteId,
        // varchar(20) en expediente_bitacora.tipo
        tipo: 'categorizacion',
        usuarioId: userId,
        comentario: `Paquete PDF categorizado en ${creados.length} documento(s): ${secciones
          .map((s) => `${s.tipoDocumento} (p.${s.paginaInicio}–${s.paginaFin})`)
          .join('; ')}.`.slice(0, 2000),
      } as any)
    );

    res.status(201).json({
      documentos: creados,
      paqueteId: origen.id,
      totalPaginasOrigen: totalPages,
    });
  } catch (err: any) {
    console.error('Error al categorizar paquete PDF:', err?.message || err);
    const detail = err?.message || String(err);
    const isValueTooLong = /value too long|character varying\(20\)/i.test(detail);
    res.status(500).json({
      message: isValueTooLong
        ? 'Error de bitácora al guardar la categorización. Reinicie el backend (corrección aplicada) e intente de nuevo.'
        : (detail || 'Error al categorizar el expediente completo.'),
    });
  }
});

// Reemplazar documento (sube nueva versión y guarda la anterior como respaldo)
expedientesRouter.post('/:id/documentos/:docId/reemplazar', verifyToken, uploadMemory.single('archivo'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const expedienteId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    if (isNaN(expedienteId) || isNaN(docId)) return res.status(400).json({ message: 'Parámetros inválidos.' });
    const file = (req as any).file;
    if (!file || !file.buffer) return res.status(400).json({ message: 'Debe enviar un archivo (campo "archivo").' });
    const expRepo = AppDataSource.getRepository(Expediente);
    const exp = await expRepo.findOne({ where: { id: expedienteId } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    if (exp.usuarioId !== userId) return res.status(403).json({ message: 'No puede reemplazar documentos de este expediente.' });
    if (exp.estado === 'en_proceso') return res.status(400).json({ message: 'No puede reemplazar documentos mientras el expediente está en revisión.' });
    const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
    const doc = await docRepo.findOne({ where: { id: docId, expedienteId } });
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
    const versionesExistentes = await versionRepo.find({
      where: { expedienteDocumentoId: docId },
      order: { numeroVersion: 'DESC' },
    });
    let versionActual = versionesExistentes.find((v) => v.esActual);
    if (!versionActual) {
      versionActual = versionesExistentes.find((v) => v.hashArchivo === doc.hashArchivo);
      if (versionActual) {
        versionActual.esActual = true;
        await versionRepo.save(versionActual);
      }
    }
    const siguienteVersion = (versionesExistentes[0]?.numeroVersion ?? 0) + 1;
    const nombreAnterior = doc.nombreArchivo;
    const nombreOriginal = file.originalname || doc.nombreArchivo || `documento-${Date.now()}`;
    const pdfInfo = await fileStorageService.saveExpedienteDocument(file.buffer, exp.numeroExpediente, nombreOriginal);
    if (versionActual) {
      versionActual.esActual = false;
      await versionRepo.save(versionActual);
    }
    doc.nombreArchivo = nombreOriginal;
    doc.rutaArchivo = pdfInfo.filePath;
    doc.hashArchivo = pdfInfo.hash;
    doc.tamanioBytes = pdfInfo.size;
    doc.mimeType = file.mimetype || 'application/octet-stream';
    doc.subidoPorId = userId;
    doc.subidoPor = user;
    await docRepo.save(doc);
    const versionNueva = await versionRepo.save(versionRepo.create({
      expedienteDocumentoId: docId,
      expedienteDocumento: doc,
      numeroVersion: siguienteVersion,
      esActual: true,
      nombreArchivo: nombreOriginal,
      rutaArchivo: pdfInfo.filePath,
      hashArchivo: pdfInfo.hash,
      tamanioBytes: pdfInfo.size,
      mimeType: file.mimetype || 'application/octet-stream',
      subidoPorId: userId,
      subidoPor: user,
    }));

    // Registrar corrección: conserva la versión anterior y deja claro cuál es la nueva.
    const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
    const bitacoraCorreccion = bitacoraRepo.create({
      expedienteId,
      tipo: 'correccion',
      usuarioId: userId,
      usuario: user,
      comentario: `Versión ${versionActual?.numeroVersion ?? 'anterior'} («${nombreAnterior}») reemplazada por versión ${versionNueva.numeroVersion} («${nombreOriginal}»).`,
      expedienteDocumentoId: docId,
      expedienteDocumentoVersionId: versionActual?.id ?? null,
    });
    await bitacoraRepo.save(bitacoraCorreccion);

    res.json(doc);
  } catch (err: any) {
    console.error('Error al reemplazar documento:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al reemplazar el documento.' });
  }
});

/**
 * Reemplaza el PDF completo (paquete), elimina los documentos categorizados previos
 * y deja el expediente listo para re-categorizar. Solo en abierto o rechazado.
 */
expedientesRouter.post(
  '/:id/reemplazar-paquete',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador'], ['crear-expediente']),
  uploadMemory.single('archivo'),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const expedienteId = parseInt(req.params.id);
      if (isNaN(expedienteId)) return res.status(400).json({ message: 'ID de expediente inválido.' });
      const file = (req as any).file;
      if (!file || !file.buffer) return res.status(400).json({ message: 'Debe enviar el PDF completo (campo "archivo").' });

      const mime = String(file.mimetype || '').toLowerCase();
      const name = String(file.originalname || '').toLowerCase();
      if (!mime.includes('pdf') && !name.endsWith('.pdf')) {
        return res.status(400).json({ message: 'El expediente completo debe ser un archivo PDF.' });
      }

      const expRepo = AppDataSource.getRepository(Expediente);
      const exp = await expRepo.findOne({ where: { id: expedienteId } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      if (exp.usuarioId !== userId) {
        return res.status(403).json({ message: 'Solo el creador puede reemplazar el PDF completo.' });
      }
      if (exp.estado !== 'abierto' && exp.estado !== 'rechazado') {
        return res.status(400).json({
          message:
            exp.estado === 'en_proceso'
              ? 'No puede reemplazar el PDF mientras el expediente está en revisión. Espere el rechazo de DAF.'
              : 'No se puede reemplazar el PDF de un expediente cerrado o aprobado.',
        });
      }

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: userId });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

      const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
      const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
      const todos = await docRepo.find({ where: { expedienteId } });
      let paquete = todos.find((d) => d.tipoDocumento === TIPO_DOCUMENTO_PAQUETE) || null;
      const categorizados = todos.filter((d) => d.tipoDocumento !== TIPO_DOCUMENTO_PAQUETE);

      for (const doc of categorizados) {
        try {
          await fileStorageService.deleteExpedienteDocument(doc.rutaArchivo);
        } catch {
          /* archivo ya ausente */
        }
        const versiones = await versionRepo.find({ where: { expedienteDocumentoId: doc.id } });
        for (const v of versiones) {
          if (v.rutaArchivo && v.rutaArchivo !== doc.rutaArchivo) {
            try {
              await fileStorageService.deleteExpedienteDocument(v.rutaArchivo);
            } catch {
              /* ignore */
            }
          }
        }
        await docRepo.remove(doc);
      }

      const nombreOriginal = file.originalname || `expediente-completo-${Date.now()}.pdf`;
      const pdfInfo = await fileStorageService.saveExpedienteDocument(file.buffer, exp.numeroExpediente, nombreOriginal);

      if (!paquete) {
        paquete = docRepo.create({
          expedienteId: exp.id,
          expediente: exp,
          tipoDocumento: TIPO_DOCUMENTO_PAQUETE,
          nombreArchivo: nombreOriginal,
          rutaArchivo: pdfInfo.filePath,
          mimeType: file.mimetype || 'application/pdf',
          tamanioBytes: pdfInfo.size,
          hashArchivo: pdfInfo.hash,
          subidoPorId: userId,
          subidoPor: user,
          descripcion: 'PDF completo del expediente (origen para categorización por páginas).',
        });
        await docRepo.save(paquete);
        await versionRepo.save(
          versionRepo.create({
            expedienteDocumentoId: paquete.id,
            expedienteDocumento: paquete,
            numeroVersion: 1,
            esActual: true,
            nombreArchivo: nombreOriginal,
            rutaArchivo: pdfInfo.filePath,
            hashArchivo: pdfInfo.hash,
            tamanioBytes: pdfInfo.size,
            mimeType: file.mimetype || 'application/pdf',
            subidoPorId: userId,
            subidoPor: user,
          })
        );
      } else {
        const versionesExistentes = await versionRepo.find({
          where: { expedienteDocumentoId: paquete.id },
          order: { numeroVersion: 'DESC' },
        });
        let versionActual = versionesExistentes.find((v) => v.esActual) || versionesExistentes[0] || null;
        const siguienteVersion = (versionesExistentes[0]?.numeroVersion ?? 0) + 1;
        const nombreAnterior = paquete.nombreArchivo;
        if (versionActual) {
          versionActual.esActual = false;
          await versionRepo.save(versionActual);
        }
        paquete.nombreArchivo = nombreOriginal;
        paquete.rutaArchivo = pdfInfo.filePath;
        paquete.hashArchivo = pdfInfo.hash;
        paquete.tamanioBytes = pdfInfo.size;
        paquete.mimeType = file.mimetype || 'application/pdf';
        paquete.subidoPorId = userId;
        paquete.subidoPor = user;
        paquete.descripcion =
          paquete.descripcion || 'PDF completo del expediente (origen para categorización por páginas).';
        await docRepo.save(paquete);
        const versionNueva = await versionRepo.save(
          versionRepo.create({
            expedienteDocumentoId: paquete.id,
            expedienteDocumento: paquete,
            numeroVersion: siguienteVersion,
            esActual: true,
            nombreArchivo: nombreOriginal,
            rutaArchivo: pdfInfo.filePath,
            hashArchivo: pdfInfo.hash,
            tamanioBytes: pdfInfo.size,
            mimeType: file.mimetype || 'application/pdf',
            subidoPorId: userId,
            subidoPor: user,
          })
        );
        await AppDataSource.getRepository(ExpedienteBitacora).save(
          AppDataSource.getRepository(ExpedienteBitacora).create({
            expedienteId,
            tipo: 'correccion',
            usuarioId: userId,
            usuario: user,
            comentario: `PDF completo reemplazado (v${versionActual?.numeroVersion ?? '—'} «${nombreAnterior}» → v${versionNueva.numeroVersion} «${nombreOriginal}»). Se eliminaron ${categorizados.length} documento(s) categorizados para re-categorizar.`,
            expedienteDocumentoId: paquete.id,
            expedienteDocumentoVersionId: versionActual?.id ?? null,
          })
        );
      }

      if (categorizados.length > 0 && paquete) {
        // Si el paquete era nuevo (sin bitácora de corrección arriba), deja traza del borrado.
        const yaRegistro =
          (await AppDataSource.getRepository(ExpedienteBitacora).count({
            where: { expedienteId, tipo: 'correccion', expedienteDocumentoId: paquete.id },
          })) > 0;
        if (!yaRegistro) {
          await AppDataSource.getRepository(ExpedienteBitacora).save(
            AppDataSource.getRepository(ExpedienteBitacora).create({
              expedienteId,
              tipo: 'correccion',
              usuarioId: userId,
              usuario: user,
              comentario: `PDF completo nuevo. Se eliminaron ${categorizados.length} documento(s) categorizados previos para re-categorizar.`,
              expedienteDocumentoId: paquete.id,
              expedienteDocumentoVersionId: null,
            })
          );
        }
      }

      res.json({
        paquete,
        eliminados: categorizados.length,
        message:
          categorizados.length > 0
            ? `PDF reemplazado. Se eliminaron ${categorizados.length} documento(s) categorizados. Categorice de nuevo.`
            : 'PDF reemplazado. Categorice las páginas del expediente.',
      });
    } catch (err: any) {
      console.error('Error al reemplazar paquete PDF:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al reemplazar el PDF completo.' });
    }
  }
);

// Listar versiones de un documento (respaldo de cada subida/reemplazo)
expedientesRouter.get('/:id/documentos/:docId/versiones', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userPermissions: string[] = (req as any).user?.permissions ?? [];
    const userRoles: string[] = (req as any).user?.roles ?? [];
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const expedienteId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    if (isNaN(expedienteId) || isNaN(docId)) return res.status(400).json({ message: 'Parámetros inválidos.' });
    const expRepo = AppDataSource.getRepository(Expediente);
    const exp = await expRepo.findOne({ where: { id: expedienteId } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    const esPropietario = exp.usuarioId === userId;
    const puedeRevisar = (userPermissions.includes('revisar-expediente-direccion-departamental') || userRoles.includes('revisar-siaf-direccion-departamental')) && exp.estado === 'en_proceso';
    const puedeUnidad = await puedeLeerExpedienteComoUnidad(req, exp);
    if (!esPropietario && !puedeRevisar && !puedeUnidad) return res.status(403).json({ message: 'No tiene acceso a este expediente.' });
    const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
    const versiones = await versionRepo.find({
      where: { expedienteDocumentoId: docId },
      relations: ['subidoPor'],
      order: { numeroVersion: 'DESC' },
    });
    const detalleRepo = AppDataSource.getRepository(ExpedienteBitacoraDetalle);
    const detalles = versiones.length
      ? await detalleRepo.find({
        where: { expedienteDocumentoVersionId: In(versiones.map((v) => v.id)) },
        relations: ['bitacora', 'bitacora.usuario'],
        order: { id: 'DESC' },
      })
      : [];
    const observacionesPorVersion = new Map<number, any[]>();
    for (const detalle of detalles) {
      if (detalle.expedienteDocumentoVersionId == null) continue;
      const list = observacionesPorVersion.get(detalle.expedienteDocumentoVersionId) ?? [];
      list.push({
        comentario: detalle.comentario,
        pagina: detalle.pagina,
        fecha: detalle.bitacora?.fecha ?? null,
        usuario: detalle.bitacora?.usuario
          ? { nombres: detalle.bitacora.usuario.nombres, apellidos: detalle.bitacora.usuario.apellidos }
          : null,
      });
      observacionesPorVersion.set(detalle.expedienteDocumentoVersionId, list);
    }
    const list = versiones.map((v: any) => ({
      id: v.id,
      numeroVersion: v.numeroVersion,
      esActual: !!v.esActual,
      nombreArchivo: v.nombreArchivo,
      fechaSubida: v.fechaSubida,
      tamanioBytes: v.tamanioBytes,
      subidoPor: v.subidoPor ? { nombres: v.subidoPor.nombres, apellidos: v.subidoPor.apellidos } : null,
      observaciones: observacionesPorVersion.get(v.id) ?? [],
    }));
    res.json(list);
  } catch (err: any) {
    console.error('Error al listar versiones:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al listar versiones.' });
  }
});

// Descargar archivo de una versión concreta (respaldo)
expedientesRouter.get('/:id/documentos/:docId/versiones/:versionId/archivo', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userPermissions: string[] = (req as any).user?.permissions ?? [];
    const userRoles: string[] = (req as any).user?.roles ?? [];
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const expedienteId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    const versionId = parseInt(req.params.versionId);
    if (isNaN(expedienteId) || isNaN(docId) || isNaN(versionId)) return res.status(400).json({ message: 'Parámetros inválidos.' });
    const expRepo = AppDataSource.getRepository(Expediente);
    const exp = await expRepo.findOne({ where: { id: expedienteId } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    const esPropietario = exp.usuarioId === userId;
    const esAnalistaDAF = userPermissions.includes('revisar-expediente-direccion-departamental') || userRoles.includes('revisar-siaf-direccion-departamental');
    const puedeRevisar = esAnalistaDAF && (exp.estado === 'en_proceso' || exp.estado === 'rechazado' || exp.estado === 'cerrado');
    const puedeUnidad = await puedeLeerExpedienteComoUnidad(req, exp);
    if (!esPropietario && !puedeRevisar && !puedeUnidad) return res.status(403).json({ message: 'No tiene acceso a este expediente.' });
    const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
    const version = await versionRepo.findOne({ where: { id: versionId, expedienteDocumentoId: docId } });
    if (!version) return res.status(404).json({ message: 'Versión no encontrada.' });
    const buffer = await fileStorageService.readExpedienteDocument(version.rutaArchivo);
    const fileName = version.nombreArchivo || `v${version.numeroVersion}`;
    res.setHeader('Content-Type', version.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.send(buffer);
  } catch (err: any) {
    if (err?.message === 'Archivo no encontrado') return res.status(404).json({ message: 'Archivo no encontrado.' });
    console.error('Error al servir archivo de versión:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al obtener el archivo.' });
  }
});

// Descargar/visualizar archivo de un documento del expediente (creador o analista DAF si está en revisión/rechazado/cerrado)
expedientesRouter.get('/:id/documentos/:docId/archivo', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userPermissions: string[] = (req as any).user?.permissions ?? [];
    const userRoles: string[] = (req as any).user?.roles ?? [];
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const expedienteId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    if (isNaN(expedienteId) || isNaN(docId)) return res.status(400).json({ message: 'Parámetros inválidos.' });
    const expRepo = AppDataSource.getRepository(Expediente);
    const exp = await expRepo.findOne({ where: { id: expedienteId } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    const esPropietario = exp.usuarioId === userId;
    const esAnalistaDAF = userPermissions.includes('revisar-expediente-direccion-departamental') || userRoles.includes('revisar-siaf-direccion-departamental');
    const puedeRevisar = esAnalistaDAF && (exp.estado === 'en_proceso' || exp.estado === 'rechazado' || exp.estado === 'cerrado');
    const puedeUnidad = await puedeLeerExpedienteComoUnidad(req, exp);
    if (!esPropietario && !puedeRevisar && !puedeUnidad) return res.status(403).json({ message: 'No tiene acceso a este expediente.' });
    const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
    const doc = await docRepo.findOne({ where: { id: docId, expedienteId } });
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    const buffer = await fileStorageService.readExpedienteDocument(doc.rutaArchivo);
    const fileName = doc.nombreArchivo || `documento-${docId}`;
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.send(buffer);
  } catch (err: any) {
    if (err?.message === 'Archivo no encontrado') return res.status(404).json({ message: 'Archivo no encontrado.' });
    console.error('Error al servir archivo:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al obtener el archivo.' });
  }
});

// Eliminar documento de un expediente
expedientesRouter.delete('/:id/documentos/:docId', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
    const expedienteId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    if (isNaN(expedienteId) || isNaN(docId)) return res.status(400).json({ message: 'Parámetros inválidos.' });
    const expRepo = AppDataSource.getRepository(Expediente);
    const exp = await expRepo.findOne({ where: { id: expedienteId } });
    if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
    if (exp.usuarioId !== userId) return res.status(403).json({ message: 'No puede eliminar documentos de este expediente.' });
    if (exp.estado === 'en_proceso') return res.status(400).json({ message: 'No puede eliminar documentos mientras el expediente está en revisión. Espere aprobación o rechazo.' });
    const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
    const doc = await docRepo.findOne({ where: { id: docId, expedienteId } });
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
    await fileStorageService.deleteExpedienteDocument(doc.rutaArchivo);
    await docRepo.remove(doc);
    res.status(204).send();
  } catch (err: any) {
    console.error('Error al eliminar documento:', err?.message || err);
    res.status(500).json({ message: err?.message || 'Error al eliminar el documento.' });
  }
});
