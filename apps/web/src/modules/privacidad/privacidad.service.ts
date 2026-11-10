import type { AvisoPrivacidadLista, EstadoAvisoPrivacidad, FiltroAvisoPrivacidad } from '@platinum/shared';
import { api } from '../../core/api';

/** Aviso de privacidad por el uso del rostro (A-68). */
export const privacidadService = {
  keys: {
    all: ['privacidad'] as const,
    estado: ['privacidad', 'estado'] as const,
    guardias: (filtro: FiltroAvisoPrivacidad) => ['privacidad', 'guardias', filtro] as const,
  },
  estado: () => api.get<EstadoAvisoPrivacidad>('/privacidad/estado'),
  aceptar: (version: string) => api.post<EstadoAvisoPrivacidad>('/privacidad/aceptar', { version }),
  guardias: (filtro: FiltroAvisoPrivacidad) =>
    api.get<AvisoPrivacidadLista>(`/privacidad/guardias${filtro === 'pendientes' ? '?filtro=pendientes' : ''}`),
};
