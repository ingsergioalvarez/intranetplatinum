import { z } from 'zod';
import { fechaSchema } from './comunes';
import { notaSchema, pedirNotaSiOtro } from './medidas';

/**
 * Ausencias justificadas por adelantado (A-43, AS4-03): vacaciones, incapacidad, permiso… Mientras duran, el
 * guardia no genera "No se presentó" ni "Falta", los días salen en el reporte como "Ausencia justificada" y el
 * hueco del sitio sigue viéndose en el calendario de cobertura. Solo el admin las registra o aprueba.
 */
export const TIPOS_AUSENCIA = ['vacaciones', 'incapacidad', 'cita_medica', 'permiso', 'otro'] as const;
export type TipoAusencia = (typeof TIPOS_AUSENCIA)[number];

export const TIPO_AUSENCIA_LABEL: Record<TipoAusencia, string> = {
  vacaciones: 'Vacaciones',
  incapacidad: 'Incapacidad médica',
  cita_medica: 'Cita o consulta médica',
  permiso: 'Permiso',
  otro: 'Otro',
};

/** Qué comprobante pide cada tipo: lo médico siempre lo exige. */
export type ComprobanteAusencia = 'obligatorio' | 'opcional' | 'no';
export const COMPROBANTE_AUSENCIA: Record<TipoAusencia, ComprobanteAusencia> = {
  vacaciones: 'no',
  incapacidad: 'obligatorio',
  cita_medica: 'obligatorio',
  permiso: 'opcional',
  otro: 'opcional',
};

/** Tipos que piden que se explique el motivo. */
export const AUSENCIA_PIDE_MOTIVO: TipoAusencia[] = ['permiso', 'otro'];

export const ESTADOS_AUSENCIA = ['pendiente', 'aprobada', 'rechazada', 'cancelada'] as const;
export type EstadoAusencia = (typeof ESTADOS_AUSENCIA)[number];
export const ESTADO_AUSENCIA_LABEL: Record<EstadoAusencia, string> = {
  pendiente: 'Por aprobar',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

/** Máximo de días que cubre una ausencia. */
export const DIAS_MAX_AUSENCIA = 180;

const dias = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
export const diasDeAusencia = dias;

/**
 * Pedir o registrar una ausencia. Llega como formulario con el comprobante (`foto`) cuando aplica, así que
 * los números vienen como texto. El guardia pide la suya; el supervisor la pide a nombre de un guardia suyo;
 * el admin la registra directo. El comprobante lo exige el servidor según el tipo.
 */
export const ausenciaCreateSchema = z
  .object({
    /** El guardia (el supervisor y el admin lo indican; el guardia pide la suya). */
    usuarioId: z.coerce.number().int().positive().optional(),
    tipo: z.enum(TIPOS_AUSENCIA, 'Elige el tipo de ausencia'),
    desde: fechaSchema,
    hasta: fechaSchema,
    motivo: z.string().trim().max(255, 'Máximo 255 caracteres').optional(),
  })
  .superRefine((v, ctx) => {
    if (v.hasta < v.desde) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser antes de la inicial' });
    } else if (dias(v.desde, v.hasta) > DIAS_MAX_AUSENCIA) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: `Máximo ${DIAS_MAX_AUSENCIA} días por ausencia` });
    }
    if (AUSENCIA_PIDE_MOTIVO.includes(v.tipo) && (v.motivo?.length ?? 0) < 3) {
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Explica el motivo' });
    }
  });
export type AusenciaCreateInput = z.input<typeof ausenciaCreateSchema>;
export type AusenciaCreateData = z.output<typeof ausenciaCreateSchema>;

/** Motivos al rechazar o cancelar (lista + "otro" con texto). */
export const MOTIVOS_RECHAZAR_AUSENCIA = ['sin_comprobante', 'fechas_incorrectas', 'no_procede', 'otro'] as const;
export type MotivoRechazarAusencia = (typeof MOTIVOS_RECHAZAR_AUSENCIA)[number];
export const MOTIVO_RECHAZAR_AUSENCIA_LABEL: Record<MotivoRechazarAusencia, string> = {
  sin_comprobante: 'Falta el comprobante o no es válido',
  fechas_incorrectas: 'Las fechas no son correctas',
  no_procede: 'No procede',
  otro: 'Otro',
};

export const MOTIVOS_CANCELAR_AUSENCIA = ['ya_no_se_necesita', 'se_equivoco', 'otro'] as const;
export type MotivoCancelarAusencia = (typeof MOTIVOS_CANCELAR_AUSENCIA)[number];
export const MOTIVO_CANCELAR_AUSENCIA_LABEL: Record<MotivoCancelarAusencia, string> = {
  ya_no_se_necesita: 'Ya no se necesita',
  se_equivoco: 'Se pidió por error',
  otro: 'Otro',
};

export const resolverAusenciaSchema = z
  .object({
    decision: z.enum(['aprobar', 'rechazar'], 'Elige aprobar o rechazar'),
    /** Al rechazar es obligatorio. */
    categoria: z.enum(MOTIVOS_RECHAZAR_AUSENCIA).optional(),
    nota: notaSchema,
  })
  .superRefine((v, ctx) => {
    if (v.decision !== 'rechazar') return;
    if (!v.categoria) ctx.addIssue({ code: 'custom', path: ['categoria'], message: 'Elige el motivo' });
    else pedirNotaSiOtro({ categoria: v.categoria, nota: v.nota }, ctx);
  });
export type ResolverAusenciaInput = z.infer<typeof resolverAusenciaSchema>;

export const cancelarAusenciaSchema = z
  .object({ categoria: z.enum(MOTIVOS_CANCELAR_AUSENCIA, 'Elige el motivo'), nota: notaSchema })
  .superRefine(pedirNotaSiOtro);
export type CancelarAusenciaInput = z.infer<typeof cancelarAusenciaSchema>;

export const ausenciasQuerySchema = z.object({ estado: z.enum(['pendientes', 'todas']).default('todas') });

/** Qué pasaría con lo ya marcado como falta en esos días (antes de guardar). */
export const vistaPreviaAusenciaQuerySchema = z.object({
  usuarioId: z.coerce.number().int().positive(),
  desde: fechaSchema,
  hasta: fechaSchema,
});
export type VistaPreviaAusenciaQuery = z.infer<typeof vistaPreviaAusenciaQuerySchema>;
export interface VistaPreviaAusencia {
  /** Faltas (y "No se presentó") de esos días que se justificarían solas. */
  faltas: number;
  fechas: string[];
}

export interface Ausencia {
  id: number;
  estado: EstadoAusencia;
  tipo: TipoAusencia;
  guardia: { id: number; nombre: string };
  desde: string;
  hasta: string;
  dias: number;
  motivo: string | null;
  /** Quién la pidió o registró. */
  solicitante: { id: number; nombre: string; rol: string };
  /** Foto del comprobante (URL firmada). */
  comprobante: string | null;
  createdAt: string;
  resueltaEn: string | null;
  resueltaPor: string | null;
  /** Por qué se rechazó o canceló. */
  resolucion: string | null;
  /** Faltas que se justificaron solas al aprobarla. */
  faltasJustificadas: number;
}

export interface AusenciasLista {
  items: Ausencia[];
  pendientes: number;
}
