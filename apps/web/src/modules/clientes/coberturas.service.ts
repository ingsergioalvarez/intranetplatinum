import type {
  CandidatoCobertura,
  CandidatosCoberturaQuery,
  Cobertura,
  CoberturaCreada,
  CoberturaInput,
} from '@platinum/shared';
import { api } from '../../core/api';

/** Cubrir otro sitio (DA-39, DA-46). */
export const coberturasService = {
  keys: {
    all: ['coberturas'] as const,
    sitio: (sitioId: number) => ['coberturas', 'sitio', sitioId] as const,
    candidatos: (q: CandidatosCoberturaQuery) => ['coberturas', 'candidatos', q] as const,
  },
  candidatos: (q: CandidatosCoberturaQuery) =>
    api.get<CandidatoCobertura[]>('/coberturas/candidatos', { query: { ...q } }),
  delSitio: (sitioId: number) => api.get<Cobertura[]>('/coberturas', { query: { sitioId } }),
  crear: (data: CoberturaInput) => api.post<CoberturaCreada>('/coberturas', data),
  cancelar: (id: number) => api.delete(`/coberturas/${id}`),
};
