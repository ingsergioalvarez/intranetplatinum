import { z } from 'zod';
import { fechaSchema } from './comunes';

// ---------- Cobertura de sitios por día y turno (AS6, DA-56) ----------

/** Días máximos que se piden en una sola consulta (un mes completo con sus semanas). */
export const DIAS_MAX_COBERTURA = 62;

export const ESTADOS_COBERTURA = ['cubierto', 'cobertura', 'extra', 'sin_cubrir', 'sin_registro', 'sin_turno'] as const;
export type EstadoCobertura = (typeof ESTADOS_COBERTURA)[number];

export const ESTADO_COBERTURA_LABEL: Record<EstadoCobertura, string> = {
  cubierto: 'Cubierto',
  cobertura: 'Cobertura',
  extra: 'Con horas extra',
  sin_cubrir: 'Sin cubrir',
  sin_registro: 'Sin registro',
  sin_turno: 'Sin turno',
};

/** Qué pasó (o pasará) con un guardia programado en un turno. */
export const SITUACIONES_GUARDIA = ['programado', 'presente', 'ausente', 'falta', 'sin_registro'] as const;
export type SituacionGuardia = (typeof SITUACIONES_GUARDIA)[number];

export const SITUACION_GUARDIA_LABEL: Record<SituacionGuardia, string> = {
  programado: 'Programado',
  presente: 'Presente',
  ausente: 'No se ha presentado',
  falta: 'Falta',
  sin_registro: 'Sin registro',
};

const rangoCoberturaSchema = z.object({ desde: fechaSchema, hasta: fechaSchema }).superRefine((q, ctx) => {
  if (q.hasta < q.desde) {
    ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'Debe ser igual o posterior a la fecha inicial' });
    return;
  }
  const dias = Math.round((Date.parse(q.hasta) - Date.parse(q.desde)) / 86_400_000) + 1;
  if (dias > DIAS_MAX_COBERTURA) {
    ctx.addIssue({ code: 'custom', path: ['hasta'], message: `Máximo ${DIAS_MAX_COBERTURA} días` });
  }
});

export const coberturaQuerySchema = z
  .object({ sitioId: z.coerce.number().int().positive(), desde: fechaSchema, hasta: fechaSchema })
  .superRefine((q, ctx) => {
    const r = rangoCoberturaSchema.safeParse(q);
    if (!r.success) r.error.issues.forEach((i) => ctx.addIssue({ ...i, code: 'custom' }));
  });
export type CoberturaQuery = z.infer<typeof coberturaQuerySchema>;

export const resumenCoberturaQuerySchema = rangoCoberturaSchema;
export type ResumenCoberturaQuery = z.infer<typeof resumenCoberturaQuerySchema>;

/** Una franja del sitio: misma hora de entrada y misma duración (p. ej. "8:00 a.m. · 12 h"). */
export interface TurnoCobertura {
  clave: string;
  horaInicio: string;
  horas: number;
  etiqueta: string;
}

export interface GuardiaCobertura {
  id: number;
  nombre: string;
  /** `cobertura` = vino a cubrir (DA-39); `turno` = su asignación normal. */
  origen: 'turno' | 'cobertura';
  situacion: SituacionGuardia;
  /** Tiene horas extra (no rechazadas) ese día. */
  extra: boolean;
}

export interface TurnoDiaCobertura {
  clave: string;
  estado: EstadoCobertura;
  /** Por qué está sin cubrir. */
  motivo: 'sin_asignar' | 'ausente' | 'falta' | null;
  guardias: GuardiaCobertura[];
}

export interface DiaCobertura {
  fecha: string;
  turnos: TurnoDiaCobertura[];
}

export interface CoberturaSitio {
  sitio: { id: number; nombre: string };
  desde: string;
  hasta: string;
  turnos: TurnoCobertura[];
  dias: DiaCobertura[];
}

/** Un sitio en la vista "Todos los sitios": el estado de cada turno de cada día. */
export interface ResumenCoberturaSitio {
  sitio: { id: number; nombre: string };
  turnos: TurnoCobertura[];
  dias: { fecha: string; /** Un estado por turno, en el orden de `turnos`. */ estados: EstadoCobertura[] }[];
}

export interface ResumenCobertura {
  desde: string;
  hasta: string;
  sitios: ResumenCoberturaSitio[];
  /** Turnos sin cubrir de hoy en adelante (el número del botón Calendario). */
  sinCubrir: number;
}
