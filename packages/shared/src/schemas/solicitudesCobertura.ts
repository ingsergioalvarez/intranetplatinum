import { z } from 'zod';
import { notaSchema, pedirNotaSiOtro } from './medidas';

/**
 * Solicitudes de cobertura (A-39, completa A-26): un supervisor que necesita un guardia de otro supervisor
 * para un sitio que quedó solo lo pide al admin; queda guardada, el admin la atiende desde el calendario del
 * sitio y se cierra sola al asignar la cobertura.
 */
export const ESTADOS_SOLICITUD = ['pendiente', 'atendida', 'cancelada'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ESTADO_SOLICITUD_LABEL: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
};

/** Horas sin atender antes de recordárselo a los admin, y cada cuántas horas se repite. */
export const HORAS_RECORDAR_SOLICITUD = 2;
export const HORAS_REPETIR_SOLICITUD = 4;

/** Motivos al cancelar una solicitud (lista + "otro" con texto). */
export const MOTIVOS_CANCELAR_SOLICITUD = ['ya_no_se_necesita', 'lo_resolvi', 'se_equivoco', 'otro'] as const;
export type MotivoCancelarSolicitud = (typeof MOTIVOS_CANCELAR_SOLICITUD)[number];
export const MOTIVO_CANCELAR_SOLICITUD_LABEL: Record<MotivoCancelarSolicitud, string> = {
  ya_no_se_necesita: 'Ya no se necesita',
  lo_resolvi: 'Lo resolví con uno de mis guardias',
  se_equivoco: 'Se pidió por error',
  otro: 'Otro',
};

export const cancelarSolicitudSchema = z
  .object({
    categoria: z.enum(MOTIVOS_CANCELAR_SOLICITUD, 'Elige el motivo'),
    nota: notaSchema,
  })
  .superRefine(pedirNotaSiOtro);
export type CancelarSolicitudInput = z.infer<typeof cancelarSolicitudSchema>;

export const solicitudesQuerySchema = z.object({
  /** Por omisión, las pendientes y lo reciente. */
  estado: z.enum(['pendientes', 'todas']).default('todas'),
});
export type SolicitudesQuery = z.infer<typeof solicitudesQuerySchema>;

export interface SolicitudCobertura {
  id: number;
  estado: EstadoSolicitud;
  sitio: { id: number; nombre: string };
  /** El supervisor (o admin) que la pidió. */
  solicitante: { id: number; nombre: string };
  /** El guardia al que mandaron a casa y por quien se pide cobertura. */
  guardia: { id: number; nombre: string } | null;
  /** Día que se necesita cubrir (`AAAA-MM-DD`). */
  fecha: string;
  motivo: string;
  createdAt: string;
  /** Cuándo y quién la atendió o canceló, y cómo terminó ("Ana cubre el 5 nov", "Ya no se necesita"). */
  cerradaEn: string | null;
  cerradaPor: string | null;
  resolucion: string | null;
}

export interface SolicitudesLista {
  items: SolicitudCobertura[];
  pendientes: number;
}
