import type {
  CasosCoberturaLista,
  CasoCobertura,
  ResolverCasoInput,
  VistaPreviaCaso,
} from '@platinum/shared';
import { api } from '../../core/api';

/** Casos de cobertura (AS6-05, AS6-06): el plan del supervisor cuando el relevo no llega. */
export const casosService = {
  keys: {
    all: ['casos-cobertura'] as const,
    lista: ['casos-cobertura', 'lista'] as const,
    vistaPrevia: (entradaId: number, descansoExtraHoras: number) =>
      ['casos-cobertura', 'vista-previa', entradaId, descansoExtraHoras] as const,
  },
  lista: () => api.get<CasosCoberturaLista>('/casos-cobertura'),
  vistaPrevia: (entradaId: number, descansoExtraHoras: number) =>
    api.get<VistaPreviaCaso>(`/casos-cobertura/${entradaId}/vista-previa`, { query: { descansoExtraHoras } }),
  resolver: (entradaId: number, input: ResolverCasoInput) =>
    api.post<CasoCobertura>(`/casos-cobertura/${entradaId}/resolver`, input),
  /** El guardia avisa que no puede quedarse. */
  noPuedo: () => api.post<{ ok: boolean }>('/casos-cobertura/no-puedo', {}),
};
