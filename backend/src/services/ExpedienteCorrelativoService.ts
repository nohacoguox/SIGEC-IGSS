import { AppDataSource } from '../data-source';
import { Expediente } from '../entity/Expediente';
import { ExpedienteCorrelativoConfig } from '../entity/ExpedienteCorrelativoConfig';

const anioActual = () => new Date().getFullYear();

export function formatCorrelativoExpediente(numero: number, digitos: number, anio = anioActual()): string {
  const consecutivo = digitos > 0 ? String(numero).padStart(digitos, '0') : String(numero);
  return `EXP-${consecutivo}/${anio}`;
}

async function ensureConfig(): Promise<ExpedienteCorrelativoConfig> {
  const repo = AppDataSource.getRepository(ExpedienteCorrelativoConfig);
  let config = await repo.findOne({ where: { id: 1 } });
  if (!config) {
    config = repo.create({ siguienteNumero: 1, numeroInicio: 1, digitos: 4, anioActual: anioActual() });
    config = await repo.save(config);
  }
  return config;
}

/** Asigna el correlativo al guardar el expediente: no queda reservado si el usuario cancela. */
export async function asignarCorrelativoExpediente(): Promise<string> {
  return AppDataSource.transaction(async (manager) => {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext('sigec_expediente_correlativo'))`);

    const configRepo = manager.getRepository(ExpedienteCorrelativoConfig);
    const expedienteRepo = manager.getRepository(Expediente);
    let config = await configRepo.createQueryBuilder('c').orderBy('c.id', 'ASC').setLock('pessimistic_write').getOne();
    if (!config) {
      config = await configRepo.save(configRepo.create({
        siguienteNumero: 1,
        numeroInicio: 1,
        digitos: 4,
        anioActual: anioActual(),
      }));
    }

    const year = anioActual();
    if (config.anioActual !== year) {
      config.anioActual = year;
      config.siguienteNumero = config.numeroInicio;
    }

    let numero = Math.max(config.siguienteNumero, config.numeroInicio, 1);
    for (let attempts = 0; attempts < 10000; attempts += 1) {
      const correlativo = formatCorrelativoExpediente(numero, config.digitos, year);
      const existe = await expedienteRepo.findOne({ where: { numeroExpediente: correlativo } });
      if (!existe) {
        config.siguienteNumero = numero + 1;
        await configRepo.save(config);
        return correlativo;
      }
      numero += 1;
    }

    throw new Error('No se pudo asignar un correlativo de expediente libre.');
  });
}

export async function getEstadoCorrelativosExpediente() {
  const config = await ensureConfig();
  const repo = AppDataSource.getRepository(Expediente);
  const ultimo = await repo.find({ order: { id: 'DESC' }, take: 50, select: ['id', 'numeroExpediente'] });
  const ultimoUsado = ultimo.find((expediente) => expediente.numeroExpediente.startsWith('EXP-'))?.numeroExpediente ?? null;
  const year = anioActual();

  return {
    siguienteNumero: config.siguienteNumero,
    numeroInicio: config.numeroInicio,
    digitos: config.digitos,
    anioActual: config.anioActual || year,
    correlativoSiguientePreview: formatCorrelativoExpediente(config.siguienteNumero, config.digitos, year),
    ultimoUsado,
  };
}

export async function actualizarConfigCorrelativoExpediente(input: {
  numeroInicio?: number;
  siguienteNumero?: number;
  digitos?: number;
}) {
  const config = await ensureConfig();
  if (input.numeroInicio != null) {
    if (input.numeroInicio < 1) throw new Error('El número de inicio debe ser mayor o igual a 1.');
    config.numeroInicio = input.numeroInicio;
  }
  if (input.siguienteNumero != null) {
    if (input.siguienteNumero < 1) throw new Error('El siguiente número debe ser mayor o igual a 1.');
    config.siguienteNumero = input.siguienteNumero;
  } else if (input.numeroInicio != null) {
    config.siguienteNumero = input.numeroInicio;
  }
  if (input.digitos != null) {
    if (input.digitos < 0 || input.digitos > 12) throw new Error('Los dígitos deben estar entre 0 y 12.');
    config.digitos = input.digitos;
  }
  config.anioActual = anioActual();
  return AppDataSource.getRepository(ExpedienteCorrelativoConfig).save(config);
}
