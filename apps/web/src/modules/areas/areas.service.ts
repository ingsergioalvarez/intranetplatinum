import type { Area, AreaCreate, AreaUpdate, CandidatoArea, PersonaDeArea } from '@platinum/shared';
import { api } from '../../core/api';

export type EstadoAreas = 'activas' | 'todas';

/** Áreas de la empresa (C-10): estructura con subáreas, una por persona y su jefe. */
export const areasService = {
  keys: {
    all: ['areas'] as const,
    list: (estado: EstadoAreas) => ['areas', 'lista', estado] as const,
    personas: (id: number) => ['areas', id, 'personas'] as const,
    candidatos: (q: string) => ['areas', 'candidatos', q] as const,
  },
  list: (estado: EstadoAreas = 'activas') => api.get<Area[]>('/areas', { query: { estado } }),
  crear: (data: AreaCreate) => api.post<Area>('/areas', data),
  actualizar: (id: number, data: AreaUpdate) => api.patch<Area>(`/areas/${id}`, data),
  baja: (id: number) => api.patch<void>(`/areas/${id}/baja`),
  reactivar: (id: number) => api.patch<void>(`/areas/${id}/reactivar`),
  /** Borrado definitivo del área y sus subáreas (solo super admin). */
  eliminar: (id: number) => api.delete<void>(`/areas/${id}`),
  personas: (id: number) => api.get<PersonaDeArea[]>(`/areas/${id}/personas`),
  candidatos: (q: string) => api.get<CandidatoArea[]>('/areas/candidatos', { query: { q } }),
  /** Mueve a una persona a un área (null = sin área). */
  asignar: (usuarioId: number, areaId: number | null) => api.put<void>(`/areas/personas/${usuarioId}`, { areaId }),
};
