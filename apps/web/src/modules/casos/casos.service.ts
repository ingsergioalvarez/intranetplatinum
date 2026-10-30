import type {
  CancelarPlanInput,
  CasosCoberturaLista,
  CasoCobertura,
  NoPuedoQuedarmeInput,
  ResolverCasoInput,
  VistaPreviaCaso,
} from '@platinum/shared';
import { api } from '../../core/api';

/** Casos de cobertura (AS6-05, AS6-06): el plan del supervisor cuando el relevo no llega. */
export const casosService = {
  keys: {
    all: ['casos-cobertura'] as const,
    lista: ['casos-cobertura', 'lista'] as const,
    vistaPrevia: (entradaId: number, descansoExtraHoras: number, finCubierto?: string) =>
      ['casos-cobertura', 'vista-previa', entradaId, descansoExtraHoras, finCubierto ?? null] as const,
  },
  lista: () => api.get<CasosCoberturaLista>('/casos-cobertura'),
  vistaPrevia: (entradaId: number, descansoExtraHoras: number, finCubierto?: string) =>
    api.get<VistaPreviaCaso>(`/casos-cobertura/${entradaId}/vista-previa`, {
      query: { descansoExtraHoras, ...(finCubierto ? { finCubierto } : {}) },
    }),
  resolver: (entradaId: number, input: ResolverCasoInput) =>
    api.post<CasoCobertura>(`/casos-cobertura/${entradaId}/resolver`, input),
  /** Cambia un plan confirmado: deshace el anterior y confirma el nuevo (A-45). */
  cambiar: (entradaId: number, input: ResolverCasoInput) =>
    api.post<CasoCobertura>(`/casos-cobertura/${entradaId}/cambiar`, input),
  /** Cancela un plan confirmado con su motivo (A-45). */
  cancelar: (entradaId: number, input: CancelarPlanInput) =>
    api.post<CasoCobertura>(`/casos-cobertura/${entradaId}/cancelar`, input),
  /** El guardia avisa que no puede quedarse, con su motivo (A-35). */
  noPuedo: (input: NoPuedoQuedarmeInput) => api.post<{ ok: boolean }>('/casos-cobertura/no-puedo', input),
};
