import type { DiasTurno } from '@platinum/shared';
import type { DiasTurnoTipo } from '../../generated/prisma/client';

/** Columnas de la BD para los días de un turno (DA-37). */
export interface DiasDb {
  diasTipo: DiasTurnoTipo | null;
  diasTrabajo: number | null;
  diasDescanso: number | null;
  /** Bits: 1 = domingo, 2 = lunes … 64 = sábado. */
  diasSemana: number | null;
}

export function diasADb(d: DiasTurno): DiasDb {
  if (d.tipo === 'ciclo') {
    return { diasTipo: 'ciclo', diasTrabajo: d.trabaja, diasDescanso: d.descansa, diasSemana: null };
  }
  if (d.tipo === 'semanal') {
    return {
      diasTipo: 'semanal',
      diasTrabajo: null,
      diasDescanso: null,
      diasSemana: d.semana.reduce((bits, dia) => bits | (1 << dia), 0),
    };
  }
  return { diasTipo: 'diario', diasTrabajo: null, diasDescanso: null, diasSemana: null };
}

export function diasDeDb(r: DiasDb): DiasTurno | null {
  if (r.diasTipo === 'ciclo')
    return { tipo: 'ciclo', trabaja: r.diasTrabajo ?? 1, descansa: r.diasDescanso ?? 1 };
  if (r.diasTipo === 'semanal') {
    return { tipo: 'semanal', semana: [0, 1, 2, 3, 4, 5, 6].filter((d) => ((r.diasSemana ?? 0) >> d) & 1) };
  }
  return r.diasTipo === 'diario' ? { tipo: 'diario' } : null;
}

export const diasSelect = {
  diasTipo: true,
  diasTrabajo: true,
  diasDescanso: true,
  diasSemana: true,
} as const;
