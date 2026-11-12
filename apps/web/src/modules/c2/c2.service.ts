import type { C2TableroQuery, HistorialC2, TableroC2 } from '@platinum/shared';
import { api } from '../../core/api';

/** Monitoreo del C2 (A-61). */
export const c2Service = {
  keys: {
    all: ['c2'] as const,
    tablero: (q: C2TableroQuery) => ['c2', 'tablero', q] as const,
    historial: (fecha: string) => ['c2', 'historial', fecha] as const,
  },
  tablero: (q: C2TableroQuery) => api.get<TableroC2>('/c2/tablero', { query: { ...q } }),
  historial: (fecha: string) => api.get<HistorialC2>('/c2/historial', { query: { fecha } }),
};
