import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runUserRolesMigration } from './migrations/migrate-user-roles';
import { AppDataSource } from './data-source';
import { User } from './entity/User';
import { Credential } from './entity/Credential';
import { Puesto } from './entity/Puesto';
import { UnidadMedica } from './entity/UnidadMedica';
import { Departamento } from './entity/Departamento';
import { Municipio } from './entity/Municipio';
import { Area } from './entity/Area';
import { SiafSolicitud, SiafAutorizacion, SiafItem, SiafSubproducto, SiafDocumentoAdjunto, SiafBitacora } from './entity/SiafSolicitud';
import { Expediente, ExpedienteDocumento, ExpedienteBitacora, ExpedienteBitacoraDetalle, ExpedienteDocumentoVersion } from './entity/Expediente';
import { ProductoCatalogo } from './entity/ProductoCatalogo';
import { Permission } from './entity/Permission';
import { Role } from './entity/Role';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { In, DeepPartial } from 'typeorm';
import { pdfGeneratorService } from './services/PdfGeneratorService';
import { fileStorageService } from './services/FileStorageService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const multer = require('multer');
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB (catálogos Excel pueden ser grandes)

let XLSX: any;
try {
  XLSX = require('xlsx');
  if (!XLSX.default && !XLSX.read) XLSX = require('xlsx');
  if (XLSX.default && XLSX.default.read) XLSX = XLSX.default;
} catch (e) {
  console.warn('xlsx no cargado al inicio:', (e as Error).message);
}

// Middleware
app.use(cors());
app.use(express.json());

// Verify Token Middleware
const verifyToken = (req: Request, res: Response, next: Function) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  console.log(`[Middleware] Verificando token para: ${req.method} ${req.path}`);
  
  if (!token) {
    console.log('[Middleware] Token no proporcionado');
    return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    (req as any).user = decoded;
    console.log('[Middleware] Token válido para usuario ID:', decoded.userId);
    next();
  } catch (error) {
    console.error('[Middleware] Error de verificación de token:', error);
    res.status(400).json({ message: 'Token inválido.' });
  }
};

// Middleware: solo permite si el usuario tiene al menos uno de los roles indicados (requiere verifyToken antes)
const authorizeRoles = (allowedRoles: string[]) => (req: Request, res: Response, next: Function) => {
  const userRoles: string[] = (req as any).user?.roles ?? [];
  const hasRole = allowedRoles.some((r) => userRoles.includes(r));
  if (!hasRole) {
    return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
  }
  next();
};

// Middleware: permite si tiene uno de los roles O uno de los permisos (requiere verifyToken antes; el JWT debe incluir permissions)
const authorizeRolesOrPermissions = (allowedRoles: string[], allowedPermissions: string[]) => (req: Request, res: Response, next: Function) => {
  const userRoles: string[] = (req as any).user?.roles ?? [];
  const userPermissions: string[] = (req as any).user?.permissions ?? [];
  const hasRole = allowedRoles.some((r) => userRoles.includes(r));
  const hasPermission = allowedPermissions.some((p) => userPermissions.includes(p));
  if (hasRole || hasPermission) return next();
  return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
};

// Migración user_roles (automática al iniciar) y luego conexión TypeORM
runUserRolesMigration()
  .then(() => AppDataSource.initialize())
  .then(async () => {
  console.log('✅ Base de datos conectada exitosamente');

  // Asegurar columnas de bitácora (detalle_antes, detalle_despues) para correcciones
  try {
    await AppDataSource.query(`ALTER TABLE siaf_bitacora ADD COLUMN IF NOT EXISTS detalle_antes TEXT`);
    await AppDataSource.query(`ALTER TABLE siaf_bitacora ADD COLUMN IF NOT EXISTS detalle_despues TEXT`);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al asegurar columnas bitácora:', e?.message);
  }

  // Columnas motivo_rechazo y motivos_rechazo en siaf_autorizaciones (uno o varios motivos para estadísticas)
  try {
    await AppDataSource.query(`ALTER TABLE siaf_autorizaciones ADD COLUMN IF NOT EXISTS motivo_rechazo VARCHAR(80)`);
    await AppDataSource.query(`ALTER TABLE siaf_autorizaciones ADD COLUMN IF NOT EXISTS motivos_rechazo TEXT`);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al agregar motivo_rechazo / motivos_rechazo:', e?.message);
  }

  // Columna comentario_rechazo en expedientes (rechazo por Dirección Departamental)
  try {
    await AppDataSource.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS comentario_rechazo TEXT`);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al agregar comentario_rechazo:', e?.message);
  }

  // Columna expediente_documento_id en expediente_bitacora (para tipo correccion)
  try {
    await AppDataSource.query(`ALTER TABLE expediente_bitacora ADD COLUMN IF NOT EXISTS expediente_documento_id INT`);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al agregar expediente_documento_id a bitácora:', e?.message);
  }
  // Columna expediente_documento_version_id (versión reemplazada, para "Ver documento reemplazado")
  try {
    await AppDataSource.query(`ALTER TABLE expediente_bitacora ADD COLUMN IF NOT EXISTS expediente_documento_version_id INT`);
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al agregar expediente_documento_version_id a bitácora:', e?.message);
  }

  // Columnas origen expediente (unidad y municipio del creador, para filtro DAF)
  try {
    await AppDataSource.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS unidad_origen VARCHAR(255)`);
    await AppDataSource.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS municipio_origen VARCHAR(150)`);
    // Backfill unidad_origen para expedientes ya creados
    await AppDataSource.query(`
      UPDATE expedientes e SET unidad_origen = (SELECT u.unidad_medica FROM users u WHERE u.id = e.usuario_id LIMIT 1)
      WHERE e.unidad_origen IS NULL
    `).catch(() => {});
    // Backfill municipio_origen desde UnidadMedica (ej. "Palín, Escuintla")
    const expRepo = AppDataSource.getRepository(Expediente);
    const expsConUnidad = await expRepo
      .createQueryBuilder('e')
      .select(['e.id', 'e.unidadOrigen'])
      .where('e.municipioOrigen IS NULL')
      .andWhere('e.unidadOrigen IS NOT NULL')
      .getMany()
      .catch(() => []);
    if (expsConUnidad.length > 0) {
      const unidadRepo = AppDataSource.getRepository(UnidadMedica);
      for (const e of expsConUnidad) {
        const nombre = (e as any).unidadOrigen;
        if (!nombre) continue;
        const unidad = await unidadRepo.findOne({ where: { nombre }, relations: ['municipio', 'municipio.departamento'] }).catch(() => null);
        const dep = unidad?.municipio?.departamento?.nombre ?? unidad?.departamento ?? '';
        const texto = unidad?.municipio ? `${unidad.municipio.nombre}, ${dep}`.trim() : (dep || null);
        await expRepo.update({ id: e.id }, { municipioOrigen: texto } as any).catch(() => {});
      }
    }
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al agregar unidad_origen/municipio_origen:', e?.message);
  }

  // Asignar siaf_id a correcciones que lo tienen NULL (así se cargan en la bitácora por SIAF)
  try {
    const beforeCount = await AppDataSource.query(`SELECT COUNT(*) AS c FROM siaf_bitacora WHERE tipo = 'correccion' AND siaf_id IS NULL`);
    await AppDataSource.query(`
      UPDATE siaf_bitacora b
      SET siaf_id = COALESCE(
        (SELECT r.siaf_id FROM siaf_bitacora r WHERE r.tipo = 'rechazo' AND r.siaf_id IS NOT NULL AND r.fecha < b.fecha ORDER BY r.fecha DESC LIMIT 1),
        (SELECT r.siaf_id FROM siaf_bitacora r WHERE r.tipo = 'rechazo' AND r.siaf_id IS NOT NULL ORDER BY r.fecha ASC LIMIT 1)
      )
      WHERE b.tipo = 'correccion' AND b.siaf_id IS NULL
    `);
    const afterCount = await AppDataSource.query(`SELECT COUNT(*) AS c FROM siaf_bitacora WHERE tipo = 'correccion' AND siaf_id IS NULL`);
    const remaining = afterCount?.[0]?.c ?? 0;
    if (remaining === 0) {
      console.log('✅ Bitácora: correcciones con siaf_id NULL asignadas (rechazos y correcciones se muestran por SIAF).');
    } else if ((beforeCount?.[0]?.c ?? 0) > 0) {
      console.log(`⚠️ Bitácora: ${remaining} corrección(es) siguen con siaf_id NULL (se intentará mostrarlas por fecha al cargar bitácora).`);
    }
  } catch (e: any) {
    if (!/does not exist/i.test(e?.message || '')) console.error('Aviso al asignar siaf_id a correcciones:', e?.message);
  }

  // Test database connection
  try {
    const userCount = await AppDataSource.getRepository(User).count();
    console.log(`📊 Usuarios en base de datos: ${userCount}`);
  } catch (error) {
    console.error('❌ Error al verificar base de datos:', error);
  }

  // Auth endpoints
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { codigoEmpleado, password } = req.body;
      if (!codigoEmpleado || !password) {
        return res.status(400).json({ message: 'Código de empleado y contraseña son requeridos' });
      }
      const credentialRepository = AppDataSource.getRepository(Credential);
      const userRepository = AppDataSource.getRepository(User);
      
      // Find credential by codigoEmpleado
      const credential = await credentialRepository.findOne({ 
        where: { codigoEmpleado },
        relations: ['user', 'user.puesto', 'user.roles', 'user.roles.permissions']
      });

      if (!credential) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      const isValidPassword = await bcrypt.compare(password, credential.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      const user = credential.user;
      const roles = user.roles ?? [];
      const roleNames = roles.map((r) => r.name);
      const allPermissions = new Set<string>();
      roles.forEach((r) => r.permissions?.forEach((p) => allPermissions.add(p.name)));

      const token = jwt.sign(
        { userId: user.id, codigoEmpleado: credential.codigoEmpleado, roles: roleNames, permissions: Array.from(allPermissions) },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login exitoso',
        token,
        nombres: user.nombres,
        apellidos: user.apellidos,
        role: roleNames[0] ?? null,
        roles: roleNames,
        permissions: Array.from(allPermissions),
        isTempPassword: credential.isTempPassword,
      });
    } catch (error: any) {
      console.error('Error en login:', error);
      const message = error?.message || 'Error en el servidor';
      res.status(500).json({ message: 'Error en el servidor', detail: message });
    }
  });

  app.get('/api/auth/me', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const userRepository = AppDataSource.getRepository(User);
      
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['puesto', 'roles', 'roles.permissions'],
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error al obtener datos del usuario logueado:', error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  });

  // Validación de contraseña: mínimo 8 caracteres, al menos una mayúscula, un número y un símbolo
  const validatePassword = (password: string): { valid: boolean; message?: string } => {
    if (!password || password.length < 8) {
      return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'La contraseña debe incluir al menos una letra mayúscula.' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'La contraseña debe incluir al menos un número.' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { valid: false, message: 'La contraseña debe incluir al menos un símbolo (ej. ! @ # $ %).' };
    }
    return { valid: true };
  };

  app.post('/api/auth/change-password', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Contraseña antigua y nueva son requeridas.' });
      }
      const validation = validatePassword(newPassword);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }
      const credentialRepository = AppDataSource.getRepository(Credential);
      const credential = await credentialRepository.findOne({ where: { userId } });
      if (!credential) {
        return res.status(404).json({ message: 'No se encontraron credenciales para este usuario.' });
      }
      const isValid = await bcrypt.compare(oldPassword, credential.password);
      if (!isValid) {
        return res.status(401).json({ message: 'La contraseña antigua es incorrecta.' });
      }
      const hashed = await bcrypt.hash(newPassword, 10);
      credential.password = hashed;
      credential.isTempPassword = false;
      await credentialRepository.save(credential);
      res.json({ message: 'Contraseña cambiada correctamente.' });
    } catch (err: any) {
      console.error('Error al cambiar contraseña:', err);
      res.status(500).json({ message: err?.message || 'Error al cambiar la contraseña.' });
    }
  });

  // Roles (solo super administrador)
  app.get('/api/roles', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
    try {
      const roleRepository = AppDataSource.getRepository(Role);
      const roles = await roleRepository.find({ relations: ['permissions'] });
      res.json(roles);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching roles' });
    }
  });

  app.post('/api/roles', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
    try {
      const { name, permissionIds } = req.body;
      const roleRepository = AppDataSource.getRepository(Role);
      const permissionRepository = AppDataSource.getRepository(Permission);
      const permissions = permissionIds?.length
        ? await permissionRepository.find({ where: { id: In(permissionIds) } })
        : [];
      const newRole = roleRepository.create({ name, permissions });
      await roleRepository.save(newRole);
      res.status(201).json(newRole);
    } catch (err) {
      res.status(500).json({ message: 'Error creating role' });
    }
  });

  app.put('/api/roles/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
    try {
      const { name, permissionIds } = req.body;
      const roleId = parseInt(req.params.id);
      const roleRepository = AppDataSource.getRepository(Role);
      const permissionRepository = AppDataSource.getRepository(Permission);
      const role = await roleRepository.findOne({ where: { id: roleId }, relations: ['permissions'] });
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
      role.name = name ?? role.name;
      if (permissionIds != null) {
        role.permissions = permissionIds.length
          ? await permissionRepository.find({ where: { id: In(permissionIds) } })
          : [];
      }
      await roleRepository.save(role);
      res.json(role);
    } catch (err) {
      res.status(500).json({ message: 'Error updating role' });
    }
  });

  app.delete('/api/roles/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
    try {
      const roleId = parseInt(req.params.id);
      const roleRepository = AppDataSource.getRepository(Role);
      const role = await roleRepository.findOne({ where: { id: roleId } });
      if (!role) return res.status(404).json({ message: 'Rol no encontrado' });
      await roleRepository.remove(role);
      res.status(204).send();
    } catch (err) {
      console.error('Error al eliminar rol:', err);
      res.status(500).json({ message: 'Error al eliminar el rol' });
    }
  });

  // Permissions (solo super administrador)
  app.get('/api/permissions', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
    try {
      const permissionRepository = AppDataSource.getRepository(Permission);
      const permissions = await permissionRepository.find();
      res.json(permissions);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching permissions' });
    }
  });

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

  // Expedientes: listar (del usuario) y crear (crear solo con permiso crear-expediente)
  app.get('/api/expedientes', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const repo = AppDataSource.getRepository(Expediente);
      const expedientes = await repo.find({
        where: { usuarioId: userId },
        relations: ['usuario'],
        order: { createdAt: 'DESC' },
      });
      res.json(expedientes);
    } catch (err: any) {
      console.error('Error al listar expedientes:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al listar expedientes.' });
    }
  });

  const TITULOS_EXPEDIENTE_VALIDOS = ['Bien/Producto', 'Servicio'];

  app.post('/api/expedientes', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['crear-expediente']), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const { numeroExpediente, tipoExpediente, titulo, descripcion } = req.body || {};
      const numero = typeof numeroExpediente === 'string' ? numeroExpediente.trim() : '';
      const tipo = typeof tipoExpediente === 'string' ? tipoExpediente.trim() : 'Compras';
      const tit = typeof titulo === 'string' ? titulo.trim() : '';
      if (!numero) return res.status(400).json({ message: 'El número de expediente es obligatorio.' });
      if (!tit) return res.status(400).json({ message: 'El título es obligatorio. Elija Bien/Producto o Servicio.' });
      if (!TITULOS_EXPEDIENTE_VALIDOS.includes(tit)) return res.status(400).json({ message: 'El título debe ser "Bien/Producto" o "Servicio".' });
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: userId });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
      const repo = AppDataSource.getRepository(Expediente);
      const existe = await repo.findOne({ where: { numeroExpediente: numero } });
      if (existe) return res.status(400).json({ message: 'Ya existe un expediente con ese número.' });
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const exp = repo.create({
        numeroExpediente: numero,
        usuarioId: userId,
        usuario: user,
        tipoExpediente: tipo || 'Compras',
        titulo: tit,
        descripcion: typeof descripcion === 'string' ? descripcion.trim() || null : null,
        estado: 'abierto',
        fechaApertura: hoy,
        fechaCierre: null,
      } as unknown as DeepPartial<Expediente>);
      const nombreUnidad = (user.unidadMedica || '').trim();
      (exp as any).unidadOrigen = nombreUnidad || null;
      if (nombreUnidad) {
        const unidadRepo = AppDataSource.getRepository(UnidadMedica);
        const unidad = await unidadRepo.findOne({ where: { nombre: nombreUnidad }, relations: ['municipio', 'municipio.departamento'] });
        const dep = unidad?.municipio?.departamento?.nombre ?? unidad?.departamento ?? '';
        (exp as any).municipioOrigen = unidad?.municipio ? `${unidad.municipio.nombre}, ${dep}`.trim() : (dep || null);
      } else {
        (exp as any).municipioOrigen = null;
      }
      await repo.save(exp);
      res.status(201).json(exp);
    } catch (err: any) {
      console.error('Error al crear expediente:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al crear expediente.' });
    }
  });

  // Expedientes pendientes de revisión por Dirección Departamental (estado en_proceso).
  // El analista DAF ve TODOS los expedientes en_proceso; el filtro por municipio en el frontend es opcional (por origen).
  app.get('/api/expedientes/para-revision-departamental', verifyToken, authorizeRolesOrPermissions(['super administrador', 'revisar-siaf-direccion-departamental'], ['revisar-expediente-direccion-departamental']), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId }, relations: ['departamentoDireccionEntidad'] });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
      const depto = await resolveDepartamentoDireccion(user);
      const repo = AppDataSource.getRepository(Expediente);
      const lista = await repo.find({
        where: { estado: 'en_proceso' },
        relations: ['usuario'],
        order: { createdAt: 'DESC' },
      });
      const deptoRepo = AppDataSource.getRepository(Departamento);
      const deptoEntidad = depto ? await deptoRepo.findOne({ where: { nombre: depto } }) : null;
      res.json({
        expedientes: lista,
        meta: { departamento: depto ?? '', departamentoId: deptoEntidad?.id ?? null },
      });
    } catch (err: any) {
      console.error('Error al listar expedientes para revisión:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al listar expedientes.' });
    }
  });

  // Expedientes ya revisados por el analista DAF (él fue quien aprobó o rechazó por última vez).
  app.get('/api/expedientes/revisados-departamental', verifyToken, authorizeRolesOrPermissions(['super administrador', 'revisar-siaf-direccion-departamental'], ['revisar-expediente-direccion-departamental']), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
      const entradas = await bitacoraRepo.find({
        where: { tipo: In(['aprobacion', 'rechazo']) },
        select: ['id', 'expedienteId', 'fecha', 'tipo', 'usuarioId'],
        order: { expedienteId: 'ASC', fecha: 'DESC' },
      });
      const ultimaAccionPorExpediente = new Map<number, { tipo: string; fecha: Date; usuarioId: number }>();
      for (const b of entradas) {
        if (!ultimaAccionPorExpediente.has(b.expedienteId)) {
          ultimaAccionPorExpediente.set(b.expedienteId, { tipo: b.tipo, fecha: b.fecha, usuarioId: b.usuarioId });
        }
      }
      const expedienteIdsRevisadosPorMi: number[] = [];
      const expedienteIdToLatest = new Map<number, { tipo: string; fecha: Date }>();
      for (const [expId, accion] of ultimaAccionPorExpediente) {
        if (accion.usuarioId === userId) {
          expedienteIdsRevisadosPorMi.push(expId);
          expedienteIdToLatest.set(expId, { tipo: accion.tipo, fecha: accion.fecha });
        }
      }
      if (expedienteIdsRevisadosPorMi.length === 0) {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId }, relations: ['departamentoDireccionEntidad'] });
        const depto = user ? await resolveDepartamentoDireccion(user) : '';
        const deptoEntidad = depto ? await AppDataSource.getRepository(Departamento).findOne({ where: { nombre: depto } }) : null;
        return res.json({ expedientes: [], meta: { departamento: depto ?? '', departamentoId: deptoEntidad?.id ?? null } });
      }
      const repo = AppDataSource.getRepository(Expediente);
      const expedientes = await repo.find({
        where: { id: In(expedienteIdsRevisadosPorMi), estado: In(['cerrado', 'rechazado']) },
        relations: ['usuario'],
        order: { updatedAt: 'DESC' },
      });
      const lista = expedientes.map((e: any) => ({
        ...e,
        ultimaAccionPorMi: expedienteIdToLatest.get(e.id) || null,
      }));
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId }, relations: ['departamentoDireccionEntidad'] });
      const depto = user ? await resolveDepartamentoDireccion(user) : '';
      const deptoRepo = AppDataSource.getRepository(Departamento);
      const deptoEntidad = depto ? await deptoRepo.findOne({ where: { nombre: depto } }) : null;
      res.json({
        expedientes: lista,
        meta: { departamento: depto ?? '', departamentoId: deptoEntidad?.id ?? null },
      });
    } catch (err: any) {
      console.error('Error al listar expedientes revisados:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al listar expedientes revisados.' });
    }
  });

  // Enviar expediente a revisión (solo creador con crear-expediente)
  app.post('/api/expedientes/:id/enviar-revision', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['crear-expediente']), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
      const repo = AppDataSource.getRepository(Expediente);
      const exp = await repo.findOne({ where: { id, usuarioId: userId } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      if (exp.estado !== 'abierto' && exp.estado !== 'rechazado') return res.status(400).json({ message: 'Solo se puede enviar a revisión un expediente en estado abierto o rechazado (tras corrección).' });
      exp.estado = 'en_proceso';
      exp.comentarioRechazo = null;
      await repo.save(exp);
      res.json(exp);
    } catch (err: any) {
      console.error('Error al enviar expediente a revisión:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al enviar.' });
    }
  });

  // Aprobar expediente (Dirección Departamental). Acepta body.comentario opcional para la bitácora.
  app.post('/api/expedientes/:id/aprobar', verifyToken, authorizeRolesOrPermissions(['super administrador', 'revisar-siaf-direccion-departamental'], ['revisar-expediente-direccion-departamental']), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
      const body = (req as any).body || {};
      const comentarioAprobacion = typeof body.comentario === 'string' ? body.comentario.trim() || null : null;
      const repo = AppDataSource.getRepository(Expediente);
      const exp = await repo.findOne({ where: { id } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      if (exp.estado !== 'en_proceso') return res.status(400).json({ message: 'Solo se puede aprobar un expediente en revisión.' });
      exp.estado = 'cerrado';
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      exp.fechaCierre = hoy;
      exp.comentarioRechazo = null;
      await repo.save(exp);
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: userId });
      if (user) {
        const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
        const bitacora = bitacoraRepo.create({
          expedienteId: id,
          tipo: 'aprobacion',
          usuarioId: userId,
          usuario: user,
          comentario: comentarioAprobacion || 'Aprobado por Dirección Departamental.',
        });
        await bitacoraRepo.save(bitacora);
      }
      res.json(exp);
    } catch (err: any) {
      console.error('Error al aprobar expediente:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al aprobar.' });
    }
  });

  // Rechazar expediente (Dirección Departamental). Acepta comentario general y comentarios por documento; registra bitácora.
  app.post('/api/expedientes/:id/rechazar', verifyToken, authorizeRolesOrPermissions(['super administrador', 'revisar-siaf-direccion-departamental'], ['revisar-expediente-direccion-departamental']), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
      const body = (req as any).body || {};
      const comentario = typeof body.comentario === 'string' ? body.comentario.trim() || null : null;
      const comentariosPorDocumento = Array.isArray(body.comentariosPorDocumento) ? body.comentariosPorDocumento : [];
      const repo = AppDataSource.getRepository(Expediente);
      const exp = await repo.findOne({ where: { id } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      if (exp.estado !== 'en_proceso') return res.status(400).json({ message: 'Solo se puede rechazar un expediente en revisión.' });
      exp.estado = 'rechazado';
      const resumenRechazo = comentario || (comentariosPorDocumento.length > 0 ? 'Rechazado con observaciones por documento.' : null);
      exp.comentarioRechazo = resumenRechazo;
      await repo.save(exp);
      const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
      const bitacora = bitacoraRepo.create({
        expedienteId: id,
        tipo: 'rechazo',
        usuarioId: userId,
        comentario: comentario ?? null,
      } as any);
      const saved = await bitacoraRepo.save(bitacora);
      const bitacoraGuardada = Array.isArray(saved) ? saved[0] : saved;
      const detalleRepo = AppDataSource.getRepository(ExpedienteBitacoraDetalle);
      const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
      for (const item of comentariosPorDocumento) {
        const docId = item.documentoId != null ? parseInt(String(item.documentoId), 10) : NaN;
        const texto = typeof item.comentario === 'string' ? item.comentario.trim() : '';
        if (!isNaN(docId) && texto) {
          const doc = await docRepo.findOne({ where: { id: docId, expedienteId: id } });
          if (doc) {
            const pagina = item.pagina != null ? parseInt(String(item.pagina), 10) : null;
            const xPercent = item.xPercent != null ? Number(item.xPercent) : null;
            const yPercent = item.yPercent != null ? Number(item.yPercent) : null;
            const det = detalleRepo.create({
              bitacoraId: bitacoraGuardada.id,
              expedienteDocumentoId: docId,
              nombreDocumento: doc.nombreArchivo || null,
              comentario: texto,
              pagina: pagina ?? undefined,
              xPercent: xPercent ?? undefined,
              yPercent: yPercent ?? undefined,
            } as any);
            await detalleRepo.save(det);
          }
        }
      }
      res.json(exp);
    } catch (err: any) {
      console.error('Error al rechazar expediente:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al rechazar.' });
    }
  });

  // Actualizar expediente (solo si no está aprobado/cerrado/archivado)
  app.put('/api/expedientes/:id', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
      const { tipoExpediente, titulo, descripcion } = req.body || {};
      const repo = AppDataSource.getRepository(Expediente);
      const exp = await repo.findOne({ where: { id, usuarioId: userId } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      const estadosNoEditables = ['en_proceso', 'cerrado', 'aprobado', 'archivado'];
      if (estadosNoEditables.includes(exp.estado)) return res.status(400).json({ message: exp.estado === 'en_proceso' ? 'No se puede editar el expediente mientras está en revisión. Espere aprobación o rechazo.' : 'No se puede editar un expediente ya aprobado o cerrado.' });
      const tipo = typeof tipoExpediente === 'string' ? tipoExpediente.trim() : exp.tipoExpediente;
      const tit = typeof titulo === 'string' ? titulo.trim() : exp.titulo;
      if (tit && !TITULOS_EXPEDIENTE_VALIDOS.includes(tit)) return res.status(400).json({ message: 'El título debe ser "Bien/Producto" o "Servicio".' });
      const nuevoTipo = tipo || exp.tipoExpediente;
      const nuevoTit = tit || exp.titulo;
      const nuevaDesc = typeof descripcion === 'string' ? descripcion.trim() || null : exp.descripcion;
      await repo.update(
        { id, usuarioId: userId },
        { tipoExpediente: nuevoTipo, titulo: nuevoTit, descripcion: nuevaDesc } as any
      );
      const actualizado = await repo.findOne({ where: { id } });
      res.json(actualizado ?? exp);
    } catch (err: any) {
      console.error('Error al actualizar expediente:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al actualizar expediente.' });
    }
  });

  // Expediente por ID (con documentos) — del usuario o en revisión por DD
  app.get('/api/expedientes/:id', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      const userPermissions: string[] = (req as any).user?.permissions ?? [];
      const userRoles: string[] = (req as any).user?.roles ?? [];
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
      const repo = AppDataSource.getRepository(Expediente);
      let exp = await repo.findOne({
        where: { id },
        relations: ['documentos', 'documentos.subidoPor', 'usuario'],
      });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      const esPropietario = exp.usuarioId === userId;
      const esAnalistaDAF = userPermissions.includes('revisar-expediente-direccion-departamental') || userRoles.includes('revisar-siaf-direccion-departamental');
      const puedeRevisar = esAnalistaDAF && (exp.estado === 'en_proceso' || exp.estado === 'rechazado' || exp.estado === 'cerrado');
      if (!esPropietario && !puedeRevisar) return res.status(403).json({ message: 'No tiene acceso a este expediente.' });
      let ultimoRechazo: any = null;
      const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
      const bitacoraRechazo = await bitacoraRepo.findOne({
        where: { expedienteId: id, tipo: 'rechazo' },
        relations: ['detalle', 'detalle.expedienteDocumento', 'usuario'],
        order: { fecha: 'DESC' },
      });
      const idsEnUltimoRechazo = new Set<number>();
      if (bitacoraRechazo) {
        (bitacoraRechazo.detalle || []).forEach((d: any) => { if (d.expedienteDocumentoId != null) idsEnUltimoRechazo.add(d.expedienteDocumentoId); });
        const fechaRechazo = bitacoraRechazo.fecha ? new Date(bitacoraRechazo.fecha).getTime() : 0;
        const correccionesPosteriores = await bitacoraRepo.find({
          where: { expedienteId: id, tipo: 'correccion' },
          order: { fecha: 'ASC' },
        });
        const docIdToVersionId = new Map<number, number>();
        for (const c of correccionesPosteriores) {
          if (c.expedienteDocumentoVersionId != null && c.expedienteDocumentoId != null && c.fecha && new Date(c.fecha).getTime() > fechaRechazo && !docIdToVersionId.has(c.expedienteDocumentoId)) {
            docIdToVersionId.set(c.expedienteDocumentoId, c.expedienteDocumentoVersionId);
          }
        }
        ultimoRechazo = {
          id: bitacoraRechazo.id,
          fecha: bitacoraRechazo.fecha,
          comentario: bitacoraRechazo.comentario,
          usuario: bitacoraRechazo.usuario ? { nombres: bitacoraRechazo.usuario.nombres, apellidos: bitacoraRechazo.usuario.apellidos } : null,
          detalle: (bitacoraRechazo.detalle || []).map((d: any) => ({
            expedienteDocumentoId: d.expedienteDocumentoId,
            nombreDocumento: d.expedienteDocumento?.nombreArchivo || d.expedienteDocumento?.tipoDocumento || d.nombreDocumento || '',
            comentario: d.comentario,
            pagina: d.pagina != null ? Number(d.pagina) : null,
            xPercent: d.xPercent != null ? Number(d.xPercent) : null,
            yPercent: d.yPercent != null ? Number(d.yPercent) : null,
            documentoVersionIdParaMarca: d.expedienteDocumentoId != null ? docIdToVersionId.get(d.expedienteDocumentoId) : undefined,
          })),
        };
      }
      const expJson: any = { ...exp };
      if (expJson.documentos && Array.isArray(expJson.documentos)) {
        expJson.documentos = expJson.documentos.map((doc: any) => ({
          ...doc,
          enUltimoRechazo: idsEnUltimoRechazo.has(doc.id),
        }));
      }
      res.json({ ...expJson, ultimoRechazo });
    } catch (err: any) {
      console.error('Error al obtener expediente:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener expediente.' });
    }
  });

  // Bitácora del expediente (rechazos y aprobaciones) — mismo acceso que GET expediente
  app.get('/api/expedientes/:id/bitacora', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      const userPermissions: string[] = (req as any).user?.permissions ?? [];
      const userRoles: string[] = (req as any).user?.roles ?? [];
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID de expediente inválido.' });
      const expRepo = AppDataSource.getRepository(Expediente);
      const exp = await expRepo.findOne({ where: { id } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      const esPropietario = exp.usuarioId === userId;
      const esAnalistaDAF = userPermissions.includes('revisar-expediente-direccion-departamental') || userRoles.includes('revisar-siaf-direccion-departamental');
      const puedeVerBitacora = esPropietario || (esAnalistaDAF && (exp.estado === 'en_proceso' || exp.estado === 'rechazado' || exp.estado === 'cerrado'));
      if (!puedeVerBitacora) return res.status(403).json({ message: 'No tiene acceso a la bitácora de este expediente.' });
      const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
      // Incluir todos los tipos: rechazo, aprobacion, correccion (reemplazo de documento)
      let filas = await bitacoraRepo.find({
        where: { expedienteId: id },
        relations: ['detalle', 'detalle.expedienteDocumento', 'usuario'],
        order: { fecha: 'DESC' },
      });

      // Si el expediente está rechazado pero no hay registros en bitácora (rechazo anterior a la implementación de bitácora),
      // se arma una entrada de respaldo a partir de comentarioRechazo para que el usuario vea el motivo.
      if ((!filas || filas.length === 0) && exp.estado === 'rechazado') {
        const fechaRef = exp.updatedAt || exp.createdAt || new Date();
        filas = [{
          id: 0,
          tipo: 'rechazo',
          fecha: fechaRef,
          comentario: (exp as any).comentarioRechazo || 'Expediente rechazado. (Registro anterior a la bitácora; el motivo puede estar en el detalle del expediente.)',
          usuario: null,
          detalle: [],
        }] as any;
      }

      const fechaRechazo = (b: any) => b.fecha ? new Date(b.fecha).getTime() : 0;
      const docIdsCorreccion = [...new Set((filas || []).filter((f: any) => f.tipo === 'correccion' && f.expedienteDocumentoId != null).map((f: any) => f.expedienteDocumentoId))];
      const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
      const docsCorreccion = docIdsCorreccion.length > 0
        ? await docRepo.find({ where: { id: In(docIdsCorreccion) }, select: ['id', 'nombreArchivo', 'mimeType', 'tipoDocumento'] })
        : [];
      const docCorreccionMap = new Map(docsCorreccion.map((d: any) => [d.id, { nombreArchivo: d.nombreArchivo || d.tipoDocumento || 'Documento', mimeType: d.mimeType || 'application/octet-stream' }]));
      const versionIdsCorreccion = [...new Set((filas || []).filter((f: any) => f.tipo === 'correccion' && f.expedienteDocumentoVersionId != null).map((f: any) => f.expedienteDocumentoVersionId))];
      const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
      const versionesReemplazadas = versionIdsCorreccion.length > 0
        ? await versionRepo.find({ where: { id: In(versionIdsCorreccion) }, select: ['id', 'nombreArchivo', 'mimeType'] })
        : [];
      const versionReemplazadaMap = new Map(versionesReemplazadas.map((v: any) => [v.id, { versionId: v.id, nombreArchivo: v.nombreArchivo || 'Documento', mimeType: v.mimeType || 'application/octet-stream' }]));
      const bitacora = (filas || []).map((b: any) => {
        const esRechazo = b.tipo === 'rechazo';
        const esCorreccion = b.tipo === 'correccion';
        const docActual = esCorreccion && b.expedienteDocumentoId != null ? docCorreccionMap.get(b.expedienteDocumentoId) : null;
        const docReemplazado = esCorreccion && b.expedienteDocumentoVersionId != null ? versionReemplazadaMap.get(b.expedienteDocumentoVersionId) : null;
        return {
          id: b.id,
          tipo: b.tipo,
          fecha: b.fecha,
          comentario: b.comentario ?? null,
          usuario: b.usuario ? { nombres: b.usuario.nombres, apellidos: b.usuario.apellidos } : null,
          expedienteDocumentoId: b.expedienteDocumentoId ?? null,
          documentoReemplazo: docActual ?? undefined,
          documentoReemplazado: docReemplazado ?? undefined,
          detalle: (b.detalle || []).map((d: any) => {
            const docId = d.expedienteDocumentoId;
            const correccionesPosteriores = (filas || []).filter((f: any) =>
              esRechazo && f.tipo === 'correccion' && f.expedienteDocumentoId === docId && fechaRechazo(f) > fechaRechazo(b)
            );
            const correccionQueReemplazoRechazado = correccionesPosteriores.length > 0
              ? correccionesPosteriores.reduce((min: any, f: any) => fechaRechazo(f) < fechaRechazo(min) ? f : min)
              : null;
            const corregido = !!correccionQueReemplazoRechazado;
            const rawVersionId = correccionQueReemplazoRechazado?.expedienteDocumentoVersionId;
            const documentoVersionIdParaMarca = (corregido && rawVersionId != null && Number(rawVersionId) > 0)
              ? Number(rawVersionId)
              : undefined;
            return {
              expedienteDocumentoId: docId,
              nombreDocumento: d.nombreDocumento || d.expedienteDocumento?.nombreArchivo || d.expedienteDocumento?.tipoDocumento || 'Documento',
              mimeType: d.expedienteDocumento?.mimeType || 'application/octet-stream',
              comentario: d.comentario || '',
              pagina: d.pagina != null ? Number(d.pagina) : null,
              xPercent: d.xPercent != null ? Number(d.xPercent) : null,
              yPercent: d.yPercent != null ? Number(d.yPercent) : null,
              corregido,
              documentoVersionIdParaMarca,
            };
          }),
        };
      });
      res.json(bitacora);
    } catch (err: any) {
      console.error('Error al obtener bitácora del expediente:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener bitácora.' });
    }
  });

  // Listar documentos de un expediente (incluido en GET /expedientes/:id)
  // Subir documento a un expediente
  app.post('/api/expedientes/:id/documentos', verifyToken, uploadMemory.single('archivo'), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const expedienteId = parseInt(req.params.id);
      if (isNaN(expedienteId)) return res.status(400).json({ message: 'ID de expediente inválido.' });
      const file = (req as any).file;
      if (!file || !file.buffer) return res.status(400).json({ message: 'Debe enviar un archivo (campo "archivo").' });
      const expRepo = AppDataSource.getRepository(Expediente);
      const exp = await expRepo.findOne({ where: { id: expedienteId } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      if (exp.usuarioId !== userId) return res.status(403).json({ message: 'No puede agregar documentos a este expediente.' });
      if (exp.estado === 'en_proceso') return res.status(400).json({ message: 'No puede agregar documentos mientras el expediente está en revisión. Espere aprobación o rechazo.' });
      const tipoDocumento = typeof (req as any).body?.tipoDocumento === 'string' ? (req as any).body.tipoDocumento.trim() : 'Otro';
      const descripcionDoc = typeof (req as any).body?.descripcion === 'string' ? (req as any).body.descripcion.trim() || null : null;
      const nombreOriginal = file.originalname || `documento-${Date.now()}`;
      const pdfInfo = await fileStorageService.saveExpedienteDocument(file.buffer, exp.numeroExpediente, nombreOriginal);
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: userId });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
      const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
      const doc = docRepo.create({
        expedienteId: exp.id,
        expediente: exp,
        tipoDocumento: tipoDocumento || 'Otro',
        nombreArchivo: nombreOriginal,
        rutaArchivo: pdfInfo.filePath,
        mimeType: file.mimetype || 'application/octet-stream',
        tamanioBytes: pdfInfo.size,
        hashArchivo: pdfInfo.hash,
        subidoPorId: userId,
        subidoPor: user,
        descripcion: descripcionDoc,
      });
      await docRepo.save(doc);
      const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
      const v1 = versionRepo.create({
        expedienteDocumentoId: doc.id,
        expedienteDocumento: doc,
        numeroVersion: 1,
        nombreArchivo: nombreOriginal,
        rutaArchivo: pdfInfo.filePath,
        hashArchivo: pdfInfo.hash,
        tamanioBytes: pdfInfo.size,
        mimeType: file.mimetype || 'application/octet-stream',
        subidoPorId: userId,
        subidoPor: user,
      });
      await versionRepo.save(v1);
      res.status(201).json(doc);
    } catch (err: any) {
      console.error('Error al subir documento al expediente:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al subir el documento.' });
    }
  });

  // Reemplazar documento (sube nueva versión y guarda la anterior como respaldo)
  app.post('/api/expedientes/:id/documentos/:docId/reemplazar', verifyToken, uploadMemory.single('archivo'), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const expedienteId = parseInt(req.params.id);
      const docId = parseInt(req.params.docId);
      if (isNaN(expedienteId) || isNaN(docId)) return res.status(400).json({ message: 'Parámetros inválidos.' });
      const file = (req as any).file;
      if (!file || !file.buffer) return res.status(400).json({ message: 'Debe enviar un archivo (campo "archivo").' });
      const expRepo = AppDataSource.getRepository(Expediente);
      const exp = await expRepo.findOne({ where: { id: expedienteId } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      if (exp.usuarioId !== userId) return res.status(403).json({ message: 'No puede reemplazar documentos de este expediente.' });
      if (exp.estado === 'en_proceso') return res.status(400).json({ message: 'No puede reemplazar documentos mientras el expediente está en revisión.' });
      const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
      const doc = await docRepo.findOne({ where: { id: docId, expedienteId } });
      if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: userId });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
      const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
      const versionesExistentes = await versionRepo.find({ where: { expedienteDocumentoId: docId }, order: { numeroVersion: 'DESC' }, take: 1 });
      const siguienteVersion = versionesExistentes.length > 0 ? (versionesExistentes[0].numeroVersion + 1) : 1;
      const nombreAnterior = doc.nombreArchivo;
      const versionAnterior = versionRepo.create({
        expedienteDocumentoId: docId,
        numeroVersion: siguienteVersion,
        nombreArchivo: doc.nombreArchivo,
        rutaArchivo: doc.rutaArchivo,
        hashArchivo: doc.hashArchivo,
        tamanioBytes: Number(doc.tamanioBytes),
        mimeType: doc.mimeType,
        subidoPorId: doc.subidoPorId,
        subidoPor: doc.subidoPor,
      });
      const versionGuardada = await versionRepo.save(versionAnterior);
      const nombreOriginal = file.originalname || doc.nombreArchivo || `documento-${Date.now()}`;
      const pdfInfo = await fileStorageService.saveExpedienteDocument(file.buffer, exp.numeroExpediente, nombreOriginal);
      doc.nombreArchivo = nombreOriginal;
      doc.rutaArchivo = pdfInfo.filePath;
      doc.hashArchivo = pdfInfo.hash;
      doc.tamanioBytes = pdfInfo.size;
      doc.mimeType = file.mimetype || 'application/octet-stream';
      doc.subidoPorId = userId;
      doc.subidoPor = user;
      await docRepo.save(doc);

      // Registrar corrección en la bitácora (documento reemplazado; guardamos la versión que quedó como respaldo)
      const bitacoraRepo = AppDataSource.getRepository(ExpedienteBitacora);
      const bitacoraCorreccion = bitacoraRepo.create({
        expedienteId,
        tipo: 'correccion',
        usuarioId: userId,
        usuario: user,
        comentario: `Documento «${nombreAnterior}» reemplazado por «${nombreOriginal}».`,
        expedienteDocumentoId: docId,
        expedienteDocumentoVersionId: versionGuardada.id,
      });
      await bitacoraRepo.save(bitacoraCorreccion);

      res.json(doc);
    } catch (err: any) {
      console.error('Error al reemplazar documento:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al reemplazar el documento.' });
    }
  });

  // Listar versiones de un documento (respaldo de cada subida/reemplazo)
  app.get('/api/expedientes/:id/documentos/:docId/versiones', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      const userPermissions: string[] = (req as any).user?.permissions ?? [];
      const userRoles: string[] = (req as any).user?.roles ?? [];
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const expedienteId = parseInt(req.params.id);
      const docId = parseInt(req.params.docId);
      if (isNaN(expedienteId) || isNaN(docId)) return res.status(400).json({ message: 'Parámetros inválidos.' });
      const expRepo = AppDataSource.getRepository(Expediente);
      const exp = await expRepo.findOne({ where: { id: expedienteId } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      const esPropietario = exp.usuarioId === userId;
      const puedeRevisar = (userPermissions.includes('revisar-expediente-direccion-departamental') || userRoles.includes('revisar-siaf-direccion-departamental')) && exp.estado === 'en_proceso';
      if (!esPropietario && !puedeRevisar) return res.status(403).json({ message: 'No tiene acceso a este expediente.' });
      const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
      const versiones = await versionRepo.find({
        where: { expedienteDocumentoId: docId },
        relations: ['subidoPor'],
        order: { numeroVersion: 'DESC' },
      });
      const list = versiones.map((v: any) => ({
        id: v.id,
        numeroVersion: v.numeroVersion,
        nombreArchivo: v.nombreArchivo,
        fechaSubida: v.fechaSubida,
        tamanioBytes: v.tamanioBytes,
        subidoPor: v.subidoPor ? { nombres: v.subidoPor.nombres, apellidos: v.subidoPor.apellidos } : null,
      }));
      res.json(list);
    } catch (err: any) {
      console.error('Error al listar versiones:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al listar versiones.' });
    }
  });

  // Descargar archivo de una versión concreta (respaldo)
  app.get('/api/expedientes/:id/documentos/:docId/versiones/:versionId/archivo', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      const userPermissions: string[] = (req as any).user?.permissions ?? [];
      const userRoles: string[] = (req as any).user?.roles ?? [];
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const expedienteId = parseInt(req.params.id);
      const docId = parseInt(req.params.docId);
      const versionId = parseInt(req.params.versionId);
      if (isNaN(expedienteId) || isNaN(docId) || isNaN(versionId)) return res.status(400).json({ message: 'Parámetros inválidos.' });
      const expRepo = AppDataSource.getRepository(Expediente);
      const exp = await expRepo.findOne({ where: { id: expedienteId } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      const esPropietario = exp.usuarioId === userId;
      const esAnalistaDAF = userPermissions.includes('revisar-expediente-direccion-departamental') || userRoles.includes('revisar-siaf-direccion-departamental');
      const puedeRevisar = esAnalistaDAF && (exp.estado === 'en_proceso' || exp.estado === 'rechazado' || exp.estado === 'cerrado');
      if (!esPropietario && !puedeRevisar) return res.status(403).json({ message: 'No tiene acceso a este expediente.' });
      const versionRepo = AppDataSource.getRepository(ExpedienteDocumentoVersion);
      const version = await versionRepo.findOne({ where: { id: versionId, expedienteDocumentoId: docId } });
      if (!version) return res.status(404).json({ message: 'Versión no encontrada.' });
      const buffer = await fileStorageService.readExpedienteDocument(version.rutaArchivo);
      const fileName = version.nombreArchivo || `v${version.numeroVersion}`;
      res.setHeader('Content-Type', version.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.send(buffer);
    } catch (err: any) {
      if (err?.message === 'Archivo no encontrado') return res.status(404).json({ message: 'Archivo no encontrado.' });
      console.error('Error al servir archivo de versión:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener el archivo.' });
    }
  });

  // Descargar/visualizar archivo de un documento del expediente (creador o analista DAF si está en revisión/rechazado/cerrado)
  app.get('/api/expedientes/:id/documentos/:docId/archivo', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      const userPermissions: string[] = (req as any).user?.permissions ?? [];
      const userRoles: string[] = (req as any).user?.roles ?? [];
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const expedienteId = parseInt(req.params.id);
      const docId = parseInt(req.params.docId);
      if (isNaN(expedienteId) || isNaN(docId)) return res.status(400).json({ message: 'Parámetros inválidos.' });
      const expRepo = AppDataSource.getRepository(Expediente);
      const exp = await expRepo.findOne({ where: { id: expedienteId } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      const esPropietario = exp.usuarioId === userId;
      const esAnalistaDAF = userPermissions.includes('revisar-expediente-direccion-departamental') || userRoles.includes('revisar-siaf-direccion-departamental');
      const puedeRevisar = esAnalistaDAF && (exp.estado === 'en_proceso' || exp.estado === 'rechazado' || exp.estado === 'cerrado');
      if (!esPropietario && !puedeRevisar) return res.status(403).json({ message: 'No tiene acceso a este expediente.' });
      const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
      const doc = await docRepo.findOne({ where: { id: docId, expedienteId } });
      if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
      const buffer = await fileStorageService.readExpedienteDocument(doc.rutaArchivo);
      const fileName = doc.nombreArchivo || `documento-${docId}`;
      res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.send(buffer);
    } catch (err: any) {
      if (err?.message === 'Archivo no encontrado') return res.status(404).json({ message: 'Archivo no encontrado.' });
      console.error('Error al servir archivo:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener el archivo.' });
    }
  });

  // Eliminar documento de un expediente
  app.delete('/api/expedientes/:id/documentos/:docId', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Usuario no identificado.' });
      const expedienteId = parseInt(req.params.id);
      const docId = parseInt(req.params.docId);
      if (isNaN(expedienteId) || isNaN(docId)) return res.status(400).json({ message: 'Parámetros inválidos.' });
      const expRepo = AppDataSource.getRepository(Expediente);
      const exp = await expRepo.findOne({ where: { id: expedienteId } });
      if (!exp) return res.status(404).json({ message: 'Expediente no encontrado.' });
      if (exp.usuarioId !== userId) return res.status(403).json({ message: 'No puede eliminar documentos de este expediente.' });
      if (exp.estado === 'en_proceso') return res.status(400).json({ message: 'No puede eliminar documentos mientras el expediente está en revisión. Espere aprobación o rechazo.' });
      const docRepo = AppDataSource.getRepository(ExpedienteDocumento);
      const doc = await docRepo.findOne({ where: { id: docId, expedienteId } });
      if (!doc) return res.status(404).json({ message: 'Documento no encontrado.' });
      await fileStorageService.deleteExpedienteDocument(doc.rutaArchivo);
      await docRepo.remove(doc);
      res.status(204).send();
    } catch (err: any) {
      console.error('Error al eliminar documento:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al eliminar el documento.' });
    }
  });

  // User endpoints (solo super administrador o gestionar-usuarios)
  app.get('/api/users', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
    try {
      const userRepository = AppDataSource.getRepository(User);
      const users = await userRepository.find({
        relations: ['puesto', 'roles', 'roles.permissions'],
        order: { nombres: 'ASC' }
      });
      res.json(users);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      res.status(500).json({ message: 'Error al obtener usuarios' });
    }
  });

  // Restablecer contraseña de un usuario (debe ir antes de GET /api/users/:id)
  app.post('/api/users/:id/reset-password', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID de usuario inválido.' });
      const userRepository = AppDataSource.getRepository(User);
      const credentialRepository = AppDataSource.getRepository(Credential);
      const user = await userRepository.findOne({ where: { id } });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
      let credential = await credentialRepository.findOne({ where: { userId: id } });
      const newPassword = '123';
      const hashed = await bcrypt.hash(newPassword, 10);
      if (credential) {
        credential.password = hashed;
        credential.isTempPassword = true;
        await credentialRepository.save(credential);
      } else {
        credential = credentialRepository.create({
          codigoEmpleado: user.codigoEmpleado || `user-${id}`,
          password: hashed,
          userId: id,
          isTempPassword: true,
        });
        await credentialRepository.save(credential);
      }
      res.json({ message: 'Contraseña restablecida correctamente. La nueva contraseña es: 123' });
    } catch (err: any) {
      console.error('Error al restablecer contraseña:', err);
      res.status(500).json({ message: err?.message || 'Error al restablecer la contraseña.' });
    }
  });

  app.get('/api/users/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
    try {
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: parseInt(req.params.id) },
        relations: ['puesto', 'roles', 'roles.permissions']
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      res.status(500).json({ message: 'Error al obtener usuario' });
    }
  });

  // Roles de un usuario (para Gestión de Roles: asignar varios roles a un colaborador)
  app.get('/api/users/:id/roles', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['roles', 'roles.permissions'],
      });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
      res.json({ roles: user.roles ?? [] });
    } catch (error) {
      console.error('Error al obtener roles del usuario:', error);
      res.status(500).json({ message: 'Error al obtener roles del usuario' });
    }
  });

  app.put('/api/users/:id/roles', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles', 'gestionar-usuarios']), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { roleIds } = req.body as { roleIds: number[] };
      const userRepository = AppDataSource.getRepository(User);
      const roleRepository = AppDataSource.getRepository(Role);
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['roles'],
      });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
      const roles = Array.isArray(roleIds) && roleIds.length > 0
        ? await roleRepository.find({ where: { id: In(roleIds) } })
        : [];
      user.roles = roles;
      await userRepository.save(user);
      res.json({ roles: user.roles });
    } catch (error) {
      console.error('Error al actualizar roles del usuario:', error);
      res.status(500).json({ message: 'Error al actualizar roles del usuario' });
    }
  });

  app.post('/api/users', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
    try {
      const { nombres, apellidos, dpi, nit, telefono, correoInstitucional, codigoEmpleado, renglon, puestoId, unidadMedica, departamentoDireccion } = req.body;
      const userRepository = AppDataSource.getRepository(User);
      const credentialRepository = AppDataSource.getRepository(Credential);
      const puestoRepository = AppDataSource.getRepository(Puesto);
      if (!puestoId) return res.status(400).json({ message: 'Puesto es requerido' });
      const puesto = await puestoRepository.findOneBy({ id: puestoId });
      if (!puesto) return res.status(400).json({ message: 'Puesto no encontrado' });
      const hashed = await bcrypt.hash('TempPass123!', 10);
      const user = userRepository.create({
        nombres,
        apellidos,
        dpi,
        nit,
        telefono,
        correoInstitucional,
        codigoEmpleado,
        renglon,
        puesto,
        unidadMedica,
        departamentoDireccion: departamentoDireccion === '' || departamentoDireccion == null ? null : String(departamentoDireccion),
        roles: [],
      });
      const savedUser = await userRepository.save(user);
      const cred = credentialRepository.create({
        codigoEmpleado,
        password: hashed,
        userId: savedUser.id,
        isTempPassword: true,
      });
      await credentialRepository.save(cred);
      res.status(201).json(savedUser);
    } catch (error: any) {
      console.error('Error al crear usuario:', error);
      res.status(500).json({ message: error?.message || 'Error al crear usuario' });
    }
  });

  app.put('/api/users/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { nombres, apellidos, dpi, nit, telefono, correoInstitucional, codigoEmpleado, renglon, puestoId, unidadMedica, departamentoDireccion } = req.body;
      const userRepository = AppDataSource.getRepository(User);
      const puestoRepository = AppDataSource.getRepository(Puesto);
      const user = await userRepository.findOne({ where: { id }, relations: ['puesto', 'roles'] });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
      if (nombres != null) user.nombres = nombres;
      if (apellidos != null) user.apellidos = apellidos;
      if (dpi != null) user.dpi = dpi;
      if (nit != null) user.nit = nit;
      if (telefono != null) user.telefono = telefono;
      if (correoInstitucional != null) user.correoInstitucional = correoInstitucional;
      if (codigoEmpleado != null) user.codigoEmpleado = codigoEmpleado;
      if (renglon != null) user.renglon = renglon;
      if (unidadMedica != null) user.unidadMedica = unidadMedica;
      if (departamentoDireccion !== undefined) user.departamentoDireccion = departamentoDireccion === '' || departamentoDireccion === null ? null : String(departamentoDireccion);
      if (puestoId != null) {
        const puesto = await puestoRepository.findOneBy({ id: puestoId });
        if (puesto) user.puesto = puesto;
      }
      await userRepository.save(user);
      res.json(user);
    } catch (error: any) {
      console.error('Error al actualizar usuario:', error);
      res.status(500).json({ message: error?.message || 'Error al actualizar usuario' });
    }
  });

  app.delete('/api/users/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id } });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
      await userRepository.remove(user);
      res.status(204).send();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      res.status(500).json({ message: 'Error al eliminar usuario' });
    }
  });

  app.get('/api/users/director/:unidadMedica', verifyToken, async (req: Request, res: Response) => {
    try {
      const { unidadMedica } = req.params;
      const userRepository = AppDataSource.getRepository(User);

      const director = await userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.puesto', 'puesto')
        .where('user.unidadMedica = :unidadMedica', { unidadMedica })
        .andWhere('puesto.nombre ILIKE :puestoNombre', { puestoNombre: '%DIRECTOR%' })
        .getOne();

      if (!director) {
        return res.status(404).json({ message: `No se encontró un director para la unidad: ${unidadMedica}` });
      }

      res.json(director);
    } catch (error) {
      console.error('Error al buscar director:', error);
      res.status(500).json({ message: 'Error en el servidor al buscar director' });
    }
  });

  /** Personal de la unidad con puesto que contenga "Médico" (para elegir Encargado del Despacho). */
  app.get('/api/users/medicos-por-unidad/:unidadMedica', verifyToken, async (req: Request, res: Response) => {
    try {
      const { unidadMedica } = req.params;
      const userRepository = AppDataSource.getRepository(User);
      const medicos = await userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.puesto', 'puesto')
        .where('user.unidadMedica = :unidadMedica', { unidadMedica: decodeURIComponent(unidadMedica) })
        .andWhere('(puesto.nombre ILIKE :patron)', { patron: '%médico%' })
        .orderBy('user.apellidos', 'ASC')
        .addOrderBy('user.nombres', 'ASC')
        .getMany();
      res.json(medicos);
    } catch (error) {
      console.error('Error al listar médicos por unidad:', error);
      res.status(500).json({ message: 'Error en el servidor al listar personal médico.' });
    }
  });

  // Puestos: GET lista (para dropdown en Gestión de Usuarios) permite también gestionar-usuarios; resto solo super admin o gestionar-puestos
  app.get('/api/puestos', verifyToken, authorizeRoles(['super administrador', 'gestionar-puestos', 'gestionar-usuarios']), async (req: Request, res: Response) => {
    try {
      const puestoRepository = AppDataSource.getRepository(Puesto);
      const puestos = await puestoRepository.find({ order: { nombre: 'ASC' } });
      res.json(puestos);
    } catch (error) {
      console.error('Error al obtener puestos:', error);
      res.status(500).json({ message: 'Error al obtener puestos' });
    }
  });

  app.get('/api/puestos/all', verifyToken, authorizeRoles(['super administrador', 'gestionar-puestos']), async (req: Request, res: Response) => {
    try {
      const puestoRepository = AppDataSource.getRepository(Puesto);
      const puestos = await puestoRepository.find({ order: { nombre: 'ASC' } });
      res.json(puestos);
    } catch (error) {
      console.error('Error al obtener puestos:', error);
      res.status(500).json({ message: 'Error al obtener puestos' });
    }
  });

  app.post('/api/puestos', verifyToken, authorizeRoles(['super administrador', 'gestionar-puestos']), async (req: Request, res: Response) => {
    try {
      const { nombre, activo } = req.body;
      const puestoRepository = AppDataSource.getRepository(Puesto);
      const puesto = puestoRepository.create({ nombre, activo: activo !== false });
      await puestoRepository.save(puesto);
      res.status(201).json(puesto);
    } catch (error) {
      console.error('Error al crear puesto:', error);
      res.status(500).json({ message: 'Error al crear puesto' });
    }
  });

  app.put('/api/puestos/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-puestos']), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { nombre, activo } = req.body;
      const puestoRepository = AppDataSource.getRepository(Puesto);
      const puesto = await puestoRepository.findOneBy({ id });
      if (!puesto) return res.status(404).json({ message: 'Puesto no encontrado' });
      if (nombre != null) puesto.nombre = nombre;
      if (activo != null) puesto.activo = activo;
      await puestoRepository.save(puesto);
      res.json(puesto);
    } catch (error) {
      console.error('Error al actualizar puesto:', error);
      res.status(500).json({ message: 'Error al actualizar puesto' });
    }
  });

  app.delete('/api/puestos/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-puestos']), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const puestoRepository = AppDataSource.getRepository(Puesto);
      const puesto = await puestoRepository.findOneBy({ id });
      if (!puesto) return res.status(404).json({ message: 'Puesto no encontrado' });
      await puestoRepository.remove(puesto);
      res.status(204).send();
    } catch (error) {
      console.error('Error al eliminar puesto:', error);
      res.status(500).json({ message: 'Error al eliminar puesto' });
    }
  });

  // Departamentos (para asociar a unidades médicas y usuarios DD)
  app.get('/api/departamentos', verifyToken, async (req: Request, res: Response) => {
    try {
      const repo = AppDataSource.getRepository(Departamento);
      const list = await repo.find({ order: { nombre: 'ASC' } });
      res.json(list);
    } catch (error) {
      console.error('Error al obtener departamentos:', error);
      res.status(500).json({ message: 'Error al obtener departamentos' });
    }
  });

  // Municipios (opcional: ?departamentoId= para filtrar por departamento)
  app.get('/api/municipios', verifyToken, async (req: Request, res: Response) => {
    try {
      const repo = AppDataSource.getRepository(Municipio);
      const departamentoId = req.query.departamentoId ? parseInt(String(req.query.departamentoId)) : undefined;
      if (departamentoId && !isNaN(departamentoId)) {
        const list = await repo.find({
          where: { departamento: { id: departamentoId } },
          order: { nombre: 'ASC' },
          relations: ['departamento'],
        });
        return res.json(list);
      }
      const list = await repo.find({ order: { nombre: 'ASC' }, relations: ['departamento'] });
      res.json(list);
    } catch (error) {
      console.error('Error al obtener municipios:', error);
      res.status(500).json({ message: 'Error al obtener municipios' });
    }
  });

  // Unidades médicas (incluye municipio y departamento para mostrar/asignar)
  app.get('/api/unidades-medicas', verifyToken, async (req: Request, res: Response) => {
    try {
      const unidadMedicaRepository = AppDataSource.getRepository(UnidadMedica);
      const unidades = await unidadMedicaRepository.find({
        order: { nombre: 'ASC' },
        relations: ['municipio', 'municipio.departamento'],
      });
      res.json(unidades);
    } catch (error) {
      console.error('Error al obtener unidades médicas:', error);
      res.status(500).json({ message: 'Error al obtener unidades médicas' });
    }
  });

  // Actualizar unidad médica (asociar municipio/departamento)
  app.put('/api/unidades-medicas/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-areas']), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID inválido' });
      const { municipioId, nombre, telefonos } = req.body;
      const repo = AppDataSource.getRepository(UnidadMedica);
      const unidad = await repo.findOne({ where: { id }, relations: ['municipio', 'municipio.departamento'] });
      if (!unidad) return res.status(404).json({ message: 'Unidad médica no encontrada' });
      if (nombre != null && String(nombre).trim()) unidad.nombre = String(nombre).trim();
      if (telefonos !== undefined) unidad.telefonos = telefonos ?? '';
      if (municipioId !== undefined) {
        if (municipioId == null || municipioId === '') {
          unidad.municipio = null;
          unidad.departamento = null;
        } else {
          const muniRepo = AppDataSource.getRepository(Municipio);
          const municipio = await muniRepo.findOne({ where: { id: Number(municipioId) }, relations: ['departamento'] });
          if (!municipio) return res.status(400).json({ message: 'Municipio no encontrado' });
          unidad.municipio = municipio;
          unidad.departamento = municipio.departamento?.nombre ?? null;
        }
      }
      await repo.save(unidad);
      res.json(unidad);
    } catch (error: any) {
      console.error('Error al actualizar unidad médica:', error);
      res.status(500).json({ message: error?.message || 'Error al actualizar unidad médica' });
    }
  });

  // Area Endpoints: GET lista (para dropdown en formulario SIAF) permite también crear-siaf y autorizar-siaf; gestión completa solo super admin o gestionar-areas
  app.get('/api/areas', verifyToken, authorizeRoles(['super administrador', 'gestionar-areas', 'crear-siaf', 'autorizar-siaf']), async (req: Request, res: Response) => {
    try {
      const areaRepository = AppDataSource.getRepository(Area);
      const areas = await areaRepository.find({ order: { nombre: 'ASC' } });
      res.json(areas);
    } catch (error) {
      console.error('Error al obtener áreas:', error);
      res.status(500).json({ message: 'Error en el servidor al obtener áreas' });
    }
  });

  app.post('/api/areas', verifyToken, authorizeRoles(['super administrador', 'gestionar-areas']), async (req: Request, res: Response) => {
    try {
      const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
      const descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : null;
      const activo = req.body.activo !== false;

      if (!nombre) {
        return res.status(400).json({ message: 'El nombre del área es obligatorio.' });
      }
      if (nombre.length > 200) {
        return res.status(400).json({ message: 'El nombre del área no puede superar 200 caracteres.' });
      }

      const areaRepository = AppDataSource.getRepository(Area);
      const existente = await areaRepository.findOne({ where: { nombre } });
      if (existente) {
        return res.status(409).json({ message: 'Ya existe un área con ese nombre.' });
      }

      const area = areaRepository.create({
        nombre,
        descripcion: descripcion || null,
        activo,
      });
      await areaRepository.save(area);
      res.status(201).json(area);
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY' || err?.message?.includes('Duplicate')) {
        return res.status(409).json({ message: 'Ya existe un área con ese nombre.' });
      }
      console.error('Error al crear área:', err);
      res.status(500).json({ message: err?.message || 'Error al crear el área.' });
    }
  });

  app.put('/api/areas/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-areas']), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID de área inválido.' });

      const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
      const descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : null;
      const activo = req.body.activo !== false;

      if (!nombre) {
        return res.status(400).json({ message: 'El nombre del área es obligatorio.' });
      }
      if (nombre.length > 200) {
        return res.status(400).json({ message: 'El nombre del área no puede superar 200 caracteres.' });
      }

      const areaRepository = AppDataSource.getRepository(Area);
      const area = await areaRepository.findOne({ where: { id } });
      if (!area) return res.status(404).json({ message: 'Área no encontrada.' });

      const otroConMismoNombre = await areaRepository.findOne({ where: { nombre } });
      if (otroConMismoNombre && otroConMismoNombre.id !== id) {
        return res.status(409).json({ message: 'Ya existe un área con ese nombre.' });
      }

      area.nombre = nombre;
      area.descripcion = descripcion || null;
      area.activo = activo;
      await areaRepository.save(area);
      res.json(area);
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY' || err?.message?.includes('Duplicate')) {
        return res.status(409).json({ message: 'Ya existe un área con ese nombre.' });
      }
      console.error('Error al actualizar área:', err);
      res.status(500).json({ message: err?.message || 'Error al actualizar el área.' });
    }
  });

  app.delete('/api/areas/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-areas']), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID de área inválido.' });
      const areaRepository = AppDataSource.getRepository(Area);
      const area = await areaRepository.findOne({ where: { id } });
      if (!area) return res.status(404).json({ message: 'Área no encontrada.' });
      await areaRepository.remove(area);
      res.status(204).send();
    } catch (err: any) {
      console.error('Error al eliminar área:', err);
      res.status(500).json({ message: err?.message || 'Error al eliminar el área.' });
    }
  });

  // Catálogo de productos (código -> descripción): consulta para formulario SIAF; importación Excel solo con permiso
  const productoCatalogoRepository = AppDataSource.getRepository(ProductoCatalogo);

  app.get('/api/catalogo-productos/codigo/:codigo', verifyToken, async (req: Request, res: Response) => {
    try {
      const codigo = (req.params.codigo || '').trim();
      if (!codigo) {
        return res.status(400).json({ message: 'Código es requerido.' });
      }
      const producto = await productoCatalogoRepository.findOne({ where: { codigo } });
      if (!producto) {
        return res.status(404).json({ message: 'Código no encontrado en el catálogo.' });
      }
      res.json({ codigo: producto.codigo, descripcion: producto.descripcion ?? '' });
    } catch (err: any) {
      console.error('Error al buscar código en catálogo:', err);
      res.status(500).json({ message: err?.message || 'Error al consultar el catálogo.' });
    }
  });

  const normalizarTexto = (s: string) =>
    String(s ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();

  app.post('/api/catalogo-productos/importar', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), uploadMemory.single('archivo'), async (req: Request, res: Response) => {
    const send500 = (msg: string) => {
      try { res.status(500).json({ message: msg }); } catch (_) {}
    };
    try {
      if (!XLSX?.read || !XLSX?.utils) {
        return send500('No se pudo cargar el paquete xlsx. Ejecute en backend: npm install xlsx');
      }
      const file = (req as any).file;
      const buffer = file?.buffer ?? file;
      if (!file || !buffer || !Buffer.isBuffer(buffer)) {
        return res.status(400).json({ message: 'Debe enviar un archivo Excel (campo: archivo).' });
      }
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const firstSheetName = workbook.SheetNames?.[0];
      if (!firstSheetName) {
        return res.status(400).json({ message: 'El archivo no contiene hojas.' });
      }
      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) {
        return res.status(400).json({ message: 'No se pudo leer la primera hoja.' });
      }
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
      if (!Array.isArray(rows) || rows.length < 1) {
        return res.status(400).json({ message: 'El archivo no tiene filas.' });
      }
      const header = (rows[0] || []).map((h: any) => normalizarTexto(String(h ?? '')));
      let codigoIdx = header.findIndex((h: string) => h === 'codigo');
      let descIdx = header.findIndex((h: string) => h === 'descripcion');
      if (codigoIdx < 0) {
        codigoIdx = 0;
        descIdx = 1;
      } else if (descIdx < 0) {
        descIdx = codigoIdx === 0 ? 1 : 0;
      }
      const dataStart = header.some((h: string) => h === 'codigo') ? 1 : 0;
      const mapCodigo = new Map<string, string | null>();
      for (let i = dataStart; i < rows.length; i++) {
        const row = rows[i] || [];
        const rawCode = row[codigoIdx];
        const codigo = rawCode !== undefined && rawCode !== null ? String(rawCode).trim() : '';
        if (!codigo) continue;
        const rawDesc = row[descIdx];
        const descripcion = rawDesc !== undefined && rawDesc !== null ? String(rawDesc).trim() || null : null;
        mapCodigo.set(codigo, descripcion);
      }
      const registros = Array.from(mapCodigo.entries()).map(([codigo, descripcion]) => ({ codigo, descripcion }));
      if (registros.length === 0) {
        return res.status(400).json({ message: 'No se encontraron filas con código válido.' });
      }
      await productoCatalogoRepository.clear();
      const CHUNK = 200;
      for (let i = 0; i < registros.length; i += CHUNK) {
        const chunk = registros.slice(i, i + CHUNK).map((r) => ({ codigo: r.codigo, descripcion: r.descripcion }));
        await productoCatalogoRepository.insert(chunk);
      }
      return res.json({ message: 'Catálogo actualizado correctamente.', total: registros.length });
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('Error al importar catálogo:', err);
      if (!res.headersSent) send500(msg);
    }
  });

  app.get('/api/catalogo-productos/stats', verifyToken, authorizeRoles(['super administrador', 'actualizar-codigos-productos']), async (req: Request, res: Response) => {
    try {
      const total = await productoCatalogoRepository.count();
      const last = await productoCatalogoRepository.find({ order: { createdAt: 'DESC' as const }, take: 1 });
      res.json({ total, ultimaActualizacion: last[0]?.createdAt ?? null });
    } catch (err: any) {
      console.error('Error al obtener estadísticas del catálogo:', err);
      res.json({ total: 0, ultimaActualizacion: null });
    }
  });

  // SIAF Endpoints

  // Obtener todas las solicitudes SIAF creadas por el usuario actual
  app.get('/api/siaf', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const siafRepository = AppDataSource.getRepository(SiafSolicitud);

      const solicitudes = await siafRepository
        .createQueryBuilder('solicitud')
        .leftJoinAndSelect('solicitud.usuarioSolicitante', 'solicitante')
        .leftJoinAndSelect('solicitud.area', 'area')
        .leftJoinAndSelect('solicitud.items', 'items')
        .leftJoinAndSelect('solicitud.subproductos', 'subproductos')
        .leftJoinAndSelect('solicitud.documentosAdjuntos', 'documentosAdjuntos')
        .leftJoinAndSelect('solicitud.autorizaciones', 'autorizaciones')
        .where('solicitante.id = :userId', { userId })
        .orderBy('solicitud.createdAt', 'DESC')
        .getMany();

      const conUltimoRechazo = solicitudes.map((s) => {
        const rechazos = (s.autorizaciones || []).filter((a: any) => a.accion === 'rechazado')
          .sort((a: any, b: any) => new Date(b.fechaAutorizacion).getTime() - new Date(a.fechaAutorizacion).getTime());
        const ultimoRechazo = rechazos[0] ? { comentario: rechazos[0].comentario, fecha: rechazos[0].fechaAutorizacion } : null;
        return { ...s, ultimoRechazo };
      });

      res.json(conUltimoRechazo);
    } catch (error) {
      console.error('Error al obtener las solicitudes SIAF del usuario:', error);
      res.status(500).json({ message: 'Error al obtener las solicitudes SIAF' });
    }
  });

  // Crear una nueva solicitud SIAF
  app.post('/api/siaf', verifyToken, async (req: Request, res: Response) => {
    try {
      const siafData = req.body;
      const userId = (req as any).user.userId;

      const siafRepository = AppDataSource.getRepository(SiafSolicitud);
      const userRepository = AppDataSource.getRepository(User);
      const areaRepository = AppDataSource.getRepository(Area);

      // 1. Validar correlativo único
      const existingSiaf = await siafRepository.findOne({ where: { correlativo: siafData.correlativo } });
      if (existingSiaf) {
        return res.status(409).json({ message: `El correlativo "${siafData.correlativo}" ya existe.` });
      }

      // 2. Obtener entidades relacionadas
      const solicitante = await userRepository.findOneBy({ id: userId });
      if (!solicitante) {
        return res.status(404).json({ message: 'Usuario solicitante no encontrado.' });
      }

      let autoridad: User | null = null;
      if (siafData.usuarioAutoridadId) {
        autoridad = await userRepository.findOneBy({ id: siafData.usuarioAutoridadId });
      }
      let encargado: User | null = null;
      if (siafData.usuarioEncargadoId) {
        encargado = await userRepository.findOneBy({ id: siafData.usuarioEncargadoId });
      }

      let area: Area | null = null;
      if (siafData.areaId) {
        area = await areaRepository.findOneBy({ id: siafData.areaId });
      }

      // 3. Crear y poblar la solicitud
      const nuevaSolicitud = new SiafSolicitud();
      nuevaSolicitud.correlativo = siafData.correlativo;
      nuevaSolicitud.fecha = new Date(siafData.fecha);
      nuevaSolicitud.nombreUnidad = siafData.nombreUnidad;
      nuevaSolicitud.direccion = siafData.direccion;
      nuevaSolicitud.justificacion = siafData.justificacion;
      nuevaSolicitud.consistenteItem = siafData.consistentItem;
      
      // Asignar datos textuales y entidades
      nuevaSolicitud.nombreSolicitante = siafData.nombreSolicitante;
      nuevaSolicitud.puestoSolicitante = siafData.puestoSolicitante;
      nuevaSolicitud.unidadSolicitante = siafData.unidadSolicitante;
      nuevaSolicitud.nombreAutoridad = siafData.nombreAutoridad;
      nuevaSolicitud.puestoAutoridad = siafData.puestoAutoridad;
      nuevaSolicitud.unidadAutoridad = siafData.unidadAutoridad;
      
      nuevaSolicitud.usuarioSolicitante = solicitante;
      if (autoridad) nuevaSolicitud.usuarioAutoridad = autoridad;
      if (encargado) nuevaSolicitud.usuarioEncargado = encargado;
      if (area) nuevaSolicitud.area = area;

      // 4. Mapear items y subproductos
      nuevaSolicitud.items = siafData.items.map((itemData: any, index: number) => {
        const newItem = new SiafItem();
        newItem.codigo = itemData.codigo;
        newItem.descripcion = itemData.descripcion;
        newItem.cantidad = itemData.cantidad;
        newItem.orden = index;
        return newItem;
      });

      nuevaSolicitud.subproductos = siafData.subproductos.map((subData: any, index: number) => {
        const newSub = new SiafSubproducto();
        newSub.codigo = subData.codigo;
        newSub.cantidad = subData.cantidad;
        newSub.orden = index;
        return newSub;
      });

      // 5. Guardar en la base de datos
      const savedSiaf = await siafRepository.save(nuevaSolicitud);

      // 6. Generar y guardar el PDF
      try {
        const pdfBuffer = await pdfGeneratorService.generateSiafPdf(savedSiaf);
        const pdfInfo = await fileStorageService.saveSiafPdf(pdfBuffer, savedSiaf.correlativo);

        // Actualizar la solicitud con la info del PDF
        savedSiaf.pdfPath = pdfInfo.filePath;
        savedSiaf.pdfHash = pdfInfo.hash;
        savedSiaf.pdfSize = pdfInfo.size;
        await siafRepository.save(savedSiaf); // Guardar la actualización

        res.status(201).json({ 
          message: 'Solicitud SIAF creada y PDF generado exitosamente.',
          siafId: savedSiaf.id,
          pdfGenerated: true
        });

      } catch (pdfError) {
        console.error('Error al generar o guardar el PDF:', pdfError);
        // La solicitud ya fue creada, pero el PDF falló. Se responde con éxito parcial.
        res.status(201).json({ 
          message: 'Solicitud SIAF creada, pero hubo un problema al generar el PDF.',
          siafId: savedSiaf.id,
          pdfGenerated: false 
        });
      }

    } catch (error) {
      console.error('Error al crear solicitud SIAF:', error);
      res.status(500).json({ message: 'Error en el servidor al crear la solicitud SIAF.' });
    }
  });

  // Rutas específicas de SIAF (deben ir ANTES de /api/siaf/:id para no capturar "por-unidad", "para-autorizar", etc. como id)

  // (Flujo director/encargado de despacho anulado: solo Dirección Departamental autoriza con rol revisar-siaf-direccion-departamental.)

  // Resuelve el departamento del usuario DD: departamentoDireccionEntidad (tabla), luego texto departamentoDireccion, luego desde Unidad Médica.
  async function resolveDepartamentoDireccion(user: User): Promise<string | null> {
    const deptoEntidad = (user as any).departamentoDireccionEntidad;
    if (deptoEntidad?.nombre) return deptoEntidad.nombre.trim();
    let depto = (user.departamentoDireccion || '').trim();
    if (depto) return depto;
    const unidadNombre = (user.unidadMedica || '').trim();
    if (!unidadNombre) return null;
    const unidadRepo = AppDataSource.getRepository(UnidadMedica);
    const unidad = await unidadRepo.findOne({ where: { nombre: unidadNombre }, relations: ['municipio', 'municipio.departamento'] });
    return unidad?.municipio?.departamento?.nombre ?? unidad?.departamento ?? null;
  }

  // Dirección Departamental: SIAFs PENDIENTES de su departamento (opcional: filtrar por municipio con ?municipioId=).
  app.get('/api/siaf/para-direccion-departamental', verifyToken, authorizeRoles(['super administrador', 'revisar-siaf-direccion-departamental']), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const municipioIdParam = req.query.municipioId != null ? parseInt(String(req.query.municipioId), 10) : null;
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId }, relations: ['roles', 'departamentoDireccionEntidad'] });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
      const depto = await resolveDepartamentoDireccion(user);
      if (!depto) return res.status(400).json({ message: 'No tiene asignado un departamento de Dirección. Asigne una Unidad Médica de tipo Dirección Departamental (ej. Dirección Departamental Escuintla) o contacte al administrador.' });
      const unidadRepo = AppDataSource.getRepository(UnidadMedica);
      const todasUnidades = await unidadRepo.find({ relations: ['municipio', 'municipio.departamento'] });
      let unidadesDelDepto = todasUnidades.filter(
        (u) => (u.departamento === depto) || (u.municipio?.departamento?.nombre === depto)
      );
      if (municipioIdParam != null && !isNaN(municipioIdParam)) {
        unidadesDelDepto = unidadesDelDepto.filter((u) => u.municipio?.id === municipioIdParam);
      }
      const nombresUnidad = unidadesDelDepto.map((u) => u.nombre);
      const deptoPattern = `%${depto}%`;
      const siafRepo = AppDataSource.getRepository(SiafSolicitud);
      let qb = siafRepo
        .createQueryBuilder('solicitud')
        .leftJoinAndSelect('solicitud.autorizaciones', 'aut')
        .leftJoinAndSelect('aut.usuarioAutorizador', 'autorizador')
        .leftJoinAndSelect('solicitud.items', 'items')
        .leftJoinAndSelect('solicitud.subproductos', 'subproductos')
        .leftJoinAndSelect('solicitud.area', 'area')
        .leftJoinAndSelect('solicitud.usuarioSolicitante', 'usuarioSolicitante')
        .leftJoinAndSelect('usuarioSolicitante.puesto', 'puestoSolicitante')
        .leftJoinAndSelect('solicitud.usuarioAutoridad', 'usuarioAutoridad')
        .leftJoinAndSelect('solicitud.documentosAdjuntos', 'documentosAdjuntos')
        .where('solicitud.estado = :estado', { estado: 'pendiente' });
      const filtrandoPorMunicipio = municipioIdParam != null && !isNaN(municipioIdParam);
      if (filtrandoPorMunicipio) {
        const muniRepo = AppDataSource.getRepository(Municipio);
        const municipio = await muniRepo.findOne({ where: { id: municipioIdParam }, relations: ['departamento'] });
        const nombreMuni = municipio?.nombre ?? '';
        const perteneceAlDepto = municipio?.departamento?.nombre === depto;
        const municipioPattern = nombreMuni ? `%${nombreMuni}%` : '';
        const nombreMuniSinAcento = nombreMuni.replace(/í/g, 'i').replace(/á/g, 'a').replace(/é/g, 'e').replace(/ó/g, 'o').replace(/ú/g, 'u');
        const municipioPatternSinAcento = nombreMuniSinAcento ? `%${nombreMuniSinAcento}%` : '';
        if (!perteneceAlDepto && nombreMuni) {
          qb = qb.andWhere('1 = 0');
        } else if (nombresUnidad.length > 0 && (municipioPattern || municipioPatternSinAcento)) {
          if (municipioPattern && municipioPatternSinAcento && municipioPattern !== municipioPatternSinAcento) {
            qb = qb.andWhere(
              '(solicitud.nombreUnidad IN (:...nombres) OR solicitud.nombreUnidad ILIKE :municipioPattern OR solicitud.nombreUnidad ILIKE :municipioPatternSinAcento)',
              { nombres: nombresUnidad, municipioPattern, municipioPatternSinAcento }
            );
          } else {
            qb = qb.andWhere(
              '(solicitud.nombreUnidad IN (:...nombres) OR solicitud.nombreUnidad ILIKE :municipioPattern)',
              { nombres: nombresUnidad, municipioPattern: municipioPattern || municipioPatternSinAcento }
            );
          }
        } else if (nombresUnidad.length > 0) {
          qb = qb.andWhere('solicitud.nombreUnidad IN (:...nombres)', { nombres: nombresUnidad });
        } else if (municipioPattern && municipioPatternSinAcento && municipioPattern !== municipioPatternSinAcento) {
          qb = qb.andWhere('(solicitud.nombreUnidad ILIKE :municipioPattern OR solicitud.nombreUnidad ILIKE :municipioPatternSinAcento)', { municipioPattern, municipioPatternSinAcento });
        } else if (municipioPattern || municipioPatternSinAcento) {
          qb = qb.andWhere('solicitud.nombreUnidad ILIKE :municipioPattern', { municipioPattern: municipioPattern || municipioPatternSinAcento });
        } else {
          qb = qb.andWhere('1 = 0');
        }
      } else if (nombresUnidad.length > 0) {
        qb = qb.andWhere('(solicitud.nombreUnidad IN (:...nombres) OR solicitud.nombreUnidad ILIKE :deptoPattern)', { nombres: nombresUnidad, deptoPattern });
      } else {
        qb = qb.andWhere('solicitud.nombreUnidad ILIKE :deptoPattern', { deptoPattern });
      }
      const solicitudes = await qb.orderBy('solicitud.createdAt', 'DESC').getMany();
      const ids = solicitudes.map((s) => s.id);
      let esCorreccionIds: number[] = [];
      if (ids.length > 0) {
        const bitacoraRepo = AppDataSource.getRepository(SiafBitacora);
        const rows = await bitacoraRepo
          .createQueryBuilder('b')
          .innerJoin('b.siaf', 's')
          .select('DISTINCT s.id', 'siafId')
          .where('s.id IN (:...ids)', { ids })
          .andWhere("b.tipo IN ('rechazo', 'correccion')")
          .getRawMany();
        esCorreccionIds = (rows || []).map((r: any) => r.siafId).filter((id: any) => id != null);
      }
      const deptoRepo = AppDataSource.getRepository(Departamento);
      const deptoEntidad = await deptoRepo.findOne({ where: { nombre: depto } });
      res.json({
        solicitudes,
        meta: {
          unidadAsignada: user.unidadMedica || '',
          departamento: depto,
          departamentoId: deptoEntidad?.id ?? null,
          esCorreccionIds,
        },
      });
    } catch (err: any) {
      console.error('Error al obtener SIAFs para Dirección Departamental:', err);
      res.status(500).json({ message: err?.message || 'Error al obtener solicitudes.' });
    }
  });

  // Historial de SIAFs aprobados/rechazados por el usuario de Dirección Departamental (el que está logueado)
  app.get('/api/siaf/historial-direccion-departamental', verifyToken, authorizeRoles(['super administrador', 'revisar-siaf-direccion-departamental']), async (req: Request, res: Response) => {
    try {
      const userId = Number((req as any).user?.userId);
      if (!userId || isNaN(userId)) return res.status(401).json({ message: 'Usuario no identificado.' });
      const autRepo = AppDataSource.getRepository(SiafAutorizacion);
      const autorizaciones = await autRepo
        .createQueryBuilder('aut')
        .innerJoinAndSelect('aut.siaf', 'siaf')
        .leftJoinAndSelect('siaf.usuarioSolicitante', 'usuarioSolicitante')
        .leftJoinAndSelect('usuarioSolicitante.puesto', 'puestoSolicitante')
        .leftJoinAndSelect('siaf.area', 'area')
        .leftJoinAndSelect('siaf.items', 'items')
        .leftJoinAndSelect('siaf.subproductos', 'subproductos')
        .leftJoinAndSelect('siaf.documentosAdjuntos', 'documentosAdjuntos')
        .where('aut.usuario_autorizador_id = :userId', { userId })
        .orderBy('aut.fecha_autorizacion', 'DESC')
        .getMany();
      const items = autorizaciones.map((aut) => ({
        id: aut.siaf.id,
        correlativo: aut.siaf.correlativo,
        fecha: aut.siaf.fecha ?? aut.siaf.createdAt,
        nombreSolicitante: aut.siaf.nombreSolicitante || (aut.siaf.usuarioSolicitante ? `${aut.siaf.usuarioSolicitante.nombres || ''} ${aut.siaf.usuarioSolicitante.apellidos || ''}`.trim() : 'N/A'),
        puestoSolicitante: aut.siaf.puestoSolicitante || aut.siaf.usuarioSolicitante?.puesto?.nombre || 'N/A',
        nombreUnidad: aut.siaf.nombreUnidad || aut.siaf.area?.nombre || 'N/A',
        areaUnidad: aut.siaf.area?.nombre || 'N/A',
        estado: aut.accion,
        fechaDecision: aut.fechaAutorizacion,
        comentario: aut.comentario ?? null,
        siaf: aut.siaf,
      }));
      res.json(items);
    } catch (err: any) {
      console.error('Error al obtener historial DD:', err);
      res.status(500).json({ message: err?.message || 'Error al obtener historial.' });
    }
  });

  // Estadísticas de tiempos SIAF: tiempo promedio de revisión (generación → autorización/rechazo) y tiempo promedio de corrección (rechazo → corrección)
  app.get('/api/estadisticas/siaf-tiempos', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas']), async (req: Request, res: Response) => {
    const desde = new Date();
    const dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias || 90), 10) || 90));
    desde.setDate(desde.getDate() - dias);
    desde.setHours(0, 0, 0, 0);

    try {
      const autRepo = AppDataSource.getRepository(SiafAutorizacion);
      const bitacoraRepo = AppDataSource.getRepository(SiafBitacora);
      const siafRepo = AppDataSource.getRepository(SiafSolicitud);

      const autorizaciones = await autRepo
        .createQueryBuilder('aut')
        .innerJoinAndSelect('aut.siaf', 'siaf')
        .where('aut.fecha_autorizacion >= :desde', { desde })
        .getMany();

      const tiemposRevisionHoras: number[] = [];
      const tiemposAutorizacionHoras: number[] = [];
      for (const aut of autorizaciones) {
        const siaf = aut.siaf;
        if (!siaf?.createdAt) continue;
        const creado = new Date(siaf.createdAt).getTime();
        const decidido = new Date(aut.fechaAutorizacion).getTime();
        const horas = (decidido - creado) / (1000 * 60 * 60);
        if (horas >= 0) {
          tiemposRevisionHoras.push(horas);
          if (String(aut.accion).toLowerCase() === 'autorizado') {
            tiemposAutorizacionHoras.push(horas);
          }
        }
      }
      const promedioRevisionHoras = tiemposRevisionHoras.length > 0
        ? tiemposRevisionHoras.reduce((a, b) => a + b, 0) / tiemposRevisionHoras.length
        : null;
      const cantidadRevisados = tiemposRevisionHoras.length;
      const promedioAutorizacionHoras = tiemposAutorizacionHoras.length > 0
        ? tiemposAutorizacionHoras.reduce((a, b) => a + b, 0) / tiemposAutorizacionHoras.length
        : null;
      const cantidadAutorizados = tiemposAutorizacionHoras.length;

      const siafsConBitacora = await siafRepo
        .createQueryBuilder('s')
        .innerJoin('s.bitacora', 'b')
        .where('s.createdAt >= :desde', { desde })
        .getMany();
      const siafIds = [...new Set(siafsConBitacora.map((s) => s.id))];
      const tiemposCorreccionHoras: number[] = [];
      for (const siafId of siafIds) {
        const entradas = await bitacoraRepo
          .createQueryBuilder('b')
          .innerJoin('b.siaf', 'siaf')
          .where('siaf.id = :siafId', { siafId })
          .orderBy('b.fecha', 'ASC')
          .getMany();
        let fechaRechazo: Date | null = null;
        for (const e of entradas) {
          if (e.tipo === 'rechazo') fechaRechazo = new Date(e.fecha);
          if (e.tipo === 'correccion' && fechaRechazo) {
            const horas = (new Date(e.fecha).getTime() - fechaRechazo.getTime()) / (1000 * 60 * 60);
            if (horas >= 0) tiemposCorreccionHoras.push(horas);
            fechaRechazo = null;
          }
        }
      }
      const promedioCorreccionHoras = tiemposCorreccionHoras.length > 0
        ? tiemposCorreccionHoras.reduce((a, b) => a + b, 0) / tiemposCorreccionHoras.length
        : null;
      const cantidadConCorreccion = tiemposCorreccionHoras.length;

      const porSemana: { semana: string; promedioRevisionHoras: number; promedioAutorizacionHoras: number; promedioCorreccionHoras: number; cantidadRevisados: number; cantidadAutorizados: number; cantidadCorrecciones: number }[] = [];
      const semanalesRevision = new Map<string, number[]>();
      const semanalesAutorizacion = new Map<string, number[]>();
      const semanalesCorreccion = new Map<string, number[]>();
      const keySemana = (d: Date) => {
        const lunes = new Date(d);
        lunes.setDate(lunes.getDate() - ((d.getDay() + 6) % 7));
        return lunes.toISOString().slice(0, 10);
      };
      for (const aut of autorizaciones) {
        const siaf = aut.siaf;
        if (!siaf?.createdAt) continue;
        const decidido = new Date(aut.fechaAutorizacion);
        const creado = new Date(siaf.createdAt).getTime();
        const horas = (decidido.getTime() - creado) / (1000 * 60 * 60);
        if (horas >= 0) {
          const k = keySemana(decidido);
          if (!semanalesRevision.has(k)) semanalesRevision.set(k, []);
          semanalesRevision.get(k)!.push(horas);
          if (String(aut.accion).toLowerCase() === 'autorizado') {
            if (!semanalesAutorizacion.has(k)) semanalesAutorizacion.set(k, []);
            semanalesAutorizacion.get(k)!.push(horas);
          }
        }
      }
      const bitacoraTodas = await bitacoraRepo
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.siaf', 'siaf')
        .where('b.fecha >= :desde', { desde })
        .orderBy('b.fecha', 'ASC')
        .getMany();
      const fechaRechazoPorSiaf = new Map<number, Date>();
      for (const e of bitacoraTodas) {
        const siafId = (e.siaf as any)?.id;
        if (!siafId) continue;
        if (e.tipo === 'rechazo') fechaRechazoPorSiaf.set(siafId, new Date(e.fecha));
        if (e.tipo === 'correccion') {
          const fr = fechaRechazoPorSiaf.get(siafId);
          if (fr) {
            const horas = (new Date(e.fecha).getTime() - fr.getTime()) / (1000 * 60 * 60);
            if (horas >= 0) {
              const k = keySemana(new Date(e.fecha));
              if (!semanalesCorreccion.has(k)) semanalesCorreccion.set(k, []);
              semanalesCorreccion.get(k)!.push(horas);
            }
            fechaRechazoPorSiaf.delete(siafId);
          }
        }
      }
      const semanasSet = new Set([...semanalesRevision.keys(), ...semanalesCorreccion.keys(), ...semanalesAutorizacion.keys()]);
      const semanasOrdenadas = [...semanasSet].sort();
      for (const k of semanasOrdenadas) {
        const rev = semanalesRevision.get(k) ?? [];
        const aut = semanalesAutorizacion.get(k) ?? [];
        const corr = semanalesCorreccion.get(k) ?? [];
        porSemana.push({
          semana: k,
          promedioRevisionHoras: rev.length ? rev.reduce((a, b) => a + b, 0) / rev.length : 0,
          promedioAutorizacionHoras: aut.length ? aut.reduce((a, b) => a + b, 0) / aut.length : 0,
          promedioCorreccionHoras: corr.length ? corr.reduce((a, b) => a + b, 0) / corr.length : 0,
          cantidadRevisados: rev.length,
          cantidadAutorizados: aut.length,
          cantidadCorrecciones: corr.length,
        });
      }
      porSemana.sort((a, b) => a.semana.localeCompare(b.semana));

      res.json({
        dias,
        desde: desde.toISOString(),
        promedioRevisionHoras,
        promedioAutorizacionHoras,
        promedioCorreccionHoras,
        cantidadRevisados,
        cantidadAutorizados,
        cantidadConCorreccion,
        porSemana,
      });
    } catch (err: any) {
      console.error('Error al obtener estadísticas SIAF:', err?.message || err);
      if (err?.stack) console.error(err.stack);
      const message = err?.message || 'Error al obtener estadísticas.';
      res.status(500).json({ message });
    }
  });

  // Estadísticas: motivos de rechazo (conteo por categoría)
  const MOTIVOS_RECHAZO_ETIQUETAS: Record<string, string> = {
    falta_documento: 'Falta documento',
    ortografia: 'Ortografía / redacción',
    mal_explicado: 'Mal explicado / poco claro',
    datos_incorrectos: 'Datos incorrectos o inconsistentes',
    otro: 'Otro',
  };
  app.get('/api/estadisticas/motivos-rechazo', verifyToken, authorizeRolesOrPermissions(['super administrador'], ['ver-estadisticas']), async (req: Request, res: Response) => {
    try {
      const dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias || 90), 10) || 90));
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      desde.setHours(0, 0, 0, 0);

      const autRepo = AppDataSource.getRepository(SiafAutorizacion);
      const rechazos = await autRepo
        .createQueryBuilder('aut')
        .where('aut.accion = :accion', { accion: 'rechazado' })
        .andWhere('aut.fecha_autorizacion >= :desde', { desde })
        .select('aut.motivo_rechazo', 'motivoRechazo')
        .addSelect('aut.motivos_rechazo', 'motivosRechazo')
        .getRawMany();

      const conteo = new Map<string, number>();
      let sinClasificar = 0;
      for (const r of rechazos) {
        const raw = r as { motivoRechazo?: string | null; motivosRechazo?: string | null };
        let categorias: string[] = [];
        if (raw.motivosRechazo) {
          try {
            const arr = JSON.parse(raw.motivosRechazo);
            if (Array.isArray(arr)) categorias = arr.filter((c: any) => typeof c === 'string');
          } catch {
            categorias = [];
          }
        }
        if (categorias.length === 0 && raw.motivoRechazo) categorias = [raw.motivoRechazo];
        if (categorias.length === 0) {
          sinClasificar += 1;
          continue;
        }
        for (const motivo of categorias) {
          if (motivo && MOTIVOS_RECHAZO_ETIQUETAS[motivo] != null) {
            conteo.set(motivo, (conteo.get(motivo) ?? 0) + 1);
          } else {
            sinClasificar += 1;
          }
        }
      }
      const motivos = Object.keys(MOTIVOS_RECHAZO_ETIQUETAS).map((clave) => ({
        clave,
        etiqueta: MOTIVOS_RECHAZO_ETIQUETAS[clave],
        cantidad: conteo.get(clave) ?? 0,
      }));
      if (sinClasificar > 0) {
        motivos.push({ clave: 'sin_clasificar', etiqueta: 'Sin clasificar', cantidad: sinClasificar });
      }
      motivos.sort((a, b) => b.cantidad - a.cantidad);
      const total = rechazos.length;

      res.json({
        dias,
        desde: desde.toISOString(),
        motivos,
        sinClasificar,
        total,
        etiquetas: MOTIVOS_RECHAZO_ETIQUETAS,
      });
    } catch (err: any) {
      console.error('Error al obtener estadísticas motivos rechazo:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Error al obtener estadísticas.' });
    }
  });

  // Obtener solicitudes SIAF rechazadas (misma unidad que el usuario)
  app.get('/api/siaf/rechazadas', verifyToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: userId } });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
      const unidadUsuario = user.unidadMedica || '';
      const siafRepository = AppDataSource.getRepository(SiafSolicitud);

      const solicitudes = await siafRepository
        .createQueryBuilder('solicitud')
        .leftJoinAndSelect('solicitud.autorizaciones', 'aut')
        .leftJoinAndSelect('aut.usuarioAutorizador', 'autorizador')
        .leftJoinAndSelect('solicitud.items', 'items')
        .leftJoinAndSelect('solicitud.subproductos', 'subproductos')
        .leftJoinAndSelect('solicitud.area', 'area')
        .leftJoinAndSelect('solicitud.usuarioSolicitante', 'usuarioSolicitante')
        .leftJoinAndSelect('usuarioSolicitante.puesto', 'puestoSolicitante')
        .leftJoinAndSelect('solicitud.usuarioAutoridad', 'usuarioAutoridad')
        .where('solicitud.unidadSolicitante = :unidad', { unidad: unidadUsuario })
        .andWhere('solicitud.estado = :estado', { estado: 'rechazado' })
        .orderBy('solicitud.createdAt', 'DESC')
        .getMany();

      res.json(solicitudes);
    } catch (err: any) {
      console.error('Error fetching SIAF solicitudes rechazadas:', err);
      res.status(500).json({ message: 'Error al obtener solicitudes SIAF rechazadas' });
    }
  });

  // Descargar un documento adjunto de SIAF (ruta debe ir antes de /api/siaf/:id)
  app.get('/api/siaf/adjuntos/:idAdjunto/descargar', verifyToken, async (req: Request, res: Response) => {
    try {
      const idAdjunto = parseInt(req.params.idAdjunto);
      if (isNaN(idAdjunto)) return res.status(400).json({ message: 'ID de adjunto inválido.' });
      const userId = (req as any).user.userId;
      const adjuntoRepo = AppDataSource.getRepository(SiafDocumentoAdjunto);
      const adjunto = await adjuntoRepo.findOne({
        where: { id: idAdjunto },
        relations: ['siaf', 'siaf.usuarioSolicitante'],
      });
      if (!adjunto) return res.status(404).json({ message: 'Documento adjunto no encontrado.' });
      // Solo el solicitante o quien tenga acceso a la unidad puede descargar (por ahora permitir a cualquier autenticado que conozca el id)
      const buffer = await fileStorageService.readFileByRelativePath(adjunto.rutaArchivo);
      const fileName = adjunto.nombreOriginal || `adjunto-${idAdjunto}`;
      res.setHeader('Content-Type', adjunto.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.send(buffer);
    } catch (err: any) {
      if (err.message === 'Archivo no encontrado') return res.status(404).json({ message: 'Archivo no encontrado.' });
      console.error('Error al descargar adjunto:', err);
      res.status(500).json({ message: 'Error al descargar el documento.' });
    }
  });

  // Eliminar un documento adjunto de SIAF (debe ir antes de /api/siaf/:id)
  app.delete('/api/siaf/adjuntos/:idAdjunto', verifyToken, async (req: Request, res: Response) => {
    try {
      const idAdjunto = parseInt(req.params.idAdjunto);
      if (isNaN(idAdjunto)) return res.status(400).json({ message: 'ID de adjunto inválido.' });
      const userId = (req as any).user.userId;
      const adjuntoRepo = AppDataSource.getRepository(SiafDocumentoAdjunto);
      const adjunto = await adjuntoRepo.findOne({
        where: { id: idAdjunto },
        relations: ['siaf', 'siaf.usuarioSolicitante'],
      });
      if (!adjunto) return res.status(404).json({ message: 'Documento adjunto no encontrado.' });
      if (adjunto.siaf?.usuarioSolicitante?.id !== userId) return res.status(403).json({ message: 'Solo el solicitante puede eliminar documentos de esta solicitud.' });
      await fileStorageService.deleteSiafAdjunto(adjunto.rutaArchivo);
      await adjuntoRepo.remove(adjunto);
      res.status(204).send();
    } catch (err: any) {
      console.error('Error al eliminar adjunto:', err);
      res.status(500).json({ message: err?.message || 'Error al eliminar el documento.' });
    }
  });

  // Subir documento adjunto a un SIAF
  app.post('/api/siaf/:id/adjuntos', verifyToken, uploadMemory.single('archivo'), async (req: Request, res: Response) => {
    try {
      const siafId = parseInt(req.params.id);
      if (isNaN(siafId)) return res.status(400).json({ message: 'ID de SIAF inválido.' });
      const file = (req as any).file;
      if (!file || !file.buffer) return res.status(400).json({ message: 'Debe enviar un archivo (campo "archivo").' });
      const siafRepo = AppDataSource.getRepository(SiafSolicitud);
      const siaf = await siafRepo.findOne({ where: { id: siafId }, relations: ['usuarioSolicitante'] });
      if (!siaf) return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
      const userId = (req as any).user.userId;
      if (siaf.usuarioSolicitante?.id !== userId) return res.status(403).json({ message: 'Solo el solicitante puede adjuntar documentos a esta solicitud.' });
      const nombreOriginal = file.originalname || `documento-${Date.now()}`;
      const pdfInfo = await fileStorageService.saveSiafAdjunto(file.buffer, siafId, nombreOriginal);
      const adjuntoRepo = AppDataSource.getRepository(SiafDocumentoAdjunto);
      const adjunto = adjuntoRepo.create({
        siafId,
        nombreOriginal,
        rutaArchivo: pdfInfo.filePath,
        mimeType: file.mimetype || 'application/octet-stream',
        tamanioBytes: pdfInfo.size,
        hashArchivo: pdfInfo.hash,
      });
      await adjuntoRepo.save(adjunto);
      res.status(201).json(adjunto);
    } catch (err: any) {
      console.error('Error al subir adjunto:', err);
      res.status(500).json({ message: err?.message || 'Error al subir el documento.' });
    }
  });

  /** Mapea entidades SiafBitacora al formato que espera el frontend (rechazos y correcciones). */
  function mapBitacoraToApi(entradas: SiafBitacora[]): any[] {
    return (entradas || []).map((b) => ({
      id: b.id,
      tipo: b.tipo || '',
      comentario: b.comentario ?? null,
      detalleAntes: b.detalleAntes ?? null,
      detalleDespues: b.detalleDespues ?? null,
      fecha: b.fecha,
      usuario: b.usuario ? { nombres: b.usuario.nombres, apellidos: b.usuario.apellidos } : null,
    }));
  }

  async function loadBitacoraBySiafId(siafId: number): Promise<any[]> {
    const mainRows = await AppDataSource.query(
      `SELECT id, tipo, comentario, detalle_antes AS "detalleAntes", detalle_despues AS "detalleDespues", fecha, usuario_id FROM siaf_bitacora WHERE siaf_id = $1 ORDER BY fecha DESC`,
      [siafId]
    );
    const nullCorrecciones = await AppDataSource.query(
      `SELECT b.id, b.tipo, b.comentario, b.detalle_antes AS "detalleAntes", b.detalle_despues AS "detalleDespues", b.fecha, b.usuario_id
       FROM siaf_bitacora b
       WHERE b.tipo = 'correccion' AND b.siaf_id IS NULL
         AND EXISTS (SELECT 1 FROM siaf_bitacora r WHERE r.siaf_id = $1 AND r.tipo = 'rechazo' AND r.fecha < b.fecha LIMIT 1)
       ORDER BY b.fecha DESC`,
      [siafId]
    );
    const seenIds = new Set((mainRows || []).map((r: any) => r.id));
    const merged = [...(mainRows || [])];
    for (const r of nullCorrecciones || []) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        merged.push(r);
      }
    }
    merged.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const userIds = [...new Set(merged.map((r: any) => r.usuario_id).filter(Boolean))];
    const users = userIds.length ? await AppDataSource.getRepository(User).find({ where: { id: In(userIds) } }) : [];
    const userMap = new Map(users.map((u) => [u.id, { nombres: u.nombres, apellidos: u.apellidos }]));
    return merged.map((row: any) => ({
      id: row.id,
      tipo: String(row.tipo || ''),
      comentario: row.comentario ?? null,
      detalleAntes: row.detalleAntes ?? row.detalle_antes ?? null,
      detalleDespues: row.detalleDespues ?? row.detalle_despues ?? null,
      fecha: row.fecha,
      usuario: row.usuario_id ? (userMap.get(row.usuario_id) ?? { nombres: '', apellidos: '' }) : null,
    }));
  }

  // Bitácora: GET (con cabeceras anti-caché)
  app.get('/api/siaf/:id/bitacora', verifyToken, async (req: Request, res: Response) => {
    try {
      const siafId = parseInt(req.params.id);
      if (isNaN(siafId)) return res.status(400).json({ message: 'ID inválido.' });
      const bitacora = await loadBitacoraBySiafId(siafId);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      return res.json(bitacora);
    } catch (err: any) {
      console.error('Error GET bitácora:', err);
      res.status(500).json({ message: err?.message || 'Error al cargar bitácora.' });
    }
  });

  // Bitácora: POST para cargar siempre datos frescos (el navegador NUNCA cachea POST)
  app.post('/api/siaf/:id/bitacora', verifyToken, async (req: Request, res: Response) => {
    try {
      const siafId = parseInt(req.params.id);
      if (isNaN(siafId)) return res.status(400).json({ message: 'ID inválido.' });
      const bitacora = await loadBitacoraBySiafId(siafId);
      return res.json(bitacora);
    } catch (err: any) {
      console.error('Error POST bitácora:', err);
      res.status(500).json({ message: err?.message || 'Error al cargar bitácora.' });
    }
  });

  // Obtener una solicitud SIAF por ID (bitácora se carga con consulta explícita para incluir siempre rechazos y correcciones)
  app.get('/api/siaf/:id', verifyToken, async (req: Request, res: Response) => {
    try {
      const siafId = parseInt(req.params.id);
      if (isNaN(siafId)) {
        return res.status(400).json({ message: 'ID de solicitud inválido.' });
      }
      const siafRepository = AppDataSource.getRepository(SiafSolicitud);
      const solicitud = await siafRepository.findOne({
        where: { id: siafId },
        relations: ['items', 'subproductos', 'area', 'usuarioSolicitante', 'usuarioAutoridad', 'usuarioEncargado', 'documentosAdjuntos', 'autorizaciones'],
      });

      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
      }

      const rechazos = (solicitud.autorizaciones || []).filter((a) => a.accion === 'rechazado').sort((a, b) => new Date(b.fechaAutorizacion).getTime() - new Date(a.fechaAutorizacion).getTime());
      const ultimoRechazo = rechazos[0] ? { comentario: rechazos[0].comentario, fecha: rechazos[0].fechaAutorizacion, usuario: rechazos[0].usuarioAutorizador } : null;

      const bitacoraRows = await AppDataSource.query(
        `SELECT id, tipo, comentario, detalle_antes AS "detalleAntes", detalle_despues AS "detalleDespues", fecha, usuario_id FROM siaf_bitacora WHERE siaf_id = $1 ORDER BY fecha DESC`,
        [siafId]
      );
      const bitacoraUserIds = [...new Set((bitacoraRows || []).map((r: any) => r.usuario_id).filter(Boolean))];
      const bitacoraUsers = bitacoraUserIds.length ? await AppDataSource.getRepository(User).find({ where: { id: In(bitacoraUserIds) } }) : [];
      const bitacoraUserMap = new Map(bitacoraUsers.map((u) => [u.id, { nombres: u.nombres, apellidos: u.apellidos }]));
      const bitacora = (bitacoraRows || []).map((row: any) => ({
        id: row.id,
        tipo: String(row.tipo || ''),
        comentario: row.comentario ?? null,
        detalleAntes: row.detalleAntes ?? row.detalle_antes ?? null,
        detalleDespues: row.detalleDespues ?? row.detalle_despues ?? null,
        fecha: row.fecha,
        usuario: row.usuario_id ? (bitacoraUserMap.get(row.usuario_id) ?? { nombres: '', apellidos: '' }) : null,
      }));

      res.json({
        ...solicitud,
        ultimoRechazo,
        bitacora,
      });
    } catch (error) {
      console.error('Error al obtener solicitud SIAF por ID:', error);
      res.status(500).json({ message: 'Error en el servidor.' });
    }
  });

  // Autorizar/rechazar por director o encargado de despacho ya no se usa; solo Dirección Departamental (revisar-siaf-direccion-departamental) autoriza.
  app.put('/api/siaf/:id/autorizar', verifyToken, (_req: Request, res: Response) => {
    return res.status(403).json({ message: 'La autorización de SIAF la realiza únicamente Dirección Departamental (rol revisar-siaf-direccion-departamental).' });
  });
  app.put('/api/siaf/:id/rechazar', verifyToken, (_req: Request, res: Response) => {
    return res.status(403).json({ message: 'El rechazo de SIAF lo realiza únicamente Dirección Departamental (rol revisar-siaf-direccion-departamental).' });
  });

  // Autorizar (aprobar) SIAF por Dirección Departamental. Solo el rol revisar-siaf-direccion-departamental; SIAF debe estar pendiente y pertenecer al departamento del usuario.
  app.post('/api/siaf/:id/aprobar-direccion-departamental', verifyToken, authorizeRoles(['super administrador', 'revisar-siaf-direccion-departamental']), async (req: Request, res: Response) => {
    try {
      const siafId = parseInt(req.params.id);
      if (isNaN(siafId)) return res.status(400).json({ message: 'ID de SIAF inválido.' });
      const userId = (req as any).user.userId;
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: userId });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
      const depto = await resolveDepartamentoDireccion(user);
      if (!depto) return res.status(403).json({ message: 'No tiene departamento de Dirección asignado. Asigne una Unidad Médica de tipo Dirección Departamental.' });
      const unidadRepo = AppDataSource.getRepository(UnidadMedica);
      const unidades = await unidadRepo.find({ where: { departamento: depto } });
      const nombresUnidad = unidades.map((u) => u.nombre);
      const siafRepo = AppDataSource.getRepository(SiafSolicitud);
      const siaf = await siafRepo.findOne({ where: { id: siafId }, relations: ['usuarioSolicitante'] });
      if (!siaf) return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
      if (siaf.estado !== 'pendiente') return res.status(400).json({ message: 'Solo se puede aprobar un SIAF en estado pendiente.' });
      const perteneceAlDepto = nombresUnidad.includes(siaf.nombreUnidad) || (siaf.nombreUnidad && siaf.nombreUnidad.toLowerCase().includes(depto.toLowerCase()));
      if (!perteneceAlDepto) return res.status(403).json({ message: 'Este SIAF no corresponde a su departamento.' });
      siaf.estado = 'autorizado';
      siaf.aprobadoDireccionDepartamental = true;
      await siafRepo.save(siaf);
      const autRepo = AppDataSource.getRepository(SiafAutorizacion);
      const aut = autRepo.create({ siaf, usuarioAutorizador: user, accion: 'autorizado', comentario: undefined });
      await autRepo.save(aut);
      const bitacoraRepo = AppDataSource.getRepository(SiafBitacora);
      const bitacora = bitacoraRepo.create({ siaf, tipo: 'aprobado_dd', usuario: user, comentario: 'Aprobado por Dirección Departamental para continuar con expediente.' });
      await bitacoraRepo.save(bitacora);
      res.json(siaf);
    } catch (err: any) {
      console.error('Error al aprobar SIAF por DD:', err);
      res.status(500).json({ message: err?.message || 'Error al aprobar.' });
    }
  });

  const ETIQUETAS_MOTIVO: Record<string, string> = {
    falta_documento: 'Falta documento',
    ortografia: 'Ortografía / redacción',
    mal_explicado: 'Mal explicado / poco claro',
    datos_incorrectos: 'Datos incorrectos o inconsistentes',
    otro: 'Otro',
  };
  const MOTIVOS_VALIDOS = ['falta_documento', 'ortografia', 'mal_explicado', 'datos_incorrectos', 'otro'];

  // Rechazo por Dirección Departamental (uno o varios motivos; se registra una sola revisión en autorizaciones y bitácora)
  app.post('/api/siaf/:id/rechazar-direccion-departamental', verifyToken, authorizeRoles(['super administrador', 'revisar-siaf-direccion-departamental']), async (req: Request, res: Response) => {
    try {
      const siafId = parseInt(req.params.id);
      if (isNaN(siafId)) return res.status(400).json({ message: 'ID de SIAF inválido.' });
      const userId = (req as any).user.userId;
      let comentario: string;
      let motivoRechazoPrimero: string | null = null;
      let motivosRechazoJson: string | null = null;
      let motivosRaw = req.body?.motivos;
      if (typeof motivosRaw === 'string') {
        try {
          motivosRaw = JSON.parse(motivosRaw);
        } catch {
          motivosRaw = undefined;
        }
      }
      if (Array.isArray(motivosRaw) && motivosRaw.length > 0) {
        const motivos = motivosRaw
          .filter((m: any) => m != null && (typeof m.descripcion === 'string' || typeof m.descripcion === 'number'))
          .map((m: any) => ({
            categoria: typeof m.categoria === 'string' && MOTIVOS_VALIDOS.includes(m.categoria.trim()) ? m.categoria.trim() : 'otro',
            descripcion: String(m.descripcion ?? '').trim(),
          }))
          .filter((m) => m.descripcion.length > 0);
        if (motivos.length === 0) return res.status(400).json({ message: 'Debe indicar al menos un motivo con descripción.' });
        motivoRechazoPrimero = motivos[0].categoria;
        motivosRechazoJson = JSON.stringify(motivos.map((m) => m.categoria));
        const lineas = motivos.map((m, i) => `${i + 1}) ${ETIQUETAS_MOTIVO[m.categoria] || m.categoria}: ${m.descripcion}`);
        comentario = '[Dirección Departamental] Motivos de rechazo (esta revisión): ' + lineas.join(' | ');
      } else {
        const comentarioLegacy = typeof req.body?.comentario === 'string' ? req.body.comentario.trim() : '';
        if (!comentarioLegacy) return res.status(400).json({ message: 'Debe indicar al menos un motivo con descripción. Si envía varios, use el campo "motivos" (array con categoría y descripción).' });
        const motivoRechazoRaw = typeof req.body?.motivoRechazo === 'string' ? req.body.motivoRechazo.trim() : '';
        motivoRechazoPrimero = motivoRechazoRaw && MOTIVOS_VALIDOS.includes(motivoRechazoRaw) ? motivoRechazoRaw : null;
        if (motivoRechazoPrimero) motivosRechazoJson = JSON.stringify([motivoRechazoPrimero]);
        comentario = `[Dirección Departamental] ${comentarioLegacy}`;
      }
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: userId });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
      const depto = await resolveDepartamentoDireccion(user);
      if (!depto) return res.status(403).json({ message: 'No tiene departamento de Dirección asignado. Asigne una Unidad Médica de tipo Dirección Departamental.' });
      const unidadRepo = AppDataSource.getRepository(UnidadMedica);
      const unidades = await unidadRepo.find({ where: { departamento: depto } });
      const nombresUnidad = unidades.map((u) => u.nombre);
      const siafRepo = AppDataSource.getRepository(SiafSolicitud);
      const siaf = await siafRepo.findOne({ where: { id: siafId } });
      if (!siaf) return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
      if (siaf.estado !== 'pendiente') return res.status(400).json({ message: 'Solo se puede rechazar un SIAF en estado pendiente.' });
      const perteneceAlDepto = nombresUnidad.includes(siaf.nombreUnidad) || (siaf.nombreUnidad && siaf.nombreUnidad.toLowerCase().includes(depto.toLowerCase()));
      if (!perteneceAlDepto) return res.status(403).json({ message: 'Este SIAF no corresponde a su departamento.' });
      siaf.estado = 'rechazado';
      await siafRepo.save(siaf);
      const autRepo = AppDataSource.getRepository(SiafAutorizacion);
      const aut = autRepo.create({
        siaf,
        usuarioAutorizador: user,
        accion: 'rechazado',
        comentario,
        motivoRechazo: motivoRechazoPrimero,
        motivosRechazo: motivosRechazoJson,
      });
      await autRepo.save(aut);
      const bitacoraRepo = AppDataSource.getRepository(SiafBitacora);
      const bitacora = bitacoraRepo.create({ siaf, tipo: 'rechazo', usuario: user, comentario });
      await bitacoraRepo.save(bitacora);
      res.json(siaf);
    } catch (err: any) {
      console.error('Error al rechazar SIAF por DD:', err);
      res.status(500).json({ message: err?.message || 'Error al rechazar.' });
    }
  });

  /** Genera detalle "antes" y "después" comparando estado anterior y nuevo (para bitácora de corrección). */
  function buildDetalleCorreccion(
    oldState: { justificacion: string; direccion: string; consistenteItem: string; items: Array<{ codigo: string; descripcion: string; cantidad: number }>; subproductos: Array<{ codigo: string; cantidad: number }> },
    newState: { justificacion: string; direccion: string; consistenteItem: string; items: Array<{ codigo: string; descripcion: string; cantidad: number }>; subproductos: Array<{ codigo: string; cantidad: number }> }
  ): { detalleAntes: string; detalleDespues: string } {
    const lineasAntes: string[] = [];
    const lineasDespues: string[] = [];
    const trim = (s: string) => (s ?? '').toString().trim();

    if (trim(oldState.justificacion) !== trim(newState.justificacion)) {
      lineasAntes.push(`Justificación: ${(oldState.justificacion || '(vacío)').slice(0, 200)}${(oldState.justificacion || '').length > 200 ? '...' : ''}`);
      lineasDespues.push(`Justificación: ${(newState.justificacion || '(vacío)').slice(0, 200)}${(newState.justificacion || '').length > 200 ? '...' : ''}`);
    }
    if (trim(oldState.direccion) !== trim(newState.direccion)) {
      lineasAntes.push(`Dirección: ${(oldState.direccion || '(vacío)').slice(0, 150)}`);
      lineasDespues.push(`Dirección: ${(newState.direccion || '(vacío)').slice(0, 150)}`);
    }
    if (trim(oldState.consistenteItem) !== trim(newState.consistenteItem)) {
      lineasAntes.push(`Consistente: ${(oldState.consistenteItem || '(vacío)').slice(0, 150)}`);
      lineasDespues.push(`Consistente: ${(newState.consistenteItem || '(vacío)').slice(0, 150)}`);
    }

    const oldItems = oldState.items || [];
    const newItems = newState.items || [];
    for (let i = 0; i < Math.max(oldItems.length, newItems.length); i++) {
      const o = oldItems[i];
      const n = newItems[i];
      const codigoO = o ? String(o.codigo || '').trim() : '';
      const codigoN = n ? String(n.codigo || '').trim() : '';
      const descO = o ? String(o.descripcion || '').trim() : '';
      const descN = n ? String(n.descripcion || '').trim() : '';
      const cantO = o ? Number(o.cantidad) : 0;
      const cantN = n ? Number(n.cantidad) : 0;
      if (codigoO !== codigoN || descO !== descN || cantO !== cantN) {
        const etq = codigoN || codigoO || `Ítem ${i + 1}`;
        const descOA = descO.length > 50 ? descO.slice(0, 50) + '...' : descO;
        const descNA = descN.length > 50 ? descN.slice(0, 50) + '...' : descN;
        lineasAntes.push(`Ítem ${etq}: código "${codigoO}", descripción "${descOA || '(vacío)'}", cantidad ${cantO}`);
        lineasDespues.push(`Ítem ${etq}: código "${codigoN}", descripción "${descNA || '(vacío)'}", cantidad ${cantN}`);
      }
    }

    const oldSub = oldState.subproductos || [];
    const newSub = newState.subproductos || [];
    for (let i = 0; i < Math.max(oldSub.length, newSub.length); i++) {
      const o = oldSub[i];
      const n = newSub[i];
      const codigoO = o ? String(o.codigo || '').trim() : '';
      const codigoN = n ? String(n.codigo || '').trim() : '';
      const cantO = o ? Number(o.cantidad) : 0;
      const cantN = n ? Number(n.cantidad) : 0;
      if (codigoO !== codigoN || cantO !== cantN) {
        const etq = codigoN || codigoO || `Subproducto ${i + 1}`;
        lineasAntes.push(`Subproducto ${etq}: cantidad ${cantO}`);
        lineasDespues.push(`Subproducto ${etq}: cantidad ${cantN}`);
      }
    }

    const detalleAntes = lineasAntes.length ? lineasAntes.join('\n') : 'Sin cambios detectados en datos.';
    const detalleDespues = lineasDespues.length ? lineasDespues.join('\n') : 'Reenvío tras rechazo.';
    return { detalleAntes, detalleDespues };
  }

  // Actualizar una solicitud SIAF (corregir); si estaba rechazada, vuelve a pendiente y se registra en bitácora
  app.put('/api/siaf/:id', verifyToken, async (req: Request, res: Response) => {
    try {
      const siafId = parseInt(req.params.id);
      if (isNaN(siafId)) return res.status(400).json({ message: 'ID de solicitud inválido.' });
      const userId = (req as any).user.userId;
      const userRepo = AppDataSource.getRepository(User);
      const siafRepo = AppDataSource.getRepository(SiafSolicitud);
      const solicitud = await siafRepo.findOne({
        where: { id: siafId },
        relations: ['usuarioSolicitante', 'area', 'items', 'subproductos', 'autorizaciones'],
      });
      if (!solicitud) return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
      if (solicitud.usuarioSolicitante?.id !== userId) return res.status(403).json({ message: 'Solo el solicitante puede editar esta solicitud.' });
      const tieneAlgunRechazo = (solicitud.autorizaciones || []).some((a: any) => a.accion === 'rechazado');
      const estabaRechazada = solicitud.estado === 'rechazado' || tieneAlgunRechazo;
      console.log('[SIAF] PUT corrección', { siafId, estado: solicitud.estado, tieneAlgunRechazo, estabaRechazada, numAutorizaciones: (solicitud.autorizaciones || []).length });
      const body = req.body;

      // Solo cuando el SIAF estaba rechazado se captura el estado anterior para el diff y se registra la corrección en bitácora.
      // Si el usuario solo modifica un SIAF pendiente (sin rechazo previo), no se crea ninguna entrada en la bitácora.
      const oldState = estabaRechazada ? {
        justificacion: solicitud.justificacion ?? '',
        direccion: solicitud.direccion ?? '',
        consistenteItem: (solicitud.consistenteItem ?? '').toString(),
        items: (solicitud.items || []).map((i: any) => ({ codigo: i.codigo ?? '', descripcion: i.descripcion ?? '', cantidad: Number(i.cantidad ?? 0) })),
        subproductos: (solicitud.subproductos || []).map((s: any) => ({ codigo: s.codigo ?? '', cantidad: Number(s.cantidad ?? 0) })),
      } : null;

      if (body.fecha != null) solicitud.fecha = new Date(body.fecha);
      if (body.nombreUnidad != null) solicitud.nombreUnidad = body.nombreUnidad;
      if (body.direccion != null) solicitud.direccion = body.direccion;
      if (body.justificacion != null) solicitud.justificacion = body.justificacion;
      if (body.consistenteItem != null || body.consistentItem != null) solicitud.consistenteItem = String(body.consistenteItem ?? body.consistentItem ?? '');
      if (body.nombreSolicitante != null) solicitud.nombreSolicitante = body.nombreSolicitante;
      if (body.puestoSolicitante != null) solicitud.puestoSolicitante = body.puestoSolicitante;
      if (body.unidadSolicitante != null) solicitud.unidadSolicitante = body.unidadSolicitante;
      if (body.nombreAutoridad != null) solicitud.nombreAutoridad = body.nombreAutoridad;
      if (body.puestoAutoridad != null) solicitud.puestoAutoridad = body.puestoAutoridad;
      if (body.unidadAutoridad != null) solicitud.unidadAutoridad = body.unidadAutoridad;
      if (body.areaId != null) {
        const area = await AppDataSource.getRepository(Area).findOneBy({ id: body.areaId });
        if (area) solicitud.area = area;
      }
      if (body.usuarioAutoridadId != null) {
        const userRepo = AppDataSource.getRepository(User);
        const aut = await userRepo.findOneBy({ id: body.usuarioAutoridadId });
        solicitud.usuarioAutoridad = aut || undefined;
      }
      if (body.usuarioEncargadoId != null) {
        const userRepo = AppDataSource.getRepository(User);
        const enc = await userRepo.findOneBy({ id: body.usuarioEncargadoId });
        solicitud.usuarioEncargado = enc || undefined;
      }
      if (body.usuarioEncargadoId === null) {
        (solicitud as any).usuarioEncargado = null;
      }
      if (Array.isArray(body.items)) {
        const itemRepo = AppDataSource.getRepository(SiafItem);
        if (solicitud.items?.length) await itemRepo.remove(solicitud.items);
        solicitud.items = body.items.map((itemData: any, index: number) => {
          const item = new SiafItem();
          item.codigo = itemData.codigo;
          item.descripcion = itemData.descripcion;
          item.cantidad = itemData.cantidad;
          item.orden = index;
          return item;
        });
      }
      if (Array.isArray(body.subproductos)) {
        const subRepo = AppDataSource.getRepository(SiafSubproducto);
        if (solicitud.subproductos?.length) await subRepo.remove(solicitud.subproductos);
        solicitud.subproductos = body.subproductos.map((subData: any, index: number) => {
          const sub = new SiafSubproducto();
          sub.codigo = subData.codigo;
          sub.cantidad = subData.cantidad;
          sub.orden = index;
          return sub;
        });
      }
      if (estabaRechazada) solicitud.estado = 'pendiente';
      await siafRepo.save(solicitud);

      let bitacoraTrasCorreccion: any[] | null = null;
      if (estabaRechazada) {
        const newState = {
          justificacion: (body.justificacion ?? solicitud.justificacion ?? '').toString(),
          direccion: (body.direccion ?? solicitud.direccion ?? '').toString(),
          consistenteItem: (body.consistenteItem ?? body.consistentItem ?? solicitud.consistenteItem ?? '').toString(),
          items: (Array.isArray(body.items) ? body.items : (solicitud.items || [])).map((i: any) => ({
            codigo: (i.codigo ?? '').toString(),
            descripcion: (i.descripcion ?? '').toString(),
            cantidad: Number(i.cantidad ?? 0),
          })),
          subproductos: (Array.isArray(body.subproductos) ? body.subproductos : (solicitud.subproductos || [])).map((s: any) => ({
            codigo: (s.codigo ?? '').toString(),
            cantidad: Number(s.cantidad ?? 0),
          })),
        };
        const { detalleAntes, detalleDespues } = oldState
          ? buildDetalleCorreccion(oldState, newState)
          : { detalleAntes: 'Rechazo previo.', detalleDespues: 'Corrección enviada.' };
        const user = await userRepo.findOneBy({ id: userId });
        if (user) {
          const comentarioCorreccion = 'Corrección registrada automáticamente por el sistema.';
          const siafIdVal = Number(solicitud.id);
          if (!isNaN(siafIdVal)) {
            const qr = AppDataSource.createQueryRunner();
            try {
              await qr.connect();
              await qr.startTransaction();
              await qr.query(
                `INSERT INTO siaf_bitacora (siaf_id, usuario_id, tipo, comentario, detalle_antes, detalle_despues) VALUES ($1, $2, 'correccion', $3, $4, $5)`,
                [siafIdVal, user.id, comentarioCorreccion, detalleAntes ?? '', detalleDespues ?? '']
              );
              await qr.commitTransaction();
              const rowsTrasInsert = await qr.query(
                `SELECT id, tipo, comentario, detalle_antes AS "detalleAntes", detalle_despues AS "detalleDespues", fecha, usuario_id FROM siaf_bitacora WHERE siaf_id = $1 ORDER BY fecha DESC`,
                [siafIdVal]
              );
              bitacoraTrasCorreccion = Array.isArray(rowsTrasInsert) ? rowsTrasInsert : [];
              console.log('[SIAF] Bitácora corrección guardada (siaf_id=', siafIdVal, ') filas=', bitacoraTrasCorreccion.length);
            } catch (errInsert: any) {
              await qr.rollbackTransaction().catch(() => {});
              console.error('[SIAF] Error al guardar corrección en bitácora:', errInsert?.message);
            } finally {
              await qr.release();
            }
          }
        }
      }
      try {
        const pdfBuffer = await pdfGeneratorService.generateSiafPdf(solicitud);
        const pdfInfo = await fileStorageService.saveSiafPdf(pdfBuffer, solicitud.correlativo);
        solicitud.pdfPath = pdfInfo.filePath;
        solicitud.pdfHash = pdfInfo.hash;
        solicitud.pdfSize = pdfInfo.size;
        await siafRepo.save(solicitud);
      } catch (_) {}
      let bitacoraActualizada: any[];
      if (bitacoraTrasCorreccion != null) {
        const userIds = [...new Set(bitacoraTrasCorreccion.map((r: any) => r.usuario_id).filter(Boolean))];
        const users = userIds.length ? await userRepo.find({ where: { id: In(userIds) } }) : [];
        const userMap = new Map(users.map((u) => [u.id, { nombres: u.nombres, apellidos: u.apellidos }]));
        bitacoraActualizada = bitacoraTrasCorreccion.map((row: any) => ({
          id: row.id,
          tipo: String(row.tipo || ''),
          comentario: row.comentario ?? null,
          detalleAntes: row.detalleAntes ?? row.detalle_antes ?? null,
          detalleDespues: row.detalleDespues ?? row.detalle_despues ?? null,
          fecha: row.fecha,
          usuario: row.usuario_id ? (userMap.get(row.usuario_id) ?? { nombres: '', apellidos: '' }) : null,
        }));
      } else {
        bitacoraActualizada = await loadBitacoraBySiafId(Number(solicitud.id));
      }
      res.json({ ...solicitud, bitacora: bitacoraActualizada });
    } catch (error) {
      console.error('Error al actualizar SIAF:', error);
      res.status(500).json({ message: 'Error en el servidor.' });
    }
  });

  // Manejo de errores (p. ej. multer o errores no capturados en rutas)
  app.use((err: any, _req: Request, res: Response, _next: Function) => {
    console.error('Error en petición:', err);
    if (res.headersSent) return;
    const isFileTooLarge = err?.code === 'LIMIT_FILE_SIZE' || err?.message?.includes('File too large');
    const msg = isFileTooLarge
      ? 'Archivo demasiado grande. Límite: 50 MB. Comprima el Excel o use un archivo más pequeño.'
      : (err?.message || String(err));
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