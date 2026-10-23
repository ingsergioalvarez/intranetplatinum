import type { TurnoCatalogo, TurnoInput } from '@platinum/shared';
import { api } from '../../core/api';

/** Catálogo de turnos (DA-37). */
export const turnosService = {
  keys: {
    all: ['turnos'] as const,
  },
  list: () => api.get<TurnoCatalogo[]>('/turnos'),
  crear: (data: TurnoInput) => api.post<TurnoCatalogo>('/turnos', data),
  actualizar: (id: number, data: TurnoInput) => api.put<TurnoCatalogo>(`/turnos/${id}`, data),
  baja: (id: number) => api.patch<void>(`/turnos/${id}/baja`),
  reactivar: (id: number) => api.patch<void>(`/turnos/${id}/reactivar`),
  /** Solo admin: borra el turno aunque esté asignado (los guardias siguen con su horario). */
  eliminar: (id: number) => api.delete(`/turnos/${id}`),
};
