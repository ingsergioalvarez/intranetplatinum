import type { CoberturaQuery, CoberturaSitio, ResumenCobertura, ResumenCoberturaQuery } from '@platinum/shared';
import { api } from '../../core/api';

export const coberturaService = {
  keys: {
    all: ['cobertura'] as const,
    sitio: (params: CoberturaQuery) => ['cobertura', 'sitio', params] as const,
    resumen: (params: ResumenCoberturaQuery) => ['cobertura', 'resumen', params] as const,
  },
  sitio: (params: CoberturaQuery) => api.get<CoberturaSitio>('/cobertura', { query: params }),
  resumen: (params: ResumenCoberturaQuery) => api.get<ResumenCobertura>('/cobertura/resumen', { query: params }),
};
