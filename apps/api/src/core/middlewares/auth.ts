import type { Request, RequestHandler } from 'express';
import type { Rol } from '@platinum/shared';
import { HttpError } from '../errors/HttpError';
import { conEmpresa } from '../empresa/contexto';
import { verifyAccessToken } from '../security/jwt';
import type { AuthUser } from '../types/auth';

/** Cabecera con la empresa a la que el super admin eligió entrar (C-09). */
export const CABECERA_EMPRESA = 'x-empresa-id';

/**
 * Usuario del token, con la empresa efectiva: la suya, o la elegida si es super admin (C-09). Lanza si el token es inválido.
 * Solo el super admin puede actuar en otra empresa; para cualquiera más la cabecera se ignora.
 */
function usuarioDeSolicitud(req: Request, token: string): AuthUser {
  const user = verifyAccessToken(token);
  const elegida = Number(req.headers[CABECERA_EMPRESA]);
  if (user.esSuperAdmin && Number.isInteger(elegida) && elegida > 0) user.empresaId = elegida;
  return user;
}

/** Usuario de la sesión si el token es válido; null si falta o no sirve. No responde errores: lo decide quien la use. */
export function sesionOpcional(req: Request): AuthUser | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return usuarioDeSolicitud(req, header.slice(7));
  } catch {
    return null;
  }
}

function createAuthenticate(permitirPasswordTemporal: boolean): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(HttpError.unauthorized());
    }
    try {
      req.user = usuarioDeSolicitud(req, header.slice(7));
    } catch {
      return next(new HttpError(401, 'TOKEN_INVALID', 'Sesión inválida o expirada'));
    }
    if (req.user.debeCambiarPassword && !permitirPasswordTemporal) {
      return next(
        new HttpError(403, 'PASSWORD_CHANGE_REQUIRED', 'Debes cambiar tu contraseña temporal para continuar'),
      );
    }
    // Lo que sigue (y lo asíncrono que lance) corre como parte de la empresa de la sesión (C-08).
    const { empresaId } = req.user;
    if (!empresaId) return next();
    conEmpresa(empresaId, () => next());
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
  const handler: RequestHandler = (req, _res, next) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!roles.includes(req.user.rol)) return next(HttpError.forbidden());
    next();
  };
  // Etiqueta para la prueba que revisa qué pide cada ruta (`rutas-por-permiso.test.ts`).
  return Object.assign(handler, { roles });
}

/** Exige un permiso granular (ej. `usuarios.crear`). El rol admin pasa siempre. */
export function requirePermission(permiso: string): RequestHandler {
  return requireAnyPermission(permiso);
}

/** Basta con uno de estos permisos. El rol admin pasa siempre. */
export function requireAnyPermission(...permisos: string[]): RequestHandler {
  const handler: RequestHandler = (req, _res, next) => {
    if (!req.user) return next(HttpError.unauthorized());
    const user = req.user;
    if (!permisos.some((p) => tienePermiso(user, p))) return next(HttpError.forbidden());
    next();
  };
  // Etiqueta para la prueba que revisa qué pide cada ruta (`rutas-por-permiso.test.ts`).
  return Object.assign(handler, { permisos });
}

/** Misma regla que `requirePermission`, para decisiones dentro de servicios. El admin tiene todo. */
export function tienePermiso(user: AuthUser, permiso: string) {
  return user.rol === 'admin' || user.permisos.includes(permiso);
}
