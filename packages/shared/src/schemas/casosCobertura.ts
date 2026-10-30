import { z } from 'zod';
import type { EstadoHoraExtra } from './horasExtra';

// ---------- Caso de cobertura (AS6-05, AS6-06, DA-56) ----------
// Cuando un guardia sigue en el sitio porque su relevo no llega, el supervisor deja el plan completo
// desde el inicio: qué pasa con el relevo, con el siguiente turno del guardia y quién cubre el hueco.

export const DECISIONES_CASO = ['en_camino', 'no_llegara', 'otro_cubre'] as const;
export type DecisionCaso = (typeof DECISIONES_CASO)[number];

export const DECISION_CASO_LABEL: Record<DecisionCaso, string> = {
  en_camino: 'Viene en camino',
  no_llegara: 'No llegará: el guardia cubre el turno',
  otro_cubre: 'Mando a otro guardia',
};

export const SIGUIENTES_TURNO = ['normal', 'descansa'] as const;
export type SiguienteTurno = (typeof SIGUIENTES_TURNO)[number];

/** `nuevo` = aún sin decisión; `en_espera` = "viene en camino"; `resuelto` = plan confirmado. */
export const ESTADOS_CASO = ['nuevo', 'en_espera', 'resuelto'] as const;
export type EstadoCaso = (typeof ESTADOS_CASO)[number];

/** Si el relevo no llega, se le vuelve a preguntar al supervisor cada tantas horas. */
export const HORAS_RECONSULTA_CASO = 2;
/** Más horas seguidas que estas en el sitio: aviso de cansancio al supervisor (solo aviso). */
export const HORAS_CANSANCIO = 16;
/** Horas de descanso que el supervisor puede agregar a las del patrón. */
export const DESCANSO_EXTRA_MAX_HORAS = 72;

/** Por qué el supervisor deja el plan (A-35): queda en el caso, la bitácora y la auditoría. */
export const MOTIVOS_PLAN = ['relevo_no_llego', 'falta_personal', 'necesidad_cliente', 'emergencia', 'otro'] as const;
export type MotivoPlan = (typeof MOTIVOS_PLAN)[number];

export const MOTIVO_PLAN_LABEL: Record<MotivoPlan, string> = {
  relevo_no_llego: 'El relevo no llegó',
  falta_personal: 'Falta de personal',
  necesidad_cliente: 'Necesidad del cliente',
  emergencia: 'Emergencia en el sitio',
  otro: 'Otro',
};

/** Por qué un guardia no puede quedarse (A-35). */
export const MOTIVOS_NO_PUEDE = ['compromiso', 'salud', 'cansancio', 'transporte', 'familiar', 'otro'] as const;
export type MotivoNoPuede = (typeof MOTIVOS_NO_PUEDE)[number];

export const MOTIVO_NO_PUEDE_LABEL: Record<MotivoNoPuede, string> = {
  compromiso: 'Tengo otro compromiso',
  salud: 'Cuestión de salud',
  cansancio: 'Estoy muy cansado',
  transporte: 'No tengo cómo regresar a casa más tarde',
  familiar: 'Urgencia familiar',
  otro: 'Otro',
};

/** Por qué se cancela un plan ya confirmado (A-45). */
export const MOTIVOS_CANCELAR_PLAN = ['relevo_llego', 'error', 'cambio_situacion', 'otro'] as const;
export type MotivoCancelarPlan = (typeof MOTIVOS_CANCELAR_PLAN)[number];

export const MOTIVO_CANCELAR_PLAN_LABEL: Record<MotivoCancelarPlan, string> = {
  relevo_llego: 'El relevo ya llegó',
  error: 'Me equivoqué al elegir el plan',
  cambio_situacion: 'Cambió la situación',
  otro: 'Otro',
};

const notaSchema = z.string().trim().max(255, 'Máximo 255 caracteres').optional();

/** "Otro" no dice nada por sí solo: pide explicarlo. */
const pedirDetalleSiOtro = (d: { motivo: string; nota?: string | undefined }, ctx: z.RefinementCtx) => {
  if (d.motivo === 'otro' && !d.nota?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['nota'], message: 'Explica el motivo' });
  }
};

const descansoExtraSchema = z.coerce
  .number('Indica las horas')
  .int('Solo horas enteras')
  .min(0, 'No puede ser negativo')
  .max(DESCANSO_EXTRA_MAX_HORAS, `Máximo ${DESCANSO_EXTRA_MAX_HORAS} horas`);

export const resolverCasoSchema = z
  .object({
    decision: z.enum(DECISIONES_CASO, 'Elige qué pasa con el relevo'),
    /** Hasta cuándo se queda el guardia ("no llegará"); si no se manda, el fin del turno del relevo. */
    finCubierto: z.iso.datetime({ offset: true }).optional(),
    /** Solo si el guardia cubre el turno ("no llegará"). */
    siguiente: z.enum(SIGUIENTES_TURNO).optional(),
    /** Horas de descanso que se agregan a las del patrón ("descansa"). */
    descansoExtraHoras: descansoExtraSchema.default(0),
    /** Quien cubre: el turno del relevo ("mando a otro") o el hueco que deja el descanso. */
    cubridorId: z.coerce.number().int().positive().optional(),
    /** Por qué se deja este plan (obligatorio). */
    motivo: z.enum(MOTIVOS_PLAN, 'Elige el motivo'),
    /** Detalle del motivo; obligatorio si el motivo es "otro". */
    nota: notaSchema,
  })
  .superRefine((d, ctx) => {
    pedirDetalleSiOtro(d, ctx);
    if (d.decision === 'no_llegara' && !d.siguiente) {
      ctx.addIssue({ code: 'custom', path: ['siguiente'], message: 'Elige qué pasa con su siguiente turno' });
    }
    if (d.decision === 'otro_cubre' && !d.cubridorId) {
      ctx.addIssue({ code: 'custom', path: ['cubridorId'], message: 'Elige quién cubre' });
    }
  });
export type ResolverCasoInput = z.input<typeof resolverCasoSchema>;
export type ResolverCasoData = z.output<typeof resolverCasoSchema>;

/** El guardia avisa que no puede quedarse (A-35): siempre con su motivo. */
export const noPuedoQuedarmeSchema = z
  .object({
    motivo: z.enum(MOTIVOS_NO_PUEDE, 'Elige el motivo'),
    nota: notaSchema,
  })
  .superRefine(pedirDetalleSiOtro);
export type NoPuedoQuedarmeInput = z.input<typeof noPuedoQuedarmeSchema>;
export type NoPuedoQuedarmeData = z.output<typeof noPuedoQuedarmeSchema>;

/** Cancelar un plan confirmado (A-45): siempre con su motivo. */
export const cancelarPlanSchema = z
  .object({
    motivo: z.enum(MOTIVOS_CANCELAR_PLAN, 'Elige el motivo'),
    nota: notaSchema,
  })
  .superRefine(pedirDetalleSiOtro);
export type CancelarPlanInput = z.input<typeof cancelarPlanSchema>;
export type CancelarPlanData = z.output<typeof cancelarPlanSchema>;

export const entradaIdParamSchema = z.object({ entradaId: z.coerce.number().int().positive() });
export type EntradaIdParam = z.infer<typeof entradaIdParamSchema>;

export const vistaPreviaCasoQuerySchema = z.object({
  descansoExtraHoras: descansoExtraSchema.default(0),
  finCubierto: z.iso.datetime({ offset: true }).optional(),
});
export type VistaPreviaCasoQuery = z.infer<typeof vistaPreviaCasoQuerySchema>;

export interface CasoCobertura {
  entradaId: number;
  estado: EstadoCaso;
  guardia: { id: number; nombre: string };
  sitio: { id: number; nombre: string };
  /** Desde cuándo está de más (su hora de salida). */
  desde: string;
  horaExtra: { id: number; estado: EstadoHoraExtra } | null;
  /** Quien no llegó y el turno que debía cubrir; null si no se sabe de quién es el turno. */
  relevo: { id: number; nombre: string; inicio: string; fin: string; horas: number } | null;
  decision: DecisionCaso | null;
  siguiente: SiguienteTurno | null;
  regresaEn: string | null;
  /** Por qué el supervisor dejó el plan (null mientras no hay plan). */
  motivo: MotivoPlan | null;
  nota: string | null;
  /** El guardia avisó que no puede quedarse (A-35); el supervisor decide quién cubre. */
  noPuede: { motivo: MotivoNoPuede; nota: string | null; en: string } | null;
}

export interface CasosCoberturaLista {
  items: CasoCobertura[];
  /** Casos que esperan una decisión (el número del botón). */
  pendientes: number;
}

/** Un tramo de un turno (o parte de él) con lo necesario para mandar a cubrirlo. */
export interface TramoPlan {
  inicio: string;
  fin: string;
  /** Día en que empieza (zona del negocio). */
  fecha: string;
  horaInicio: string;
  horas: number;
}

/** Lo que pasaría con cada elección, antes de confirmar (el supervisor lo ve mientras decide). */
export interface VistaPreviaCaso {
  /** Hasta cuándo cubre el guardia (fin del turno del relevo). */
  finCubierto: string;
  /** Su siguiente turno propio. */
  siguienteTurno: { inicio: string; fin: string } | null;
  /** Descanso del patrón (24 h en 24x24, 12 h en 12x12…). */
  descansoPatronHoras: number | null;
  /** Fin de lo que cubre + descanso del patrón + lo que agregue el supervisor. */
  regresaEn: string | null;
  /** Cuándo se presenta de nuevo (inicio de su turno, o `regresaEn` si entra a la mitad de uno). */
  vuelveA: string | null;
  /** Lo que queda sin cubrir por su descanso. */
  huecos: TramoPlan[];
  /** Si regresa a la mitad de un turno: entra tarde y termina a la hora original. */
  entraTarde: TramoPlan | null;
  /** "Lo trabaja normal": aquí terminan las horas extra (empieza su turno). */
  limiteExtra: string | null;
  /** Horas seguidas en el sitio si sigue sin descansar. */
  horasSeguidas: number;
  advertencias: string[];
}

/** Lo que ve el guardia de su plan en el Checador (AS6-08). */
export interface PlanGuardia {
  estado: Exclude<EstadoCaso, 'nuevo'>;
  decision: DecisionCaso;
  /** Hasta cuándo cubre. */
  cubreHasta: string | null;
  siguiente: SiguienteTurno | null;
  /** Cuándo se presenta de nuevo si descansa. */
  vuelveA: string | null;
  /** Si trabaja normal: a esta hora termina lo extra y empieza su turno. */
  limiteExtra: string | null;
  nota: string | null;
}
