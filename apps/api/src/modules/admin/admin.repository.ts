import type { HistorialUsuario } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

export interface UsuarioEliminable {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  deletedAt: Date | null;
}

/** Eliminación definitiva de usuarios (solo admin, para limpiar pruebas). */
export abstract class AdminRepository {
  abstract findUsuario(id: number): Promise<UsuarioEliminable | null>;
  abstract adminsActivos(): Promise<number>;
  abstract historial(id: number): Promise<HistorialUsuario>;
  /**
   * Borra al usuario y todo lo que depende de él, en una transacción: sus reportes (con
   * seguimientos, evidencias, notificaciones y avisos), sus seguimientos y evidencias en otros
   * reportes, sus marcas, rostros y asignaciones. Devuelve las claves de archivos a borrar.
   */
  abstract eliminarUsuario(id: number): Promise<string[]>;
}

export class PrismaAdminRepository extends AdminRepository {
  async findUsuario(id: number) {
    const u = await getPrisma().usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        deletedAt: true,
        rol: { select: { clave: true } },
      },
    });
    return u && { ...u, rol: u.rol.clave };
  }

  adminsActivos() {
    return getPrisma().usuario.count({ where: { activo: true, deletedAt: null, rol: { clave: 'admin' } } });
  }

  async historial(id: number): Promise<HistorialUsuario> {
    const db = getPrisma();
    const [marcas, rostros, reportes, seguimientos, asignaciones] = await Promise.all([
      db.marcacion.count({ where: { usuarioId: id } }),
      db.rostroGuardia.count({ where: { usuarioId: id } }),
      db.reporte.count({ where: { creadoPorId: id } }),
      db.reporteSeguimiento.count({ where: { usuarioId: id } }),
      db.sitioGuardia.count({ where: { usuarioId: id } }),
    ]);
    return { marcas, rostros, reportes, seguimientos, asignaciones };
  }

  eliminarUsuario(id: number) {
    return getPrisma().$transaction(async (tx) => {
      const reportes = (await tx.reporte.findMany({ where: { creadoPorId: id }, select: { id: true } })).map(
        (r) => r.id,
      );
      const evidencias = await tx.reporteEvidencia.findMany({
        where: {
          OR: [{ reporteId: { in: reportes } }, { subidaPorId: id }, { seguimiento: { usuarioId: id } }],
        },
        select: { id: true, archivo: true },
      });
      await tx.reporteEvidencia.deleteMany({ where: { id: { in: evidencias.map((e) => e.id) } } });
      await tx.notificacion.deleteMany({ where: { reporteId: { in: reportes } } });
      await tx.aviso.deleteMany({ where: { reporteId: { in: reportes } } });
      await tx.reporteSeguimiento.deleteMany({
        where: { OR: [{ reporteId: { in: reportes } }, { usuarioId: id }] },
      });
      await tx.reporte.deleteMany({ where: { id: { in: reportes } } });

      const marcas = await tx.marcacion.findMany({
        where: { usuarioId: id, fotoClave: { not: null } },
        select: { fotoClave: true },
      });
      await tx.marcacion.deleteMany({ where: { usuarioId: id } });
      const rostros = await tx.rostroGuardia.findMany({
        where: { usuarioId: id },
        select: { fotoClave: true, fotos: true },
      });
      await tx.rostroGuardia.deleteMany({ where: { usuarioId: id } });
      const incidencias = await tx.incidenciaRostro.findMany({
        where: { usuarioId: id },
        select: { fotoClave: true },
      });
      await tx.incidenciaRostro.deleteMany({ where: { usuarioId: id } });
      await tx.sitioGuardia.deleteMany({ where: { usuarioId: id } });
      // Sesiones, avisos propios y grupos se borran en cascada; la auditoría queda con usuario null.
      await tx.usuario.delete({ where: { id } });

      return [
        ...evidencias.map((e) => e.archivo),
        ...marcas.map((m) => m.fotoClave!),
        ...new Set(
          rostros.flatMap((r) => [r.fotoClave, ...(Array.isArray(r.fotos) ? (r.fotos as string[]) : [])]),
        ),
        ...incidencias.map((i) => i.fotoClave),
      ];
    });
  }
}
