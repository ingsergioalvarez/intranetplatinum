import { z } from 'zod';
import { fechaSchema, idCoerce } from './comunes';
import { paginationQuerySchema } from './pagination';

/**
 * Horas extra (AS5, DA-55): tiempo trabajado fuera de la jornada normal (después de la salida o en
 * un día de descanso). Van en su propia tabla; no cambian la jornada ni el reporte oficial. Solo las
 * ve admin y supervisor, y nada cuenta hasta que uno de ellos lo aprueba. Solo horas, sin tarifas.
 */

/** Minutos después de la hora de salida antes de que se considere hora extra. */
export const TOLERANCIA_EXTRA_MIN = 15;
/** Después de tantas horas sin respuesta del supervisor, el aviso sube a los admins. */
export const HORAS_ESCALAR_EXTRA = 12;
/** La pregunta "¿sigues en turno?" deja de salir pasadas estas horas de la hora de salida. */
export const HORAS_PREGUNTA_EXTRA = 12;

export const ORIGENES_HORA_EXTRA = [
  'salida_tardia',
  'guardia_extiende',
  'jornada_abierta',
  'cobertura_descanso',
  'captura_supervisor',
] as const;
export type OrigenHoraExtra = (typeof ORIGENES_HORA_EXTRA)[number];
export const ORIGEN_HORA_EXTRA_LABEL: Record<OrigenHoraExtra, string> = {
  salida_tardia: 'Marcó su salida tarde',
  guardia_extiende: 'El guardia extendió su horario',
  jornada_abierta: 'No marcó su salida a tiempo',
  cobertura_descanso: 'Trabajó en su día de descanso',
  captura_supervisor: 'Captura del supervisor',
};

export const ESTADOS_HORA_EXTRA = ['abierta', 'por_aprobar', 'aprobada', 'rechazada', 'sin_salida'] as const;
export type EstadoHoraExtra = (typeof ESTADOS_HORA_EXTRA)[number];
export const ESTADO_HORA_EXTRA_LABEL: Record<EstadoHoraExtra, string> = {
  abierta: 'Abierta',
  por_aprobar: 'Por aprobar',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  sin_salida: 'Sin salida',
};

export interface HoraExtra {
  id: number;
  guardia: { id: number; nombre: string };
  sitio: { id: number; nombre: string };
  /** Día de la jornada (AAAA-MM-DD). */
  fecha: string;
  desde: string;
  hasta: string | null;
  minutos: number | null;
  origen: OrigenHoraExtra;
  estado: EstadoHoraExtra;
  /** Motivo de una captura del supervisor. */
  motivo: string | null;
  resolucion: { por: string | null; en: string; nota: string | null } | null;
  creadaEn: string;
}

export interface HorasExtraPagina {
  items: HoraExtra[];
  total: number;
  page: number;
  limit: number;
  /** Las que esperan una decisión (por aprobar, abiertas y sin salida), en todo el alcance. */
  pendientes: number;
}

export const horasExtraQuerySchema = paginationQuerySchema.extend({
  /** `pendientes` = por aprobar + abiertas + sin salida. */
  estado: z.enum([...ESTADOS_HORA_EXTRA, 'pendientes']).optional(),
  guardiaId: idCoerce().optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
});
export type HorasExtraQuery = z.output<typeof horasExtraQuerySchema>;

/** Aprobar o rechazar; rechazar pide el motivo. */
export const resolverHoraExtraSchema = z
  .object({
    decision: z.enum(['aprobar', 'rechazar']),
    nota: z.string().trim().max(255, 'Máximo 255 caracteres').nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.decision === 'rechazar' && !v.nota) {
      ctx.addIssue({ code: 'custom', path: ['nota'], message: 'Escribe el motivo del rechazo' });
    }
  });
export type ResolverHoraExtraInput = z.infer<typeof resolverHoraExtraSchema>;

/** Fija la hora en que terminaron las horas extra (queda por aprobar). */
export const cortarHoraExtraSchema = z.object({
  hasta: z.iso.datetime({ offset: true }),
  nota: z.string().trim().min(3, 'Escribe el motivo').max(255, 'Máximo 255 caracteres'),
});
export type CortarHoraExtraInput = z.infer<typeof cortarHoraExtraSchema>;

const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:mm)');

/** Horas extra que captura el supervisor o el admin: quedan aprobadas, con motivo. */
export const capturaHoraExtraSchema = z.object({
  guardiaId: idCoerce('Elige un guardia'),
  /** Si no se manda, el del guardia ese día. */
  sitioId: idCoerce().nullish(),
  fecha: fechaSchema,
  desde: horaSchema,
  /** Antes que `desde` = cruza la medianoche. */
  hasta: horaSchema,
  motivo: z.string().trim().min(3, 'Escribe el motivo').max(255, 'Máximo 255 caracteres'),
});
export type CapturaHoraExtraInput = z.infer<typeof capturaHoraExtraSchema>;

/** El guardia dice que sigue en turno. Si ya marcó su salida, se comprueba que sigue en el sitio. */
export const extenderHorarioSchema = z.object({
  lat: z.coerce.number('Falta tu ubicación').min(-90).max(90).optional(),
  lng: z.coerce.number('Falta tu ubicación').min(-180).max(180).optional(),
  precisionM: z.coerce.number().min(0).max(100_000).optional(),
  /** Opcional: algo que el supervisor deba tomar en cuenta (p. ej. "no puedo quedarme mucho tiempo"). */
  nota: z.string().trim().max(255, 'Máximo 255 caracteres').optional(),
});
export type ExtenderHorarioInput = z.infer<typeof extenderHorarioSchema>;

export const reporteHorasExtraQuerySchema = z.object({
  desde: fechaSchema,
  hasta: fechaSchema,
  guardiaId: idCoerce().optional(),
});
export type ReporteHorasExtraQuery = z.output<typeof reporteHorasExtraQuerySchema>;

export interface ReporteHorasExtra {
  desde: string;
  hasta: string;
  guardias: {
    guardia: { id: number; nombre: string };
    aprobadasMin: number;
    pendientesMin: number;
    registros: HoraExtra[];
  }[];
  aprobadasMin: number;
  pendientesMin: number;
}

/** Guardias entre los que elegir en la captura manual. */
export interface OpcionesHorasExtra {
  guardias: { id: number; nombre: string }[];
  /** Para elegir el sitio si el guardia no tenía uno asignado ese día. */
  sitios: { id: number; nombre: string }[];
}

/** Lo que ve el guardia en "Marcar" sobre sus horas extra de la jornada. */
export interface HoraExtraGuardia {
  entradaId: number;
  /** Hora de salida programada de la jornada (ISO). */
  finProgramado: string;
  /** La solicitud de horas extra de esta jornada, si ya la hay. */
  solicitud: { estado: EstadoHoraExtra; desde: string; hasta: string | null; minutos: number | null } | null;
  /** Ya pasó su hora de salida y aún no dice si sigue en turno: se le pregunta. */
  preguntar: boolean;
  /** Ya marcó su salida: para extender tiene que estar dentro del sitio. */
  requiereUbicacion: boolean;
}

/** `2 h 30 min`, `45 min`, `3 h`. */
export function duracionExtra(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}
