import { z } from 'zod';
import { fechaSchema, idCoerce } from './comunes';
import { paginationQuerySchema } from './pagination';

/**
 * Cambios de turno (TC-22, DA-54): un guardia pide (o el supervisor hace) cubrir a un compañero o
 * mover su descanso. Lo que pide el guardia lo aprueba el supervisor del sitio; lo que hace el
 * supervisor queda aplicado al momento. Siempre con motivo.
 */
export const TIPOS_CAMBIO_TURNO = ['cubrir', 'descanso'] as const;
export type TipoCambioTurno = (typeof TIPOS_CAMBIO_TURNO)[number];
export const TIPO_CAMBIO_TURNO_LABEL: Record<TipoCambioTurno, string> = {
  cubrir: 'Que un compañero me cubra',
  descanso: 'Mover mi descanso',
};

export const ESTADOS_CAMBIO_TURNO = ['pendiente', 'aprobado', 'rechazado', 'cancelado'] as const;
export type EstadoCambioTurno = (typeof ESTADOS_CAMBIO_TURNO)[number];
export const ESTADO_CAMBIO_TURNO_LABEL: Record<EstadoCambioTurno | 'vencido', string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
  vencido: 'Vencido',
};

export const nuevoCambioTurnoSchema = z
  .object({
    tipo: z.enum(TIPOS_CAMBIO_TURNO, 'Elige el tipo de cambio'),
    /** Guardia al que se le cambia el turno; el guardia que lo pide no lo manda (es él). */
    guardiaId: idCoerce('Elige un guardia').nullish(),
    /** Cubrir: el día del turno a cubrir. Descanso: el día que trabajaba y ahora descansará. */
    fecha: fechaSchema,
    /** Cubrir: quien lo cubre. */
    cubreId: idCoerce('Elige a quien cubrirá').nullish(),
    /** Descanso: el día que descansaba y ahora trabajará. */
    fechaNueva: fechaSchema.nullish(),
    motivo: z.string().trim().min(3, 'Escribe el motivo').max(255, 'Máximo 255 caracteres'),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'cubrir' && !v.cubreId) {
      ctx.addIssue({ code: 'custom', path: ['cubreId'], message: 'Elige a quien cubrirá' });
    }
    if (v.tipo === 'cubrir' && v.cubreId && v.cubreId === v.guardiaId) {
      ctx.addIssue({ code: 'custom', path: ['cubreId'], message: 'Elige a otro compañero' });
    }
    if (v.tipo === 'descanso') {
      if (!v.fechaNueva) {
        ctx.addIssue({ code: 'custom', path: ['fechaNueva'], message: 'Elige el día que trabajarás' });
      } else if (v.fechaNueva === v.fecha) {
        ctx.addIssue({ code: 'custom', path: ['fechaNueva'], message: 'Elige un día distinto' });
      }
    }
  });
export type NuevoCambioTurnoInput = z.input<typeof nuevoCambioTurnoSchema>;
export type NuevoCambioTurnoData = z.output<typeof nuevoCambioTurnoSchema>;

export const resolverCambioTurnoSchema = z.object({
  decision: z.enum(['aprobar', 'rechazar'], 'Elige aprobar o rechazar'),
  nota: z.string().trim().max(255, 'Máximo 255 caracteres').nullish(),
});
export type ResolverCambioTurnoInput = z.input<typeof resolverCambioTurnoSchema>;

export const cambiosTurnoQuerySchema = paginationQuerySchema.extend({
  estado: z.enum(ESTADOS_CAMBIO_TURNO).optional(),
  guardiaId: idCoerce().optional(),
});
export type CambiosTurnoQuery = z.infer<typeof cambiosTurnoQuerySchema>;

export interface CambioTurno {
  id: number;
  tipo: TipoCambioTurno;
  estado: EstadoCambioTurno;
  /** Pendiente cuya fecha ya pasó: ya no se puede aprobar. */
  vencido: boolean;
  /** A quién se le cambia el turno. */
  guardia: { id: number; nombre: string };
  solicitante: { id: number; nombre: string };
  sitio: { id: number; nombre: string };
  fecha: string;
  fechaNueva: string | null;
  cubre: { id: number; nombre: string } | null;
  motivo: string;
  /** `08:00 · 12 h` */
  horario: string;
  resolucion: { por: string | null; en: string; nota: string | null } | null;
  creadoEn: string;
}

/** Lo que el formulario necesita para elegir. */
export interface OpcionesCambioTurno {
  /** Compañeros que pueden cubrir (guardias activos que puede ver quien pide). */
  companeros: { id: number; nombre: string }[];
  /** Guardias a los que el supervisor puede cambiar el turno. */
  guardias: { id: number; nombre: string }[];
  /** Próximos turnos del propio guardia (para elegir el día). */
  misTurnos: { fecha: string; sitio: string; horario: string }[];
}
