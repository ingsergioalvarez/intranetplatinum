import type { EstadoHoraExtra, HoraExtraGuardia, PlanGuardia } from '@platinum/shared';
import type { CasoRow } from '../casos-cobertura/casos.repository';
import type { MarcacionRow } from '../asistencia/asistencia.repository';

/** Lo que la asistencia necesita de las horas extra (AS5); así los módulos no se importan entre sí. */
export interface HorasExtraPuerto {
  /** Lo que ve el guardia en "Marcar": su solicitud y si hay que preguntarle si sigue en turno. */
  paraGuardia(entrada: MarcacionRow, salida: MarcacionRow | null): Promise<HoraExtraGuardia | null>;
  /** Extendió su horario después de marcar su salida: puede marcar la salida final. */
  puedeSalidaFinal(entradaId: number): Promise<boolean>;
  /** El plan que dejó el supervisor para esa jornada, si lo hay (AS6-08). */
  plan(entradaId: number): Promise<PlanGuardia | null>;
  /** ¿Esa jornada tuvo horas extra? (Su salida tardía no hace llegar tarde al turno siguiente.) */
  tuvoHorasExtra(entradaId: number): Promise<boolean>;
  /** Estado de las horas extra de esas jornadas (las que tienen), para el tablero. */
  estados(entradaIds: number[]): Promise<Map<number, EstadoHoraExtra>>;
  /** Se registró la salida de la jornada (la normal, la final o la que puso un supervisor). */
  alSalir(a: {
    entrada: MarcacionRow;
    salida: { registradaEn: Date; final: boolean; porSupervisor: boolean };
  }): Promise<void>;
}

/** El caso de cobertura de una jornada (lo que las horas extra necesitan saber del plan). */
export type CasoDeJornada = (entradaId: number) => Promise<CasoRow | null>;

/** Para pruebas o instalaciones sin horas extra. */
export const sinHorasExtra: HorasExtraPuerto = {
  paraGuardia: async () => null,
  puedeSalidaFinal: async () => false,
  estados: async () => new Map(),
  tuvoHorasExtra: async () => false,
  plan: async () => null,
  alSalir: async () => undefined,
};
