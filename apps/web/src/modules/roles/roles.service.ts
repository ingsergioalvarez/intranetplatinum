import type { RolCreate, RolEmpresa, RolUpdate } from '@platinum/shared';
import { api } from '../../core/api';

const BASE = '/roles';

export const rolesService = {
  keys: {
    all: ['roles'] as const,
    list: () => ['roles', 'list'] as const,
    detail: (id: number) => ['roles', 'detail', id] as const,
  },
  list: () => api.get<RolEmpresa[]>(BASE),
  getById: (id: number) => api.get<RolEmpresa>(`${BASE}/${id}`),
  crear: (data: RolCreate) => api.post<RolEmpresa>(BASE, data),
  actualizar: (id: number, data: RolUpdate) => api.patch<RolEmpresa>(`${BASE}/${id}`, data),
  eliminar: (id: number) => api.delete<void>(`${BASE}/${id}`),
};

