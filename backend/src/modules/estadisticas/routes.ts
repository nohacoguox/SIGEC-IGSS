import { Request, Response, Router } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { User } from '../../entity/User';
import { UnidadMedica } from '../../entity/UnidadMedica';
import { SiafSolicitud, SiafAutorizacion, SiafBitacora } from '../../entity/SiafSolicitud';
import { Expediente, ExpedienteBitacora, ExpedienteDocumentoVersion } from '../../entity/Expediente';
import { verifyToken, authorizeRolesOrPermissions } from '../../middleware/auth';
import { resolveAnalyticsScope } from '../../services/analyticsScope';
import {
  clasificarAlCorte,
  construirCierresMensuales,
  construirTrazabilidad,
  promediarTiemposDesdeHistoriales,
} from '../../services/expedienteAnalytics';
import {
  clasificarSiafAlCorte,
  construirCierresMensualesSiaf,
  construirTrazabilidadSiaf,
  promediarTiemposSiaf,
  unificarEventosSiaf,
} from '../../services/siafAnalytics';

// El router se monta en /api/estadisticas.
export const estadisticasRouter = Router();

// Estadísticas de tiempos SIAF: tiempo promedio de revisión (generación → autorización/rechazo) y tiempo promedio de corrección (rechazo → corrección)
estadisticasRouter.get('/siaf-tiempos', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-tiempos']), async (req: Request, res: Response) => {
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
estadisticasRouter.get('/motivos-rechazo', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-motivos']), async (req: Request, res: Response) => {
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
estadisticasRouter.get('/tesis-piloto', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-tiempos']), async (req: Request, res: Response) => {
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
estadisticasRouter.get('/filtros-analitica', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-tiempos', 'ver-estadisticas-unidad']), async (req: Request, res: Response) => {
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
estadisticasRouter.get('/expedientes-analitica', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-tiempos', 'ver-estadisticas-unidad']), async (req: Request, res: Response) => {
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
estadisticasRouter.get('/daf-analitica', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas', 'estadisticas-tiempos', 'ver-estadisticas-unidad']), async (req: Request, res: Response) => {
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
