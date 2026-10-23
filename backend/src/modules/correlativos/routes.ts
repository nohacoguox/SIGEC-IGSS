import { Request, Response, Router } from 'express';
import { AppDataSource } from '../../data-source';
import { verifyToken, authorizeRolesOrPermissions } from '../../middleware/auth';
import { describirAltasBajas, describirCambios, registrarActividadAdmin } from '../../services/adminActividad';
import {
  reservarCorrelativo,
  liberarCorrelativo,
  getEstadoCorrelativos,
  actualizarConfigCorrelativo,
  liberarReservaAdmin,
  listarSeriesCorrelativo,
  crearSerieCorrelativo,
  actualizarSerieCorrelativo,
  eliminarSerieCorrelativo,
} from '../../services/CorrelativoService';
import {
  actualizarConfigCorrelativoExpediente,
  getEstadoCorrelativosExpediente,
} from '../../services/ExpedienteCorrelativoService';

// El router se monta en /api/correlativos.
export const correlativosRouter = Router();

// ——— Correlativos SIAF (secuencia automática + reservas) ———
correlativosRouter.get(
  '/estado',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-correlativos'], ['gestionar-correlativos']),
  async (_req: Request, res: Response) => {
    try {
      const estado = await getEstadoCorrelativos();
      res.json(estado);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err?.message || 'Error al obtener estado de correlativos' });
    }
  }
);

correlativosRouter.put(
  '/config',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-correlativos'], ['gestionar-correlativos']),
  async (req: Request, res: Response) => {
    try {
      const { numeroInicio, siguienteNumero, digitos, minutosReserva } = req.body;
      const previa = await AppDataSource.query(
        `SELECT id, nombre, numero_inicio, siguiente_numero, digitos, minutos_reserva FROM siaf_correlativo_config ORDER BY id ASC LIMIT 1`
      );
      const config = await actualizarConfigCorrelativo({
        numeroInicio: numeroInicio != null ? Number(numeroInicio) : undefined,
        siguienteNumero: siguienteNumero != null ? Number(siguienteNumero) : undefined,
        digitos: digitos != null ? Number(digitos) : undefined,
        minutosReserva: minutosReserva != null ? Number(minutosReserva) : undefined,
      });
      const estado = await getEstadoCorrelativos();
      const detalleConfig = describirCambios([
        { etiqueta: 'el número de inicio', antes: previa?.[0]?.numero_inicio, despues: config.numeroInicio },
        { etiqueta: 'el siguiente número', antes: previa?.[0]?.siguiente_numero, despues: config.siguienteNumero },
        { etiqueta: 'los dígitos', antes: previa?.[0]?.digitos, despues: config.digitos },
        { etiqueta: 'los minutos de reserva', antes: previa?.[0]?.minutos_reserva, despues: config.minutosReserva },
      ]);
      if (detalleConfig) {
        await registrarActividadAdmin(req, `En el correlativo ${previa?.[0]?.nombre || 'General'}: ${detalleConfig}.`);
      }
      res.json({ config, estado });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || 'Error al actualizar configuración' });
    }
  }
);

correlativosRouter.get(
  '/series',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-correlativos'], ['gestionar-correlativos']),
  async (_req: Request, res: Response) => {
    try {
      res.json(await listarSeriesCorrelativo());
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Error al listar correlativos' });
    }
  }
);

correlativosRouter.post(
  '/series',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-correlativos'], ['gestionar-correlativos']),
  async (req: Request, res: Response) => {
    try {
      const creada = await crearSerieCorrelativo(req.body || {});
      await registrarActividadAdmin(req, `Creó el correlativo ${req.body?.nombre || ''}`);
      res.status(201).json(creada);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || 'Error al crear el correlativo' });
    }
  }
);

correlativosRouter.put(
  '/series/:id',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-correlativos'], ['gestionar-correlativos']),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const body = req.body || {};
      const previa = await AppDataSource.query(
        `SELECT nombre, prefijo, prefijo_posicion, numero_inicio, siguiente_numero, digitos, minutos_reserva FROM siaf_correlativo_config WHERE id = $1`,
        [id]
      );
      const areasPrevias: Array<{ nombre: string }> = await AppDataSource.query(
        `SELECT a.nombre FROM siaf_correlativo_areas j JOIN areas a ON a.id = j.area_id WHERE j.config_id = $1 ORDER BY a.nombre`,
        [id]
      );
      const actualizada = await actualizarSerieCorrelativo(id, {
        nombre: body.nombre,
        prefijo: body.prefijo,
        prefijoPosicion: body.prefijoPosicion,
        areaIds: Array.isArray(body.areaIds) ? body.areaIds.map((value: unknown) => Number(value)) : undefined,
        numeroInicio: body.numeroInicio != null ? Number(body.numeroInicio) : undefined,
        siguienteNumero: body.siguienteNumero != null ? Number(body.siguienteNumero) : undefined,
        digitos: body.digitos != null ? Number(body.digitos) : undefined,
        minutosReserva: body.minutosReserva != null ? Number(body.minutosReserva) : undefined,
      });
      const nueva = await AppDataSource.query(
        `SELECT nombre, prefijo, prefijo_posicion, numero_inicio, siguiente_numero, digitos, minutos_reserva FROM siaf_correlativo_config WHERE id = $1`,
        [id]
      );
      const areasNuevas: Array<{ nombre: string }> = await AppDataSource.query(
        `SELECT a.nombre FROM siaf_correlativo_areas j JOIN areas a ON a.id = j.area_id WHERE j.config_id = $1 ORDER BY a.nombre`,
        [id]
      );
      const posicion = (valor: unknown) => (String(valor || '') === 'despues' ? 'después del número' : 'antes del número');
      const partes: string[] = [];
      const detalleSerie = describirCambios([
        { etiqueta: 'el nombre', antes: previa?.[0]?.nombre, despues: nueva?.[0]?.nombre },
        { etiqueta: 'el prefijo', antes: previa?.[0]?.prefijo, despues: nueva?.[0]?.prefijo },
        { etiqueta: 'la posición del prefijo', antes: posicion(previa?.[0]?.prefijo_posicion), despues: posicion(nueva?.[0]?.prefijo_posicion) },
        { etiqueta: 'el número de inicio', antes: previa?.[0]?.numero_inicio, despues: nueva?.[0]?.numero_inicio },
        { etiqueta: 'el siguiente número', antes: previa?.[0]?.siguiente_numero, despues: nueva?.[0]?.siguiente_numero },
        { etiqueta: 'los dígitos', antes: previa?.[0]?.digitos, despues: nueva?.[0]?.digitos },
        { etiqueta: 'los minutos de reserva', antes: previa?.[0]?.minutos_reserva, despues: nueva?.[0]?.minutos_reserva },
      ]);
      if (detalleSerie) partes.push(detalleSerie);
      if (Array.isArray(body.areaIds)) {
        const antesNombres = areasPrevias.map((area) => area.nombre);
        const despuesNombres = areasNuevas.map((area) => area.nombre);
        const antesSet = new Set(antesNombres);
        const despuesSet = new Set(despuesNombres);
        const detalleAreas = describirAltasBajas(
          despuesNombres.filter((nombre) => !antesSet.has(nombre)),
          antesNombres.filter((nombre) => !despuesSet.has(nombre)),
          'área'
        );
        if (detalleAreas) partes.push(detalleAreas);
      }
      if (partes.length) {
        await registrarActividadAdmin(req, `En el correlativo ${previa?.[0]?.nombre || ''}: ${partes.join('; ')}.`);
      }
      res.json(actualizada);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || 'Error al guardar el correlativo' });
    }
  }
);

correlativosRouter.delete(
  '/series/:id',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-correlativos'], ['gestionar-correlativos']),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const previa = await AppDataSource.query(`SELECT nombre FROM siaf_correlativo_config WHERE id = $1`, [id]);
      const resultado = await eliminarSerieCorrelativo(id);
      await registrarActividadAdmin(req, `Eliminó el correlativo ${previa?.[0]?.nombre || ''}`);
      res.json(resultado);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || 'Error al eliminar el correlativo' });
    }
  }
);

correlativosRouter.post(
  '/reservar',
  verifyToken,
  authorizeRolesOrPermissions(
    ['super administrador', 'crear-siaf', 'listado-siaf'],
    ['crear-siaf', 'listado-siaf']
  ),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const areaId = Number(req.body?.areaId);
      const reserva = await reservarCorrelativo(userId, areaId);
      res.status(201).json(reserva);
    } catch (err: any) {
      console.error('[correlativos/reservar]', err);
      const msg = err?.message || 'Error al reservar correlativo';
      const hint = /does not exist|relation|tabla/i.test(msg)
        ? ' Reinicie el backend para crear las tablas de correlativos.'
        : '';
      const status = err?.code || /does not exist|relation|tabla/i.test(msg) ? 500 : 400;
      res.status(status).json({ message: `${msg}${hint}` });
    }
  }
);

correlativosRouter.post(
  '/liberar',
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const reservaId = Number(req.body?.reservaId);
      if (!reservaId) return res.status(400).json({ message: 'reservaId es obligatorio' });
      const ok = await liberarCorrelativo(reservaId, userId, false);
      if (!ok) return res.status(404).json({ message: 'Reserva no encontrada o no autorizada' });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Error al liberar correlativo' });
    }
  }
);

correlativosRouter.post(
  '/liberar-admin/:id',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-correlativos'], ['gestionar-correlativos']),
  async (req: Request, res: Response) => {
    try {
      const reservaId = parseInt(req.params.id, 10);
      const reserva = await AppDataSource.query(
        `SELECT correlativo FROM siaf_correlativo_reservas WHERE id = $1`,
        [reservaId]
      );
      const ok = await liberarReservaAdmin(reservaId);
      if (!ok) return res.status(404).json({ message: 'Reserva no encontrada' });
      const estado = await getEstadoCorrelativos();
      await registrarActividadAdmin(req, `Liberó la reserva ${reserva?.[0]?.correlativo || ''}`.trim());
      res.json({ ok: true, estado });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Error al liberar reserva' });
    }
  }
);

// ——— Correlativos de expedientes (asignación automática al guardar) ———
// Vista previa para quien crea expedientes (no requiere gestionar-correlativos)
correlativosRouter.get(
  '/expedientes/siguiente',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador'], ['crear-expediente']),
  async (_req: Request, res: Response) => {
    try {
      const estado = await getEstadoCorrelativosExpediente();
      res.json({ correlativo: estado.correlativoSiguientePreview });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Error al obtener el siguiente correlativo de expediente' });
    }
  }
);

correlativosRouter.get(
  '/expedientes/estado',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-correlativos'], ['gestionar-correlativos']),
  async (_req: Request, res: Response) => {
    try {
      res.json(await getEstadoCorrelativosExpediente());
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Error al obtener correlativos de expedientes' });
    }
  }
);

correlativosRouter.put(
  '/expedientes/config',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-correlativos'], ['gestionar-correlativos']),
  async (req: Request, res: Response) => {
    try {
      const { numeroInicio, siguienteNumero, digitos } = req.body || {};
      const previa = await AppDataSource.query(
        `SELECT numero_inicio, siguiente_numero, digitos FROM expediente_correlativo_config ORDER BY id ASC LIMIT 1`
      );
      const config = await actualizarConfigCorrelativoExpediente({
        numeroInicio: numeroInicio != null ? Number(numeroInicio) : undefined,
        siguienteNumero: siguienteNumero != null ? Number(siguienteNumero) : undefined,
        digitos: digitos != null ? Number(digitos) : undefined,
      });
      const detalleExpediente = describirCambios([
        { etiqueta: 'el número de inicio', antes: previa?.[0]?.numero_inicio, despues: config.numeroInicio },
        { etiqueta: 'el siguiente número', antes: previa?.[0]?.siguiente_numero, despues: config.siguienteNumero },
        { etiqueta: 'los dígitos', antes: previa?.[0]?.digitos, despues: config.digitos },
      ]);
      if (detalleExpediente) {
        await registrarActividadAdmin(req, `En el correlativo de expedientes: ${detalleExpediente}.`);
      }
      res.json({ config, estado: await getEstadoCorrelativosExpediente() });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || 'Error al actualizar correlativos de expedientes' });
    }
  }
);
