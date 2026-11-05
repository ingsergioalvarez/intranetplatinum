import type { Paginated, PaginationQuery, Rol, Usuario, UsuarioFiltro } from '@platinum/shared';
import { BaseRepository } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { empresaActual } from '../../core/empresa/contexto';

export interface UsuarioCreateData {
  nombre: string;
  email: string;
  telefono?: string | null;
  telefonoPersonal?: string | null;
  rol: Rol;
  /** Admin dueño (A-65). */
  propietarioId?: number | null;
  passwordHash: string;
  debeCambiarPassword: boolean;
}

export interface UsuarioUpdateData {
  nombre?: string;
  email?: string;
  telefono?: string | null;
  telefonoPersonal?: string | null;
  rol?: Rol;
}

export type UsuarioFiltroData = Omit<UsuarioFiltro, 'page' | 'limit'> & {
  /** Admin que consulta: ve a los suyos y a sí mismo (A-65). Sin esto (super admin) ve todos. */
  cartera?: { adminId: number; /** Además de los de la cartera, estos ids (él mismo). */ tambien: number[] };
};

export abstract class UsuariosRepository extends BaseRepository<
  Usuario,
  UsuarioCreateData,
  UsuarioUpdateData,
  UsuarioFiltroData
> {
  /** Incluye usuarios dados de baja (el correo es único en toda la tabla). */
  abstract findByEmail(email: string): Promise<Usuario | null>;
  /** Administradores activos, para no dejar el sistema sin ninguno. */
  abstract countAdminsActivos(): Promise<number>;
  /** Contraseña temporal (D-012): marca cambio obligatorio y desbloquea la cuenta. */
  abstract setPasswordTemporal(id: number, passwordHash: string): Promise<void>;
  /** Revoca todos los refresh tokens vigentes (baja, reset de contraseña). */
  abstract revocarSesiones(id: number): Promise<void>;
  /** Deja "sin asignar" lo que tenía este admin (A-65). Devuelve cuántos usuarios, clientes y grupos eran. */
  abstract soltarCartera(adminId: number): Promise<{ usuarios: number; clientes: number; grupos: number }>;
}

const select = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  telefonoPersonal: true,
  activo: true,
  esSuperAdmin: true,
  propietario: { select: { id: true, nombre: true } },
  areaId: true,
  debeCambiarPassword: true,
  bloqueadoHasta: true,
  ultimoAcceso: true,
  createdAt: true,
  deletedAt: true,
  rol: { select: { clave: true } },
} as const;

type UsuarioRow = Prisma.UsuarioGetPayload<{ select: typeof select }>;

function toUsuario(u: UsuarioRow): Usuario {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    telefono: u.telefono,
    telefonoPersonal: u.telefonoPersonal,
    rol: u.rol.clave as Rol,
    esSuperAdmin: u.esSuperAdmin,
    propietario: u.propietario,
    areaId: u.areaId,
    activo: u.activo,
    debeCambiarPassword: u.debeCambiarPassword,
    bloqueadoHasta: u.bloqueadoHasta?.toISOString() ?? null,
    ultimoAcceso: u.ultimoAcceso?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    deletedAt: u.deletedAt?.toISOString() ?? null,
  };
}

export class PrismaUsuariosRepository extends UsuariosRepository {
  async findById(id: number) {
    const u = await getPrisma().usuario.findUnique({ where: { id }, select });
    return u && toUsuario(u);
  }

  async findByEmail(email: string) {
    const u = await getPrisma().usuario.findUnique({ where: { email }, select });
    return u && toUsuario(u);
  }

  async findPaged(
    { q, rol, estado, propietarioId, sinAsignar, cartera }: UsuarioFiltroData,
    { page, limit }: PaginationQuery,
  ): Promise<Paginated<Usuario>> {
    const where: Prisma.UsuarioWhereInput = {
      ...(estado === 'activos' && { deletedAt: null }),
      ...(estado === 'baja' && { deletedAt: { not: null } }),
      ...(rol && { rol: { clave: rol } }),
      ...(cartera && {
        OR: [{ propietarioId: cartera.adminId }, { id: { in: [cartera.adminId, ...cartera.tambien] } }],
      }),
      ...(!cartera && sinAsignar && { propietarioId: null, esSuperAdmin: false }),
      ...(!cartera && !sinAsignar && propietarioId && { propietarioId }),
      ...(q && {
        AND: [
          {
            OR: [
              { nombre: { contains: q } },
              { email: { contains: q } },
              { telefono: { contains: q } },
              { telefonoPersonal: { contains: q } },
            ],
          },
        ],
      }),
    };
    const prisma = getPrisma();
    const [rows, total] = await prisma.$transaction([
      prisma.usuario.findMany({
        where,
        select,
        orderBy: [{ deletedAt: 'asc' }, { nombre: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.usuario.count({ where }),
    ]);
    return { items: rows.map(toUsuario), total, page, limit };
  }

  async create({ rol, propietarioId, ...data }: UsuarioCreateData) {
    const u = await getPrisma().usuario.create({
      data: {
        ...data,
        empresa: { connect: { id: empresaActual() } },
        rol: { connect: { clave: rol } },
        ...(propietarioId && { propietario: { connect: { id: propietarioId } } }),
      },
      select,
    });
    return toUsuario(u);
  }

  async update(id: number, { rol, ...data }: UsuarioUpdateData) {
    const u = await getPrisma().usuario.update({
      where: { id },
      data: { ...data, ...(rol && { rol: { connect: { clave: rol } } }) },
      select,
    });
    return toUsuario(u);
  }

  async softDelete(id: number) {
    await getPrisma().usuario.update({ where: { id }, data: { activo: false, deletedAt: new Date() } });
  }

  async restore(id: number) {
    await getPrisma().usuario.update({ where: { id }, data: { activo: true, deletedAt: null } });
  }

  async countAdminsActivos() {
    return getPrisma().usuario.count({ where: { deletedAt: null, activo: true, rol: { clave: 'admin' } } });
  }

  async soltarCartera(adminId: number) {
    const db = getPrisma();
    const donde = { propietarioId: adminId };
    const data = { propietarioId: null };
    const [usuarios, clientes, grupos] = await db.$transaction([
      db.usuario.updateMany({ where: donde, data }),
      db.cliente.updateMany({ where: donde, data }),
      db.grupoGuardias.updateMany({ where: donde, data }),
    ]);
    return { usuarios: usuarios.count, clientes: clientes.count, grupos: grupos.count };
  }

  async setPasswordTemporal(id: number, passwordHash: string) {
    await getPrisma().usuario.update({
      where: { id },
      data: { passwordHash, debeCambiarPassword: true, intentosFallidos: 0, bloqueadoHasta: null },
    });
  }

  async revocarSesiones(id: number) {
    await getPrisma().refreshToken.updateMany({
      where: { usuarioId: id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    // Baja o contraseña temporal: también se quitan sus perfiles rápidos (A-40).
    await getPrisma().dispositivoUsuario.updateMany({
      where: { usuarioId: id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }
}
