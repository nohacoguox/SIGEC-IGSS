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
const synchronizeEnabled = process.env.DB_SYNCHRONIZE === 'true';

// Middleware
app.use(cors());
app.use(express.json());

// Migración user_roles (automática al iniciar) y luego conexión TypeORM
runUserRolesMigration()
  .then(() => AppDataSource.initialize())
  .then(async () => {
  console.log('✅ Base de datos conectada exitosamente');
  console.log(
    synchronizeEnabled
      ? '⚠️  TypeORM synchronize=ON (DB_SYNCHRONIZE=true). Solo para BD vacía / desarrollo.'
      : '🔒 TypeORM synchronize=OFF. Esquema asegurado por ensureSchema (producción / BD existente).'
  );

  await ensureSchema();

  try {
    await syncAppScreenPermissions();
  } catch (e: any) {
    console.error('Aviso al sincronizar permisos de pantallas:', e?.message);
  }

  // Test database connection
  try {
    const userCount = await AppDataSource.getRepository(User).count();
    console.log(`📊 Usuarios en base de datos: ${userCount}`);
  } catch (error) {
    console.error('❌ Error al verificar base de datos:', error);
  }

  // Revisión ortográfica vía LanguageTool → src/modules/ortografia
  app.use('/api/ortografia', ortografiaRouter);

  // Auth endpoints (login, recuperación y cambio de contraseña) → src/modules/auth
  app.use('/api/auth', authRouter);

  // Roles, permisos y catálogo de pantallas → src/modules/rbac
  app.use('/api', rbacRouter);

  // Correlativos SIAF y de expedientes (secuencia, reservas y configuración) → src/modules/correlativos
  app.use('/api/correlativos', correlativosRouter);

  // Estadísticas del dashboard (admin)
  app.get('/api/dashboard/stats', verifyToken, async (req: Request, res: Response) => {
    try {
      const [totalUsers, totalRoles, totalReports] = await Promise.all([
        AppDataSource.getRepository(User).count(),
        AppDataSource.getRepository(Role).count(),
        AppDataSource.getRepository(SiafSolicitud).count(),
      ]);
      res.json({ totalUsers, totalRoles, totalReports });
    } catch (error) {
      console.error('Error al obtener estadísticas del dashboard:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas del dashboard' });
    }
  });

  // Expedientes: CRUD, revisión DAF, documentos y versiones → src/modules/expedientes
  app.use('/api/expedientes', expedientesRouter);

  // Usuarios: alta, edición, roles asignados, director y personal médico → src/modules/usuarios
  app.use('/api/users', usuariosRouter);

  // Puestos, departamentos, municipios, unidades médicas y áreas → src/modules/catalogos
  app.use('/api', catalogosRouter);

  // Catálogo de productos MINFIN/SIBOFA: consulta, importación Excel y configuración → src/modules/catalogoProductos
  app.use('/api/catalogo-productos', catalogoProductosRouter);

  // SIAF: solicitudes, revisión de Dirección Departamental, adjuntos y bitácora → src/modules/siaf
  app.use('/api/siaf', siafRouter);

  // Estadísticas y analítica (SIAF, expedientes y DAF) → src/modules/estadisticas
  app.use('/api/estadisticas', estadisticasRouter);

  // Manejo de errores (p. ej. multer o errores no capturados en rutas)
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

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📡 API disponible en http://localhost:${PORT}/api`);
  });

}).catch(error => {
  console.error('❌ Error al conectar con la base de datos:', error);
  process.exit(1);
});

export default app;