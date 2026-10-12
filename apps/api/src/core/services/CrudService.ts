import type { Paginated, PaginationQuery } from '@platinum/shared';
import { HttpError } from '../errors/HttpError';
import type { BaseRepository } from '../data/BaseRepository';
import { BaseService } from './BaseService';

/** Servicio CRUD genérico sobre un BaseRepository. Los módulos lo extienden y sobrescriben reglas. */
export abstract class CrudService<
  TEntity,
  TCreate,
  TUpdate,
  TFilter = Record<string, unknown>,
> extends BaseService {
  protected abstract readonly entityLabel: string;

  constructor(protected readonly repo: BaseRepository<TEntity, TCreate, TUpdate, TFilter>) {
    super();
  }

  async getById(id: number): Promise<TEntity> {
    const entity = await this.repo.findById(id);
    if (!entity) throw HttpError.notFound(`${this.entityLabel} no encontrado`);
    return entity;
  }

  list(filter: TFilter, pagination: PaginationQuery): Promise<Paginated<TEntity>> {
    return this.repo.findPaged(filter, pagination);
  }

  create(data: TCreate): Promise<TEntity> {
    return this.repo.create(data);
  }

  async update(id: number, data: TUpdate): Promise<TEntity> {
    await this.getById(id);
    return this.repo.update(id, data);
  }

  async deactivate(id: number): Promise<void> {
    await this.getById(id);
    await this.repo.softDelete(id);
  }

  async restore(id: number): Promise<void> {
    await this.repo.restore(id);
  }
}
