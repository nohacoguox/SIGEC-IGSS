import { AppDataSource } from '../data-source';
import { SiafCorrelativoConfig } from '../entity/SiafCorrelativoConfig';
import { SiafCorrelativoArea } from '../entity/SiafCorrelativoArea';
import { SiafCorrelativoReserva } from '../entity/SiafCorrelativoReserva';
import { Area } from '../entity/Area';
import { SiafSolicitud } from '../entity/SiafSolicitud';
import { randomUUID } from 'crypto';

/** antes → BF 1/2026. despues → 14568 SC/2026. Vacío → 1/2026. */
export function formatCorrelativo(
  numero: number,
  digitos: number,
  anio?: number,
  prefijo?: string,
  posicion?: string,
): string {
  const year = anio ?? new Date().getFullYear();
  const numPart = digitos > 0 ? String(numero).padStart(digitos, '0') : String(numero);
  const prefix = (prefijo || '').trim();
  if (!prefix) return `${numPart}/${year}`;
  if (posicion === 'despues') return `${numPart} ${prefix}/${year}`;
  return `${prefix} ${numPart}/${year}`;
}

export function anioActual(): number {
  return new Date().getFullYear();
}

/** Normaliza resultado de manager.query (rows | [rows, count] | row) */
function firstRow(result: any): any | null {
  if (result == null) return null;
  if (Array.isArray(result)) {
    if (result.length === 0) return null;
    if (Array.isArray(result[0])) return result[0][0] ?? null;
    return result[0] ?? null;
  }
  if (typeof result === 'object') return result;
  return null;
}

async function ensureConfig(): Promise<SiafCorrelativoConfig> {
  const repo = AppDataSource.getRepository(SiafCorrelativoConfig);
  let config = await repo.findOne({ where: { id: 1 } });
  if (!config) {
    const any = await repo.find({ take: 1, order: { id: 'ASC' } });
    if (any[0]) return any[0];
    config = repo.create({
      siguienteNumero: 1,
      numeroInicio: 1,
      digitos: 0,
      minutosReserva: 120,
      anioActual: anioActual(),
    });
    return repo.save(config);
  }
  return config;
}

/** Marca como liberadas las reservas vencidas y baja el puntero si aplica */
async function expireReservations(): Promise<void> {
  const reservaRepo = AppDataSource.getRepository(SiafCorrelativoReserva);
  const configRepo = AppDataSource.getRepository(SiafCorrelativoConfig);
  const now = new Date();

  const expired = await reservaRepo
    .createQueryBuilder('r')
    .where('r.estado = :estado', { estado: 'reservado' })
    .andWhere('r.expira_en < :now', { now })
    .getMany();

  if (expired.length === 0) return;

  const minPorConfig = new Map<number, number>();
  for (const r of expired) {
    r.estado = 'liberado';
    r.liberadoEn = now;
    await reservaRepo.save(r);
    if (!r.configId) continue;
    const actual = minPorConfig.get(r.configId);
    if (actual == null || r.numero < actual) minPorConfig.set(r.configId, r.numero);
  }

  for (const [configId, minLiberado] of minPorConfig) {
    const config = await configRepo.findOne({ where: { id: configId } });
    if (config && minLiberado < config.siguienteNumero) {
      config.siguienteNumero = Math.max(config.numeroInicio, minLiberado);
      await configRepo.save(config);
    }
  }
}

/**
 * Reserva el siguiente correlativo libre para el usuario.
 * Si el usuario ya tiene una reserva activa, la reutiliza.
 * Serializa con advisory lock para evitar que dos usuarios reciban el mismo número.
 */
export async function reservarCorrelativo(usuarioId: number, areaId: number): Promise<{
  reservaId: number;
  correlativo: string;
  numero: number;
  expiraEn: Date;
}> {
  if (!areaId) {
    throw new Error('Seleccione el área para asignar el correlativo.');
  }
  await expireReservations();

  return AppDataSource.transaction(async (manager) => {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sigec_siaf_usuario_${usuarioId}`]);

    const configRepo = manager.getRepository(SiafCorrelativoConfig);
    const reservaRepo = manager.getRepository(SiafCorrelativoReserva);
    const siafRepo = manager.getRepository(SiafSolicitud);
    const areaLink = await manager.getRepository(SiafCorrelativoArea).findOne({ where: { areaId } });
    if (!areaLink) {
      throw new Error('Esta área no tiene un correlativo asignado. Agréguela en Gestión de Correlativos.');
    }

    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sigec_siaf_correlativo_${areaLink.configId}`]);

    let config = await configRepo.findOne({
      where: { id: areaLink.configId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!config) {
      throw new Error('El correlativo de esta área ya no existe. Revise Gestión de Correlativos.');
    }

    const year = anioActual();
    if (!config.anioActual || config.anioActual !== year) {
      config.anioActual = year;
      config.siguienteNumero = config.numeroInicio || 1;
      await configRepo.save(config);
    }

    // Reutilizar reserva activa del mismo usuario (año actual)
    const existing = await reservaRepo
      .createQueryBuilder('r')
      .where('r.usuario_id = :usuarioId', { usuarioId })
      .andWhere('r.estado = :estado', { estado: 'reservado' })
      .orderBy('r.id', 'DESC')
      .getOne();

    if (
      existing &&
      existing.configId === config.id &&
      existing.expiraEn > new Date() &&
      existing.correlativo.endsWith(`/${year}`)
    ) {
      return {
        reservaId: existing.id,
        correlativo: existing.correlativo,
        numero: existing.numero,
        expiraEn: existing.expiraEn,
      };
    }
    if (existing && existing.estado === 'reservado') {
      existing.estado = 'liberado';
      existing.liberadoEn = new Date();
      await reservaRepo.save(existing);
      const configDeReserva = existing.configId
        ? await configRepo.findOne({ where: { id: existing.configId } })
        : config;
      if (
        configDeReserva &&
        existing.correlativo.endsWith(`/${year}`) &&
        existing.numero < configDeReserva.siguienteNumero
      ) {
        configDeReserva.siguienteNumero = Math.max(configDeReserva.numeroInicio, existing.numero);
        await configRepo.save(configDeReserva);
        if (configDeReserva.id === config.id) config.siguienteNumero = configDeReserva.siguienteNumero;
      }
    }

    // Siempre buscar el menor número libre desde el inicio (rellena huecos liberados)
    let candidate = Math.max(1, config.numeroInicio || 1);
    const maxAttempts = 10000;

    for (let i = 0; i < maxAttempts; i++) {
      const correlativo = formatCorrelativo(candidate, config.digitos, year, config.prefijo, config.prefijoPosicion);

      const inSiaf = await siafRepo.findOne({ where: { correlativo } });
      if (inSiaf) {
        candidate++;
        continue;
      }

      // ¿Ya lo tiene alguien más reservado (vigente)?
      const reserved = await reservaRepo
        .createQueryBuilder('r')
        .where('r.correlativo = :correlativo', { correlativo })
        .andWhere('r.estado = :estado', { estado: 'reservado' })
        .andWhere('r.expira_en > NOW()')
        .getOne();
      if (reserved) {
        if (reserved.usuarioId === usuarioId) {
          return {
            reservaId: reserved.id,
            correlativo: reserved.correlativo,
            numero: reserved.numero,
            expiraEn: reserved.expiraEn,
          };
        }
        candidate++;
        continue;
      }

      // Liberar vencidas de este correlativo (si quedaron)
      await manager.query(
        `
        UPDATE siaf_correlativo_reservas
        SET estado = 'liberado', liberado_en = NOW()
        WHERE correlativo = $1 AND estado = 'reservado' AND expira_en <= NOW()
      `,
        [correlativo]
      );

      const expiraEn = new Date(Date.now() + config.minutosReserva * 60 * 1000);
      const token = randomUUID().replace(/-/g, '');

      // Reactivar fila liberada (no consumida: esas ya se guardaron en SIAF)
      const reactivated = await manager.query(
        `
        UPDATE siaf_correlativo_reservas
        SET usuario_id = $1,
            numero = $2,
            estado = 'reservado',
            token = $3,
            expira_en = $4,
            config_id = $6,
            liberado_en = NULL,
            consumido_en = NULL,
            reservado_en = NOW()
        WHERE id = (
          SELECT id FROM siaf_correlativo_reservas
          WHERE correlativo = $5 AND estado = 'liberado'
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        AND estado = 'liberado'
        RETURNING id, correlativo, numero, expira_en
      `,
        [usuarioId, candidate, token, expiraEn, correlativo, config.id]
      );

      let saved: { id: number; correlativo: string; numero: number; expiraEn: Date } | null = null;
      const reactivatedRow = firstRow(reactivated);

      if (reactivatedRow?.id != null && reactivatedRow?.correlativo) {
        saved = {
          id: Number(reactivatedRow.id),
          correlativo: String(reactivatedRow.correlativo),
          numero: Number(reactivatedRow.numero),
          expiraEn: new Date(reactivatedRow.expira_en),
        };
      } else {
        // Si quedó una fila 'reservado' vencida ya liberada arriba, o no hay fila: insertar
        const stillTaken = await reservaRepo
          .createQueryBuilder('r')
          .where('r.correlativo = :correlativo', { correlativo })
          .andWhere('r.estado = :estado', { estado: 'reservado' })
          .andWhere('r.expira_en > NOW()')
          .getOne();
        if (stillTaken) {
          candidate++;
          continue;
        }

        // Evitar duplicar si existe historial consumido del mismo correlativo sin SIAF
        const orphanConsumido = await manager.query(
          `
          UPDATE siaf_correlativo_reservas
          SET usuario_id = $1,
              numero = $2,
              estado = 'reservado',
              token = $3,
              expira_en = $4,
              config_id = $6,
              liberado_en = NULL,
              consumido_en = NULL,
              reservado_en = NOW()
          WHERE id = (
            SELECT id FROM siaf_correlativo_reservas
            WHERE correlativo = $5 AND estado = 'consumido'
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          AND estado = 'consumido'
          RETURNING id, correlativo, numero, expira_en
        `,
          [usuarioId, candidate, token, expiraEn, correlativo, config.id]
        );
        const orphanRow = firstRow(orphanConsumido);
        if (orphanRow?.id != null && orphanRow?.correlativo) {
          saved = {
            id: Number(orphanRow.id),
            correlativo: String(orphanRow.correlativo),
            numero: Number(orphanRow.numero),
            expiraEn: new Date(orphanRow.expira_en),
          };
        } else {
          try {
            const legacy = await manager.query(`
              SELECT 1
              FROM pg_attribute a
              JOIN pg_class cl ON cl.oid = a.attrelid
              JOIN pg_namespace n ON n.oid = cl.relnamespace
              WHERE n.nspname = current_schema()
                AND cl.relname = 'siaf_correlativo_reservas'
                AND a.attname = 'expires_at'
                AND a.attnum > 0 AND NOT a.attisdropped
              LIMIT 1
            `);

            if (legacy?.length) {
              const rows = await manager.query(
                `
                INSERT INTO siaf_correlativo_reservas
                  (numero, correlativo, usuario_id, estado, token, expira_en, expires_at, config_id, liberado_en, consumido_en)
                VALUES ($1, $2, $3, 'reservado', $4, $5, $5, $6, NULL, NULL)
                RETURNING id, correlativo, numero, expira_en
              `,
                [candidate, correlativo, usuarioId, token, expiraEn, config.id]
              );
              const row = firstRow(rows);
              if (!row?.id || !row?.correlativo) {
                candidate++;
                continue;
              }
              saved = {
                id: Number(row.id),
                correlativo: String(row.correlativo),
                numero: Number(row.numero),
                expiraEn: new Date(row.expira_en),
              };
            } else {
              const entity = await reservaRepo.save(
                reservaRepo.create({
                  numero: candidate,
                  correlativo,
                  configId: config.id,
                  usuarioId,
                  estado: 'reservado',
                  token,
                  expiraEn,
                  liberadoEn: null,
                  consumidoEn: null,
                })
              );
              saved = {
                id: entity.id,
                correlativo: entity.correlativo,
                numero: entity.numero,
                expiraEn: entity.expiraEn,
              };
            }
          } catch (err: any) {
            if (err?.code === '23505' || /unicidad|unique|duplicate/i.test(err?.message || '')) {
              candidate++;
              continue;
            }
            throw err;
          }
        }
      }

      if (!saved?.id || !saved.correlativo) {
        candidate++;
        continue;
      }

      // siguienteNumero = pista del próximo candidato (el menor libre se recalcula siempre)
      config.siguienteNumero = Math.max(config.numeroInicio, candidate);
      config.anioActual = year;
      await configRepo.save(config);

      return {
        reservaId: saved.id,
        correlativo: saved.correlativo,
        numero: saved.numero,
        expiraEn: saved.expiraEn,
      };
    }

    throw new Error('No se pudo asignar un correlativo libre. Contacte al administrador.');
  });
}

export async function liberarCorrelativo(
  reservaId: number,
  usuarioId: number,
  esAdmin = false
): Promise<boolean> {
  return AppDataSource.transaction(async (manager) => {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext('sigec_siaf_correlativo'))`);

    const reservaRepo = manager.getRepository(SiafCorrelativoReserva);
    const configRepo = manager.getRepository(SiafCorrelativoConfig);

    const reserva = await reservaRepo.findOne({ where: { id: reservaId } });
    if (!reserva) return false;
    if (!esAdmin && reserva.usuarioId !== usuarioId) return false;
    if (reserva.estado !== 'reservado') return true;

    reserva.estado = 'liberado';
    reserva.liberadoEn = new Date();
    await reservaRepo.save(reserva);

    const config = reserva.configId
      ? await configRepo.findOne({ where: { id: reserva.configId } })
      : await configRepo.createQueryBuilder('c').orderBy('c.id', 'ASC').getOne();
    if (!config) return true;

    if (reserva.numero < config.siguienteNumero) {
      config.siguienteNumero = Math.max(config.numeroInicio, reserva.numero);
      await configRepo.save(config);
    }
    return true;
  });
}

export async function validarReservaActiva(
  reservaId: number,
  usuarioId: number
): Promise<{ correlativo: string; numero: number } | null> {
  const reservaRepo = AppDataSource.getRepository(SiafCorrelativoReserva);
  const reserva = await reservaRepo.findOne({ where: { id: reservaId } });
  if (!reserva) return null;
  if (reserva.usuarioId !== usuarioId) return null;
  if (reserva.estado !== 'reservado') return null;
  if (reserva.expiraEn < new Date()) {
    reserva.estado = 'liberado';
    reserva.liberadoEn = new Date();
    await reservaRepo.save(reserva);
    return null;
  }
  return { correlativo: reserva.correlativo, numero: reserva.numero };
}

export async function consumirCorrelativo(
  reservaId: number,
  usuarioId: number
): Promise<{ correlativo: string; numero: number } | null> {
  const valid = await validarReservaActiva(reservaId, usuarioId);
  if (!valid) return null;

  const reservaRepo = AppDataSource.getRepository(SiafCorrelativoReserva);
  const reserva = await reservaRepo.findOne({ where: { id: reservaId } });
  if (!reserva) return null;

  reserva.estado = 'consumido';
  reserva.consumidoEn = new Date();
  await reservaRepo.save(reserva);
  return { correlativo: reserva.correlativo, numero: reserva.numero };
}

export async function getEstadoCorrelativos() {
  await expireReservations();
  const config = await ensureConfig();
  const reservaRepo = AppDataSource.getRepository(SiafCorrelativoReserva);
  const siafRepo = AppDataSource.getRepository(SiafSolicitud);

  const reservasActivas = await reservaRepo.find({
    where: { estado: 'reservado' },
    order: { numero: 'ASC' },
    relations: ['usuario'],
  });

  const activasValidas = reservasActivas.filter((r) => r.expiraEn > new Date());

  // Último correlativo numérico usado en SIAF (mejor esfuerzo)
  const lastSiafs = await siafRepo.find({
    order: { id: 'DESC' },
    take: 50,
    select: ['id', 'correlativo', 'fecha'],
  });

  let ultimoUsado: { correlativo: string; numero: number | null } | null = null;
  for (const s of lastSiafs) {
    const digits = s.correlativo?.replace(/\D/g, '');
    if (digits) {
      ultimoUsado = { correlativo: s.correlativo, numero: parseInt(digits, 10) };
      break;
    }
  }
  if (!ultimoUsado && lastSiafs[0]) {
    ultimoUsado = { correlativo: lastSiafs[0].correlativo, numero: null };
  }

  return {
    siguienteNumero: config.siguienteNumero,
    numeroInicio: config.numeroInicio,
    digitos: config.digitos,
    minutosReserva: config.minutosReserva,
    correlativoSiguientePreview: formatCorrelativo(config.siguienteNumero, config.digitos, anioActual(), config.prefijo, config.prefijoPosicion),
    anioActual: config.anioActual || anioActual(),
    ultimoUsado,
    enUso: activasValidas.map((r) => ({
      reservaId: r.id,
      numero: r.numero,
      correlativo: r.correlativo,
      usuarioId: r.usuarioId,
      usuarioNombre: r.usuario
        ? `${r.usuario.nombres || ''} ${r.usuario.apellidos || ''}`.trim()
        : '—',
      reservadoEn: r.reservadoEn,
      expiraEn: r.expiraEn,
    })),
    totalReservasActivas: activasValidas.length,
  };
}

export async function actualizarConfigCorrelativo(input: {
  numeroInicio?: number;
  siguienteNumero?: number;
  digitos?: number;
  minutosReserva?: number;
}): Promise<SiafCorrelativoConfig> {
  const config = await ensureConfig();
  const repo = AppDataSource.getRepository(SiafCorrelativoConfig);

  if (input.numeroInicio != null) {
    if (input.numeroInicio < 1) throw new Error('El número de inicio debe ser >= 1');
    config.numeroInicio = input.numeroInicio;
  }
  if (input.siguienteNumero != null) {
    if (input.siguienteNumero < 1) throw new Error('El siguiente número debe ser >= 1');
    config.siguienteNumero = input.siguienteNumero;
  }
  if (input.digitos != null) {
    if (input.digitos < 0 || input.digitos > 12) throw new Error('Dígitos debe estar entre 0 y 12');
    config.digitos = input.digitos;
  }
  if (input.minutosReserva != null) {
    if (input.minutosReserva < 5 || input.minutosReserva > 24 * 60) {
      throw new Error('Minutos de reserva debe estar entre 5 y 1440');
    }
    config.minutosReserva = input.minutosReserva;
  }

  // Si fijan inicio y no mandan siguiente, arrancar la secuencia desde ese inicio
  if (input.numeroInicio != null && input.siguienteNumero == null) {
    config.siguienteNumero = input.numeroInicio;
  }

  return repo.save(config);
}

function normalizarPosicion(value: unknown): 'antes' | 'despues' {
  return String(value || '').trim().toLowerCase() === 'despues' ? 'despues' : 'antes';
}

function normalizarPrefijo(value: unknown): string {
  const prefijo = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!prefijo) return '';
  if (!/^[A-Z]{1,8}$/.test(prefijo)) {
    throw new Error('El prefijo solo puede tener letras, hasta 8, o quedar vacío.');
  }
  return prefijo;
}

function normalizarNombre(value: unknown): string {
  const nombre = String(value ?? '').trim();
  if (nombre.length < 2 || nombre.length > 120) {
    throw new Error('El nombre del correlativo debe tener entre 2 y 120 caracteres.');
  }
  return nombre;
}

async function asignarAreas(configId: number, areaIds: number[]) {
  const unicos = Array.from(new Set(areaIds.map((id) => Number(id)).filter((id) => id > 0)));
  const areaRepo = AppDataSource.getRepository(Area);
  const linkRepo = AppDataSource.getRepository(SiafCorrelativoArea);
  if (unicos.length) {
    const areas = await areaRepo.find({ where: unicos.map((id) => ({ id })) });
    if (areas.length !== unicos.length) throw new Error('Hay un área que no existe.');
    await linkRepo
      .createQueryBuilder()
      .delete()
      .where('area_id IN (:...ids)', { ids: unicos })
      .andWhere('config_id <> :configId', { configId })
      .execute();
  }
  await linkRepo.delete({ configId });
  if (unicos.length) {
    await linkRepo.save(unicos.map((areaId) => linkRepo.create({ configId, areaId })));
  }
}

export async function listarSeriesCorrelativo() {
  await expireReservations();
  const configRepo = AppDataSource.getRepository(SiafCorrelativoConfig);
  const linkRepo = AppDataSource.getRepository(SiafCorrelativoArea);
  const areaRepo = AppDataSource.getRepository(Area);
  const reservaRepo = AppDataSource.getRepository(SiafCorrelativoReserva);
  const siafRepo = AppDataSource.getRepository(SiafSolicitud);
  const configs = await configRepo.find({ order: { id: 'ASC' } });
  const links = await linkRepo.find();
  const areas = await areaRepo.find({ order: { nombre: 'ASC' } });
  const reservas = await reservaRepo.find({
    where: { estado: 'reservado' },
    order: { numero: 'ASC' },
    relations: ['usuario'],
  });
  const recientes = await siafRepo.find({
    order: { id: 'DESC' },
    take: 400,
    select: ['id', 'correlativo'],
  });
  const year = anioActual();
  return {
    areas: areas.filter((area) => area.activo).map((area) => ({
      id: area.id,
      nombre: area.nombre,
      configId: links.find((link) => link.areaId === area.id)?.configId ?? null,
    })),
    series: configs.map((config) => {
      const propias = links.filter((link) => link.configId === config.id);
      const enUso = reservas.filter((reserva) => reserva.configId === config.id && reserva.expiraEn > new Date());
      const ultimo = recientes.find((siaf) => correlativoDeSerie(siaf.correlativo, config.prefijo, config.prefijoPosicion));
      return {
        id: config.id,
        nombre: config.nombre || 'General',
        prefijo: config.prefijo || '',
        prefijoPosicion: config.prefijoPosicion === 'despues' ? 'despues' : 'antes',
        siguienteNumero: config.siguienteNumero,
        numeroInicio: config.numeroInicio,
        digitos: config.digitos,
        minutosReserva: config.minutosReserva,
        anioActual: config.anioActual || year,
        correlativoSiguientePreview: formatCorrelativo(config.siguienteNumero, config.digitos, year, config.prefijo, config.prefijoPosicion),
        ultimoUsado: ultimo ? { correlativo: ultimo.correlativo, numero: null } : null,
        areas: propias
          .map((link) => areas.find((area) => area.id === link.areaId))
          .filter((area): area is Area => !!area)
          .map((area) => ({ id: area.id, nombre: area.nombre })),
        enUso: enUso.map((reserva) => ({
          reservaId: reserva.id,
          numero: reserva.numero,
          correlativo: reserva.correlativo,
          usuarioId: reserva.usuarioId,
          usuarioNombre: reserva.usuario
            ? `${reserva.usuario.nombres || ''} ${reserva.usuario.apellidos || ''}`.trim()
            : '—',
          reservadoEn: reserva.reservadoEn,
          expiraEn: reserva.expiraEn,
        })),
        totalReservasActivas: enUso.length,
      };
    }),
  };
}

function correlativoDeSerie(correlativo: string, prefijo: string, posicion?: string): boolean {
  const texto = String(correlativo || '').trim();
  const prefix = (prefijo || '').trim();
  if (!prefix) return /^\d+\/\d{4}$/.test(texto);
  if (posicion === 'despues') return new RegExp(`^\\d+ ${prefix}/\\d{4}$`).test(texto);
  return texto.startsWith(`${prefix} `) && /\/\d{4}$/.test(texto);
}

export async function crearSerieCorrelativo(input: { nombre: unknown; prefijo?: unknown; prefijoPosicion?: unknown; areaIds?: number[] }) {
  const nombre = normalizarNombre(input.nombre);
  const prefijo = normalizarPrefijo(input.prefijo);
  const prefijoPosicion = normalizarPosicion(input.prefijoPosicion);
  const repo = AppDataSource.getRepository(SiafCorrelativoConfig);
  const existente = await repo
    .createQueryBuilder('c')
    .where('LOWER(c.nombre) = LOWER(:nombre)', { nombre })
    .getOne();
  if (existente) throw new Error('Ya existe un correlativo con ese nombre.');
  const creado = await repo.save(repo.create({
    nombre,
    prefijo,
    prefijoPosicion,
    siguienteNumero: 1,
    numeroInicio: 1,
    digitos: 0,
    minutosReserva: 120,
    anioActual: anioActual(),
  }));
  await asignarAreas(creado.id, input.areaIds || []);
  return listarSeriesCorrelativo();
}

export async function actualizarSerieCorrelativo(id: number, input: {
  nombre?: unknown;
  prefijo?: unknown;
  prefijoPosicion?: unknown;
  areaIds?: number[];
  numeroInicio?: number;
  siguienteNumero?: number;
  digitos?: number;
  minutosReserva?: number;
}) {
  const repo = AppDataSource.getRepository(SiafCorrelativoConfig);
  const config = await repo.findOne({ where: { id } });
  if (!config) throw new Error('Correlativo no encontrado.');
  if (input.nombre != null) {
    const nombre = normalizarNombre(input.nombre);
    const duplicado = await repo
      .createQueryBuilder('c')
      .where('LOWER(c.nombre) = LOWER(:nombre)', { nombre })
      .andWhere('c.id <> :id', { id })
      .getOne();
    if (duplicado) throw new Error('Ya existe un correlativo con ese nombre.');
    config.nombre = nombre;
  }
  if (input.prefijo != null) config.prefijo = normalizarPrefijo(input.prefijo);
  if (input.prefijoPosicion != null) config.prefijoPosicion = normalizarPosicion(input.prefijoPosicion);
  if (input.numeroInicio != null) {
    if (input.numeroInicio < 1) throw new Error('El número de inicio debe ser >= 1');
    config.numeroInicio = input.numeroInicio;
  }
  if (input.siguienteNumero != null) {
    if (input.siguienteNumero < 1) throw new Error('El siguiente número debe ser >= 1');
    config.siguienteNumero = input.siguienteNumero;
  }
  if (input.digitos != null) {
    if (input.digitos < 0 || input.digitos > 12) throw new Error('Dígitos debe estar entre 0 y 12');
    config.digitos = input.digitos;
  }
  if (input.minutosReserva != null) {
    if (input.minutosReserva < 5 || input.minutosReserva > 24 * 60) {
      throw new Error('Minutos de reserva debe estar entre 5 y 1440');
    }
    config.minutosReserva = input.minutosReserva;
  }
  if (input.numeroInicio != null && input.siguienteNumero == null) {
    config.siguienteNumero = input.numeroInicio;
  }
  await repo.save(config);
  if (input.areaIds) await asignarAreas(config.id, input.areaIds);
  return listarSeriesCorrelativo();
}

export async function eliminarSerieCorrelativo(id: number) {
  const repo = AppDataSource.getRepository(SiafCorrelativoConfig);
  const config = await repo.findOne({ where: { id } });
  if (!config) throw new Error('Correlativo no encontrado.');
  const usadas = await AppDataSource.getRepository(SiafCorrelativoReserva).count({
    where: { configId: id, estado: 'consumido' },
  });
  if (usadas > 0) {
    throw new Error('Este correlativo ya se usó en SIAF guardados. No se puede eliminar.');
  }
  const guardados = await AppDataSource.getRepository(SiafSolicitud).find({
    select: ['id', 'correlativo'],
    order: { id: 'DESC' },
    take: 500,
  });
  if (guardados.some((siaf) => correlativoDeSerie(siaf.correlativo, config.prefijo, config.prefijoPosicion))) {
    throw new Error('Este correlativo ya se usó en SIAF guardados. No se puede eliminar.');
  }
  await AppDataSource.getRepository(SiafCorrelativoArea).delete({ configId: id });
  await repo.delete({ id });
  return listarSeriesCorrelativo();
}

export async function liberarReservaAdmin(reservaId: number): Promise<boolean> {
  const reserva = await AppDataSource.getRepository(SiafCorrelativoReserva).findOne({
    where: { id: reservaId },
  });
  if (!reserva) return false;
  return liberarCorrelativo(reservaId, reserva.usuarioId, true);
}
