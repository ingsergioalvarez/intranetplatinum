import { z } from 'zod';

// ---------- Avisos en la app (F3-10) ----------

export const TIPOS_AVISO = [
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
  'emergencia',
] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  /** Título del aviso: el propio si lo tiene (A-22) o el genérico del tipo; siempre viene lleno. */
  titulo: string;
  mensaje: string;
  /** Pantalla a la que lleva el aviso. */
  ruta?: string | null;
  /** Miniatura de la foto de evidencia (incidencias de rostro), URL firmada. */
  foto?: string | null;
  leido: boolean;
  /** Ya lo atendió alguien (A-54): quién, cuándo y con qué resultado ("Aprobado", "Falta confirmada"…). */
  atendido?: { por: string | null; en: string; resultado: string } | null;
  createdAt: string;
}

export interface BandejaAvisos {
  items: Aviso[];
  noLeidos: number;
}

/** Título del aviso: el propio (A-22) o, si no tiene, el genérico de su tipo. Largo máximo de la columna. */
export const TITULO_AVISO_MAX = 80;
export const tituloDeAviso = (tipo: TipoAviso, titulo?: string | null) =>
  titulo?.trim().slice(0, TITULO_AVISO_MAX) || TITULO_AVISO[tipo];

/** Título genérico de cada tipo de aviso, cuando el aviso no trae uno propio (A-20, A-22). */
export const TITULO_AVISO: Record<TipoAviso, string> = {
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
  emergencia: 'Emergencia',
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
  /** Alerta urgente (A-60): suena, vibra y no se descarta sola. */
  urgente?: boolean;
}
