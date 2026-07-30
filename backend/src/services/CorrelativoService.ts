import { AppDataSource } from '../data-source';
import { SiafCorrelativoConfig } from '../entity/SiafCorrelativoConfig';
import { SiafCorrelativoReserva } from '../entity/SiafCorrelativoReserva';
import { SiafSolicitud } from '../entity/SiafSolicitud';
import { randomUUID } from 'crypto';

/** Formato institucional: número/año → ej. 1/2026 */
export function formatCorrelativo(numero: number, digitos: number, anio?: number): string {
  const year = anio ?? new Date().getFullYear();
  const numPart = digitos > 0 ? String(numero).padStart(digitos, '0') : String(numero);
  return `${numPart}/${year}`;
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

  let minLiberado: number | null = null;
  for (const r of expired) {
    r.estado = 'liberado';
    r.liberadoEn = now;
    await reservaRepo.save(r);
    if (minLiberado == null || r.numero < minLiberado) minLiberado = r.numero;
  }

  if (minLiberado != null) {
    const config = await ensureConfig();
    if (minLiberado < config.siguienteNumero) {
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
export async function reservarCorrelativo(usuarioId: number): Promise<{
  reservaId: number;
  correlativo: string;
  numero: number;
  expiraEn: Date;
}> {
  await expireReservations();

  return AppDataSource.transaction(async (manager) => {
    // Bloqueo de transacción: una sola reserva a la vez en todo el sistema
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext('sigec_siaf_correlativo'))`);

    const configRepo = manager.getRepository(SiafCorrelativoConfig);
    const reservaRepo = manager.getRepository(SiafCorrelativoReserva);
    const siafRepo = manager.getRepository(SiafSolicitud);

    let config = await configRepo
      .createQueryBuilder('c')
      .orderBy('c.id', 'ASC')
      .setLock('pessimistic_write')
      .getOne();

    if (!config) {
      config = await configRepo.save(
        configRepo.create({
          siguienteNumero: 1,
          numeroInicio: 1,
          digitos: 0,
          minutosReserva: 120,
          anioActual: anioActual(),
        })
      );
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

    if (existing && existing.expiraEn > new Date() && existing.correlativo.endsWith(`/${year}`)) {
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
      if (existing.correlativo.endsWith(`/${year}`) && existing.numero < config.siguienteNumero) {
        config.siguienteNumero = Math.max(config.numeroInicio, existing.numero);
        await configRepo.save(config);
      }
    }

    // Siempre buscar el menor número libre desde el inicio (rellena huecos liberados)
    let candidate = Math.max(1, config.numeroInicio || 1);
    const maxAttempts = 10000;

    for (let i = 0; i < maxAttempts; i++) {
      const correlativo = formatCorrelativo(candidate, config.digitos, year);

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
        [usuarioId, candidate, token, expiraEn, correlativo]
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
          [usuarioId, candidate, token, expiraEn, correlativo]
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
                  (numero, correlativo, usuario_id, estado, token, expira_en, expires_at, liberado_en, consumido_en)
                VALUES ($1, $2, $3, 'reservado', $4, $5, $5, NULL, NULL)
                RETURNING id, correlativo, numero, expira_en
              `,
                [candidate, correlativo, usuarioId, token, expiraEn]
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

    let config = await configRepo
      .createQueryBuilder('c')
      .orderBy('c.id', 'ASC')
      .getOne();
    if (!config) return true;

    // Al liberar, el número vuelve al pool: bajar el puntero para reutilizar huecos
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
    correlativoSiguientePreview: formatCorrelativo(config.siguienteNumero, config.digitos, anioActual()),
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

export async function liberarReservaAdmin(reservaId: number): Promise<boolean> {
  const reserva = await AppDataSource.getRepository(SiafCorrelativoReserva).findOne({
    where: { id: reservaId },
  });
  if (!reserva) return false;
  return liberarCorrelativo(reservaId, reserva.usuarioId, true);
}
