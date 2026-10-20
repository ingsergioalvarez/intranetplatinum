import type {
  EstadoAsistencia,
  Jornada,
  Marcacion,
  AsistenciaGuardia,
  FilaAsistencia,
  MarcacionCreate,
  Paginated,
} from '@platinum/shared';
import { api, type ListParams } from '../../core/api';

export const asistenciaService = {
  keys: {
    all: ['asistencia'] as const,
    estado: ['asistencia', 'estado'] as const,
    mias: (mes: string) => ['asistencia', 'mias', mes] as const,
    dia: (params: ListParams) => ['asistencia', 'dia', params] as const,
    guardia: (id: number, mes: string) => ['asistencia', 'guardia', id, mes] as const,
  },
  estado: () => api.get<EstadoAsistencia>('/asistencia/estado'),
  marcar: (data: MarcacionCreate) => api.post<Marcacion>('/asistencia/marcas', data),
  mias: (mes: string) => api.get<Jornada[]>('/asistencia/mias', { query: { mes } }),
  /** Admin / supervisor (solo lectura): una fila por guardia del día. */
  dia: (params: ListParams) => api.get<Paginated<FilaAsistencia>>('/asistencia/dia', { query: params }),
  guardia: (id: number, mes: string) =>
    api.get<AsistenciaGuardia>(`/asistencia/guardias/${id}`, { query: { mes } }),
};
