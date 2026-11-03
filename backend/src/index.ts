import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runUserRolesMigration } from './migrations/migrate-user-roles';
import { AppDataSource } from './data-source';
import { User } from './entity/User';
import { SiafSolicitud } from './entity/SiafSolicitud';
import { Role } from './entity/Role';
import { verifyToken } from './middleware/auth';
import { authRouter } from './modules/auth/routes';
import { rbacRouter } from './modules/rbac/routes';
import { catalogosRouter } from './modules/catalogos/routes';
import { siafRouter } from './modules/siaf/routes';
import { correlativosRouter } from './modules/correlativos/routes';
import { usuariosRouter } from './modules/usuarios/routes';
import { expedientesRouter } from './modules/expedientes/routes';
import { ortografiaRouter } from './modules/ortografia/routes';
import { estadisticasRouter } from './modules/estadisticas/routes';
import { catalogoProductosRouter, updateCatalogoTrabajo } from './modules/catalogoProductos/routes';
import { CATALOGO_MAX_MB } from './middleware/upload';
import { syncAppScreenPermissions } from './services/syncAppScreens';
import { ensureSchema } from './services/ensureSchema';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

async function actividadReciente(): Promise<Array<{ fecha: string; usuario: string; texto: string }>> {
  const rows: Array<{ fecha: Date | string; usuario: string | null; texto: string | null }> =
    await AppDataSource.query(`
      SELECT fecha, usuario, texto
      FROM admin_actividad
      ORDER BY fecha DESC
      LIMIT 8
    `);

  return rows.map((row) => ({
    fecha: row.fecha instanceof Date ? row.fecha.toISOString() : String(row.fecha),
    usuario: (row.usuario || '').trim(),
    texto: String(row.texto || '').trim(),
  }));
}
const synchronizeEnabled = process.env.DB_SYNCHRONIZE === 'true';

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, service: 'sigec-backend' });
});

runUserRolesMigration()
  .then(() => AppDataSource.initialize())
  .then(async () => {
  console.log('Base de datos conectada.');
  console.log(
    synchronizeEnabled
      ? 'TypeORM synchronize=ON (solo desarrollo / BD vacía).'
      : 'TypeORM synchronize=OFF (migraciones + ensureSchema).'
  );

  const executed = await AppDataSource.runMigrations();
  if (executed.length > 0) {
    console.log(`Migraciones aplicadas: ${executed.map((m) => m.name).join(', ')}`);
  } else {
    console.log('Migraciones: sin pendientes.');
  }

  await ensureSchema();

  try {
    await syncAppScreenPermissions();
  } catch (e: any) {
    console.error('Aviso al sincronizar permisos de pantallas:', e?.message);
  }

  try {
    const userCount = await AppDataSource.getRepository(User).count();
    console.log(`Usuarios en BD: ${userCount}`);
  } catch (error) {
    console.error('Error al verificar base de datos:', error);
  }

  app.use('/api/ortografia', ortografiaRouter);
  app.use('/api/auth', authRouter);
  app.use('/api', rbacRouter);
  app.use('/api/correlativos', correlativosRouter);

  app.get('/api/dashboard/stats', verifyToken, async (req: Request, res: Response) => {
    try {
      const [totalUsers, totalRoles, totalSiaf, actividad] = await Promise.all([
        AppDataSource.getRepository(User).count(),
        AppDataSource.getRepository(Role).count(),
        AppDataSource.getRepository(SiafSolicitud).count(),
        actividadReciente(),
      ]);
      res.json({ totalUsers, totalRoles, totalSiaf, actividad });
    } catch (error) {
      console.error('Error al obtener estadísticas del dashboard:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas del dashboard' });
    }
  });

  app.use('/api/expedientes', expedientesRouter);
  app.use('/api/users', usuariosRouter);
  app.use('/api', catalogosRouter);
  app.use('/api/catalogo-productos', catalogoProductosRouter);
  app.use('/api/siaf', siafRouter);
  app.use('/api/estadisticas', estadisticasRouter);

  app.use((err: any, req: Request, res: Response, _next: Function) => {
    console.error('Error en petición:', err);
    if (res.headersSent) return;
    const isFileTooLarge = err?.code === 'LIMIT_FILE_SIZE' || err?.message?.includes('File too large');
    const msg = isFileTooLarge
      ? `Archivo demasiado grande. Límite: ${CATALOGO_MAX_MB} MB. Comprima el Excel o use un archivo más pequeño.`
      : (err?.message || String(err));
    updateCatalogoTrabajo(String(req.query?.trabajoId ?? '') || null, {
      estado: 'ERROR',
      mensaje: msg,
    });
    res.status(isFileTooLarge ? 413 : 500).json({ message: msg });
  });

  // 0.0.0.0 para alcanzar la API desde otras PCs de la red
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Servidor en puerto ${PORT}`);
    console.log(`API local: http://localhost:${PORT}/api`);
    console.log(`API en red: http://<IP-de-esta-PC>:${PORT}/api`);
  });

}).catch(error => {
  console.error('Error al iniciar el backend (conexión o migraciones):', error);
  process.exit(1);
});

export default app;