import type { AvisoSupervisorC2Input, BitacoraC2, C2BitacoraQuery, C2TableroQuery, NotaC2Input, TableroC2 } from '@platinum/shared';
import { api } from '../../core/api';

/** Monitoreo del C2 (A-61, A-80). */
export const c2Service = {
  keys: {
    all: ['c2'] as const,
    tablero: (q: C2TableroQuery) => ['c2', 'tablero', q] as const,
    bitacora: (q: C2BitacoraQuery) => ['c2', 'bitacora', q] as const,
  },
  tablero: (q: C2TableroQuery) => api.get<TableroC2>('/c2/tablero', { query: { ...q } }),
  bitacora: (q: C2BitacoraQuery) => api.get<BitacoraC2>('/c2/bitacora', { query: { ...q } }),
  /** Nota libre sobre un sitio (queda en la bitácora). */
  nota: (sitioId: number, input: NotaC2Input) => api.post<{ ok: true }>(`/c2/sitios/${sitioId}/nota`, input),
  /** Avisa al supervisor y al admin del sitio, de parte del C2. */
  avisar: (sitioId: number, input: AvisoSupervisorC2Input) => api.post<{ avisados: number }>(`/c2/sitios/${sitioId}/avisar`, input),
};
