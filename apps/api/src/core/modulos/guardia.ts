import type { RequestHandler } from 'express';
import type { ModuloOpcionalClave } from '@platinum/shared';
import { HttpError } from '../errors/HttpError';
import { sesionOpcional } from '../middlewares/auth';
import { lectorModulos, type LectorModulos } from './lector';

/**
 * Bloquea (403 `MODULO_APAGADO`) las rutas de un módulo opcional que la empresa de la sesión tiene apagado.
 * Se monta antes del router del módulo: sin sesión válida deja pasar y el propio módulo responde 401.
 */
export function guardiaDeModulo(clave: ModuloOpcionalClave, lector: LectorModulos = lectorModulos): RequestHandler {
  return (req, _res, next) => {
    const user = sesionOpcional(req);
    if (!user?.empresaId) return next();
    lector
      .encendidos(user.empresaId)
      .then((on) => (on.has(clave) ? next() : next(new HttpError(403, 'MODULO_APAGADO', 'Este módulo no está disponible para tu empresa'))))
      .catch(next);
  };
}
