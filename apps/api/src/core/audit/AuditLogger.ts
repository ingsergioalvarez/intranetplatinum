import type { Request } from 'express';
import { getPrisma } from '../data/prisma';
import { empresaOpcional, sinFiltroDeEmpresa } from '../empresa/contexto';
import type { AuthUser } from '../types/auth';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

/** Contexto de una acción administrativa: quién la hace y desde dónde. */
export interface AccionCtx extends RequestContext {
  actorId: number;
  /** Quien hace la acción completo (rol y permisos). */
  actor?: AuthUser;
}

export interface AuditEvent extends RequestContext {
  /** null/undefined = acción del sistema o intento anónimo. */
  usuarioId?: number | null;
  /** Empresa a la que pertenece el evento; si no se indica se toma la del contexto o la del usuario (C-08). */
  empresaId?: number | null;
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

/**
 * Empresa de un evento: la indicada, o la del contexto, o (en eventos de acceso, que ocurren antes de tener
 * contexto) la de su usuario. Los eventos de plataforma (`plataforma.*`) y los anónimos quedan sin empresa:
 * solo los ve el super admin.
 */
async function empresaDelEvento({ empresaId, usuarioId, accion }: AuditEvent): Promise<number | null> {
  if (empresaId !== undefined) return empresaId;
  if (accion.startsWith('plataforma.')) return null;
  const delContexto = empresaOpcional();
  if (delContexto !== null || !usuarioId) return delContexto;
  const prisma = getPrisma();
  const u = await sinFiltroDeEmpresa(() =>
    prisma.usuario.findUnique({ where: { id: usuarioId }, select: { empresaId: true } }),
  );
  return u?.empresaId ?? null;
}

export class PrismaAuditLogger extends AuditLogger {
  protected async guardar(evento: AuditEvent) {
    const { usuarioId, accion, entidad, entidadId, datos, ip, userAgent } = evento;
    await getPrisma().auditoria.create({
      data: {
        empresaId: await empresaDelEvento(evento),
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
