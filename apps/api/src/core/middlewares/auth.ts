import type { RequestHandler } from 'express';
import type { Rol } from '@platinum/shared';
import { HttpError } from '../errors/HttpError';
import { verifyAccessToken } from '../security/jwt';
import type { AuthUser } from '../types/auth';

function createAuthenticate(permitirPasswordTemporal: boolean): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(HttpError.unauthorized());
    }
    try {
      req.user = verifyAccessToken(header.slice(7));
    } catch {
      return next(new HttpError(401, 'TOKEN_INVALID', 'Sesión inválida o expirada'));
    }
    if (req.user.debeCambiarPassword && !permitirPasswordTemporal) {
      return next(
        new HttpError(403, 'PASSWORD_CHANGE_REQUIRED', 'Debes cambiar tu contraseña temporal para continuar'),
      );
    }
    next();
  };
}

/**
 * Exige `Authorization: Bearer <accessToken>` válido y deja el usuario en `req.user`.
 * Con contraseña temporal pendiente responde 403 PASSWORD_CHANGE_REQUIRED (D-012).
 */
export const authenticate = createAuthenticate(false);

/** Igual que `authenticate` pero admite contraseña temporal: solo para cambiarla. */
export const authenticateAllowingTemporaryPassword = createAuthenticate(true);

/** Permite el acceso solo a los roles indicados. Usar después de `authenticate`. */
export function requireRoles(...roles: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!roles.includes(req.user.rol)) return next(HttpError.forbidden());
    next();
  };
}

/** Exige un permiso granular (ej. `usuarios.crear`). El rol admin pasa siempre. */
export function requirePermission(permiso: string): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!tienePermiso(req.user, permiso)) return next(HttpError.forbidden());
    next();
  };
}

/** Misma regla que `requirePermission`, para decisiones dentro de servicios. El admin tiene todo. */
export function tienePermiso(user: AuthUser, permiso: string) {
  return user.rol === 'admin' || user.permisos.includes(permiso);
}
