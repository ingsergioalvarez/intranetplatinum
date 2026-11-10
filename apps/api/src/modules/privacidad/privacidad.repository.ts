import { ROLES } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { adminsDe, type ContextoDueno } from '../avisos/duenos';

export interface AceptacionFila {
  version: string;
  aceptadaEn: Date;
}

export interface NuevaAceptacion {
  usuarioId: number;
  version: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface GuardiaFila {
  id: number;
  nombre: string;
}

/** Aceptaciones del aviso de privacidad (A-68). */
export abstract class PrivacidadRepository {
  /** La más reciente de este usuario, de cualquier versión; null si nunca aceptó. */
  abstract ultimaAceptacion(usuarioId: number): Promise<AceptacionFila | null>;
  /** Guarda la aceptación; si ya aceptó esa versión no duplica. */
  abstract aceptar(data: NuevaAceptacion): Promise<void>;
  /** Guardias activos; con `cartera`, solo los de ese admin dueño. */
  abstract guardias(cartera: number | undefined): Promise<GuardiaFila[]>;
  /** Última aceptación de cada usuario de la lista. */
  abstract ultimasAceptaciones(ids: number[]): Promise<Map<number, AceptacionFila>>;
  /** ¿Ya hay un aviso de campanita sin atender para este guardia? Evita repetirlo. */
  abstract hayAvisoPendiente(usuarioId: number): Promise<boolean>;
  abstract adminsDe(contexto: ContextoDueno): Promise<number[]>;
  abstract nombreDe(usuarioId: number): Promise<string | null>;
}

export class PrismaPrivacidadRepository extends PrivacidadRepository {
  async ultimaAceptacion(usuarioId: number) {
    return getPrisma().aceptacionAvisoPrivacidad.findFirst({
      where: { usuarioId },
      orderBy: { aceptadaEn: 'desc' },
      select: { version: true, aceptadaEn: true },
    });
  }

  async aceptar({ usuarioId, version, ip, userAgent }: NuevaAceptacion) {
    await getPrisma().aceptacionAvisoPrivacidad.upsert({
      where: { usuarioId_version: { usuarioId, version } },
      create: { usuarioId, version, ip: ip ?? null, userAgent: userAgent?.slice(0, 255) ?? null },
      update: {},
    });
  }

  async guardias(cartera: number | undefined) {
    return getPrisma().usuario.findMany({
      where: {
        activo: true,
        deletedAt: null,
        rol: { clave: ROLES.GUARDIA },
        ...(cartera !== undefined && { propietarioId: cartera }),
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async ultimasAceptaciones(ids: number[]) {
    const mapa = new Map<number, AceptacionFila>();
    if (ids.length === 0) return mapa;
    const filas = await getPrisma().aceptacionAvisoPrivacidad.findMany({
      where: { usuarioId: { in: ids } },
      orderBy: { aceptadaEn: 'desc' },
      select: { usuarioId: true, version: true, aceptadaEn: true },
    });
    for (const f of filas) if (!mapa.has(f.usuarioId)) mapa.set(f.usuarioId, f);
    return mapa;
  }

  async hayAvisoPendiente(usuarioId: number) {
    const n = await getPrisma().aviso.count({
      where: { entidad: 'aviso_privacidad', entidadId: usuarioId, atendidoEn: null },
    });
    return n > 0;
  }

  adminsDe(contexto: ContextoDueno) {
    return adminsDe(contexto);
  }

  async nombreDe(usuarioId: number) {
    const u = await getPrisma().usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } });
    return u?.nombre ?? null;
  }
}
