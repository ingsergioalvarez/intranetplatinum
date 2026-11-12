import { createHash } from 'node:crypto';
import type { Rol } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';

export interface SuscripcionRow {
  id: number;
  usuarioId: number;
  /** Nombre de la cuenta: en un celular compartido la notificación dice "para NOMBRE". */
  nombre: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** Este celular lo usan varias cuentas (A-77): la notificación oculta su contenido. */
  compartida: boolean;
}

/** Un celular (una fila aunque tenga varias cuentas) con los roles de sus cuentas: para los tips (A-78). */
export interface TelefonoRow {
  /** Una de sus suscripciones (sirve para borrarla si el celular ya no existe). */
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  roles: Rol[];
}

export interface NuevaSuscripcion {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

/** Celulares (navegadores) suscritos a las notificaciones push (A-20). */
export abstract class PushRepository {
  /**
   * Liga este celular a la cuenta (sin quitárselo a las demás). Con `dispositivoId` (su perfil rápido en este celular,
   * si es de ella y sigue vigente) la liga sigue aunque cierre sesión; sin él, solo mientras tenga la sesión abierta.
   * Además suelta las cuentas que ya no tienen ninguna de las dos cosas en este celular.
   */
  abstract guardar(usuarioId: number, s: NuevaSuscripcion, dispositivoId?: number | null): Promise<void>;
  abstract quitar(usuarioId: number, endpoint: string): Promise<void>;
  abstract quitarPorId(id: number): Promise<void>;
  abstract deUsuarios(usuarioIds: number[]): Promise<SuscripcionRow[]>;
  /** Cada celular una vez, con los roles de las cuentas que lo usan (tips). */
  abstract telefonos(): Promise<TelefonoRow[]>;
  /** Reserva el turno de un tip (`2026-11-14`); false si ya estaba reservado: así un reinicio no lo repite. */
  abstract reservarTip(slot: string): Promise<boolean>;
}

export const hashEndpoint = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex');

/** La liga cuenta-celular cuenta mientras su perfil rápido siga vigente, o si no depende de uno (sesión abierta). */
const vigente: Prisma.SuscripcionPushWhereInput = { OR: [{ dispositivoId: null }, { dispositivo: { revocadoEn: null } }] };
const cuentaActiva: Prisma.UsuarioWhereInput = { deletedAt: null, activo: true };

export class PrismaPushRepository extends PushRepository {
  async guardar(usuarioId: number, s: NuevaSuscripcion, dispositivoId: number | null = null) {
    const db = getPrisma();
    const endpointHash = hashEndpoint(s.endpoint);
    // El perfil rápido tiene que ser de esta cuenta y seguir vigente; si no, se ignora.
    const perfil = dispositivoId
      ? await db.dispositivoUsuario.findFirst({ where: { id: dispositivoId, usuarioId, revocadoEn: null }, select: { id: true } })
      : null;
    const datos = {
      endpoint: s.endpoint,
      p256dh: s.p256dh,
      auth: s.auth,
      userAgent: s.userAgent?.slice(0, 255) ?? null,
      dispositivoId: perfil?.id ?? null,
    };
    await db.suscripcionPush.upsert({
      where: { endpointHash_usuarioId: { endpointHash, usuarioId } },
      create: { endpointHash, usuarioId, ...datos },
      update: datos,
    });
    // Las demás cuentas de este celular que ya no lo tienen guardado (cerraron sesión sin perfil rápido, o su perfil
    // se quitó) dejan de recibir avisos aquí.
    await db.suscripcionPush.deleteMany({
      where: {
        endpointHash,
        usuarioId: { not: usuarioId },
        OR: [{ dispositivoId: null }, { dispositivo: { revocadoEn: { not: null } } }],
      },
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
    const db = getPrisma();
    const filas = await db.suscripcionPush.findMany({
      where: { usuarioId: { in: usuarioIds }, usuario: cuentaActiva, ...vigente },
      select: {
        id: true,
        usuarioId: true,
        endpointHash: true,
        endpoint: true,
        p256dh: true,
        auth: true,
        usuario: { select: { nombre: true } },
      },
    });
    if (filas.length === 0) return [];
    // Cuántas cuentas vigentes tiene cada uno de esos celulares.
    const ligas = await db.suscripcionPush.findMany({
      where: { endpointHash: { in: [...new Set(filas.map((f) => f.endpointHash))] }, usuario: cuentaActiva, ...vigente },
      select: { endpointHash: true, usuarioId: true },
    });
    const cuentas = new Map<string, Set<number>>();
    for (const l of ligas) cuentas.set(l.endpointHash, (cuentas.get(l.endpointHash) ?? new Set()).add(l.usuarioId));
    return filas.map(({ endpointHash, usuario, ...f }) => ({
      ...f,
      nombre: usuario.nombre,
      compartida: (cuentas.get(endpointHash)?.size ?? 0) > 1,
    }));
  }

  async telefonos() {
    const filas = await getPrisma().suscripcionPush.findMany({
      where: { usuario: cuentaActiva, ...vigente },
      select: {
        id: true,
        endpointHash: true,
        endpoint: true,
        p256dh: true,
        auth: true,
        usuario: { select: { rol: { select: { clave: true } } } },
      },
    });
    const porCelular = new Map<string, TelefonoRow>();
    for (const f of filas) {
      const rol = f.usuario.rol.clave as Rol;
      const actual = porCelular.get(f.endpointHash);
      if (!actual) porCelular.set(f.endpointHash, { id: f.id, endpoint: f.endpoint, p256dh: f.p256dh, auth: f.auth, roles: [rol] });
      else if (!actual.roles.includes(rol)) actual.roles.push(rol);
    }
    return [...porCelular.values()];
  }

  async reservarTip(slot: string) {
    try {
      await getPrisma().tipEnvio.create({ data: { slot } });
      return true;
    } catch (err) {
      // Llave repetida: ya se envió (otro proceso o antes del reinicio).
      if ((err as { code?: string }).code === 'P2002') return false;
      throw err;
    }
  }
}
