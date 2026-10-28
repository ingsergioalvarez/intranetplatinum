import { z } from 'zod';
import { PRIORIDAD_REPORTE, type PrioridadReporte } from '../constants/reportes';

// ---------- Reglas de aviso por cliente (F3-09, D-016) ----------

export const DESTINOS_AVISO = ['supervisor', 'cliente', 'ambos'] as const;
export type DestinoAviso = (typeof DESTINOS_AVISO)[number];

export const DESTINO_AVISO_LABEL: Record<DestinoAviso, string> = {
  supervisor: 'Solo supervisor',
  cliente: 'Solo cliente',
  ambos: 'Supervisor y cliente',
};

export interface ReglasAviso {
  porDefecto: DestinoAviso;
  /** Excepciones por prioridad; si falta, aplica `porDefecto`. */
  porPrioridad: Partial<Record<PrioridadReporte, DestinoAviso>>;
}

export const reglasAvisoSchema = z.object({
  porDefecto: z.enum(DESTINOS_AVISO, 'Elige a quién se avisa'),
  porPrioridad: z
    .object(
      Object.fromEntries(PRIORIDAD_REPORTE.map((p) => [p, z.enum(DESTINOS_AVISO).nullish()])) as Record<
        PrioridadReporte,
        z.ZodOptional<z.ZodNullable<z.ZodEnum<{ [K in DestinoAviso]: K }>>>
      >,
    )
    .default({}),
});

export type ReglasAvisoInput = z.input<typeof reglasAvisoSchema>;

/** A quién se avisa de un reporte de esta prioridad. */
export function resolverDestino(reglas: ReglasAviso, prioridad: PrioridadReporte): DestinoAviso {
  return reglas.porPrioridad[prioridad] ?? reglas.porDefecto;
}

export const avisaASupervisor = (d: DestinoAviso) => d === 'supervisor' || d === 'ambos';
export const avisaACliente = (d: DestinoAviso) => d === 'cliente' || d === 'ambos';

// ---------- Avisos en la app (F3-10) ----------

export const TIPOS_AVISO = [
  'reporte_nuevo',
  'reporte_estatus',
  'reporte_comentario',
  // Asistencia (A-17)
  'rostro_pendiente',
  'rostro_suplantacion',
  'rostro_duplicado',
  'rostro_pantalla',
  'rostro_reto',
  // Para el guardia (DA-34) y retardo para supervisores (DA-33)
  'rostro_aprobado',
  'rostro_rechazado',
  'cuenta_intento',
  'asignacion',
  'grupo',
  'retardo',
  'marca_alerta',
  'horas_extra',
  'cobertura',
] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
  reporteId: number | null;
  /** Pantalla a la que lleva el aviso (avisos que no son de un reporte). */
  ruta?: string | null;
  /** Miniatura de la foto de evidencia (incidencias de rostro), URL firmada. */
  foto?: string | null;
  leido: boolean;
  createdAt: string;
}

export interface BandejaAvisos {
  items: Aviso[];
  noLeidos: number;
}

/** Título de la notificación push de cada tipo de aviso (A-20). */
export const TITULO_AVISO: Record<TipoAviso, string> = {
  reporte_nuevo: 'Nuevo reporte',
  reporte_estatus: 'Reporte actualizado',
  reporte_comentario: 'Nuevo comentario',
  rostro_pendiente: 'Rostro por revisar',
  rostro_suplantacion: 'Posible suplantación',
  rostro_duplicado: 'Rostro ya registrado',
  rostro_pantalla: 'Pantalla o foto',
  rostro_reto: 'Gesto no completado',
  rostro_aprobado: 'Rostro aprobado',
  rostro_rechazado: 'Rostro rechazado',
  cuenta_intento: 'Intento con tu cuenta',
  asignacion: 'Tu sitio y horario',
  grupo: 'Tu grupo',
  retardo: 'Retardo',
  marca_alerta: 'Marca con alerta',
  horas_extra: 'Horas extra',
  cobertura: 'Turno sin cubrir',
};

// ---------- Notificaciones push (A-20) ----------

/** Suscripción de un navegador (`PushSubscription.toJSON()`). */
export const suscripcionPushSchema = z.object({
  endpoint: z.url('Suscripción inválida').max(2000),
  keys: z.object({
    p256dh: z.string().min(10).max(255),
    auth: z.string().min(8).max(255),
  }),
});
export type SuscripcionPushInput = z.infer<typeof suscripcionPushSchema>;

export const quitarSuscripcionPushSchema = z.object({ endpoint: z.url().max(2000) });
export type QuitarSuscripcionPushInput = z.infer<typeof quitarSuscripcionPushSchema>;

/** Clave pública del servicio; `null` si el servidor no tiene push configurado. */
export interface ClavePush {
  publicKey: string | null;
}

/** Lo que el service worker recibe en cada push. */
export interface PayloadPush {
  titulo: string;
  cuerpo: string;
  /** Pantalla a la que lleva al tocar la notificación. */
  ruta: string;
  tipo: TipoAviso;
}
