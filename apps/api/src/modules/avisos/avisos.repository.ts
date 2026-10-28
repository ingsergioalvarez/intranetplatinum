import { PERMISOS, ROLES, tituloDeAviso, type Aviso, type ReglasAviso, type TipoAviso } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { firmarArchivo } from '../../core';
import { notificarPush } from '../push/enviar';

export interface NuevoAviso {
  tipo: TipoAviso;
  /** Título propio del aviso (A-22); sin él se usa el genérico del tipo. */
  titulo?: string;
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
  /** Guardias asignados (directos o por grupo) o cubriendo el sitio hoy. */
  abstract guardiasDelSitio(sitioId: number, hoy: string): Promise<number[]>;
  abstract reglasDelCliente(clienteId: number): Promise<ReglasAviso>;
  /** Deja en cola (pendiente) un correo por contacto con `recibe_notificaciones` y correo. Devuelve cuántos. */
  abstract encolarCorreosCliente(reporteId: number, clienteId: number): Promise<number>;
  /** Usuarios activos con rol cliente asociados a esta empresa. */
  abstract usuariosDelCliente(clienteId: number): Promise<number[]>;
}

export class PrismaAvisosRepository extends AvisosRepository {
  async crear(usuarioIds: number[], { tipo, titulo, mensaje, reporteId }: NuevoAviso) {
    if (usuarioIds.length === 0) return;
    const t = tituloDeAviso(tipo, titulo);
    await getPrisma().aviso.createMany({
      data: usuarioIds.map((usuarioId) => ({ usuarioId, tipo, titulo: t, mensaje: mensaje.slice(0, 255), reporteId })),
    });
    notificarPush(usuarioIds, { tipo, titulo: t, mensaje, reporteId });
  }

  async listar(usuarioId: number, limite: number): Promise<Aviso[]> {
    const rows = await getPrisma().aviso.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        mensaje: true,
        reporteId: true,
        ruta: true,
        fotoClave: true,
        leidoEn: true,
        createdAt: true,
      },
    });
    return rows.map(({ leidoEn, createdAt, fotoClave, titulo, ...a }) => ({
      ...a,
      titulo: tituloDeAviso(a.tipo, titulo),
      foto: fotoClave ? firmarArchivo(fotoClave) : null,
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

  async guardiasDelSitio(sitioId: number, hoy: string): Promise<number[]> {
    const prisma = getPrisma();
    const hoyDate = new Date(`${hoy}T00:00:00.000Z`);
    const [asignaciones, coberturas] = await Promise.all([
      prisma.sitioGuardia.findMany({
        where: {
          sitioId,
          AND: [
            { desde: { lte: hoyDate } },
            { OR: [{ hasta: null }, { hasta: { gte: hoyDate } }] },
          ],
        },
        select: {
          usuarioId: true,
          grupo: {
            select: {
              integrantes: { select: { usuarioId: true } },
            },
          },
        },
      }),
      prisma.cobertura.findMany({
        where: {
          sitioId,
          canceladaEn: null,
          desde: { lte: new Date() },
          hasta: { gte: new Date() },
        },
        select: { usuarioId: true },
      }),
    ]);

    const ids = new Set<number>();
    for (const a of asignaciones) {
      if (a.usuarioId) ids.add(a.usuarioId);
      if (a.grupo) {
        for (const i of a.grupo.integrantes) ids.add(i.usuarioId);
      }
    }
    for (const c of coberturas) {
      ids.add(c.usuarioId);
    }
    return Array.from(ids);
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

  async usuariosDelCliente(clienteId: number): Promise<number[]> {
    const rows = await getPrisma().usuario.findMany({
      where: {
        clienteId,
        activo: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
