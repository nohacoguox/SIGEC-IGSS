import { Request, Response, Router } from 'express';
import { verifyToken, authorizeRolesOrPermissions } from '../../middleware/auth';
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
      const config = await actualizarConfigCorrelativo({
        numeroInicio: numeroInicio != null ? Number(numeroInicio) : undefined,
        siguienteNumero: siguienteNumero != null ? Number(siguienteNumero) : undefined,
        digitos: digitos != null ? Number(digitos) : undefined,
        minutosReserva: minutosReserva != null ? Number(minutosReserva) : undefined,
      });
      const estado = await getEstadoCorrelativos();
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
      res.status(201).json(await crearSerieCorrelativo(req.body || {}));
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
      res.json(await actualizarSerieCorrelativo(id, {
        nombre: body.nombre,
        prefijo: body.prefijo,
        prefijoPosicion: body.prefijoPosicion,
        areaIds: Array.isArray(body.areaIds) ? body.areaIds.map((value: unknown) => Number(value)) : undefined,
        numeroInicio: body.numeroInicio != null ? Number(body.numeroInicio) : undefined,
        siguienteNumero: body.siguienteNumero != null ? Number(body.siguienteNumero) : undefined,
        digitos: body.digitos != null ? Number(body.digitos) : undefined,
        minutosReserva: body.minutosReserva != null ? Number(body.minutosReserva) : undefined,
      }));
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
      res.json(await eliminarSerieCorrelativo(parseInt(req.params.id, 10)));
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
      const ok = await liberarReservaAdmin(parseInt(req.params.id, 10));
      if (!ok) return res.status(404).json({ message: 'Reserva no encontrada' });
      const estado = await getEstadoCorrelativos();
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
      const config = await actualizarConfigCorrelativoExpediente({
        numeroInicio: numeroInicio != null ? Number(numeroInicio) : undefined,
        siguienteNumero: siguienteNumero != null ? Number(siguienteNumero) : undefined,
        digitos: digitos != null ? Number(digitos) : undefined,
      });
      res.json({ config, estado: await getEstadoCorrelativosExpediente() });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || 'Error al actualizar correlativos de expedientes' });
    }
  }
);
