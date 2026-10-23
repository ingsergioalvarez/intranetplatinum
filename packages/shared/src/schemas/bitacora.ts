import { z } from 'zod';
import type { ConclusionIncidencia, MotivoIncidencia } from './asistencia';
import { paginationQuerySchema } from './pagination';

/** Bitácora del guardia (DA-41): control interno de admin y supervisor; el guardia no la ve. */
export const TIPOS_EVENTO_BITACORA = [
  'retardo',
  'salida_anticipada',
  'comida_fuera',
  'racha',
  'falta',
  'no_se_presento',
  'incidencia_rostro',
  'rostro_registrado',
  'rostro_aprobado',
  'rostro_rechazado',
  'rostro_eliminado',
  'asignacion',
  'asignacion_cambio',
  'asignacion_fin',
  'grupo_alta',
  'grupo_baja',
  'cobertura',
  'cobertura_cancelada',
] as const;
export type TipoEventoBitacora = (typeof TIPOS_EVENTO_BITACORA)[number];

/** Los que el supervisor puede justificar; justificados no cuentan en el resumen ni en reportes. */
export const TIPOS_JUSTIFICABLES: readonly TipoEventoBitacora[] = [
  'retardo',
  'salida_anticipada',
  'comida_fuera',
  'falta',
  'no_se_presento',
];

/**
 * Incidencia = todo lo que salió mal con el guardia (DA-42): de asistencia (se justifican) o de
 * rostro (se revisan). Lo demás son movimientos administrativos (rostro, sitios, horarios, grupos).
 */
export const CATEGORIAS_BITACORA = ['incidencias', 'movimientos'] as const;
export type CategoriaBitacora = (typeof CATEGORIAS_BITACORA)[number];

export const CATEGORIA_BITACORA_LABEL: Record<CategoriaBitacora, string> = {
  incidencias: 'Incidencias',
  movimientos: 'Movimientos',
};

export const CLASES_INCIDENCIA = ['asistencia', 'rostro'] as const;
export type ClaseIncidencia = (typeof CLASES_INCIDENCIA)[number];

export const CLASE_INCIDENCIA_LABEL: Record<ClaseIncidencia, string> = {
  asistencia: 'Asistencia',
  rostro: 'Rostro',
};

export const TIPOS_INCIDENCIA: readonly TipoEventoBitacora[] = [
  'retardo',
  'salida_anticipada',
  'comida_fuera',
  'racha',
  'falta',
  'no_se_presento',
  'incidencia_rostro',
];

/** Clase de incidencia del evento, o null si es un movimiento. */
export const claseIncidencia = (tipo: TipoEventoBitacora): ClaseIncidencia | null =>
  tipo === 'incidencia_rostro' ? 'rostro' : TIPOS_INCIDENCIA.includes(tipo) ? 'asistencia' : null;

export const categoriaDeEvento = (tipo: TipoEventoBitacora): CategoriaBitacora =>
  claseIncidencia(tipo) ? 'incidencias' : 'movimientos';

export const ESTADOS_INCIDENCIA = ['pendientes', 'atendidas'] as const;
export type EstadoIncidencia = (typeof ESTADOS_INCIDENCIA)[number];

export const ESTADO_INCIDENCIA_LABEL: Record<EstadoIncidencia, string> = {
  pendientes: 'Sin atender',
  atendidas: 'Atendidas',
};

/**
 * Falta atenderla: la de rostro, mientras no se revise; la de asistencia, mientras no se justifique
 * ni se comente.
 */
export function incidenciaPendiente(
  e: Pick<EventoBitacora, 'tipo' | 'incidencia' | 'justificacion' | 'comentarios' | 'decision'>,
) {
  const clase = claseIncidencia(e.tipo);
  if (clase === 'rostro') return !e.incidencia?.revisadaEn;
  return clase === 'asistencia' && !e.justificacion && !e.decision && e.comentarios.length === 0;
}

/** Cuenta en el resumen y en reportes: no justificada, y si es falta, que no se aceptó la asistencia. */
export const incidenciaCuenta = (e: Pick<EventoBitacora, 'justificacion' | 'decision'>) =>
  !e.justificacion && e.decision?.tipo !== 'asistencia';

/** Falta con llegada tarde (DA-45): el supervisor acepta la asistencia o deja la falta. */
export const DECISIONES_FALTA = ['asistencia', 'falta'] as const;
export type DecisionFalta = (typeof DECISIONES_FALTA)[number];

export const decidirFaltaSchema = z.object({
  decision: z.enum(DECISIONES_FALTA, 'Elige aceptar la asistencia o dejar la falta'),
});
export type DecidirFaltaInput = z.infer<typeof decidirFaltaSchema>;

export const TIPO_EVENTO_BITACORA_LABEL: Record<TipoEventoBitacora, string> = {
  retardo: 'Retardo',
  salida_anticipada: 'Salida anticipada',
  comida_fuera: 'Comida fuera del sitio',
  racha: 'Patrón',
  falta: 'Falta',
  no_se_presento: 'No se presentó',
  incidencia_rostro: 'Incidencia de rostro',
  rostro_registrado: 'Rostro registrado',
  rostro_aprobado: 'Rostro aprobado',
  rostro_rechazado: 'Rostro rechazado',
  rostro_eliminado: 'Rostro eliminado',
  asignacion: 'Asignación',
  asignacion_cambio: 'Cambio de horario',
  asignacion_fin: 'Fin de asignación',
  grupo_alta: 'Entró a grupo',
  grupo_baja: 'Salió de grupo',
  cobertura: 'Cobertura',
  cobertura_cancelada: 'Cobertura cancelada',
};

const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido (AAAA-MM)');

export const bitacoraQuerySchema = z.object({ mes: mesSchema });
export type BitacoraQuery = z.infer<typeof bitacoraQuerySchema>;

/** Incidencias de todos los guardias en un mes (lista general). */
export const incidenciasMesQuerySchema = paginationQuerySchema.extend({
  mes: mesSchema,
  clase: z.enum(CLASES_INCIDENCIA).optional(),
  estado: z.enum(ESTADOS_INCIDENCIA).optional(),
  /** Nombre o correo del guardia, o sitio. */
  q: z.string().trim().max(100).optional(),
});
export type IncidenciasMesQuery = z.infer<typeof incidenciasMesQuerySchema>;

/** Una fila por guardia en "Incidencias": cuántas tuvo en el mes y cuántas faltan por atender. */
export interface IncidenciasDeGuardia {
  guardia: { id: number; nombre: string; email: string; foto: string | null };
  asistencia: number;
  rostro: number;
  pendientes: number;
}

export const comentarioBitacoraSchema = z.object({
  texto: z.string().trim().min(1, 'Escribe el comentario').max(500, 'Máximo 500 caracteres'),
});
export type ComentarioBitacoraInput = z.infer<typeof comentarioBitacoraSchema>;

export const justificarBitacoraSchema = z.object({
  motivo: z.string().trim().min(3, 'Escribe el motivo').max(255, 'Máximo 255 caracteres'),
});
export type JustificarBitacoraInput = z.infer<typeof justificarBitacoraSchema>;

export interface ComentarioBitacora {
  id: number;
  texto: string;
  autor: string | null;
  createdAt: string;
}

export interface EventoBitacora {
  id: number;
  guardia: { id: number; nombre: string };
  tipo: TipoEventoBitacora;
  ocurrioEn: string;
  detalle: string;
  datos: Record<string, unknown> | null;
  sitio: { id: number; nombre: string } | null;
  /** Quién lo hizo (supervisor/admin); null si fue el sistema o el propio guardia. */
  actor: string | null;
  /** Foto de la marca o de la incidencia (URL firmada). */
  foto: string | null;
  marcacionId: number | null;
  incidencia: {
    id: number;
    motivo: MotivoIncidencia;
    revisadaPor: string | null;
    revisadaEn: string | null;
    conclusion: ConclusionIncidencia | null;
    nota: string | null;
  } | null;
  justificacion: { motivo: string; por: string | null; en: string } | null;
  /** Falta con llegada tarde: qué decidió el supervisor (DA-45). */
  decision: { tipo: DecisionFalta; por: string | null; en: string } | null;
  comentarios: ComentarioBitacora[];
}
