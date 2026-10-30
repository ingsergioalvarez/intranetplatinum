import { z } from 'zod';

/**
 * Medidas disciplinarias (A-48, A-49): se guardan en el historial formal del guardia y en su bitácora.
 * "ninguna" solo existe al elegir (no se guarda nada).
 */
export const TIPOS_MEDIDA = ['llamada_atencion', 'amonestacion'] as const;
export type TipoMedida = (typeof TIPOS_MEDIDA)[number];
export const OPCIONES_MEDIDA = ['ninguna', ...TIPOS_MEDIDA] as const;
export type OpcionMedida = (typeof OPCIONES_MEDIDA)[number];

export const MEDIDA_LABEL: Record<OpcionMedida, string> = {
  ninguna: 'Ninguna',
  llamada_atencion: 'Llamada de atención verbal',
  amonestacion: 'Amonestación por escrito',
};

export const ORIGENES_MEDIDA = ['falta', 'salida_sin_marcar'] as const;
export type OrigenMedida = (typeof ORIGENES_MEDIDA)[number];
export const ORIGEN_MEDIDA_LABEL: Record<OrigenMedida, string> = {
  falta: 'Falta',
  salida_sin_marcar: 'Salida sin marcar',
};

/** Una fila del historial formal del guardia. */
export interface MedidaDisciplinaria {
  id: number;
  tipo: TipoMedida;
  origen: OrigenMedida;
  motivo: string;
  sitio: string | null;
  aplicadaPor: string | null;
  createdAt: string;
}

/** Con tres salidas sin marcar en el mes se sugiere una amonestación. */
export const SALIDAS_SIN_MARCAR_SUGERIR = 3;

/** Motivos al justificar una falta, retardo o salida (lista + "otro" con texto). */
export const MOTIVOS_JUSTIFICAR = ['permiso', 'enfermedad', 'aviso_previo', 'transporte', 'otro'] as const;
export type MotivoJustificar = (typeof MOTIVOS_JUSTIFICAR)[number];
export const MOTIVO_JUSTIFICAR_LABEL: Record<MotivoJustificar, string> = {
  permiso: 'Permiso autorizado',
  enfermedad: 'Enfermedad o cita médica',
  aviso_previo: 'Avisó con anticipación',
  transporte: 'Falla de transporte',
  otro: 'Otro',
};

/** Motivos al confirmar una falta. */
export const MOTIVOS_FALTA = ['sin_aviso', 'abandono', 'otro'] as const;
export type MotivoFalta = (typeof MOTIVOS_FALTA)[number];
export const MOTIVO_FALTA_LABEL: Record<MotivoFalta, string> = {
  sin_aviso: 'No se presentó y no avisó',
  abandono: 'Abandonó el servicio',
  otro: 'Otro',
};

/** Motivos al cerrar la jornada de quien no marcó su salida. */
export const MOTIVOS_SALIDA_SIN_MARCAR = ['olvido', 'falla_telefono', 'no_pudo_marcar', 'otro'] as const;
export type MotivoSalidaSinMarcar = (typeof MOTIVOS_SALIDA_SIN_MARCAR)[number];
export const MOTIVO_SALIDA_SIN_MARCAR_LABEL: Record<MotivoSalidaSinMarcar, string> = {
  olvido: 'Se le olvidó marcar',
  falla_telefono: 'Falla del teléfono o de la app',
  no_pudo_marcar: 'No pudo marcar (sin señal, sin batería)',
  otro: 'Otro',
};

/** "Otro" obliga a escribir el detalle (queda siempre el porqué). */
export function pedirNotaSiOtro(d: { categoria: string; nota?: string }, ctx: z.RefinementCtx) {
  if (d.categoria === 'otro' && (d.nota?.length ?? 0) < 3) {
    ctx.addIssue({ code: 'custom', path: ['nota'], message: 'Explica el motivo' });
  }
}

/** Texto final del motivo: "Etiqueta" o "Etiqueta: nota". */
export const textoMotivoLista = (etiqueta: string, nota?: string | null) =>
  nota ? `${etiqueta}: ${nota}` : etiqueta;

export const notaSchema = z.string().trim().max(200, 'Máximo 200 caracteres').optional();
export const medidaSchema = z.enum(OPCIONES_MEDIDA, 'Elige una medida').optional();
