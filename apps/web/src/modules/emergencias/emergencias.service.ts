import type {
  Emergencia,
  EmergenciaCerrarInput,
  EmergenciaCreateInput,
  EmergenciaTipoInput,
  EmergenciasLista,
} from '@platinum/shared';
import { api } from '../../core/api';

/** Botón de pánico (A-60). */
export const emergenciasService = {
  keys: {
    all: ['emergencias'] as const,
    mia: ['emergencias', 'mia'] as const,
    activas: ['emergencias', 'lista', 'activas'] as const,
    todas: ['emergencias', 'lista', 'todas'] as const,
  },
  crear: (input: EmergenciaCreateInput) => api.post<Emergencia>('/emergencias', input),
  mia: () => api.get<Emergencia | null>('/emergencias/mia'),
  tipo: (id: number, input: EmergenciaTipoInput) => api.post<Emergencia>(`/emergencias/${id}/tipo`, input),
  cancelar: (id: number) => api.post<Emergencia>(`/emergencias/${id}/cancelar`, {}),
  lista: (estado: 'activas' | 'todas') => api.get<EmergenciasLista>('/emergencias', { query: { estado } }),
  acusar: (id: number) => api.post<Emergencia>(`/emergencias/${id}/acusar`, {}),
  cerrar: (id: number, input: EmergenciaCerrarInput) => api.post<Emergencia>(`/emergencias/${id}/cerrar`, input),
};

/** Enlace de Google Maps al punto de la alerta (null si no hubo ubicación). */
export const enlaceMapa = (e: Pick<Emergencia, 'lat' | 'lng'>) =>
  e.lat != null && e.lng != null ? `https://www.google.com/maps?q=${e.lat},${e.lng}` : null;
