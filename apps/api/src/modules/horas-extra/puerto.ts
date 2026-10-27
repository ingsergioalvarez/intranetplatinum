import type { HoraExtraGuardia } from '@platinum/shared';
import type { MarcacionRow } from '../asistencia/asistencia.repository';

/** Lo que la asistencia necesita de las horas extra (AS5); así los módulos no se importan entre sí. */
export interface HorasExtraPuerto {
  /** Lo que ve el guardia en "Marcar": su solicitud y si hay que preguntarle si sigue en turno. */
  paraGuardia(entrada: MarcacionRow, salida: MarcacionRow | null): Promise<HoraExtraGuardia | null>;
  /** Extendió su horario después de marcar su salida: puede marcar la salida final. */
  puedeSalidaFinal(entradaId: number): Promise<boolean>;
  /** Se registró la salida de la jornada (la normal, la final o la que puso un supervisor). */
  alSalir(a: {
    entrada: MarcacionRow;
    salida: { registradaEn: Date; final: boolean; porSupervisor: boolean };
  }): Promise<void>;
}

/** Para pruebas o instalaciones sin horas extra. */
export const sinHorasExtra: HorasExtraPuerto = {
  paraGuardia: async () => null,
  puedeSalidaFinal: async () => false,
  alSalir: async () => undefined,
};
