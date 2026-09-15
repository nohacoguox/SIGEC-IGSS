/**
 * Ranking de colaboradores para analítica (unidad).
 * Agrupa SIAF/expedientes por dueño y clasifica al corte.
 */
import { ExpedienteBitacora } from '../entity/Expediente';
import { clasificarAlCorte } from './expedienteAnalytics';
import { clasificarSiafAlCorte, SiafEvento } from './siafAnalytics';

export type ContadoresColaborador = {
  casos: number;
  aprobados: number;
  rechazadosAlCierre: number;
  pendientesCorreccion: number;
  pendientesRevisionDaf: number;
  /** Cantidad de dictámenes de rechazo en el período (eventos). */
  rechazosAcumulados: number;
};

export type MesColaborador = {
  mes: string;
  etiqueta: string;
} & ContadoresColaborador;

export type RankingColaboradorRow = {
  usuarioId: number;
  etiqueta: string;
  unidadMedica: string | null;
  historico: ContadoresColaborador;
  porMes: MesColaborador[];
};

const vacio = (): ContadoresColaborador => ({
  casos: 0,
  aprobados: 0,
  rechazadosAlCierre: 0,
  pendientesCorreccion: 0,
  pendientesRevisionDaf: 0,
  rechazosAcumulados: 0,
});

const aplicarClase = (
  cont: ContadoresColaborador,
  resultado: string,
) => {
  cont.casos += 1;
  if (resultado === 'aprobado') cont.aprobados += 1;
  if (resultado === 'pendiente_correccion') {
    cont.pendientesCorreccion += 1;
    cont.rechazadosAlCierre += 1;
  }
  if (resultado === 'rechazado_al_cierre') cont.rechazadosAlCierre += 1;
  if (resultado === 'pendiente_revision_daf') cont.pendientesRevisionDaf += 1;
};

const claveMes = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

const etiquetaMes = (clave: string) => {
  const [y, m] = clave.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
};

const finDeMes = (clave: string, tope: Date) => {
  const [y, m] = clave.split('-').map(Number);
  const fin = new Date(y, m, 0, 23, 59, 59, 999);
  return fin.getTime() > tope.getTime() ? new Date(tope) : fin;
};

const mesesEnRango = (desde: Date, hasta: Date): string[] => {
  const out: string[] = [];
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
  const last = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  while (cursor.getTime() <= last.getTime()) {
    out.push(claveMes(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
};

export function construirRankingExpedientes(args: {
  colaboradores: Array<{ id: number; etiqueta: string; unidadMedica: string | null }>;
  expedientes: Array<{ id: number; usuarioId: number; createdAt: Date | string }>;
  eventosPorExpediente: Map<number, ExpedienteBitacora[]>;
  desde: Date;
  hasta: Date;
}): RankingColaboradorRow[] {
  const meses = mesesEnRango(args.desde, args.hasta);
  const porUsuario = new Map<number, RankingColaboradorRow>();

  for (const c of args.colaboradores) {
    porUsuario.set(c.id, {
      usuarioId: c.id,
      etiqueta: c.etiqueta,
      unidadMedica: c.unidadMedica,
      historico: vacio(),
      porMes: meses.map((mes) => ({ mes, etiqueta: etiquetaMes(mes), ...vacio() })),
    });
  }

  for (const exp of args.expedientes) {
    const row = porUsuario.get(exp.usuarioId);
    if (!row) continue;
    const historial = args.eventosPorExpediente.get(exp.id) ?? [];
    const clase = clasificarAlCorte(historial, args.hasta);
    aplicarClase(row.historico, clase.resultado);

    const rechazosEnPeriodo = historial.filter((e) => {
      if (e.tipo !== 'rechazo') return false;
      const t = new Date(e.fecha).getTime();
      return t >= args.desde.getTime() && t <= args.hasta.getTime();
    });
    row.historico.rechazosAcumulados += rechazosEnPeriodo.length;

    for (const mes of meses) {
      const corte = finDeMes(mes, args.hasta);
      const inicioMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1, 0, 0, 0, 0);
      const creado = new Date(exp.createdAt).getTime();
      const actividadEnMes = historial.some((e) => {
        const t = new Date(e.fecha).getTime();
        return t >= inicioMes.getTime() && t <= corte.getTime();
      });
      const creadoEnMes = creado >= inicioMes.getTime() && creado <= corte.getTime();
      const creadoAntesYAbierto = creado < inicioMes.getTime();
      if (!actividadEnMes && !creadoEnMes && !creadoAntesYAbierto) continue;

      // Solo contar en el mes si hubo actividad o creación en ese mes (más legible mes a mes).
      if (!actividadEnMes && !creadoEnMes) continue;

      const mesRow = row.porMes.find((m) => m.mes === mes)!;
      const claseMes = clasificarAlCorte(historial, corte);
      aplicarClase(mesRow, claseMes.resultado);
      mesRow.rechazosAcumulados += historial.filter((e) => {
        if (e.tipo !== 'rechazo') return false;
        const t = new Date(e.fecha).getTime();
        return t >= inicioMes.getTime() && t <= corte.getTime();
      }).length;
    }
  }

  return [...porUsuario.values()]
    .filter((r) => r.historico.casos > 0 || r.historico.rechazosAcumulados > 0)
    .sort((a, b) => b.historico.casos - a.historico.casos || b.historico.rechazosAcumulados - a.historico.rechazosAcumulados);
}

export function construirRankingSiaf(args: {
  colaboradores: Array<{ id: number; etiqueta: string; unidadMedica: string | null }>;
  siafs: Array<{ id: number; usuarioId: number; createdAt: Date | string }>;
  eventosPorSiaf: Map<number, SiafEvento[]>;
  desde: Date;
  hasta: Date;
}): RankingColaboradorRow[] {
  const meses = mesesEnRango(args.desde, args.hasta);
  const porUsuario = new Map<number, RankingColaboradorRow>();

  for (const c of args.colaboradores) {
    porUsuario.set(c.id, {
      usuarioId: c.id,
      etiqueta: c.etiqueta,
      unidadMedica: c.unidadMedica,
      historico: vacio(),
      porMes: meses.map((mes) => ({ mes, etiqueta: etiquetaMes(mes), ...vacio() })),
    });
  }

  for (const siaf of args.siafs) {
    const row = porUsuario.get(siaf.usuarioId);
    if (!row) continue;
    const historial = args.eventosPorSiaf.get(siaf.id) ?? [];
    const clase = clasificarSiafAlCorte(historial, args.hasta);
    aplicarClase(row.historico, clase.resultado);

    const rechazosEnPeriodo = historial.filter((e) => {
      if (e.tipo !== 'rechazo') return false;
      const t = new Date(e.fecha).getTime();
      return t >= args.desde.getTime() && t <= args.hasta.getTime();
    });
    row.historico.rechazosAcumulados += rechazosEnPeriodo.length;

    for (const mes of meses) {
      const corte = finDeMes(mes, args.hasta);
      const inicioMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1, 0, 0, 0, 0);
      const creado = new Date(siaf.createdAt).getTime();
      const actividadEnMes = historial.some((e) => {
        const t = new Date(e.fecha).getTime();
        return t >= inicioMes.getTime() && t <= corte.getTime();
      });
      const creadoEnMes = creado >= inicioMes.getTime() && creado <= corte.getTime();
      if (!actividadEnMes && !creadoEnMes) continue;

      const mesRow = row.porMes.find((m) => m.mes === mes)!;
      const claseMes = clasificarSiafAlCorte(historial, corte);
      aplicarClase(mesRow, claseMes.resultado);
      mesRow.rechazosAcumulados += historial.filter((e) => {
        if (e.tipo !== 'rechazo') return false;
        const t = new Date(e.fecha).getTime();
        return t >= inicioMes.getTime() && t <= corte.getTime();
      }).length;
    }
  }

  return [...porUsuario.values()]
    .filter((r) => r.historico.casos > 0 || r.historico.rechazosAcumulados > 0)
    .sort((a, b) => b.historico.casos - a.historico.casos || b.historico.rechazosAcumulados - a.historico.rechazosAcumulados);
}

export function destacarRanking(ranking: RankingColaboradorRow[]) {
  const por = (fn: (r: RankingColaboradorRow) => number) => {
    if (!ranking.length) return null;
    const top = [...ranking].sort((a, b) => fn(b) - fn(a))[0];
    return fn(top) > 0 ? { usuarioId: top.usuarioId, etiqueta: top.etiqueta, valor: fn(top) } : null;
  };
  return {
    masCasos: por((r) => r.historico.casos),
    masAprobados: por((r) => r.historico.aprobados),
    masRechazos: por((r) => r.historico.rechazosAcumulados),
  };
}
