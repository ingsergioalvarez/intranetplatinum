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

const descansoExtraSchema = z.coerce
  .number('Indica las horas')
  .int('Solo horas enteras')
  .min(0, 'No puede ser negativo')
  .max(DESCANSO_EXTRA_MAX_HORAS, `Máximo ${DESCANSO_EXTRA_MAX_HORAS} horas`);

export const resolverCasoSchema = z
  .object({
    decision: z.enum(DECISIONES_CASO, 'Elige qué pasa con el relevo'),
    /** Solo si el guardia cubre el turno ("no llegará"). */
    siguiente: z.enum(SIGUIENTES_TURNO).optional(),
    /** Horas de descanso que se agregan a las del patrón ("descansa"). */
    descansoExtraHoras: descansoExtraSchema.default(0),
    /** Quien cubre: el turno del relevo ("mando a otro") o el hueco que deja el descanso. */
    cubridorId: z.coerce.number().int().positive().optional(),
    nota: z.string().trim().max(255, 'Máximo 255 caracteres').optional(),
  })
  .superRefine((d, ctx) => {
    if (d.decision === 'no_llegara' && !d.siguiente) {
      ctx.addIssue({ code: 'custom', path: ['siguiente'], message: 'Elige qué pasa con su siguiente turno' });
    }
    if (d.decision === 'otro_cubre' && !d.cubridorId) {
      ctx.addIssue({ code: 'custom', path: ['cubridorId'], message: 'Elige quién cubre' });
    }
  });
export type ResolverCasoInput = z.input<typeof resolverCasoSchema>;
export type ResolverCasoData = z.output<typeof resolverCasoSchema>;

export const entradaIdParamSchema = z.object({ entradaId: z.coerce.number().int().positive() });
export type EntradaIdParam = z.infer<typeof entradaIdParamSchema>;

export const vistaPreviaCasoQuerySchema = z.object({ descansoExtraHoras: descansoExtraSchema.default(0) });
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
  nota: string | null;
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
