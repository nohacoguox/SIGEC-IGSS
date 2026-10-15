/**
 * Métricas del analista DAF (revisor), no del creador del trámite.
 * Alcance: unidades médicas del departamento del analista (ej. Escuintla).
 */
import { In, Repository } from 'typeorm';
import { Expediente, ExpedienteBitacora } from '../entity/Expediente';
import { SiafAutorizacion, SiafBitacora, SiafSolicitud } from '../entity/SiafSolicitud';
import { mismaUnidadMedica } from './unidadMedicaMatch';

const horasEntre = (inicio?: Date | string | null, fin?: Date | string | null) => {
  if (!inicio || !fin) return null;
  const horas = (new Date(fin).getTime() - new Date(inicio).getTime()) / 3_600_000;
  return horas >= 0 ? horas : null;
};

const promedio = (valores: number[]) =>
  valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;

const etiquetaUnidad = (raw?: string | null) => {
  const t = String(raw || '').trim();
  return t || 'Sin unidad';
};

/** Normaliza etiqueta de caso a un nombre canónico del catálogo del departamento, si aplica. */
const canonizarUnidad = (raw: string, catalogo: string[]) => {
  const exact = catalogo.find((n) => n === raw);
  if (exact) return exact;
  const fuzzy = catalogo.find((n) => mismaUnidadMedica(n, raw));
  return fuzzy || raw;
};

const perteneceAlDepto = (unidad: string, catalogo: string[], depto: string | null) => {
  if (!catalogo.length && !depto) return true;
  if (catalogo.some((n) => mismaUnidadMedica(n, unidad) || n === unidad)) return true;
  if (depto && unidad.toLowerCase().includes(depto.toLowerCase())) return true;
  return false;
};

export type DecisionAnalista = {
  tipoCaso: 'siaf' | 'expediente';
  id: number;
  correlativo: string;
  unidad: string;
  accion: 'aprobacion' | 'rechazo';
  fechaDecision: string;
  horasRespuesta: number | null;
};

export type FilaUnidadAnalista = {
  unidad: string;
  revisados: number;
  aprobados: number;
  rechazados: number;
  pendientesCola: number;
  promedioHorasRespuesta: number | null;
  promedioHorasEnCola: number | null;
};

export type AnalistaDafAnalytics = {
  desde: string;
  hasta: string;
  analistaId: number;
  departamento: string | null;
  unidadFiltro: string | null;
  resumen: {
    revisados: number;
    aprobados: number;
    rechazados: number;
    pendientesCola: number;
    promedioHorasRespuesta: number | null;
    promedioHorasEnCola: number | null;
    muestraRespuesta: number;
  };
  porUnidad: FilaUnidadAnalista[];
  unidadesDisponibles: string[];
  recientes: DecisionAnalista[];
};

type Ctx = {
  analistaId: number;
  desde: Date;
  hasta: Date;
  unidadFiltro: string | null;
  ahora: Date;
  /** Departamento del analista (ej. Escuintla). */
  departamento: string | null;
  /** Nombres de hospitales/consultorios del departamento. */
  unidadesDepartamento: string[];
};

export async function construirAnaliticaAnalistaDaf(
  ctx: Ctx,
  repos: {
    siafRepo: Repository<SiafSolicitud>;
    autRepo: Repository<SiafAutorizacion>;
    siafBitacoraRepo: Repository<SiafBitacora>;
    expRepo: Repository<Expediente>;
    expBitacoraRepo: Repository<ExpedienteBitacora>;
  },
): Promise<AnalistaDafAnalytics> {
  const { analistaId, desde, hasta, unidadFiltro, ahora, departamento, unidadesDepartamento } = ctx;
  const catalogo = [...unidadesDepartamento].sort((a, b) => a.localeCompare(b, 'es'));

  // —— Decisiones SIAF del analista ——
  const autorizaciones = await repos.autRepo
    .createQueryBuilder('aut')
    .innerJoinAndSelect('aut.siaf', 'siaf')
    .leftJoinAndSelect('siaf.usuarioSolicitante', 'sol')
    .where('aut.usuario_autorizador_id = :analistaId', { analistaId })
    .andWhere('aut.fechaAutorizacion BETWEEN :desde AND :hasta', { desde, hasta })
    .orderBy('aut.fechaAutorizacion', 'DESC')
    .getMany();

  const siafIds = [...new Set(autorizaciones.map((a) => a.siaf?.id).filter(Boolean) as number[])];
  const bitacoraSiaf = siafIds.length
    ? await repos.siafBitacoraRepo
        .createQueryBuilder('b')
        .innerJoinAndSelect('b.siaf', 'siaf')
        .where('siaf.id IN (:...ids)', { ids: siafIds })
        .orderBy('b.fecha', 'ASC')
        .getMany()
    : [];

  /** Momentos en que el SIAF volvió a estar listo para DAF (corrección / envío). */
  const listoParaDafPorSiaf = new Map<number, Date[]>();
  for (const b of bitacoraSiaf) {
    const id = b.siaf?.id;
    if (!id) continue;
    const tipo = String(b.tipo || '').toLowerCase();
    if (
      tipo === 'envio_revision' ||
      tipo === 'enviado' ||
      tipo === 'en_revision' ||
      tipo === 'correccion' ||
      tipo.includes('correccion')
    ) {
      const lista = listoParaDafPorSiaf.get(id) ?? [];
      lista.push(new Date(b.fecha));
      listoParaDafPorSiaf.set(id, lista);
    }
  }

  const decisiones: DecisionAnalista[] = [];
  const horasRespuesta: number[] = [];

  for (const aut of autorizaciones) {
    const siaf = aut.siaf;
    if (!siaf) continue;
    const unidadRaw = etiquetaUnidad(
      siaf.nombreUnidad || siaf.unidadSolicitante || siaf.usuarioSolicitante?.unidadMedica,
    );
    if (!perteneceAlDepto(unidadRaw, catalogo, departamento)) continue;
    const unidad = canonizarUnidad(unidadRaw, catalogo);
    if (unidadFiltro && !mismaUnidadMedica(unidad, unidadFiltro) && unidad !== unidadFiltro) continue;

    const accion: 'aprobacion' | 'rechazo' =
      String(aut.accion || '').toLowerCase().startsWith('rechaz') ? 'rechazo' : 'aprobacion';
    const fechaDec = new Date(aut.fechaAutorizacion);
    const listos = listoParaDafPorSiaf.get(siaf.id) ?? [];
    const listoPrevio =
      [...listos].reverse().find((e) => e.getTime() <= fechaDec.getTime()) ||
      (siaf.updatedAt ? new Date(siaf.updatedAt) : null) ||
      (siaf.createdAt ? new Date(siaf.createdAt) : null);
    let inicio = listoPrevio;
    if (inicio && siaf.createdAt && Math.abs(inicio.getTime() - fechaDec.getTime()) < 2000) {
      inicio = new Date(siaf.createdAt);
    }
    const h = horasEntre(inicio, fechaDec);
    if (h != null) horasRespuesta.push(h);

    decisiones.push({
      tipoCaso: 'siaf',
      id: siaf.id,
      correlativo: siaf.correlativo,
      unidad,
      accion,
      fechaDecision: fechaDec.toISOString(),
      horasRespuesta: h,
    });
  }

  // —— Decisiones expedientes del analista ——
  const bitExp = await repos.expBitacoraRepo
    .createQueryBuilder('b')
    .innerJoinAndSelect('b.expediente', 'exp')
    .leftJoinAndSelect('exp.usuario', 'usr')
    .where('b.usuarioId = :analistaId', { analistaId })
    .andWhere('b.tipo IN (:...tipos)', { tipos: ['aprobacion', 'rechazo'] })
    .andWhere('b.fecha BETWEEN :desde AND :hasta', { desde, hasta })
    .orderBy('b.fecha', 'DESC')
    .getMany();

  const expIds = [...new Set(bitExp.map((b) => b.expedienteId))];
  const historialExp = expIds.length
    ? await repos.expBitacoraRepo.find({
        where: { expedienteId: In(expIds) },
        order: { fecha: 'ASC' },
      })
    : [];
  const enviosPorExp = new Map<number, Date[]>();
  for (const e of historialExp) {
    if (e.tipo !== 'envio_revision') continue;
    const lista = enviosPorExp.get(e.expedienteId) ?? [];
    lista.push(new Date(e.fecha));
    enviosPorExp.set(e.expedienteId, lista);
  }

  for (const b of bitExp) {
    const exp = b.expediente;
    if (!exp) continue;
    const unidadRaw = etiquetaUnidad(exp.unidadOrigen || exp.usuario?.unidadMedica);
    if (!perteneceAlDepto(unidadRaw, catalogo, departamento)) continue;
    const unidad = canonizarUnidad(unidadRaw, catalogo);
    if (unidadFiltro && !mismaUnidadMedica(unidad, unidadFiltro) && unidad !== unidadFiltro) continue;

    const accion: 'aprobacion' | 'rechazo' = b.tipo === 'rechazo' ? 'rechazo' : 'aprobacion';
    const fechaDec = new Date(b.fecha);
    const envios = enviosPorExp.get(exp.id) ?? [];
    const envioPrevio =
      [...envios].reverse().find((e) => e.getTime() <= fechaDec.getTime()) ||
      (exp.fechaApertura ? new Date(exp.fechaApertura) : null);
    const h = horasEntre(envioPrevio, fechaDec);
    if (h != null) horasRespuesta.push(h);

    decisiones.push({
      tipoCaso: 'expediente',
      id: exp.id,
      correlativo: exp.numeroExpediente,
      unidad,
      accion,
      fechaDecision: fechaDec.toISOString(),
      horasRespuesta: h,
    });
  }

  // —— Cola pendiente DAF del departamento (compartida; clasificada por unidad) ——
  const siafsEnCola = await repos.siafRepo
    .createQueryBuilder('siaf')
    .leftJoinAndSelect('siaf.usuarioSolicitante', 'sol')
    .where('LOWER(siaf.estado) = :estado', { estado: 'pendiente' })
    .getMany();

  const expsPendientes = await repos.expRepo
    .createQueryBuilder('exp')
    .leftJoinAndSelect('exp.usuario', 'usr')
    .where('LOWER(exp.estado) = :estado', { estado: 'en_proceso' })
    .getMany();

  type ColaItem = { unidad: string; horasEnCola: number | null };
  const cola: ColaItem[] = [];

  const siafColaIds = siafsEnCola.map((s) => s.id);
  const bitColaSiaf = siafColaIds.length
    ? await repos.siafBitacoraRepo
        .createQueryBuilder('b')
        .innerJoinAndSelect('b.siaf', 'siaf')
        .where('siaf.id IN (:...ids)', { ids: siafColaIds })
        .orderBy('b.fecha', 'ASC')
        .getMany()
    : [];
  const ultimoListoSiaf = new Map<number, Date>();
  for (const b of bitColaSiaf) {
    const id = b.siaf?.id;
    if (!id) continue;
    const tipo = String(b.tipo || '').toLowerCase();
    if (
      tipo === 'envio_revision' ||
      tipo === 'enviado' ||
      tipo === 'en_revision' ||
      tipo === 'correccion' ||
      tipo.includes('correccion')
    ) {
      ultimoListoSiaf.set(id, new Date(b.fecha));
    }
  }

  for (const s of siafsEnCola) {
    const unidadRaw = etiquetaUnidad(
      s.nombreUnidad || s.unidadSolicitante || s.usuarioSolicitante?.unidadMedica,
    );
    if (!perteneceAlDepto(unidadRaw, catalogo, departamento)) continue;
    const unidad = canonizarUnidad(unidadRaw, catalogo);
    if (unidadFiltro && !mismaUnidadMedica(unidad, unidadFiltro) && unidad !== unidadFiltro) continue;
    const desdeCola =
      ultimoListoSiaf.get(s.id) ||
      (s.updatedAt ? new Date(s.updatedAt) : null) ||
      (s.createdAt ? new Date(s.createdAt) : null);
    cola.push({ unidad, horasEnCola: horasEntre(desdeCola, ahora) });
  }

  const expColaIds = expsPendientes.map((e) => e.id);
  const bitColaExp = expColaIds.length
    ? await repos.expBitacoraRepo.find({
        where: { expedienteId: In(expColaIds), tipo: 'envio_revision' as any },
        order: { fecha: 'ASC' },
      })
    : [];
  const ultimoEnvioExp = new Map<number, Date>();
  for (const b of bitColaExp) {
    ultimoEnvioExp.set(b.expedienteId, new Date(b.fecha));
  }

  for (const e of expsPendientes) {
    const unidadRaw = etiquetaUnidad(e.unidadOrigen || e.usuario?.unidadMedica);
    if (!perteneceAlDepto(unidadRaw, catalogo, departamento)) continue;
    const unidad = canonizarUnidad(unidadRaw, catalogo);
    if (unidadFiltro && !mismaUnidadMedica(unidad, unidadFiltro) && unidad !== unidadFiltro) continue;
    const desdeCola = ultimoEnvioExp.get(e.id) || (e.fechaApertura ? new Date(e.fechaApertura) : null);
    cola.push({ unidad, horasEnCola: horasEntre(desdeCola, ahora) });
  }

  // —— Agregar por unidad (catálogo completo del departamento + extras vistos) ——
  const porUnidadMap = new Map<string, FilaUnidadAnalista & { horas: number[]; horasCola: number[] }>();
  const ensure = (unidad: string) => {
    if (!porUnidadMap.has(unidad)) {
      porUnidadMap.set(unidad, {
        unidad,
        revisados: 0,
        aprobados: 0,
        rechazados: 0,
        pendientesCola: 0,
        promedioHorasRespuesta: null,
        promedioHorasEnCola: null,
        horas: [],
        horasCola: [],
      });
    }
    return porUnidadMap.get(unidad)!;
  };

  for (const nombre of catalogo) {
    if (unidadFiltro && !mismaUnidadMedica(nombre, unidadFiltro) && nombre !== unidadFiltro) continue;
    ensure(nombre);
  }

  for (const d of decisiones) {
    const row = ensure(d.unidad);
    row.revisados += 1;
    if (d.accion === 'aprobacion') row.aprobados += 1;
    else row.rechazados += 1;
    if (d.horasRespuesta != null) row.horas.push(d.horasRespuesta);
  }
  for (const c of cola) {
    const row = ensure(c.unidad);
    row.pendientesCola += 1;
    if (c.horasEnCola != null) row.horasCola.push(c.horasEnCola);
  }

  const porUnidad = [...porUnidadMap.values()]
    .map((r) => ({
      unidad: r.unidad,
      revisados: r.revisados,
      aprobados: r.aprobados,
      rechazados: r.rechazados,
      pendientesCola: r.pendientesCola,
      promedioHorasRespuesta: promedio(r.horas),
      promedioHorasEnCola: promedio(r.horasCola),
    }))
    .sort(
      (a, b) =>
        b.revisados - a.revisados ||
        b.pendientesCola - a.pendientesCola ||
        a.unidad.localeCompare(b.unidad, 'es'),
    );

  // Filtro de unidades: siempre el catálogo del departamento (hospitales/consultorios).
  const unidadesDisponibles = (
    catalogo.length
      ? catalogo
      : [...new Set([...decisiones.map((d) => d.unidad), ...cola.map((c) => c.unidad)])]
  ).sort((a, b) => a.localeCompare(b, 'es'));

  const horasCola = cola.map((c) => c.horasEnCola).filter((v): v is number => v != null);

  return {
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    analistaId,
    departamento,
    unidadFiltro,
    resumen: {
      revisados: decisiones.length,
      aprobados: decisiones.filter((d) => d.accion === 'aprobacion').length,
      rechazados: decisiones.filter((d) => d.accion === 'rechazo').length,
      pendientesCola: cola.length,
      promedioHorasRespuesta: promedio(horasRespuesta),
      promedioHorasEnCola: promedio(horasCola),
      muestraRespuesta: horasRespuesta.length,
    },
    porUnidad,
    unidadesDisponibles,
    recientes: decisiones
      .sort((a, b) => new Date(b.fechaDecision).getTime() - new Date(a.fechaDecision).getTime())
      .slice(0, 40),
  };
}
