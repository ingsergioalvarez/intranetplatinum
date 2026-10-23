import { z } from 'zod';
import { horaSchema } from './clientes';
import { fechaSchema } from './comunes';

/**
 * Cubrir otro sitio (DA-39, DA-46): el supervisor (o el admin) manda a un guardia a cubrir un sitio
 * por un turno o unos días, con motivo obligatorio. Su sitio queda en pausa mientras tanto.
 */

/** Por debajo de estas horas de descanso se advierte al enviarlo (se puede enviar de todos modos). */
export const DESCANSO_MIN_HORAS = 12;

const horasSchema = z.coerce
  .number('Indica las horas del turno')
  .int('Solo horas enteras')
  .min(1, 'Mínimo 1 hora')
  .max(24, 'Máximo 24 horas');

export const coberturaCreateSchema = z
  .object({
    usuarioId: z.number('Elige al guardia').int().positive(),
    sitioId: z.number('Elige el sitio').int().positive(),
    desde: fechaSchema,
    /** Último día; si falta, solo `desde`. */
    hasta: fechaSchema.optional(),
    horaInicio: horaSchema,
    horas: horasSchema,
    motivo: z.string().trim().min(3, 'Escribe el motivo').max(255, 'Máximo 255 caracteres'),
    /** Guardia al que cubre (si es por su falta). */
    cubreAId: z.number().int().positive().optional(),
  })
  .refine((d) => !d.hasta || d.hasta >= d.desde, {
    path: ['hasta'],
    message: 'Debe ser igual o posterior al primer día',
  });
export type CoberturaInput = z.input<typeof coberturaCreateSchema>;
export type CoberturaData = z.output<typeof coberturaCreateSchema>;

export const candidatosCoberturaQuerySchema = z.object({
  sitioId: z.coerce.number().int().positive(),
  desde: fechaSchema,
  hasta: fechaSchema.optional(),
  horaInicio: horaSchema,
  horas: horasSchema,
});
export type CandidatosCoberturaQuery = z.infer<typeof candidatosCoberturaQuerySchema>;

export const coberturasQuerySchema = z.object({
  sitioId: z.coerce.number().int().positive().optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
});
export type CoberturasQuery = z.infer<typeof coberturasQuerySchema>;

/** Qué hace el guardia esos días: descansa, trabaja en su sitio (quedaría en pausa) o ya cubre otro. */
export type EstadoCandidato = 'descansa' | 'trabaja' | 'cubre';

export interface CandidatoCobertura {
  guardia: { id: number; nombre: string; email: string; foto: string | null };
  estado: EstadoCandidato;
  /** "Trabaja en POETAS 8:00 a.m." o "Cubre Plaza Norte". */
  detalle: string | null;
  /** Horas de descanso entre su turno más cercano y la cobertura; null si no tiene turnos cerca. */
  descansoHoras: number | null;
}

export interface Cobertura {
  id: number;
  guardia: { id: number; nombre: string };
  sitio: { id: number; nombre: string };
  cubreA: { id: number; nombre: string } | null;
  desde: string;
  hasta: string;
  horaInicio: string;
  horas: number;
  motivo: string;
  descansoHoras: number | null;
  creadaPor: string | null;
  createdAt: string;
}

/** Al crear: la cobertura y, si descansa poco, la advertencia que se registró. */
export interface CoberturaCreada {
  cobertura: Cobertura;
  advertencia: string | null;
}
