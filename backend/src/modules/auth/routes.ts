import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../../data-source';
import { User } from '../../entity/User';
import { Credential } from '../../entity/Credential';
import { verifyToken } from '../../middleware/auth';
import { sendPasswordRecoveryEmail } from '../../services/PasswordRecoveryMailService';
import { createTemporaryPassword, validatePassword } from './passwordPolicy';

const PASSWORD_RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_RECOVERY_MAX_REQUESTS = 3;
const passwordRecoveryAttempts = new Map<string, number[]>();

function canRequestPasswordRecovery(key: string): boolean {
  const now = Date.now();
  const attempts = (passwordRecoveryAttempts.get(key) ?? []).filter(
    (timestamp) => now - timestamp < PASSWORD_RECOVERY_WINDOW_MS,
  );
  if (attempts.length >= PASSWORD_RECOVERY_MAX_REQUESTS) {
    passwordRecoveryAttempts.set(key, attempts);
    return false;
  }
  attempts.push(now);
  passwordRecoveryAttempts.set(key, attempts);
  return true;
}

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const codigoEmpleado = String(req.body?.codigoEmpleado ?? '').trim();
    const password = String(req.body?.password ?? '').trim();
    if (!codigoEmpleado || !password) {
      return res.status(400).json({ message: 'Código de empleado y contraseña son requeridos' });
    }
    const credentialRepository = AppDataSource.getRepository(Credential);
    const userRepository = AppDataSource.getRepository(User);
    const credentialRelations = ['user', 'user.puesto', 'user.roles', 'user.roles.permissions'] as const;

    let credential = await credentialRepository.findOne({
      where: { codigoEmpleado },
      relations: [...credentialRelations],
    });

    if (!credential) {
      const userByCode = await userRepository.findOne({ where: { codigoEmpleado } });
      if (userByCode) {
        credential = await credentialRepository.findOne({
          where: { userId: userByCode.id },
          relations: [...credentialRelations],
        });
      }
    }

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

authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const genericResponse = {
    message: 'Si los datos proporcionados coinciden con una cuenta activa, se enviará una contraseña temporal al correo institucional registrado.',
  };
  try {
    const codigoEmpleado = String(req.body?.codigoEmpleado ?? '').trim();
    const correoInstitucional = String(req.body?.correoInstitucional ?? '').trim().toLowerCase();
    const rateKey = `${req.ip}:${codigoEmpleado.toLowerCase()}`;

    if (!codigoEmpleado || !correoInstitucional || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoInstitucional)) {
      return res.status(400).json({ message: 'Ingrese un código de empleado y un correo electrónico válidos.' });
    }
    if (!canRequestPasswordRecovery(rateKey)) {
      return res.status(429).json({
        message: 'Por seguridad, espere unos minutos antes de solicitar otra recuperación.',
      });
    }

    const userRepository = AppDataSource.getRepository(User);
    const credentialRepository = AppDataSource.getRepository(Credential);
    const user = await userRepository
      .createQueryBuilder('user')
      .where('user.codigoEmpleado = :codigoEmpleado', { codigoEmpleado })
      .andWhere('LOWER(user.correoInstitucional) = :correoInstitucional', { correoInstitucional })
      .getOne();

    // La respuesta no revela si el código o correo existe para proteger las cuentas registradas.
    if (!user) {
      return res.status(202).json(genericResponse);
    }

    const temporaryPassword = createTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    let credential = await credentialRepository.findOne({ where: { userId: user.id } });
    if (credential) {
      await credentialRepository.update(credential.id, {
        password: hashedPassword,
        isTempPassword: true,
        codigoEmpleado: user.codigoEmpleado,
      });
    } else {
      credential = credentialRepository.create({
        codigoEmpleado: user.codigoEmpleado,
        password: hashedPassword,
        userId: user.id,
        isTempPassword: true,
      });
      await credentialRepository.save(credential);
    }

    await sendPasswordRecoveryEmail({
      recipient: user.correoInstitucional,
      recipientName: [user.nombres, user.apellidos].filter(Boolean).join(' ') || 'Usuario',
      temporaryPassword,
    });

    return res.status(202).json(genericResponse);
  } catch (error: any) {
    // No se expone información de infraestructura ni de cuentas en una ruta pública.
    console.error('Error al procesar recuperación de contraseña:', error?.message || error);
    return res.status(202).json(genericResponse);
  }
});

authRouter.get('/me', verifyToken, async (req: Request, res: Response) => {
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

authRouter.post('/change-password', verifyToken, async (req: Request, res: Response) => {
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
