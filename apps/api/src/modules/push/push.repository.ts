import { createHash } from 'node:crypto';
import { getPrisma } from '../../core/data/prisma';

export interface SuscripcionRow {
  id: number;
  usuarioId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NuevaSuscripcion {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

/** Celulares (navegadores) suscritos a las notificaciones push (A-20). */
export abstract class PushRepository {
  /** Crea la suscripción, o la pasa a este usuario si ese navegador ya estaba registrada. */
  abstract guardar(usuarioId: number, s: NuevaSuscripcion): Promise<void>;
  abstract quitar(usuarioId: number, endpoint: string): Promise<void>;
  abstract quitarPorId(id: number): Promise<void>;
  abstract deUsuarios(usuarioIds: number[]): Promise<SuscripcionRow[]>;
}

export const hashEndpoint = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex');

export class PrismaPushRepository extends PushRepository {
  async guardar(usuarioId: number, s: NuevaSuscripcion) {
    const datos = {
      usuarioId,
      endpoint: s.endpoint,
      p256dh: s.p256dh,
      auth: s.auth,
      userAgent: s.userAgent?.slice(0, 255) ?? null,
    };
    await getPrisma().suscripcionPush.upsert({
      where: { endpointHash: hashEndpoint(s.endpoint) },
      create: { endpointHash: hashEndpoint(s.endpoint), ...datos },
      update: datos,
    });
  }

  async quitar(usuarioId: number, endpoint: string) {
    await getPrisma().suscripcionPush.deleteMany({ where: { endpointHash: hashEndpoint(endpoint), usuarioId } });
  }

  async quitarPorId(id: number) {
    await getPrisma().suscripcionPush.deleteMany({ where: { id } });
  }

  async deUsuarios(usuarioIds: number[]) {
    if (usuarioIds.length === 0) return [];
    return getPrisma().suscripcionPush.findMany({
      where: { usuarioId: { in: usuarioIds }, usuario: { deletedAt: null } },
      select: { id: true, usuarioId: true, endpoint: true, p256dh: true, auth: true },
    });
  }
}
