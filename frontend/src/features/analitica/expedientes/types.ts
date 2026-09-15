export type CierreMes = {
  mes: string;
  etiqueta: string;
  activos: number;
  aprobados: number;
  rechazadosAlCierre: number;
  pendientesCorreccion: number;
  pendientesRevisionDaf: number;
};

export type ExpedientesAnalytics = {
  desde: string;
  hasta: string;
  general?: {
    resumen: {
      total: number;
      aprobados: number;
      rechazadosAlCierre: number;
      pendientesCorreccion: number;
      pendientesRevisionDaf: number;
    };
    cierreMensual: CierreMes[];
  };
  porExpediente?: {
    tiempos: {
      primeraRespuestaHoras: number | null;
      correccionHoras: number | null;
      respuestaTrasReenvioHoras: number | null;
      cicloCompletoHoras: number | null;
      muestraPrimeraRespuesta: number;
      muestraCorreccion: number;
      muestraRespuestaTrasReenvio: number;
      muestraCicloCompleto: number;
    };
    ciclos: Array<{ etiqueta: string; cantidad: number }>;
    motivos: Array<{ motivo: string; cantidad: number }>;
    casos: Array<{
      id: number;
      numeroExpediente: string;
      titulo: string;
      resultadoAlCorte: string;
      devoluciones: number;
      correcciones: number;
      aprobado: boolean;
    }>;
    trazabilidad: Array<{
      rechazoNumero: number;
      fechaRechazo: string;
      observaciones: number;
      correcciones: number;
      reenviado: boolean;
      fechaReenvio: string | null;
      horasRespuestaDaf: number | null;
      horasCorreccion: number | null;
      horasRespuestaTrasReenvio: number | null;
    }>;
  };
  resumen: {
    total: number;
    aprobados: number;
    pendientesCorreccion?: number;
    pendientesRevisionDaf?: number;
    rechazadosAlCierre?: number;
  };
  tiempos: {
    primeraRespuestaHoras: number | null;
    correccionHoras: number | null;
    respuestaTrasReenvioHoras?: number | null;
    cicloCompletoHoras: number | null;
    muestraPrimeraRespuesta: number;
    muestraCorreccion: number;
    muestraRespuestaTrasReenvio?: number;
    muestraCicloCompleto: number;
  };
  ciclos: Array<{ etiqueta: string; cantidad: number }>;
  motivos: Array<{ motivo: string; cantidad: number }>;
  cierreMensual?: CierreMes[];
  trazabilidad?: ExpedientesAnalytics['porExpediente'] extends infer P ? P extends { trazabilidad: infer T } ? T : never : never;
};
