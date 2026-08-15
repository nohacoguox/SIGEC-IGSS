/**
 * Cierre mensual y métricas por SIAF (espejo de expedienteAnalytics).
 */
import { SiafAutorizacion, SiafBitacora } from '../entity/SiafSolicitud';
import { CierreMesRow, claveMes } from './expedienteAnalytics';

export type SiafEvento = {
  tipo: 'envio_revision' | 'rechazo' | 'aprobacion' | 'correccion';
  fecha: Date;
  siafId: number;
  motivos?: string[];
};

const promedio = (valores: number[]) => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null);

const horasEntre = (inicio?: Date | string | null, fin?: Date | string | null) => {
  if (!inicio || !fin) return null;
  const horas = (new Date(fin).getTime() - new Date(inicio).getTime()) / 3_600_000;
  return horas >= 0 ? horas : null;
};

const finDeMes = (anio: number, mes1a12: number, tope?: Date) => {
  const fin = new Date(anio, mes1a12, 0, 23, 59, 59, 999);
  if (tope && fin.getTime() > tope.getTime()) return new Date(tope);
  return fin;
};

const inicioDeMes = (anio: number, mes1a12: number) => new Date(anio, mes1a12 - 1, 1, 0, 0, 0, 0);

const eventosHasta = (historial: SiafEvento[], corte: Date) =>
  historial.filter((e) => new Date(e.fecha).getTime() <= corte.getTime());

export function clasificarSiafAlCorte(historial: SiafEvento[], corte: Date): {
  resultado: 'aprobado' | 'rechazado_al_cierre' | 'pendiente_correccion' | 'pendiente_revision_daf' | 'sin_movimiento';
} {
  const hastaCorte = eventosHasta(historial, corte);
  if (!hastaCorte.length) return { resultado: 'sin_movimiento' };

  const aprobacion = [...hastaCorte].reverse().find((e) => e.tipo === 'aprobacion');
  if (aprobacion) return { resultado: 'aprobado' };

  const ultimoRechazo = [...hastaCorte].reverse().find((e) => e.tipo === 'rechazo');
  if (ultimoRechazo) {
    const despues = hastaCorte.filter((e) => new Date(e.fecha).getTime() > new Date(ultimoRechazo.fecha).getTime());
    const corrigio = despues.some((e) => e.tipo === 'correccion' || e.tipo === 'envio_revision');
    if (!corrigio) return { resultado: 'pendiente_correccion' };
    return { resultado: 'rechazado_al_cierre' };
  }

  const ultimoEnvio = [...hastaCorte].reverse().find((e) => e.tipo === 'envio_revision');
  if (ultimoEnvio) return { resultado: 'pendiente_revision_daf' };

  return { resultado: 'sin_movimiento' };
}

export function construirCierresMensualesSiaf(
  siafIds: number[],
  porSiaf: Map<number, SiafEvento[]>,
  desde: Date,
  hasta: Date,
): CierreMesRow[] {
  const filas: CierreMesRow[] = [];
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
  const limite = new Date(hasta.getFullYear(), hasta.getMonth(), 1);

  while (cursor.getTime() <= limite.getTime()) {
    const anio = cursor.getFullYear();
    const mes = cursor.getMonth() + 1;
    const inicio = inicioDeMes(anio, mes);
    const fin = finDeMes(anio, mes, hasta);
    const mesKey = claveMes(inicio);

    let activos = 0;
    let aprobados = 0;
    let rechazadosAlCierre = 0;
    let pendientesCorreccion = 0;
    let pendientesRevisionDaf = 0;

    for (const id of siafIds) {
      const historial = porSiaf.get(id) ?? [];
      const enMes = historial.some((e) => {
        const t = new Date(e.fecha).getTime();
        return t >= inicio.getTime() && t <= fin.getTime();
      });
      const antesDelMes = eventosHasta(historial, new Date(inicio.getTime() - 1));
      const abiertoAlEntrar = !!antesDelMes.length && !antesDelMes.some((e) => e.tipo === 'aprobacion');
      if (!enMes && !abiertoAlEntrar) continue;

      const clase = clasificarSiafAlCorte(historial, fin);
      const aprobacionMes = historial.find((e) => {
        if (e.tipo !== 'aprobacion') return false;
        const t = new Date(e.fecha).getTime();
        return t >= inicio.getTime() && t <= fin.getTime();
      });

      if (aprobacionMes) {
        activos += 1;
        aprobados += 1;
        continue;
      }
      if (clase.resultado === 'aprobado') continue;
      if (clase.resultado === 'sin_movimiento' && !enMes) continue;

      activos += 1;
      if (clase.resultado === 'pendiente_correccion') {
        pendientesCorreccion += 1;
        rechazadosAlCierre += 1;
      } else if (clase.resultado === 'rechazado_al_cierre') {
        rechazadosAlCierre += 1;
      } else if (clase.resultado === 'pendiente_revision_daf') {
        pendientesRevisionDaf += 1;
      }
    }

    filas.push({
      mes: mesKey,
      etiqueta: inicio.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' }),
      activos,
      aprobados,
      rechazadosAlCierre,
      pendientesCorreccion,
      pendientesRevisionDaf,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return filas;
}

export function unificarEventosSiaf(
  autorizaciones: SiafAutorizacion[],
  bitacora: SiafBitacora[],
  createdAtPorSiaf: Map<number, Date>,
): Map<number, SiafEvento[]> {
  const porSiaf = new Map<number, SiafEvento[]>();
  const push = (evento: SiafEvento) => {
    const lista = porSiaf.get(evento.siafId) ?? [];
    lista.push(evento);
    porSiaf.set(evento.siafId, lista);
  };

  createdAtPorSiaf.forEach((fecha, siafId) => {
    push({ tipo: 'envio_revision', fecha, siafId });
  });

  for (const aut of autorizaciones) {
    const siafId = aut.siaf?.id;
    if (!siafId) continue;
    const esRechazo = String(aut.accion).toLowerCase() === 'rechazado';
    let motivos: string[] = [];
    if (esRechazo) {
      if (aut.motivosRechazo) {
        try {
          const parsed = JSON.parse(aut.motivosRechazo);
          if (Array.isArray(parsed)) motivos = parsed.filter((v) => typeof v === 'string');
        } catch { /* ignore */ }
      }
      if (!motivos.length && aut.motivoRechazo) motivos = [aut.motivoRechazo];
      if (!motivos.length) motivos = ['sin_clasificar'];
    }
    push({
      tipo: esRechazo ? 'rechazo' : 'aprobacion',
      fecha: new Date(aut.fechaAutorizacion),
      siafId,
      motivos,
    });
  }

  for (const evento of bitacora) {
    const siafId = evento.siaf?.id;
    if (!siafId) continue;
    if (evento.tipo === 'correccion') {
      push({ tipo: 'correccion', fecha: new Date(evento.fecha), siafId });
    } else if (evento.tipo === 'rechazo') {
      // Evitar duplicar si ya viene de autorizaciones cercanas: se agrega igual y se ordena.
      push({ tipo: 'rechazo', fecha: new Date(evento.fecha), siafId });
    } else if (evento.tipo === 'autorizado') {
      push({ tipo: 'aprobacion', fecha: new Date(evento.fecha), siafId });
    }
  }

  porSiaf.forEach((lista, id) => {
    lista.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    // Deduplicar rechazos/aprobaciones muy cercanos (< 2s) del mismo tipo
    const limpios: SiafEvento[] = [];
    for (const ev of lista) {
      const prev = limpios[limpios.length - 1];
      if (
        prev
        && prev.tipo === ev.tipo
        && (ev.tipo === 'rechazo' || ev.tipo === 'aprobacion')
        && Math.abs(new Date(ev.fecha).getTime() - new Date(prev.fecha).getTime()) < 2000
      ) {
        if ((!prev.motivos || !prev.motivos.length) && ev.motivos?.length) prev.motivos = ev.motivos;
        continue;
      }
      limpios.push(ev);
    }
    porSiaf.set(id, limpios);
  });

  return porSiaf;
}

export function construirTrazabilidadSiaf(historial: SiafEvento[]) {
  const envios = historial.filter((e) => e.tipo === 'envio_revision');
  const rechazos = historial.filter((e) => e.tipo === 'rechazo');
  return rechazos.map((rechazo, index) => {
    const envioPrevio = [...envios].reverse().find((e) => new Date(e.fecha).getTime() <= new Date(rechazo.fecha).getTime());
    const siguienteLimite = rechazos[index + 1]?.fecha
      ?? historial.find((e) => e.tipo === 'aprobacion' && new Date(e.fecha).getTime() > new Date(rechazo.fecha).getTime())?.fecha
      ?? null;
    const correccionesDelCiclo = historial.filter((e) => {
      if (e.tipo !== 'correccion') return false;
      const t = new Date(e.fecha).getTime();
      if (t <= new Date(rechazo.fecha).getTime()) return false;
      if (siguienteLimite && t > new Date(siguienteLimite).getTime()) return false;
      return true;
    });
    const reenvio = historial.find((e) =>
      (e.tipo === 'correccion' || e.tipo === 'envio_revision')
      && new Date(e.fecha).getTime() > new Date(rechazo.fecha).getTime()
      && (!siguienteLimite || new Date(e.fecha).getTime() <= new Date(siguienteLimite).getTime()));
    const respuestaTras = reenvio
      ? historial.find((e) => (e.tipo === 'rechazo' || e.tipo === 'aprobacion')
        && new Date(e.fecha).getTime() > new Date(reenvio.fecha).getTime())
      : null;
    return {
      rechazoNumero: index + 1,
      fechaRechazo: new Date(rechazo.fecha).toISOString(),
      motivos: rechazo.motivos?.length ?? 0,
      correcciones: correccionesDelCiclo.length,
      reenviado: !!reenvio,
      fechaReenvio: reenvio?.fecha ? new Date(reenvio.fecha).toISOString() : null,
      horasRespuestaDaf: horasEntre(envioPrevio?.fecha, rechazo.fecha),
      horasCorreccion: horasEntre(rechazo.fecha, reenvio?.fecha),
      horasRespuestaTrasReenvio: horasEntre(reenvio?.fecha, respuestaTras?.fecha),
    };
  });
}

export function promediarTiemposSiaf(porSiaf: Map<number, SiafEvento[]>) {
  const respuestas: number[] = [];
  const correcciones: number[] = [];
  const respuestasTrasReenvio: number[] = [];
  const ciclosCompletos: number[] = [];

  porSiaf.forEach((historial) => {
    const envios = historial.filter((e) => e.tipo === 'envio_revision');
    const rechazos = historial.filter((e) => e.tipo === 'rechazo');
    const aprobacion = historial.find((e) => e.tipo === 'aprobacion');
    const primerEnvio = envios[0];
    const primeraDecision = historial.find((e) => e.tipo === 'rechazo' || e.tipo === 'aprobacion');
    const h1 = horasEntre(primerEnvio?.fecha, primeraDecision?.fecha);
    if (h1 != null) respuestas.push(h1);
    const hCiclo = horasEntre(primerEnvio?.fecha, aprobacion?.fecha);
    if (hCiclo != null) ciclosCompletos.push(hCiclo);

    rechazos.forEach((rechazo, index) => {
      const siguienteLimite = rechazos[index + 1]?.fecha ?? aprobacion?.fecha ?? null;
      const reenvio = historial.find((e) =>
        (e.tipo === 'correccion' || e.tipo === 'envio_revision')
        && new Date(e.fecha).getTime() > new Date(rechazo.fecha).getTime()
        && (!siguienteLimite || new Date(e.fecha).getTime() <= new Date(siguienteLimite).getTime()));
      const hCorr = horasEntre(rechazo.fecha, reenvio?.fecha);
      if (hCorr != null) correcciones.push(hCorr);
      if (reenvio) {
        const siguienteDecision = historial.find((e) => (e.tipo === 'rechazo' || e.tipo === 'aprobacion')
          && new Date(e.fecha).getTime() > new Date(reenvio.fecha).getTime());
        const h2 = horasEntre(reenvio.fecha, siguienteDecision?.fecha);
        if (h2 != null) respuestasTrasReenvio.push(h2);
      }
    });
  });

  return {
    primeraRespuestaHoras: promedio(respuestas),
    correccionHoras: promedio(correcciones),
    respuestaTrasReenvioHoras: promedio(respuestasTrasReenvio),
    cicloCompletoHoras: promedio(ciclosCompletos),
    muestraPrimeraRespuesta: respuestas.length,
    muestraCorreccion: correcciones.length,
    muestraRespuestaTrasReenvio: respuestasTrasReenvio.length,
    muestraCicloCompleto: ciclosCompletos.length,
  };
}
