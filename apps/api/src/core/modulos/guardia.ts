import type { RequestHandler } from 'express';
import { estadoDesde, type EstadoModulos, type ModuloOpcionalClave } from '@platinum/shared';
import { HttpError } from '../errors/HttpError';
import { getPrisma } from '../data/prisma';
import { sesionOpcional } from '../middlewares/auth';

/** Qué módulos opcionales tiene encendidos una empresa (C-09). */
export abstract class LectorModulos {
  abstract encendidos(empresaId: number): Promise<ReadonlySet<string>>;
  /** Olvida lo recordado de una empresa (al cambiar sus interruptores). */
  invalidar(_empresaId?: number): void {}
}

/** Lee `empresa_modulos` y recuerda el resultado unos segundos para no consultar en cada petición. */
export class PrismaLectorModulos extends LectorModulos {
  private cache = new Map<number, { hasta: number; modulos: ReadonlySet<string> }>();

  constructor(private readonly ttlMs = 10_000) {
    super();
  }

  async encendidos(empresaId: number) {
    const guardado = this.cache.get(empresaId);
    if (guardado && guardado.hasta > Date.now()) return guardado.modulos;
    const filas = await getPrisma().empresaModulo.findMany({ where: { empresaId, encendido: true }, select: { modulo: true } });
    const modulos = new Set(filas.map((f) => f.modulo));
    this.cache.set(empresaId, { hasta: Date.now() + this.ttlMs, modulos });
    return modulos;
  }

  override invalidar(empresaId?: number) {
    if (empresaId === undefined) this.cache.clear();
    else this.cache.delete(empresaId);
  }
}

export const lectorModulos: LectorModulos = new PrismaLectorModulos();

/** Estado completo (clave → encendido) de los módulos opcionales de una empresa. */
export async function estadoDeModulos(empresaId: number, lector: LectorModulos = lectorModulos): Promise<EstadoModulos> {
  return estadoDesde(await lector.encendidos(empresaId));
}

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
