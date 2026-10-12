import type { RequestHandler } from 'express';
import type { Rol } from '@platinum/shared';
import { HttpError } from '../errors/HttpError';
import { verifyAccessToken } from '../security/jwt';

/** Exige `Authorization: Bearer <accessToken>` válido y deja el usuario en `req.user`. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(HttpError.unauthorized());
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    next(new HttpError(401, 'TOKEN_INVALID', 'Sesión inválida o expirada'));
  }
};

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
    if (req.user.rol !== 'admin' && !req.user.permisos.includes(permiso)) {
      return next(HttpError.forbidden());
    }
    next();
  };
}
