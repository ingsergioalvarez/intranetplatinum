import type {
  CambioTurno,
  CambiosTurnoQuery,
  NuevoCambioTurnoInput,
  OpcionesCambioTurno,
  Paginated,
  ResolverCambioTurnoInput,
} from '@platinum/shared';
import { api, type ListParams } from '../../core/api';

export type PaginaCambios = Paginated<CambioTurno> & { pendientes: number };

export const cambiosService = {
  keys: {
    all: ['cambios-turno'] as const,
    list: (params: ListParams) => ['cambios-turno', 'lista', params] as const,
    opciones: ['cambios-turno', 'opciones'] as const,
  },
  list: (params: Partial<CambiosTurnoQuery> & ListParams) =>
    api.get<PaginaCambios>('/cambios-turno', { query: params }),
  opciones: () => api.get<OpcionesCambioTurno>('/cambios-turno/opciones'),
  crear: (input: NuevoCambioTurnoInput) => api.post<CambioTurno>('/cambios-turno', input),
  resolver: (id: number, input: ResolverCambioTurnoInput) =>
    api.post<CambioTurno>(`/cambios-turno/${id}/resolver`, input),
  cancelar: (id: number) => api.post<CambioTurno>(`/cambios-turno/${id}/cancelar`),
};
