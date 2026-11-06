import {
  PERMISO_DESCRIPCIONES,
  PERMISOS_CATALOGO_CLAVES,
  ROLES,
  type AlcanceRol,
  type Permiso,
  type RolEmpresa,
} from '@platinum/shared';
import { empresaActual } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';

const catalogoSet = new Set<string>(PERMISOS_CATALOGO_CLAVES);

/** Garantiza que las claves del catálogo existan en la tabla `permisos` antes de enlazarlas. */
async function asegurarPermisos(claves: Permiso[]): Promise<{ id: number; clave: string }[]> {
  if (claves.length === 0) return [];
  const prisma = getPrisma();
  const unicas = [...new Set(claves)];
  const existentes = await prisma.permiso.findMany({
    where: { clave: { in: unicas } },
    select: { id: true, clave: true },
  });
  const presentes = new Set(existentes.map((p) => p.clave));
  const faltantes = unicas.filter((c) => !presentes.has(c));
  if (faltantes.length > 0) {
    await prisma.permiso.createMany({
      data: faltantes.map((clave) => ({ clave, descripcion: PERMISO_DESCRIPCIONES[clave] ?? clave })),
      skipDuplicates: true,
    });
    return prisma.permiso.findMany({
      where: { clave: { in: unicas } },
      select: { id: true, clave: true },
    });
  }
  return existentes;
}

export abstract class RolesRepository {
  abstract todos(): Promise<RolEmpresa[]>;
  abstract findById(id: number): Promise<RolEmpresa | null>;
  abstract crear(data: {
    clave: string;
    nombre: string;
    alcance: AlcanceRol;
    permisos: Permiso[];
    aPartirDeId: number;
  }): Promise<RolEmpresa>;
  abstract actualizar(
    id: number,
    data: { nombre?: string; alcance?: AlcanceRol; permisos?: Permiso[] },
  ): Promise<RolEmpresa>;
  abstract eliminar(id: number): Promise<void>;
}

const select = {
  id: true,
  clave: true,
  nombre: true,
  esBase: true,
  alcance: true,
  permisos: { select: { permiso: { select: { clave: true } } } },
  _count: { select: { usuarios: { where: { deletedAt: null } } } },
} satisfies Prisma.RolSelect;

type Fila = Prisma.RolGetPayload<{ select: typeof select }>;

function aRolEmpresa(f: Fila): RolEmpresa {
  const permisos =
    f.clave === ROLES.ADMIN
      ? [...PERMISOS_CATALOGO_CLAVES]
      : f.permisos
          .map((rp) => rp.permiso.clave as Permiso)
          .filter((c) => catalogoSet.has(c))
          .sort();
  return {
    id: f.id,
    clave: f.clave,
    nombre: f.nombre,
    esBase: f.esBase,
    alcance: f.alcance as AlcanceRol,
    permisos,
    personas: f._count.usuarios,
  };
}

export class PrismaRolesRepository extends RolesRepository {
  async todos(): Promise<RolEmpresa[]> {
    const rows = await getPrisma().rol.findMany({ select });
    return rows.map(aRolEmpresa);
  }

  async findById(id: number): Promise<RolEmpresa | null> {
    const r = await getPrisma().rol.findUnique({ where: { id }, select });
    return r && aRolEmpresa(r);
  }

  async crear({
    clave,
    nombre,
    alcance,
    permisos,
    aPartirDeId,
  }: {
    clave: string;
    nombre: string;
    alcance: AlcanceRol;
    permisos: Permiso[];
    aPartirDeId: number;
  }): Promise<RolEmpresa> {
    const prisma = getPrisma();
    // Si el rol de partida tenía permisos heredados (clientes, catálogos) y no es admin, los conserva.
    const origen = await prisma.rol.findUnique({
      where: { id: aPartirDeId },
      select: { clave: true, permisos: { select: { permiso: { select: { id: true, clave: true } } } } },
    });
    const heredadosIds =
      origen && origen.clave !== ROLES.ADMIN
        ? origen.permisos.filter((rp) => !catalogoSet.has(rp.permiso.clave)).map((rp) => rp.permiso.id)
        : [];
    const delCatalogo = await asegurarPermisos(permisos);
    const permisoIds = [...new Set([...delCatalogo.map((p) => p.id), ...heredadosIds])];

    const creado = await prisma.rol.create({
      data: {
        empresaId: empresaActual(),
        clave,
        nombre,
        esBase: false,
        alcance,
        ...(permisoIds.length && {
          permisos: { create: permisoIds.map((permisoId) => ({ permisoId })) },
        }),
      },
      select,
    });
    return aRolEmpresa(creado);
  }

  async actualizar(
    id: number,
    { nombre, alcance, permisos }: { nombre?: string; alcance?: AlcanceRol; permisos?: Permiso[] },
  ): Promise<RolEmpresa> {
    const prisma = getPrisma();
    if (nombre !== undefined || alcance !== undefined) {
      await prisma.rol.update({
        where: { id },
        data: {
          ...(nombre !== undefined && { nombre }),
          ...(alcance !== undefined && { alcance }),
        },
      });
    }
    if (permisos !== undefined) {
      await asegurarPermisos(permisos);
      const catalogoRows = await prisma.permiso.findMany({
        where: { clave: { in: PERMISOS_CATALOGO_CLAVES } },
        select: { id: true, clave: true },
      });
      const idPorClave = new Map(catalogoRows.map((p) => [p.clave, p.id]));
      const idsCatalogo = catalogoRows.map((p) => p.id);
      const idsNuevos = permisos.map((c) => idPorClave.get(c)).filter((x): x is number => x !== undefined);
      await prisma.$transaction([
        prisma.rolPermiso.deleteMany({ where: { rolId: id, permisoId: { in: idsCatalogo } } }),
        ...(idsNuevos.length
          ? [
              prisma.rolPermiso.createMany({
                data: idsNuevos.map((permisoId) => ({ rolId: id, permisoId })),
                skipDuplicates: true,
              }),
            ]
          : []),
      ]);
    }
    const r = await prisma.rol.findUniqueOrThrow({ where: { id }, select });
    return aRolEmpresa(r);
  }

  async eliminar(id: number): Promise<void> {
    const prisma = getPrisma();
    // Si hubiera usuarios dados de baja con este rol, se pasan a colaborador para no romper la llave foránea.
    const colab = await prisma.rol.findFirst({ where: { clave: ROLES.COLABORADOR }, select: { id: true } });
    if (colab) {
      await prisma.usuario.updateMany({
        where: { rolId: id, deletedAt: { not: null } },
        data: { rolId: colab.id },
      });
    }
    await prisma.rol.delete({ where: { id } });
  }
}

