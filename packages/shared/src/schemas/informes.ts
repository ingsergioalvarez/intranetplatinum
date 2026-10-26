import { z } from 'zod';
import { fechaSchema, idCoerce } from './comunes';
import { paginationQuerySchema } from './pagination';

/**
 * Reporte oficial de asistencia (DA-52): se calcula una vez, se congela con folio y huella, y ya no
 * se edita. Internos: no se muestran al cliente.
 */
export const TIPOS_INFORME = ['personal', 'general'] as const;
export type TipoInforme = (typeof TIPOS_INFORME)[number];
export const TIPO_INFORME_LABEL: Record<TipoInforme, string> = {
  personal: 'Personal',
  general: 'General',
};

/** Días máximos de un reporte (un mes completo). */
export const DIAS_MAX_INFORME = 31;

/** Días entre dos fechas `AAAA-MM-DD`, contando ambas. */
export const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;

export const nuevoInformeSchema = z
  .object({
    tipo: z.enum(TIPOS_INFORME, 'Elige el tipo de reporte'),
    /** Reporte personal: el guardia. */
    guardiaId: idCoerce('Elige un guardia').nullish(),
    /** Reporte general: limitarlo a un sitio (vacío = todos los que puedes ver). */
    sitioId: idCoerce().nullish(),
    desde: fechaSchema,
    hasta: fechaSchema,
    incluirFirmas: z.boolean().default(true),
    /** General: anexar las hojas de cada guardia. */
    incluirDetalle: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'personal' && !v.guardiaId) {
      ctx.addIssue({ code: 'custom', path: ['guardiaId'], message: 'Elige un guardia' });
    }
    if (v.hasta < v.desde) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final es anterior a la inicial' });
    } else if (diasEntre(v.desde, v.hasta) > DIAS_MAX_INFORME) {
      ctx.addIssue({
        code: 'custom',
        path: ['hasta'],
        message: `El periodo no puede pasar de ${DIAS_MAX_INFORME} días`,
      });
    }
  });
export type NuevoInformeInput = z.input<typeof nuevoInformeSchema>;
export type NuevoInformeData = z.output<typeof nuevoInformeSchema>;

export const informesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  tipo: z.enum(TIPOS_INFORME).optional(),
  guardiaId: idCoerce().optional(),
  /** Solo los que cubren este mes `AAAA-MM`. */
  mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export type InformesQuery = z.infer<typeof informesQuerySchema>;

// ---------- Contenido congelado ----------

export const ESTADOS_DIA_INFORME = [
  'completa',
  'retardo',
  'falta',
  'falta_justificada',
  'descanso',
  'sin_salida',
  'cerrada',
  'en_curso',
] as const;
export type EstadoDiaInforme = (typeof ESTADOS_DIA_INFORME)[number];

export const ESTADO_DIA_INFORME_LABEL: Record<EstadoDiaInforme, string> = {
  completa: 'Completa',
  retardo: 'Retardo',
  falta: 'Falta',
  falta_justificada: 'Falta justificada',
  descanso: 'Descanso',
  sin_salida: 'Sin salida',
  cerrada: 'Cerrada por supervisor',
  en_curso: 'En curso',
};

export interface InformeDia {
  /** `AAAA-MM-DD` en que empezó el turno. */
  fecha: string;
  sitio: string | null;
  /** Horario programado `08:00 – 20:00`. */
  horario: string | null;
  /** Instantes ISO (el servidor es quien los puso). */
  entrada: string | null;
  retardoMin: number | null;
  salidaAnticipadaMin: number | null;
  comidas: { inicio: string; fin: string | null }[];
  salida: string | null;
  /** Salida − entrada. */
  minutos: number | null;
  /** Lo programado en el día (para comparar). */
  esperadosMin: number | null;
  estado: EstadoDiaInforme;
  /** Cubría otro sitio. */
  cobertura: boolean;
  notas: string[];
}

export interface InformeResumen {
  programados: number;
  trabajados: number;
  faltas: number;
  justificadas: number;
  retardos: number;
  retardoMin: number;
  salidasAntes: number;
  comidas: number;
  minutosTrabajados: number;
  minutosEsperados: number;
}

export interface InformeGuardia {
  id: number;
  nombre: string;
  email: string;
  sitios: string[];
  supervisores: string[];
  /** `Todos los días · 08:00 – 20:00`, uno por asignación. */
  turnos: string[];
  dias: InformeDia[];
  resumen: InformeResumen;
}

export interface InformeHecho {
  /** Instante ISO. */
  en: string;
  guardia: string;
  texto: string;
}

export interface InformeDatos {
  tipo: TipoInforme;
  desde: string;
  hasta: string;
  /** `Guardia: Juan Pérez`, `Sitio: Torre Norte` o `Todos los sitios`. */
  alcance: string;
  guardias: InformeGuardia[];
  porSitio: { sitio: string; guardias: number; resumen: InformeResumen }[];
  resumen: InformeResumen;
  hechos: InformeHecho[];
  criterios: string[];
}

export interface InformeResumenFila {
  id: number;
  folio: string;
  tipo: TipoInforme;
  /** `Juan Pérez` o `Todos los sitios` / nombre del sitio. */
  alcance: string;
  guardia: { id: number; nombre: string } | null;
  desde: string;
  hasta: string;
  incluirDetalle: boolean;
  incluirFirmas: boolean;
  generadoPor: string | null;
  createdAt: string;
  codigo: string;
  /** Folio al que sustituye y folio que lo sustituyó (el reporte original nunca se borra). */
  reemplaza: { id: number; folio: string } | null;
  reemplazadoPor: { id: number; folio: string } | null;
  resumen: InformeResumen;
}

export interface Informe extends InformeResumenFila {
  datos: InformeDatos;
}

/** Respuesta de emitir: `existente` si ya había uno con los mismos datos. */
export interface InformeEmitido {
  informe: InformeResumenFila;
  existente: boolean;
}

export interface OpcionesInforme {
  guardias: { id: number; nombre: string }[];
  sitios: { id: number; nombre: string }[];
}

/** Lo único que ve quien escanea el QR (sin sesión). */
export interface VerificacionInforme {
  valido: boolean;
  folio: string;
  tipo: TipoInforme;
  desde: string;
  hasta: string;
  emitidoEn: string;
  /** El código del QR coincide con el del reporte; null si no se mandó. */
  codigoValido: boolean | null;
  vigente: boolean;
  reemplazadoPor: string | null;
  resumen: Pick<InformeResumen, 'programados' | 'trabajados' | 'faltas' | 'retardos'>;
}

/** Folio `ASIS-AAAA-NNNNNN`. */
export const folioInforme = (id: number, creado: Date) =>
  `ASIS-${creado.getUTCFullYear()}-${String(id).padStart(6, '0')}`;

/** Código corto de verificación `XXXX-XXXX` a partir de la huella. */
export const codigoInforme = (hash: string) => `${hash.slice(0, 4)}-${hash.slice(4, 8)}`.toUpperCase();

/** Minutos como `8 h 05 min`. */
export const duracionMin = (min: number) =>
  `${Math.floor(min / 60)} h ${String(Math.abs(min) % 60).padStart(2, '0')} min`;

/** Atajos de periodo (zona del negocio): quincenas y meses. `hoy` es `AAAA-MM-DD`. */
export function atajosPeriodo(hoy: string): Record<'quincena1' | 'quincena2' | 'mes' | 'mesAnterior', [string, string]> {
  const [a, m] = hoy.split('-').map(Number);
  const ultimo = (y: number, mm: number) => new Date(Date.UTC(y, mm, 0)).getUTCDate();
  const f = (y: number, mm: number, d: number) =>
    `${y}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const ant = m === 1 ? [a - 1, 12] : [a, m - 1];
  return {
    quincena1: [f(a, m, 1), f(a, m, 15)],
    quincena2: [f(a, m, 16), f(a, m, ultimo(a, m))],
    mes: [f(a, m, 1), f(a, m, ultimo(a, m))],
    mesAnterior: [f(ant[0], ant[1], 1), f(ant[0], ant[1], ultimo(ant[0], ant[1]))],
  };
}
