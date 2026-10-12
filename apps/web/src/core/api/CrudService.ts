import type { Paginated } from '@platinum/shared';
import type { ApiClient } from './ApiClient';

export interface ListParams {
  page?: number;
  limit?: number;
  [filter: string]: string | number | boolean | undefined | null;
}

/**
 * Servicio CRUD genérico sobre un recurso REST (`/usuarios`, `/clientes`, ...).
 * Espeja el CrudService del backend; cada módulo lo extiende con sus acciones propias.
 */
export class CrudService<TEntity, TCreate = Partial<TEntity>, TUpdate = Partial<TCreate>> {
  constructor(
    protected readonly api: ApiClient,
    protected readonly resource: string,
  ) {}

  list(params: ListParams = {}) {
    return this.api.get<Paginated<TEntity>>(this.resource, { query: params });
  }

  get(id: number) {
    return this.api.get<TEntity>(`${this.resource}/${id}`);
  }

  create(data: TCreate) {
    return this.api.post<TEntity>(this.resource, data);
  }

  update(id: number, data: TUpdate) {
    return this.api.patch<TEntity>(`${this.resource}/${id}`, data);
  }

  /** Baja lógica (D-006). */
  deactivate(id: number) {
    return this.api.patch<void>(`${this.resource}/${id}/baja`);
  }

  restore(id: number) {
    return this.api.patch<void>(`${this.resource}/${id}/reactivar`);
  }

  /** Claves para TanStack Query, consistentes en todo el módulo. */
  get keys() {
    const base = [this.resource] as const;
    return {
      all: base,
      list: (params: ListParams = {}) => [...base, 'list', params] as const,
      detail: (id: number) => [...base, 'detail', id] as const,
    };
  }
}
