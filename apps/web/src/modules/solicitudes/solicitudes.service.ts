import type { CancelarSolicitudInput, SolicitudCobertura, SolicitudesLista } from '@platinum/shared';
import { api } from '../../core/api';

/** Solicitudes de cobertura al admin (A-39). */
export const solicitudesService = {
  keys: {
    all: ['solicitudes-cobertura'] as const,
    lista: ['solicitudes-cobertura', 'lista'] as const,
  },
  lista: () => api.get<SolicitudesLista>('/solicitudes-cobertura'),
  cancelar: (id: number, input: CancelarSolicitudInput) =>
    api.post<SolicitudCobertura>(`/solicitudes-cobertura/${id}/cancelar`, input),
};
