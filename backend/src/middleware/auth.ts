import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

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

// Middleware: solo permite si el usuario tiene al menos uno de los roles indicados (requiere verifyToken antes)
export const authorizeRoles = (allowedRoles: string[]) => (req: Request, res: Response, next: Function) => {
  const userRoles: string[] = (req as any).user?.roles ?? [];
  const hasRole = allowedRoles.some((r) => userRoles.includes(r));
  if (!hasRole) {
    return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
  }
  next();
};

// Middleware: permite si tiene uno de los roles O uno de los permisos (requiere verifyToken antes; el JWT debe incluir permissions)
export const authorizeRolesOrPermissions = (allowedRoles: string[], allowedPermissions: string[]) => (req: Request, res: Response, next: Function) => {
  const userRoles: string[] = (req as any).user?.roles ?? [];
  const userPermissions: string[] = (req as any).user?.permissions ?? [];
  const hasRole = allowedRoles.some((r) => userRoles.includes(r));
  const hasPermission = allowedPermissions.some((p) => userPermissions.includes(p));
  if (hasRole || hasPermission) return next();
  return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
};
