export type CierreMes = {
  mes: string;
  etiqueta: string;
  activos: number;
  aprobados: number;
  rechazadosAlCierre: number;
  pendientesCorreccion: number;
  pendientesRevisionDaf: number;
};

export type SiafAnalytics = {
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
  porSiaf?: {
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
      correlativo: string;
      estado: string;
      resultadoAlCorte: string;
      devoluciones: number;
      correcciones: number;
      aprobado: boolean;
    }>;
    trazabilidad: Array<{
      rechazoNumero: number;
      fechaRechazo: string;
      motivos: number;
      correcciones: number;
      reenviado: boolean;
      fechaReenvio: string | null;
      horasRespuestaDaf: number | null;
      horasCorreccion: number | null;
      horasRespuestaTrasReenvio: number | null;
    }>;
  };
  resumen?: {
    total: number;
    aprobados: number;
    pendientesCorreccion?: number;
    pendientesRevisionDaf?: number;
    rechazadosAlCierre?: number;
  };
  tiempos?: {
    primeraRespuestaHoras: number | null;
    correccionHoras: number | null;
    respuestaTrasReenvioHoras?: number | null;
    cicloCompletoHoras: number | null;
    muestraPrimeraRespuesta: number;
    muestraCorreccion: number;
    muestraRespuestaTrasReenvio?: number;
    muestraCicloCompleto: number;
  };
  ciclos?: Array<{ etiqueta: string; cantidad: number }>;
  motivos?: Array<{ motivo: string; cantidad: number }>;
  cierreMensual?: CierreMes[];
  trazabilidad?: SiafAnalytics['porSiaf'] extends infer P ? P extends { trazabilidad: infer T } ? T : never : never;
};
