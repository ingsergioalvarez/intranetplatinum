import type { Grupo, GrupoInput } from '@platinum/shared';
import { api } from '../../core/api';

export const gruposService = {
  keys: {
    all: ['grupos'] as const,
    list: (estado: string, q?: string) => ['grupos', 'list', estado, q ?? ''] as const,
  },
  list: (estado = 'activos', q?: string) => api.get<Grupo[]>('/grupos', { query: { estado, q } }),
  crear: (data: GrupoInput & { usuarioIds: number[] }) => api.post<Grupo>('/grupos', data),
  actualizar: (id: number, data: Partial<GrupoInput>) => api.patch<Grupo>(`/grupos/${id}`, data),
  integrantes: (id: number, usuarioIds: number[]) =>
    api.put<Grupo>(`/grupos/${id}/integrantes`, { usuarioIds }),
  baja: (id: number) => api.patch<void>(`/grupos/${id}/baja`),
  reactivar: (id: number) => api.patch<void>(`/grupos/${id}/reactivar`),
};
