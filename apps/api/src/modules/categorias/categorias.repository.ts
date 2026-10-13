import type { Categoria } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

export interface CategoriaCreateData {
  nombre: string;
  icono?: string | null;
  orden: number;
  padreId?: number | null;
}

export abstract class CategoriasRepository {
  abstract listar(incluirInactivas: boolean): Promise<Categoria[]>;
  abstract findById(id: number): Promise<Categoria | null>;
  abstract contarHijas(id: number): Promise<number>;
  /** ¿Existe otra con el mismo nombre en el mismo nivel? */
  abstract nombreOcupado(nombre: string, padreId: number | null, excluirId?: number): Promise<boolean>;
  abstract crear(data: CategoriaCreateData): Promise<Categoria>;
  abstract actualizar(id: number, data: Partial<Categoria>): Promise<Categoria>;
}

const select = { id: true, padreId: true, nombre: true, icono: true, orden: true, activo: true } as const;

export class PrismaCategoriasRepository extends CategoriasRepository {
  listar(incluirInactivas: boolean) {
    return getPrisma().categoriaReporte.findMany({
      where: incluirInactivas ? {} : { activo: true },
      select,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  findById(id: number) {
    return getPrisma().categoriaReporte.findUnique({ where: { id }, select });
  }

  contarHijas(id: number) {
    return getPrisma().categoriaReporte.count({ where: { padreId: id } });
  }

  async nombreOcupado(nombre: string, padreId: number | null, excluirId?: number) {
    const n = await getPrisma().categoriaReporte.count({
      where: { nombre, padreId, ...(excluirId && { id: { not: excluirId } }) },
    });
    return n > 0;
  }

  crear({ nombre, icono, orden, padreId }: CategoriaCreateData) {
    return getPrisma().categoriaReporte.create({
      data: { nombre, orden, icono: icono ?? null, padreId: padreId ?? null },
      select,
    });
  }

  actualizar(id: number, { nombre, icono, orden, activo, padreId }: Partial<Categoria>) {
    return getPrisma().categoriaReporte.update({
      where: { id },
      data: { nombre, icono, orden, activo, padreId },
      select,
    });
  }
}
