import { z } from 'zod';
import type { Emergencia } from './emergencias';
import type { ContactoTelefono, EtiquetaTelefono } from './usuarios';

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

/** El supervisor del sitio, con todos sus números (el personal y el de la empresa) para el icono "Llamar". */
export type SupervisorC2 = ContactoTelefono & { telefonos: { numero: string; etiqueta: EtiquetaTelefono }[] };

export interface SitioC2 {
  id: number;
  nombre: string;
  estado: EstadoSitioC2;
  /** Desde cuándo está sin guardia (`solo`), para el "hace 37 m". */
  desde: string | null;
  supervisor: SupervisorC2 | null;
  guardias: GuardiaC2[];
  /** Última nota del C2 de hoy sobre este sitio: así quien relevé el turno sabe qué ya se hizo. */
  ultimaNota?: { texto: string; autor: string; en: string } | null;
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

// ---------- Bitácora del C2 (A-80) ----------

/** Todo lo que se registra: lo que pasa con los sitios, los SOS y lo que hace el C2. */
export const TIPOS_EVENTO_C2 = [
  'sitio_solo',
  'sitio_parcial',
  'sitio_cubierto',
  'sitio_cierre',
  'sos_lanzado',
  'sos_atendiendo',
  'sos_respuesta',
  'sos_cerrado',
  'sos_sin_respuesta',
  'nota',
  'aviso_supervisor',
  'reporte',
] as const;
export type TipoEventoC2 = (typeof TIPOS_EVENTO_C2)[number];

export const TIPO_EVENTO_C2_LABEL: Record<TipoEventoC2, string> = {
  sitio_solo: 'Sitio solo',
  sitio_parcial: 'Sitio parcial',
  sitio_cubierto: 'Cubierto',
  sitio_cierre: 'Turno terminó sin cubrirse',
  sos_lanzado: 'SOS lanzado',
  sos_atendiendo: 'SOS: lo están atendiendo',
  sos_respuesta: 'SOS: respuesta del C2',
  sos_cerrado: 'SOS cerrado',
  sos_sin_respuesta: 'SOS sin respuesta',
  nota: 'Nota del C2',
  aviso_supervisor: 'Aviso al supervisor',
  reporte: 'Reporte levantado',
};

/** Filtro de la bitácora: lo que pasa con los sitios, los SOS o lo que hizo el C2. */
export const GRUPOS_EVENTO_C2 = ['todo', 'sitios', 'sos', 'acciones'] as const;
export type GrupoEventoC2 = (typeof GRUPOS_EVENTO_C2)[number];
export const GRUPO_EVENTO_C2_LABEL: Record<GrupoEventoC2, string> = {
  todo: 'Todo',
  sitios: 'Sitios',
  sos: 'SOS',
  acciones: 'Acciones del C2',
};
export const TIPOS_DEL_GRUPO: Record<Exclude<GrupoEventoC2, 'todo'>, readonly TipoEventoC2[]> = {
  sitios: ['sitio_solo', 'sitio_parcial', 'sitio_cubierto', 'sitio_cierre'],
  sos: ['sos_lanzado', 'sos_atendiendo', 'sos_respuesta', 'sos_cerrado', 'sos_sin_respuesta'],
  acciones: ['nota', 'aviso_supervisor', 'reporte'],
};

export const c2BitacoraQuerySchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .optional(),
  grupo: z.enum(GRUPOS_EVENTO_C2).default('todo'),
  q: z.string().trim().max(100).optional(),
});
export type C2BitacoraQuery = z.infer<typeof c2BitacoraQuerySchema>;

export interface EventoC2 {
  id: number;
  tipo: TipoEventoC2;
  sitio: { id: number | null; nombre: string; cliente: string } | null;
  detalle: string | null;
  /** Quién lo hizo (null si lo registró el sistema). */
  usuario: string | null;
  minutos: number | null;
  /** Emergencia o reporte de donde viene. */
  entidad: { tipo: 'emergencia' | 'reporte'; id: number } | null;
  createdAt: string;
}

export interface BitacoraC2 {
  fecha: string;
  items: EventoC2[];
}

// ---------- Acciones del C2 sobre un sitio ----------

export const NOTA_C2_MAX = 500;

/** Nota libre: se guarda en la bitácora con quién la escribió y la hora. */
export const notaC2Schema = z.object({
  texto: z.string().trim().min(3, 'Escribe la nota').max(NOTA_C2_MAX, `Máximo ${NOTA_C2_MAX} caracteres`),
});
export type NotaC2Input = z.infer<typeof notaC2Schema>;

/** Aviso al supervisor y al admin del sitio, de parte del C2. El texto extra es opcional. */
export const avisoSupervisorC2Schema = z.object({
  mensaje: z.string().trim().max(200, 'Máximo 200 caracteres').optional(),
});
export type AvisoSupervisorC2Input = z.infer<typeof avisoSupervisorC2Schema>;

export const sitioC2ParamSchema = z.object({ sitioId: z.coerce.number().int().positive() });

// ---------- Lo que hace el C2, a la vista de supervisor y admin (A-82) ----------

/** Lo último que hizo el C2 hoy sobre los sitios de quien consulta: notas, avisos, reportes y respuestas a SOS. */
export interface ActividadC2 {
  items: EventoC2[];
}

/** Última nota del C2 de hoy sobre un sitio (para verla en la asistencia del día). */
export interface NotaSitioC2 {
  sitioId: number;
  texto: string;
  autor: string;
  en: string;
}

/** Qué eventos cuentan como "actividad del C2". */
export const TIPOS_ACTIVIDAD_C2: readonly TipoEventoC2[] = ['nota', 'aviso_supervisor', 'reporte', 'sos_respuesta'];
