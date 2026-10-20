import { ROLES, type Grupo, type GrupoData } from '@platinum/shared';
import { fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { vigenteEn } from '../clientes/clientes.repository';

export interface GrupoFiltro {
  q?: string;
  estado: 'activos' | 'baja' | 'todos';
}

/** Grupos de guardias (F2-06, D-017). */
export abstract class GruposRepository {
  abstract listar(filtro: GrupoFiltro, hoy: string): Promise<Grupo[]>;
  abstract findById(id: number, hoy: string): Promise<Grupo | null>;
  abstract nombreOcupado(nombre: string, excluirId?: number): Promise<boolean>;
  abstract crear(data: GrupoData): Promise<number>;
  abstract actualizar(id: number, data: Partial<GrupoData>): Promise<void>;
  /** De los ids dados, los que son guardias activos. */
  abstract guardiasActivos(ids: number[]): Promise<number[]>;
  abstract setIntegrantes(id: number, usuarioIds: number[]): Promise<void>;
  /** Baja del grupo y término (al día `hoy`) de sus asignaciones ya iniciadas. */
  abstract softDelete(id: number, hoy: string): Promise<void>;
  abstract restore(id: number): Promise<void>;
}

const select = (hoy: string) =>
  ({
    id: true,
    nombre: true,
    descripcion: true,
    deletedAt: true,
    integrantes: {
      select: { usuario: { select: { id: true, nombre: true, email: true } } },
      orderBy: { usuario: { nombre: 'asc' } },
    },
    _count: { select: { asignaciones: { where: vigenteEn(hoy) } } },
  }) satisfies Prisma.GrupoGuardiasSelect;

type Row = Prisma.GrupoGuardiasGetPayload<{ select: ReturnType<typeof select> }>;

const toGrupo = ({ integrantes, _count, deletedAt, ...g }: Row): Grupo => ({
  ...g,
  deletedAt: deletedAt?.toISOString() ?? null,
  integrantes: integrantes.map((i) => i.usuario),
  asignacionesVigentes: _count.asignaciones,
});

export class PrismaGruposRepository extends GruposRepository {
  async listar({ q, estado }: GrupoFiltro, hoy: string) {
    const rows = await getPrisma().grupoGuardias.findMany({
      where: {
        ...(estado === 'activos' && { deletedAt: null }),
        ...(estado === 'baja' && { deletedAt: { not: null } }),
        ...(q && { OR: [{ nombre: { contains: q } }, { descripcion: { contains: q } }] }),
      },
      select: select(hoy),
      orderBy: [{ deletedAt: 'asc' }, { nombre: 'asc' }],
      take: 300,
    });
    return rows.map(toGrupo);
  }

  async findById(id: number, hoy: string) {
    const g = await getPrisma().grupoGuardias.findUnique({ where: { id }, select: select(hoy) });
    return g && toGrupo(g);
  }

  async nombreOcupado(nombre: string, excluirId?: number) {
    const n = await getPrisma().grupoGuardias.count({
      where: { nombre, ...(excluirId && { id: { not: excluirId } }) },
    });
    return n > 0;
  }

  async crear(data: GrupoData) {
    return (await getPrisma().grupoGuardias.create({ data, select: { id: true } })).id;
  }

  async actualizar(id: number, data: Partial<GrupoData>) {
    await getPrisma().grupoGuardias.update({ where: { id }, data });
  }

  async guardiasActivos(ids: number[]) {
    if (ids.length === 0) return [];
    const rows = await getPrisma().usuario.findMany({
      where: { id: { in: ids }, activo: true, deletedAt: null, rol: { clave: ROLES.GUARDIA } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async setIntegrantes(id: number, usuarioIds: number[]) {
    const prisma = getPrisma();
    await prisma.$transaction([
      prisma.grupoIntegrante.deleteMany({ where: { grupoId: id, usuarioId: { notIn: usuarioIds } } }),
      prisma.grupoIntegrante.createMany({
        data: usuarioIds.map((usuarioId) => ({ grupoId: id, usuarioId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async softDelete(id: number, hoy: string) {
    const prisma = getPrisma();
    const d = fechaADate(hoy);
    await prisma.$transaction([
      prisma.grupoGuardias.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.sitioGuardia.updateMany({
        where: { grupoId: id, desde: { lte: d }, OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: d } }] },
        data: { hasta: d, vigenteHasta: d },
      }),
    ]);
  }

  async restore(id: number) {
    await getPrisma().grupoGuardias.update({ where: { id }, data: { deletedAt: null } });
  }
}
