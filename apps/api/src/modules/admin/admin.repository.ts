import type { HistorialCliente, HistorialSitio, HistorialUsuario } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';

export interface UsuarioEliminable {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  deletedAt: Date | null;
  esSuperAdmin?: boolean;
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

  // ---- Sitios y clientes (DA-50) ----
  abstract findSitio(id: number): Promise<{ id: number; nombre: string; clienteId: number } | null>;
  abstract findCliente(id: number): Promise<{ id: number; nombre: string } | null>;
  abstract historialSitio(id: number): Promise<HistorialSitio>;
  abstract historialCliente(id: number): Promise<HistorialCliente>;
  /**
   * Borra el sitio y todo lo que depende de él (asignaciones, sus checadas, sus reportes con
   * seguimientos y evidencias, coberturas). Devuelve las claves de archivos a borrar.
   */
  abstract eliminarSitio(id: number): Promise<string[]>;
  /** Borra el cliente con sus sitios, reportes y contactos; sus usuarios del portal quedan sin cliente. */
  abstract eliminarCliente(id: number): Promise<string[]>;
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
        esSuperAdmin: true,
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
    const [marcas, rostros, asignaciones] = await Promise.all([
      db.marcacion.count({ where: { usuarioId: id } }),
      db.rostroGuardia.count({ where: { usuarioId: id } }),
      db.sitioGuardia.count({ where: { usuarioId: id } }),
    ]);
    return { marcas, rostros, asignaciones };
  }

  eliminarUsuario(id: number) {
    return getPrisma().$transaction(async (tx) => {
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
        ...marcas.map((m) => m.fotoClave!),
        ...new Set(
          rostros.flatMap((r) => [r.fotoClave, ...(Array.isArray(r.fotos) ? (r.fotos as string[]) : [])]),
        ),
        ...incidencias.map((i) => i.fotoClave),
      ];
    });
  }

  // ---------- Sitios y clientes ----------

  async findSitio(id: number) {
    const s = await getPrisma().sitio.findUnique({
      where: { id },
      select: { id: true, nombre: true, clienteId: true },
    });
    return s && { id: s.id, nombre: s.nombre, clienteId: s.clienteId };
  }

  async findCliente(id: number) {
    const c = await getPrisma().cliente.findUnique({
      where: { id },
      select: { id: true, nombreComercial: true },
    });
    return c && { id: c.id, nombre: c.nombreComercial };
  }

  private async contarSitios(sitioIds: number[]): Promise<HistorialSitio> {
    const db = getPrisma();
    const [asignaciones, marcas, coberturas] = await Promise.all([
      db.sitioGuardia.count({ where: { sitioId: { in: sitioIds } } }),
      db.marcacion.count({ where: { sitioId: { in: sitioIds } } }),
      db.cobertura.count({ where: { sitioId: { in: sitioIds } } }),
    ]);
    return { asignaciones, marcas, coberturas };
  }

  historialSitio(id: number) {
    return this.contarSitios([id]);
  }

  async historialCliente(id: number): Promise<HistorialCliente> {
    const db = getPrisma();
    const sitios = (await db.sitio.findMany({ where: { clienteId: id }, select: { id: true } })).map(
      (x) => x.id,
    );
    const historial = await this.contarSitios(sitios);
    return { ...historial, sitios: sitios.length };
  }

  /** Borra, dentro de la transacción, todo lo que cuelga de esos sitios; devuelve los archivos. */
  private async borrarSitios(tx: Prisma.TransactionClient, sitioIds: number[]) {
    const marcas = await tx.marcacion.findMany({
      where: { sitioId: { in: sitioIds }, fotoClave: { not: null } },
      select: { fotoClave: true },
    });
    await tx.marcacion.deleteMany({ where: { sitioId: { in: sitioIds } } });
    await tx.sitioGuardia.deleteMany({ where: { sitioId: { in: sitioIds } } });
    // Coberturas y turnos del día se borran en cascada; incidencias de rostro y bitácora conservan
    // su registro (el sitio queda en blanco).
    await tx.sitio.deleteMany({ where: { id: { in: sitioIds } } });
    return marcas.map((m) => m.fotoClave!);
  }

  eliminarSitio(id: number) {
    return getPrisma().$transaction((tx) => this.borrarSitios(tx, [id]));
  }

  eliminarCliente(id: number) {
    return getPrisma().$transaction((tx) => this.borrarCliente(tx, id));
  }

  /** Borra el cliente con todo lo suyo dentro de la transacción; devuelve los archivos. */
  private async borrarCliente(tx: Prisma.TransactionClient, id: number) {
    {
      const sitios = (await tx.sitio.findMany({ where: { clienteId: id }, select: { id: true } })).map(
        (x) => x.id,
      );
      const archivos = await this.borrarSitios(tx, sitios);
      await tx.cliente.delete({ where: { id } });
      return archivos;
    }
  }
}
