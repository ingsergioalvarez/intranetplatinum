import type { Paginated, PaginationQuery } from '@platinum/shared';

/**
 * Contrato de acceso a datos. Cada módulo implementa su repositorio
 * sobre el ORM elegido (D-004) sin que servicios ni controladores dependan de él.
 */
export abstract class BaseRepository<TEntity, TCreate, TUpdate, TFilter = Record<string, unknown>> {
  abstract findById(id: number): Promise<TEntity | null>;
  abstract findPaged(filter: TFilter, pagination: PaginationQuery): Promise<Paginated<TEntity>>;
  abstract create(data: TCreate): Promise<TEntity>;
  abstract update(id: number, data: TUpdate): Promise<TEntity>;
  /** Borrado lógico (D-006): nunca se elimina físicamente. */
  abstract softDelete(id: number): Promise<void>;
  abstract restore(id: number): Promise<void>;

  async exists(id: number): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }
}
