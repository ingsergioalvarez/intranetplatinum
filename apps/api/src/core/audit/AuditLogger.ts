import type { Request } from 'express';
import { getPrisma } from '../data/prisma';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

/** Contexto de una acción administrativa: quién la hace y desde dónde. */
export interface AccionCtx extends RequestContext {
  actorId: number;
}

export interface AuditEvent extends RequestContext {
  /** null/undefined = acción del sistema o intento anónimo. */
  usuarioId?: number | null;
  /** `<modulo>.<accion>`, p. ej. `auth.login`, `usuarios.baja`. */
  accion: string;
  entidad?: string;
  entidadId?: string | number;
  datos?: Record<string, unknown>;
}

/** Extrae IP y navegador de la petición para auditoría y sesiones. */
export function requestContext(req: Request): RequestContext {
  return { ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 255) };
}

/**
 * Registro en la tabla `auditoria`. Un fallo al auditar nunca debe romper
 * la operación de negocio: se reporta en consola y se continúa.
 */
export abstract class AuditLogger {
  async registrar(evento: AuditEvent): Promise<void> {
    try {
      await this.guardar(evento);
    } catch (err) {
      console.error(`[auditoria] No se pudo registrar ${evento.accion}`, err);
    }
  }

  /** Atajo para acciones administrativas sobre una entidad. */
  registrarAccion(
    { actorId, ip, userAgent }: AccionCtx,
    accion: string,
    entidad: string,
    entidadId: number,
    datos?: Record<string, unknown>,
  ) {
    return this.registrar({ usuarioId: actorId, accion, entidad, entidadId, datos, ip, userAgent });
  }

  protected abstract guardar(evento: AuditEvent): Promise<void>;
}

export class PrismaAuditLogger extends AuditLogger {
  protected async guardar({ usuarioId, accion, entidad, entidadId, datos, ip, userAgent }: AuditEvent) {
    await getPrisma().auditoria.create({
      data: {
        usuarioId: usuarioId ?? null,
        accion,
        entidad,
        entidadId: entidadId === undefined ? undefined : String(entidadId),
        datos: datos as object | undefined,
        ip,
        userAgent,
      },
    });
  }
}
