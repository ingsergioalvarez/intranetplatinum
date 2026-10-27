import type {
  CapturaHoraExtraInput,
  CortarHoraExtraInput,
  ExtenderHorarioInput,
  HoraExtra,
  HorasExtraPagina,
  HorasExtraQuery,
  OpcionesHorasExtra,
  ReporteHorasExtra,
  ReporteHorasExtraQuery,
  ResolverHoraExtraInput,
} from '@platinum/shared';
import { api, type ListParams } from '../../core/api';

export const horasExtraService = {
  keys: {
    all: ['horas-extra'] as const,
    list: (params: ListParams) => ['horas-extra', 'lista', params] as const,
    opciones: ['horas-extra', 'opciones'] as const,
    reporte: (params: Record<string, unknown>) => ['horas-extra', 'reporte', params] as const,
  },
  list: (params: Partial<HorasExtraQuery> & ListParams) =>
    api.get<HorasExtraPagina>('/horas-extra', { query: params }),
  opciones: () => api.get<OpcionesHorasExtra>('/horas-extra/opciones'),
  reporte: (params: ReporteHorasExtraQuery) =>
    api.get<ReporteHorasExtra>('/horas-extra/reporte', { query: params }),
  capturar: (input: CapturaHoraExtraInput) => api.post<HoraExtra>('/horas-extra', input),
  resolver: (id: number, input: ResolverHoraExtraInput) =>
    api.post<HoraExtra>(`/horas-extra/${id}/resolver`, input),
  cortar: (id: number, input: CortarHoraExtraInput) => api.post<HoraExtra>(`/horas-extra/${id}/cortar`, input),
  /** El guardia dice que sigue en turno. */
  extender: (input: ExtenderHorarioInput) => api.post<unknown>('/horas-extra/extender', input),
};
