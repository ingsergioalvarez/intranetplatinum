import type { RequestHandler } from 'express';
import { HttpError } from '../../core';
import { PrismaPrivacidadRepository } from './privacidad.repository';

/** ¿Este usuario aceptó alguna vez el aviso de privacidad? */
export type AvisoAceptado = (usuarioId: number) => Promise<boolean>;

export const avisoAceptadoConPrisma: AvisoAceptado = async (usuarioId) =>
  !!(await new PrismaPrivacidadRepository().ultimaAceptacion(usuarioId));

/** Para pruebas o módulos que no lo piden. */
export const avisoSiempreAceptado: AvisoAceptado = async () => true;

/**
 * Candado del servidor (A-68): quien nunca aceptó el aviso de privacidad no puede checar, verificar su rostro ni
 * registrarlo. Va después de `authenticate`. Aunque la pantalla se salte (por ejemplo con checadas guardadas sin
 * conexión), aquí se rechaza.
 */
export function requireAvisoAceptado(aceptado: AvisoAceptado): RequestHandler {
  return async (req, _res, next) => {
    if (!req.user) return next(HttpError.unauthorized());
    try {
      if (!(await aceptado(req.user.id))) {
        return next(
          new HttpError(403, 'PRIVACY_NOTICE_REQUIRED', 'Falta aceptar el aviso de privacidad para poder checar'),
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
