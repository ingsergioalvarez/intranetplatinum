import { PERMISOS, ROLES, type Aviso, type ReglasAviso, type TipoAviso } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

export interface NuevoAviso {
  tipo: TipoAviso;
  mensaje: string;
  reporteId: number;
}

/** Avisos en la app y cola de correos al cliente (F3-09, F3-10). */
export abstract class AvisosRepository {
  abstract crear(usuarioIds: number[], aviso: NuevoAviso): Promise<void>;
  abstract listar(usuarioId: number, limite: number): Promise<Aviso[]>;
  abstract contarNoLeidos(usuarioId: number): Promise<number>;
  /** Devuelve false si el aviso no existe o es de otro usuario. */
  abstract marcarLeido(id: number, usuarioId: number): Promise<boolean>;
  abstract marcarTodos(usuarioId: number): Promise<void>;
  /** Usuarios activos que dan seguimiento: con permiso `reportes.estatus` (supervisores y admin). */
  abstract supervisores(): Promise<number[]>;
  abstract reglasDelCliente(clienteId: number): Promise<ReglasAviso>;
  /** Deja en cola (pendiente) un correo por contacto con `recibe_notificaciones` y correo. Devuelve cuántos. */
  abstract encolarCorreosCliente(reporteId: number, clienteId: number): Promise<number>;
}

export class PrismaAvisosRepository extends AvisosRepository {
  async crear(usuarioIds: number[], { tipo, mensaje, reporteId }: NuevoAviso) {
    if (usuarioIds.length === 0) return;
    await getPrisma().aviso.createMany({
      data: usuarioIds.map((usuarioId) => ({ usuarioId, tipo, mensaje: mensaje.slice(0, 255), reporteId })),
    });
  }

  async listar(usuarioId: number, limite: number): Promise<Aviso[]> {
    const rows = await getPrisma().aviso.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: { id: true, tipo: true, mensaje: true, reporteId: true, leidoEn: true, createdAt: true },
    });
    return rows.map(({ leidoEn, createdAt, ...a }) => ({
      ...a,
      leido: leidoEn !== null,
      createdAt: createdAt.toISOString(),
    }));
  }

  contarNoLeidos(usuarioId: number) {
    return getPrisma().aviso.count({ where: { usuarioId, leidoEn: null } });
  }

  async marcarLeido(id: number, usuarioId: number) {
    const { count } = await getPrisma().aviso.updateMany({
      where: { id, usuarioId },
      data: { leidoEn: new Date() },
    });
    return count > 0;
  }

  async marcarTodos(usuarioId: number) {
    await getPrisma().aviso.updateMany({
      where: { usuarioId, leidoEn: null },
      data: { leidoEn: new Date() },
    });
  }

  async supervisores() {
    const rows = await getPrisma().usuario.findMany({
      where: {
        activo: true,
        deletedAt: null,
        OR: [
          { rol: { clave: ROLES.ADMIN } },
          { rol: { permisos: { some: { permiso: { clave: PERMISOS.REPORTES_ESTATUS } } } } },
        ],
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async reglasDelCliente(clienteId: number): Promise<ReglasAviso> {
    const c = await getPrisma().cliente.findUniqueOrThrow({
      where: { id: clienteId },
      select: { avisoPorDefecto: true, reglasAviso: { select: { prioridad: true, destino: true } } },
    });
    return {
      porDefecto: c.avisoPorDefecto,
      porPrioridad: Object.fromEntries(c.reglasAviso.map((r) => [r.prioridad, r.destino])),
    };
  }

  async encolarCorreosCliente(reporteId: number, clienteId: number) {
    const prisma = getPrisma();
    const contactos = await prisma.clienteContacto.findMany({
      where: { clienteId, deletedAt: null, recibeNotificaciones: true, email: { not: null } },
      select: { id: true },
    });
    if (contactos.length === 0) return 0;
    await prisma.notificacion.createMany({
      data: contactos.map((c) => ({ reporteId, contactoId: c.id, canal: 'email' as const })),
    });
    return contactos.length;
  }
}
