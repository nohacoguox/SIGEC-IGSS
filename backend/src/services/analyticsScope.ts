import { Request } from 'express';
import { In, Repository } from 'typeorm';
import { User } from '../entity/User';

export type AnalyticsAlcance = 'personal' | 'unidad';

export type AnalyticsScope = {
  alcance: AnalyticsAlcance;
  viewerId: number;
  viewerNombre: string;
  unidadMedica: string | null;
  /** Dueños cuyos trámites se incluyen. */
  ownerIds: number[];
  /** Unidades visibles (nombres). Null solo no debería ocurrir en unidad. */
  unidades: string[];
  canViewUnidad: boolean;
  canPickUnidad: boolean;
  usuarioFiltroId: number | null;
  unidadFiltro: string | null;
};

function isSuperAdmin(req: Request): boolean {
  const roles: string[] = (req as any).user?.roles ?? [];
  return roles.some((r) => String(r || '').toLowerCase() === 'super administrador');
}

function hasPermission(req: Request, names: string[]): boolean {
  if (isSuperAdmin(req)) return true;
  const permissions: string[] = (req as any).user?.permissions ?? [];
  return names.some((n) => permissions.includes(n));
}

/**
 * Resuelve el alcance de estadísticas:
 * - personal: solo trámites del usuario autenticado
 * - unidad: directores/jefes (permiso) ven su unidad; super admin elige unidad(es)
 */
export async function resolveAnalyticsScope(
  req: Request,
  userRepo: Repository<User>,
): Promise<{ ok: true; scope: AnalyticsScope } | { ok: false; status: number; message: string }> {
  const viewerId = (req as any).user?.userId as number | undefined;
  if (!viewerId) return { ok: false, status: 401, message: 'Usuario no identificado.' };

  const viewer = await userRepo.findOne({ where: { id: viewerId } });
  if (!viewer) return { ok: false, status: 404, message: 'Usuario no encontrado.' };

  const canViewUnidad = hasPermission(req, ['ver-estadisticas-unidad', 'ver-estadisticas']);
  const canPickUnidad = isSuperAdmin(req);
  const requested = String(req.query.alcance || '').toLowerCase();
  const alcance: AnalyticsAlcance =
    requested === 'unidad' && canViewUnidad ? 'unidad' : 'personal';

  const usuarioFiltroRaw = parseInt(String(req.query.usuarioId || ''), 10);
  const usuarioFiltroId = Number.isInteger(usuarioFiltroRaw) && usuarioFiltroRaw > 0 ? usuarioFiltroRaw : null;
  const unidadFiltro = typeof req.query.unidad === 'string' && req.query.unidad.trim()
    ? req.query.unidad.trim()
    : null;

  if (alcance === 'personal') {
    return {
      ok: true,
      scope: {
        alcance: 'personal',
        viewerId,
        viewerNombre: `${viewer.nombres} ${viewer.apellidos}`.trim(),
        unidadMedica: viewer.unidadMedica || null,
        ownerIds: [viewerId],
        unidades: viewer.unidadMedica ? [viewer.unidadMedica] : [],
        canViewUnidad,
        canPickUnidad,
        usuarioFiltroId: null,
        unidadFiltro: null,
      },
    };
  }

  // —— Alcance unidad ——
  let unidades: string[] = [];
  if (canPickUnidad) {
    if (!unidadFiltro) {
      return {
        ok: false,
        status: 400,
        message: 'Como super administrador debe seleccionar una unidad médica específica.',
      };
    }
    unidades = [unidadFiltro];
  } else {
    if (!viewer.unidadMedica) {
      return { ok: false, status: 400, message: 'Su usuario no tiene unidad médica asignada.' };
    }
    unidades = [viewer.unidadMedica];
    if (unidadFiltro && unidadFiltro !== viewer.unidadMedica) {
      return { ok: false, status: 403, message: 'No puede consultar estadísticas de otra unidad.' };
    }
  }

  const miembros = await userRepo.find({
    where: { unidadMedica: In(unidades) },
    select: ['id', 'nombres', 'apellidos', 'unidadMedica'],
  });
  let ownerIds = miembros.map((m) => m.id);

  if (usuarioFiltroId != null) {
    if (!ownerIds.includes(usuarioFiltroId)) {
      return { ok: false, status: 403, message: 'El usuario seleccionado no pertenece a la unidad consultada.' };
    }
    ownerIds = [usuarioFiltroId];
  }

  return {
    ok: true,
    scope: {
      alcance: 'unidad',
      viewerId,
      viewerNombre: `${viewer.nombres} ${viewer.apellidos}`.trim(),
      unidadMedica: viewer.unidadMedica || null,
      ownerIds,
      unidades,
      canViewUnidad,
      canPickUnidad,
      usuarioFiltroId,
      unidadFiltro: unidades[0] || null,
    },
  };
}
