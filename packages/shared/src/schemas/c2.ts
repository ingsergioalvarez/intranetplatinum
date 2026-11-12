import { z } from 'zod';
import type { Emergencia } from './emergencias';
import type { ContactoTelefono } from './usuarios';

/**
 * Monitoreo del C2 (A-61): el C2 solo vigila que cada sitio tenga guardia y recibe los SOS; no le importan retardos,
 * horas extra ni salidas.
 * - `sos`: hay una emergencia activa en el sitio.
 * - `solo`: debía haber guardia, pasaron 15 min de su hora y nadie ha checado (o todos se fueron antes de que acabara el turno).
 * - `parcial`: debían estar 2 o más y falta alguno.
 * - `por_llegar`: el turno empezó hace menos de 15 min y aún no llega nadie.
 * - `cubierto`: hay guardia en el sitio.
 * - `sin_turno`: a esta hora no debe haber nadie.
 */
export const ESTADOS_SITIO_C2 = ['sos', 'solo', 'parcial', 'por_llegar', 'cubierto', 'sin_turno'] as const;
export type EstadoSitioC2 = (typeof ESTADOS_SITIO_C2)[number];

export const ESTADO_SITIO_C2_LABEL: Record<EstadoSitioC2, string> = {
  sos: 'SOS',
  solo: 'Solo',
  parcial: 'Parcial',
  por_llegar: 'Por llegar',
  cubierto: 'Cubierto',
  sin_turno: 'Sin turno',
};

/** De más grave a menos grave: así se ordenan clientes y sitios. */
export const GRAVEDAD_SITIO_C2: Record<EstadoSitioC2, number> = {
  sos: 0,
  solo: 1,
  parcial: 2,
  por_llegar: 3,
  cubierto: 4,
  sin_turno: 5,
};

/** Clientes por hoja de la tabla. */
export const C2_CLIENTES_POR_HOJA = [25, 50, 100] as const;

export const c2TableroQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .refine((n) => (C2_CLIENTES_POR_HOJA as readonly number[]).includes(n), 'Hoja inválida')
    .default(25),
  /** Solo lo que necesita atención: SOS, solos, parciales y por llegar. */
  problema: z.stringbool().default(false),
  /** Agrupa por cliente: las hojas son de clientes; sin agrupar, de sitios. */
  agrupar: z.stringbool().default(false),
  /** Solo los sitios en ese estado (al tocar un color de la leyenda). */
  estado: z.enum(ESTADOS_SITIO_C2).optional(),
});
export type C2TableroQuery = z.infer<typeof c2TableroQuerySchema>;

export const c2HistorialQuerySchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .optional(),
});
export type C2HistorialQuery = z.infer<typeof c2HistorialQuerySchema>;

/** Un guardia de un sitio: el que está o el que debía estar. */
export interface GuardiaC2 {
  id: number;
  nombre: string;
  /** Foto de referencia (registro de rostro); el C2 la ve para saber cómo luce. */
  foto: string | null;
  fotoAprobada: boolean;
  /** Está en el sitio ahora (checó entrada y no ha salido). */
  presente: boolean;
  /** Hora real de su entrada. */
  entrada: string | null;
  /** Horario del turno (entrada y salida). */
  horario: { entrada: string; salida: string } | null;
}

export interface SitioC2 {
  id: number;
  nombre: string;
  estado: EstadoSitioC2;
  /** Desde cuándo está sin guardia (`solo`), para el "hace 37 m". */
  desde: string | null;
  supervisor: ContactoTelefono | null;
  guardias: GuardiaC2[];
}

export interface ClienteC2 {
  id: number;
  nombre: string;
  /** El peor estado de sus sitios. */
  estado: EstadoSitioC2;
  solos: number;
  parciales: number;
  sitios: SitioC2[];
}

/** Un sitio con su cliente: una fila de la tabla. */
export interface FilaSitioC2 {
  cliente: { id: number; nombre: string };
  sitio: SitioC2;
}

/** Estados que necesitan atención (el filtro "Con problema"). */
export const ESTADOS_CON_PROBLEMA: readonly EstadoSitioC2[] = ['sos', 'solo', 'parcial', 'por_llegar'];

export interface TableroC2 {
  generadoEn: string;
  /** Conteos de todos los sitios (no solo de la hoja). */
  resumen: { sitios: number; solos: number; parciales: number; sos: number };
  /** Ids de todos los sitios solos ahora (no solo los de la hoja): el sonido depende de ellos. */
  sitiosSolos: number[];
  /** Emergencias activas que le tocan a quien consulta. Vacío casi siempre. */
  emergencias: Emergencia[];
  /** Vista normal: los sitios de la hoja, lo peor primero. Vacío si se agrupa. */
  sitios: FilaSitioC2[];
  /** Vista agrupada: los clientes de la hoja con todos sus sitios. Vacío si no se agrupa. */
  clientes: ClienteC2[];
  /** Sitios (vista normal) o clientes (agrupada) que cumplen el filtro. */
  total: number;
  page: number;
  limit: number;
}

/** Un periodo en que un sitio estuvo sin guardia (historial). */
export interface EpisodioSoloC2 {
  id: number;
  sitio: { id: number; nombre: string };
  cliente: { id: number; nombre: string };
  inicio: string;
  /** null = sigue solo. */
  fin: string | null;
  cubierto: boolean | null;
  minutos: number;
}

export interface HistorialC2 {
  fecha: string;
  items: EpisodioSoloC2[];
  /** Suma de minutos sin guardia de todos los sitios ese día. */
  totalMinutos: number;
}
