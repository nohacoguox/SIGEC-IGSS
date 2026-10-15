import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

function isSuperAdmin(req: Request): boolean {
  const userRoles: string[] = (req as any).user?.roles ?? [];
  return userRoles.some((r) => String(r || '').toLowerCase() === 'super administrador');
}

// Verify Token Middleware
export const verifyToken = (req: Request, res: Response, next: Function) => {
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

/**
 * Autoriza si:
 * - es super administrador, o
 * - tiene alguno de los nombres en `allowed` como rol, o
 * - tiene alguno de los nombres en `allowed` como permiso (slug).
 *
 * Nota: muchas rutas pasan slugs de permiso (gestionar-usuarios, crear-siaf, etc.)
 * en este mismo arreglo; por eso se contrastan también contra JWT.permissions.
 */
export const authorizeRoles = (allowed: string[]) => (req: Request, res: Response, next: Function) => {
  if (isSuperAdmin(req)) return next();
  const userRoles: string[] = (req as any).user?.roles ?? [];
  const userPermissions: string[] = (req as any).user?.permissions ?? [];
  const allowedNorm = allowed.map((a) => String(a || '').toLowerCase());
  const hasRole = userRoles.some((r) => allowedNorm.includes(String(r || '').toLowerCase()));
  const hasPermission = userPermissions.some((p) => allowedNorm.includes(String(p || '').toLowerCase()));
  if (!hasRole && !hasPermission) {
    return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
  }
  next();
};

// Middleware: permite si tiene uno de los roles O uno de los permisos
export const authorizeRolesOrPermissions = (allowedRoles: string[], allowedPermissions: string[]) => (
  req: Request,
  res: Response,
  next: Function
) => {
  if (isSuperAdmin(req)) return next();
  const userRoles: string[] = (req as any).user?.roles ?? [];
  const userPermissions: string[] = (req as any).user?.permissions ?? [];
  const rolesNorm = allowedRoles.map((r) => String(r || '').toLowerCase());
  const permsNorm = allowedPermissions.map((p) => String(p || '').toLowerCase());
  const hasRole = userRoles.some((r) => rolesNorm.includes(String(r || '').toLowerCase()));
  const hasPermission = userPermissions.some((p) => permsNorm.includes(String(p || '').toLowerCase()));
  if (hasRole || hasPermission) return next();
  return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
};
