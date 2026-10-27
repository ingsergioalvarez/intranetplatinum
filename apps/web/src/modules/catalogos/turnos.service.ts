import type { EliminarTurnoInput, TurnoCatalogo, TurnoInput, UsoTurno } from '@platinum/shared';
import { api } from '../../core/api';

/** Catálogo de turnos (DA-37). */
export const turnosService = {
  keys: {
    all: ['turnos'] as const,
    uso: (id: number) => ['turnos', 'uso', id] as const,
  },
  list: () => api.get<TurnoCatalogo[]>('/turnos'),
  crear: (data: TurnoInput) => api.post<TurnoCatalogo>('/turnos', data),
  actualizar: (id: number, data: TurnoInput) => api.put<TurnoCatalogo>(`/turnos/${id}`, data),
  baja: (id: number) => api.patch<void>(`/turnos/${id}/baja`),
  reactivar: (id: number) => api.patch<void>(`/turnos/${id}/reactivar`),
  /** A qué sitios está asignado y si quien consulta puede borrarlo. */
  uso: (id: number) => api.get<UsoTurno>(`/turnos/${id}/uso`),
  /** Borra el turno; si está asignado, con el turno nuevo de cada sitio activo. */
  eliminar: (id: number, input: EliminarTurnoInput = {}) => api.delete(`/turnos/${id}`, { body: input }),
};
