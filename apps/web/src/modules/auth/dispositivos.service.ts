import type { DefinirPinInput, DispositivoUsuarioVista } from '@platinum/shared';
import { api } from '../../core/api';

/** Perfiles rápidos y celulares guardados (A-40). */
export const dispositivosService = {
  keys: {
    mios: ['dispositivos', 'mios'] as const,
    de: (usuarioId: number) => ['dispositivos', 'usuario', usuarioId] as const,
  },
  /** El guardia: sus celulares. */
  mios: () => api.get<DispositivoUsuarioVista[]>('/auth/dispositivos'),
  definirPin: (id: number, data: DefinirPinInput) => api.put<void>(`/auth/dispositivos/${id}/pin`, data),
  quitarPin: (id: number) => api.delete(`/auth/dispositivos/${id}/pin`),
  quitarMio: (id: number) => api.delete(`/auth/dispositivos/${id}`),
  /** Admin: celulares de un guardia. */
  de: (usuarioId: number) => api.get<DispositivoUsuarioVista[]>(`/auth/usuarios/${usuarioId}/dispositivos`),
  quitarDe: (usuarioId: number, id: number) => api.delete(`/auth/usuarios/${usuarioId}/dispositivos/${id}`),
  quitarTodosDe: (usuarioId: number) =>
    api.delete<{ quitados: number }>(`/auth/usuarios/${usuarioId}/dispositivos`),
};
