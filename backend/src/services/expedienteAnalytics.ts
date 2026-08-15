/**
 * Cierre mensual y métricas por expediente.
 * - General: foto al corte (aprobado / rechazado al cierre / pendientes).
 * - Por expediente: ciclos, motivos y tiempos promedio.
 */
import { ExpedienteBitacora } from '../entity/Expediente';

export type CierreMesRow = {
  mes: string;
  etiqueta: string;
  activos: number;
  aprobados: number;
  rechazadosAlCierre: number;
  pendientesCorreccion: number;
  pendientesRevisionDaf: number;
};

export type TrazabilidadCiclo = {
  rechazoNumero: number;
  fechaRechazo: string;
  observaciones: number;
  correcciones: number;
  reenviado: boolean;
  fechaReenvio: string | null;
  horasRespuestaDaf: number | null;
  horasCorreccion: number | null;
  horasRespuestaTrasReenvio: number | null;
};

const promedio = (valores: number[]) => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null);

const horasEntre = (inicio?: Date | string | null, fin?: Date | string | null) => {
  if (!inicio || !fin) return null;
  const horas = (new Date(fin).getTime() - new Date(inicio).getTime()) / 3_600_000;
  return horas >= 0 ? horas : null;
};

const claveMes = (fecha: Date) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

const finDeMes = (anio: number, mes1a12: number, tope?: Date) => {
  const fin = new Date(anio, mes1a12, 0, 23, 59, 59, 999);
  if (tope && fin.getTime() > tope.getTime()) return new Date(tope);
  return fin;
};

const inicioDeMes = (anio: number, mes1a12: number) => new Date(anio, mes1a12 - 1, 1, 0, 0, 0, 0);

const eventosHasta = (historial: ExpedienteBitacora[], corte: Date) =>
  historial.filter((e) => new Date(e.fecha).getTime() <= corte.getTime());

/** Clasifica el estado de un expediente en un instante de corte. */
export function clasificarAlCorte(historial: ExpedienteBitacora[], corte: Date): {
  resultado: 'aprobado' | 'rechazado_al_cierre' | 'pendiente_correccion' | 'pendiente_revision_daf' | 'sin_movimiento';
  tuvoActividadEnVentana?: boolean;
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
    // Corrigió/reenvió pero DAF no resolvió antes del corte → cuenta como rechazado al cierre.
    return { resultado: 'rechazado_al_cierre' };
  }

  const ultimoEnvio = [...hastaCorte].reverse().find((e) => e.tipo === 'envio_revision');
  if (ultimoEnvio) return { resultado: 'pendiente_revision_daf' };

  return { resultado: 'sin_movimiento' };
}

export function construirCierresMensuales(
  expedientesIds: number[],
  porExpediente: Map<number, ExpedienteBitacora[]>,
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

    for (const id of expedientesIds) {
      const historial = porExpediente.get(id) ?? [];
      const enMes = historial.some((e) => {
        const t = new Date(e.fecha).getTime();
        return t >= inicio.getTime() && t <= fin.getTime();
      });
      // Incluye casos que se movieron en el mes o que llegaron al mes aún abiertos.
      const antesDelMes = eventosHasta(historial, new Date(inicio.getTime() - 1));
      const abiertoAlEntrar = !!antesDelMes.length && !antesDelMes.some((e) => e.tipo === 'aprobacion');
      if (!enMes && !abiertoAlEntrar) continue;

      const clase = clasificarAlCorte(historial, fin);
      // Aprobados del mes: la aprobación ocurrió dentro del mes.
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

      // Si ya estaba aprobado desde antes, no entra al cierre del mes.
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

export function construirTrazabilidad(historial: ExpedienteBitacora[]): TrazabilidadCiclo[] {
  const envios = historial.filter((e) => e.tipo === 'envio_revision');
  const rechazos = historial.filter((e) => e.tipo === 'rechazo');
  const trazabilidad: TrazabilidadCiclo[] = [];

  rechazos.forEach((rechazo, index) => {
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
    const reenvio = envios.find((envio) => new Date(envio.fecha).getTime() > new Date(rechazo.fecha).getTime()
      && (!siguienteLimite || new Date(envio.fecha).getTime() <= new Date(siguienteLimite).getTime()));
    const respuestaTras = reenvio
      ? historial.find((e) => (e.tipo === 'rechazo' || e.tipo === 'aprobacion')
        && new Date(e.fecha).getTime() > new Date(reenvio.fecha).getTime())
      : null;

    trazabilidad.push({
      rechazoNumero: index + 1,
      fechaRechazo: new Date(rechazo.fecha).toISOString(),
      observaciones: (rechazo.detalle ?? []).length,
      correcciones: correccionesDelCiclo.length,
      reenviado: !!reenvio,
      fechaReenvio: reenvio?.fecha ? new Date(reenvio.fecha).toISOString() : null,
      horasRespuestaDaf: horasEntre(envioPrevio?.fecha, rechazo.fecha),
      horasCorreccion: horasEntre(rechazo.fecha, reenvio?.fecha),
      horasRespuestaTrasReenvio: horasEntre(reenvio?.fecha, respuestaTras?.fecha),
    });
  });

  return trazabilidad;
}

export function promediarTiemposDesdeHistoriales(porExpediente: Map<number, ExpedienteBitacora[]>) {
  const respuestas: number[] = [];
  const correcciones: number[] = [];
  const respuestasTrasReenvio: number[] = [];
  const ciclosCompletos: number[] = [];

  porExpediente.forEach((historial) => {
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
      const siguienteLimite = rechazos[index + 1]?.fecha
        ?? aprobacion?.fecha
        ?? null;
      const reenvio = envios.find((envio) => new Date(envio.fecha).getTime() > new Date(rechazo.fecha).getTime()
        && (!siguienteLimite || new Date(envio.fecha).getTime() <= new Date(siguienteLimite).getTime()));
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

export { promedio, horasEntre, claveMes };
