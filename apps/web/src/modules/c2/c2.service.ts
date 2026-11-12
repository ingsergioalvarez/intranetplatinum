import type {
  ActividadC2,
  AvisoSupervisorC2Input,
  BitacoraC2,
  C2BitacoraQuery,
  C2TableroQuery,
  NotaC2Input,
  NotaSitioC2,
  TableroC2,
} from '@platinum/shared';
import { api } from '../../core/api';

/** Monitoreo del C2 (A-61, A-80, A-82). */
export const c2Service = {
  keys: {
    all: ['c2'] as const,
    tablero: (q: C2TableroQuery) => ['c2', 'tablero', q] as const,
    bitacora: (q: C2BitacoraQuery) => ['c2', 'bitacora', q] as const,
    actividad: ['c2', 'actividad'] as const,
    notas: ['c2', 'notas'] as const,
  },
  tablero: (q: C2TableroQuery) => api.get<TableroC2>('/c2/tablero', { query: { ...q } }),
  bitacora: (q: C2BitacoraQuery) => api.get<BitacoraC2>('/c2/bitacora', { query: { ...q } }),
  /** Lo último que hizo el C2 hoy sobre los sitios de quien consulta (supervisor y admin). */
  actividad: () => api.get<ActividadC2>('/c2/actividad'),
  /** Última nota del C2 de hoy en cada sitio de quien consulta. */
  notas: () => api.get<NotaSitioC2[]>('/c2/notas'),
  /** Nota libre sobre un sitio (queda en la bitácora). */
  nota: (sitioId: number, input: NotaC2Input) => api.post<{ ok: true }>(`/c2/sitios/${sitioId}/nota`, input),
  /** Avisa al supervisor y al admin del sitio, de parte del C2. */
  avisar: (sitioId: number, input: AvisoSupervisorC2Input) => api.post<{ avisados: number }>(`/c2/sitios/${sitioId}/avisar`, input),
};
