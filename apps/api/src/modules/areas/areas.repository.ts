import type { Rol } from '@platinum/shared';
import { empresaActual } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';

export interface AreaFila {
  id: number;
  nombre: string;
  padreId: number | null;
  jefeId: number | null;
  jefeNombre: string | null;
  deletedAt: Date | null;
  /** Personas que están directamente en el área. */
  personas: number;
}

export interface PersonaFila {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface UsuarioParaArea {
  id: number;
  nombre: string;
  areaId: number | null;
  rol: Rol;
}

export interface CandidatoFila extends PersonaFila {
  area: { id: number } | null;
}

export abstract class AreasRepository {
  /** Todas las áreas de la empresa, también las dadas de baja. */
  abstract todas(): Promise<AreaFila[]>;
  abstract find(id: number): Promise<AreaFila | null>;
  abstract crear(data: { nombre: string; padreId: number | null }): Promise<AreaFila>;
  abstract actualizar(id: number, data: { nombre?: string; padreId?: number | null; jefeId?: number | null }): Promise<void>;
  /** Da de baja las áreas indicadas: quedan sin jefe y sus personas sin área. */
  abstract darDeBaja(ids: number[]): Promise<void>;
  abstract reactivar(id: number): Promise<void>;
  /** Borra para siempre estas áreas (en este orden: las subáreas antes que su superior). Sus personas quedan sin área. */
  abstract eliminar(ids: number[]): Promise<void>;
  abstract personas(areaId: number): Promise<PersonaFila[]>;
  abstract usuario(id: number): Promise<UsuarioParaArea | null>;
  /** Cambia el rol de una persona. Con `soloSiEs`, solo si hoy tiene ese rol. Devuelve si lo cambió. */
  abstract ponerRol(usuarioId: number, rol: Rol, soloSiEs?: Rol): Promise<boolean>;
  /** Cambia el área de una persona (null = sin área). Si era jefe de otra área, deja de serlo. */
  abstract asignar(usuarioId: number, areaId: number | null): Promise<void>;
  abstract candidatos(q: string | undefined): Promise<CandidatoFila[]>;
}

const select = {
  id: true,
  nombre: true,
  padreId: true,
  jefeId: true,
  deletedAt: true,
  jefe: { select: { nombre: true } },
  _count: { select: { personas: { where: { deletedAt: null } } } },
} satisfies Prisma.AreaSelect;

type Fila = Prisma.AreaGetPayload<{ select: typeof select }>;

const aFila = ({ jefe, _count, ...a }: Fila): AreaFila => ({
  ...a,
  jefeNombre: jefe?.nombre ?? null,
  personas: _count.personas,
});

const seleccionPersona = { id: true, nombre: true, email: true, rol: { select: { clave: true } } } satisfies Prisma.UsuarioSelect;

export class PrismaAreasRepository extends AreasRepository {
  async todas() {
    const rows = await getPrisma().area.findMany({ select, orderBy: [{ nombre: 'asc' }] });
    return rows.map(aFila);
  }

  async find(id: number) {
    const a = await getPrisma().area.findUnique({ where: { id }, select });
    return a && aFila(a);
  }

  async crear({ nombre, padreId }: { nombre: string; padreId: number | null }) {
    return aFila(await getPrisma().area.create({ data: { nombre, padreId, empresaId: empresaActual() }, select }));
  }

  async actualizar(id: number, data: { nombre?: string; padreId?: number | null; jefeId?: number | null }) {
    await getPrisma().area.update({ where: { id }, data });
  }

  async darDeBaja(ids: number[]) {
    const prisma = getPrisma();
    await prisma.$transaction([
      prisma.area.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), jefeId: null } }),
      prisma.usuario.updateMany({ where: { areaId: { in: ids } }, data: { areaId: null } }),
    ]);
  }

  async eliminar(ids: number[]) {
    const prisma = getPrisma();
    await prisma.$transaction([
      prisma.usuario.updateMany({ where: { areaId: { in: ids } }, data: { areaId: null } }),
      prisma.area.updateMany({ where: { id: { in: ids } }, data: { jefeId: null } }),
      // Una por una y de las subáreas hacia arriba: la llave del área superior no admite borrarla antes.
      ...ids.map((id) => prisma.area.deleteMany({ where: { id } })),
    ]);
  }

  async reactivar(id: number) {
    await getPrisma().area.update({ where: { id }, data: { deletedAt: null } });
  }

  async personas(areaId: number) {
    const rows = await getPrisma().usuario.findMany({
      where: { areaId, deletedAt: null },
      select: seleccionPersona,
      orderBy: { nombre: 'asc' },
    });
    return rows.map(({ rol, ...u }) => ({ ...u, rol: rol.clave as Rol }));
  }

  async usuario(id: number) {
    const u = await getPrisma().usuario.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, nombre: true, areaId: true, rol: { select: { clave: true } } },
    });
    return u && { id: u.id, nombre: u.nombre, areaId: u.areaId, rol: u.rol.clave as Rol };
  }

  async ponerRol(usuarioId: number, rol: Rol, soloSiEs?: Rol) {
    const prisma = getPrisma();
    const destino = await prisma.rol.findFirst({ where: { clave: rol }, select: { id: true } });
    // Los roles los crea el seed: sin él, designar jefes no puede cambiar el rol y es mejor enterarse.
    if (!destino) throw new Error(`Falta el rol "${rol}": ejecuta npm run db:seed`);
    const { count } = await prisma.usuario.updateMany({
      where: { id: usuarioId, ...(soloSiEs && { rol: { clave: soloSiEs } }) },
      data: { rolId: destino.id },
    });
    return count > 0;
  }

  async asignar(usuarioId: number, areaId: number | null) {
    const prisma = getPrisma();
    await prisma.$transaction([
      prisma.usuario.update({ where: { id: usuarioId }, data: { areaId } }),
      // Un jefe pertenece a su área: si la persona sale de ella, deja de ser su jefe.
      prisma.area.updateMany({
        where: { jefeId: usuarioId, ...(areaId !== null && { id: { not: areaId } }) },
        data: { jefeId: null },
      }),
    ]);
  }

  async candidatos(q: string | undefined) {
    const rows = await getPrisma().usuario.findMany({
      where: {
        deletedAt: null,
        ...(q && { OR: [{ nombre: { contains: q } }, { email: { contains: q } }] }),
      },
      select: { ...seleccionPersona, areaId: true },
      orderBy: { nombre: 'asc' },
      take: 50,
    });
    return rows.map(({ rol, areaId, ...u }) => ({ ...u, rol: rol.clave as Rol, area: areaId === null ? null : { id: areaId } }));
  }
}
