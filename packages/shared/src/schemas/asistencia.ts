import { z } from 'zod';
import { fechaSchema } from './comunes';
import { paginationQuerySchema } from './pagination';

// ---------- Control de asistencia (A-17, docs/ASISTENCIA.md) ----------

export const TIPOS_MARCACION = ['entrada', 'inicio_comida', 'fin_comida', 'salida'] as const;
export type TipoMarcacion = (typeof TIPOS_MARCACION)[number];

export const TIPO_MARCACION_LABEL: Record<TipoMarcacion, string> = {
  entrada: 'Entrada',
  inicio_comida: 'Inicio de comida',
  fin_comida: 'Fin de comida',
  salida: 'Salida',
};

/** Radio de la geocerca del sitio (DA-02). */
export const RADIO_GEOCERCA_M = 100;

/**
 * Una entrada sin salida deja de considerarse "jornada abierta" pasadas estas horas
 * (cubre turnos de 24 h con margen). Después se permite una nueva entrada y la anterior
 * queda sin salida.
 */
export const JORNADA_MAX_HORAS = 30;

/** Qué se puede marcar después de cada tipo (la salida también se permite sin cerrar la comida). */
export const SIGUIENTES_MARCAS: Record<TipoMarcacion, TipoMarcacion[]> = {
  entrada: ['inicio_comida', 'salida'],
  inicio_comida: ['fin_comida', 'salida'],
  fin_comida: ['salida'],
  salida: ['entrada'],
};

export const ALERTAS_MARCACION = ['fuera_de_rango', 'sitio_sin_ubicacion', 'gps_impreciso'] as const;
export type AlertaMarcacion = (typeof ALERTAS_MARCACION)[number];

export const ALERTA_MARCACION_LABEL: Record<AlertaMarcacion, string> = {
  fuera_de_rango: `Fuera del sitio (más de ${RADIO_GEOCERCA_M} m)`,
  sitio_sin_ubicacion: 'El sitio no tiene ubicación registrada',
  gps_impreciso: 'Ubicación poco precisa',
};

/** Distancia en metros entre dos coordenadas (fórmula de haversine). */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Sitio donde el guardia puede marcar (asignación vigente). */
export interface SitioMarcable {
  id: number;
  nombre: string;
  cliente: string;
  lat: number | null;
  lng: number | null;
}

/**
 * Sitio al que corresponde una ubicación: el único asignado o el más cercano con coordenadas.
 * Si ninguno tiene coordenadas, el primero.
 */
export function sitioMasCercano<T extends SitioMarcable>(
  sitios: T[],
  punto: { lat: number; lng: number },
): { sitio: T; distanciaM: number | null } | null {
  if (sitios.length === 0) return null;
  let mejor: { sitio: T; distanciaM: number | null } = { sitio: sitios[0], distanciaM: null };
  for (const sitio of sitios) {
    if (sitio.lat === null || sitio.lng === null) continue;
    const d = distanciaMetros(punto, { lat: sitio.lat, lng: sitio.lng });
    if (mejor.distanciaM === null || d < mejor.distanciaM) mejor = { sitio, distanciaM: d };
  }
  return mejor;
}

export const marcacionCreateSchema = z.object({
  /** Generado en el dispositivo: evita duplicados si la misma marca se envía dos veces. */
  idCliente: z.uuid('Identificador inválido'),
  tipo: z.enum(TIPOS_MARCACION, 'Tipo de marca inválido'),
  // GPS obligatorio (DA-02).
  lat: z.number('Falta tu ubicación').min(-90).max(90),
  lng: z.number('Falta tu ubicación').min(-180).max(180),
  /** Precisión reportada por el GPS, en metros. */
  precisionM: z.number().min(0).max(100_000),
});
export type MarcacionCreate = z.infer<typeof marcacionCreateSchema>;

export const misMarcasQuerySchema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido (AAAA-MM)'),
});

export interface Marcacion {
  id: number;
  tipo: TipoMarcacion;
  /** Hora del servidor (ISO). */
  registradaEn: string;
  sitio: { id: number; nombre: string } | null;
  lat: number;
  lng: number;
  precisionM: number;
  /** Distancia al sitio; null si el sitio no tiene coordenadas. */
  distanciaM: number | null;
  alertas: AlertaMarcacion[];
}

/** Entrada con sus marcas de comida y salida. */
export interface Jornada {
  entrada: Marcacion;
  inicioComida: Marcacion | null;
  finComida: Marcacion | null;
  salida: Marcacion | null;
  sitio: { id: number; nombre: string } | null;
  /** Alertas de cualquiera de sus marcas, sin repetir. */
  alertas: AlertaMarcacion[];
}

/** Lo que necesita la pantalla "Marcar". */
export interface EstadoAsistencia {
  /** Jornada abierta, o la última de las últimas horas (para el resumen "Hoy"). */
  jornada: Jornada | null;
  /** Marcas permitidas ahora, en orden. */
  permitidas: TipoMarcacion[];
  /** Sitios asignados hoy. */
  sitios: SitioMarcable[];
}

// ---------- Vista de admin / supervisor (AS1-07) ----------

export const asistenciaDiaQuerySchema = paginationQuerySchema.extend({
  /** Día `AAAA-MM-DD` (zona del negocio). */
  fecha: fechaSchema,
  /** Busca en el nombre o correo del guardia y en el nombre del sitio. */
  q: z.string().trim().max(100).optional(),
  soloAlertas: z.stringbool().optional(),
});
export type AsistenciaDiaQuery = z.infer<typeof asistenciaDiaQuerySchema>;

export interface GuardiaResumen {
  id: number;
  nombre: string;
  email: string;
}

/**
 * Una fila de la lista del día: la jornada de un guardia, o un guardia asignado ese día
 * que no ha marcado (`jornada: null`).
 */
export interface FilaAsistencia {
  guardia: GuardiaResumen;
  sitio: { id: number; nombre: string } | null;
  jornada: Jornada | null;
}

/** Ficha de un guardia: sus jornadas del mes (solo lectura, DA-08). */
export interface AsistenciaGuardia {
  guardia: GuardiaResumen;
  jornadas: Jornada[];
}
