import { z } from 'zod';
import type { MiSitio, TipoAsignacion, Turno } from './clientes';
import type { DiasTurno } from './turnos';
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

/** Radio de la geocerca del sitio si no tiene uno propio (DA-02, DA-36). */
export const RADIO_GEOCERCA_M = 100;

/**
 * Una entrada sin salida deja de considerarse "jornada abierta" pasadas estas horas
 * (cubre turnos de 24 h con margen). Después se permite una nueva entrada y la anterior
 * queda sin salida.
 */
export const JORNADA_MAX_HORAS = 30;

/** Qué se puede marcar después de cada tipo (la salida también se permite sin cerrar la comida). */
/** La comida dura 1 h para todos (DA-47). */
export const COMIDA_MIN = 60;
/** Sin regresar de comer a los 90 min: un aviso al supervisor (DA-47). */
export const COMIDA_AVISO_SUPERVISOR_MIN = 90;

/** Comidas por turno (DA-47): hasta 12 h, una; turnos más largos (24 h), dos. Sin horario, una. */
export const comidasDelTurno = (horas: number | null) => (horas && horas > 12 ? 2 : 1);

export const SIGUIENTES_MARCAS: Record<TipoMarcacion, TipoMarcacion[]> = {
  entrada: ['inicio_comida'],
  inicio_comida: ['fin_comida'],
  fin_comida: ['salida'],
  salida: ['entrada'],
};

export const ALERTAS_MARCACION = [
  'fuera_de_rango',
  'sitio_sin_ubicacion',
  'gps_impreciso',
  'rostro_no_coincide',
  'sin_rostro_registrado',
  'rostro_pendiente',
  'rostro_rechazado',
  'retardo',
  'salida_anticipada',
  'sin_lentes_declarado',
  'cerrada_por_supervisor',
  'enviada_sin_conexion',
  'hora_desfasada',
] as const;
export type AlertaMarcacion = (typeof ALERTAS_MARCACION)[number];

export const ALERTA_MARCACION_LABEL: Record<AlertaMarcacion, string> = {
  fuera_de_rango: `Fuera del sitio (más de ${RADIO_GEOCERCA_M} m)`,
  sitio_sin_ubicacion: 'El sitio no tiene ubicación registrada',
  gps_impreciso: 'Ubicación poco precisa',
  rostro_no_coincide: 'Rostro no confirmado',
  sin_rostro_registrado: 'Sin rostro registrado',
  rostro_pendiente: 'Rostro pendiente de aprobación',
  rostro_rechazado: 'El rostro con el que marcó fue rechazado',
  retardo: 'Retardo',
  salida_anticipada: 'Salida anticipada',
  cerrada_por_supervisor: 'Jornada cerrada por un supervisor',
  enviada_sin_conexion: 'Checada hecha sin conexión y enviada después',
  hora_desfasada: 'La hora del celular no coincide con la del servidor',
  sin_lentes_declarado: 'Dijo que no traía lentes (el sistema detectó lentes)',
};

/** Diferencia entre el reloj del celular y el del servidor a partir de la cual se alerta (AS2-04). */
export const DESFASE_RELOJ_MAX_SEG = 300;
/** Una marca hecha sin conexión que tarda más en llegar se marca como sospechosa (AS2-02). */
export const HORAS_MAX_SIN_CONEXION = 72;

/** Minutos de tolerancia en la entrada y la salida (DA-33). */
export const TOLERANCIA_RETARDO_MIN = 10;
/** El aviso de retardo al supervisor sale pasados estos minutos (tolerancia + 5 de margen, DA-33). */
export const AVISO_RETARDO_MIN = 15;
/** Salir esta cantidad de minutos (o más) antes de la hora: alerta y aviso al supervisor (DA-33). */
export const SALIDA_ANTICIPADA_MIN = 10;
/**
 * Patrón (DA-33): faltas menores repetidas avisan aunque cada una sola no avise. Salir al menos
 * PATRON_SALIDA_MIN antes, o llegar con retardo, PATRON_SEGUIDOS turnos seguidos.
 */
export const PATRON_SALIDA_MIN = 3;
export const PATRON_SEGUIDOS = 3;

// ---------- Reconocimiento facial (AS1-02, AS1-08) ----------

/** Marcas que llevan foto con reconocimiento (la comida no, DA-07). */
export const TIPOS_CON_FOTO: TipoMarcacion[] = ['entrada', 'salida'];
/** Valores del vector facial de face-api.js. */
export const DESCRIPTOR_LONGITUD = 128;
/** Distancia máxima para considerar que es la misma persona (face-api usa 0.6; aquí más estricto). */
export const UMBRAL_ROSTRO = 0.5;
/** Más lejos que esto ya no es el titular (entre ambos umbrales: dudoso, se sigue buscando). DA-28. */
export const UMBRAL_NO_TITULAR = 0.6;
export const MUESTRAS_ROSTRO_MIN = 3;
export const MUESTRAS_ROSTRO_MAX = 5;

/** Distancia euclidiana entre dos vectores faciales. */
export function distanciaRostro(a: readonly number[], b: readonly number[]): number {
  let suma = 0;
  for (let i = 0; i < a.length; i++) suma += (a[i] - b[i]) ** 2;
  return Math.sqrt(suma);
}

/** Parecido aproximado para mostrar (100 % = idéntico). */
export const parecidoRostro = (distancia: number) => Math.max(0, Math.round((1 - distancia) * 100));

/** Acepta el valor ya parseado o como texto JSON (campos de un formulario multipart). */
const desdeJson = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }, schema);

export const descriptorSchema = z.array(z.number()).length(DESCRIPTOR_LONGITUD, 'Vector facial inválido');

export const rostroRegistroSchema = z.object({
  descriptores: desdeJson(
    z
      .array(descriptorSchema)
      .min(MUESTRAS_ROSTRO_MIN, `Toma al menos ${MUESTRAS_ROSTRO_MIN} fotos`)
      .max(MUESTRAS_ROSTRO_MAX, `Máximo ${MUESTRAS_ROSTRO_MAX} fotos`),
  ),
  /** Tocó "No traigo lentes" aunque la cámara detectaba lentes (DA-44); queda en auditoría. */
  sinLentes: z.stringbool().optional(),
});
export type RostroRegistroInput = z.infer<typeof rostroRegistroSchema>;

/** Verificación en vivo mientras la cámara está abierta (DA-28): no se guarda nada. */
export const verificacionRostroSchema = z.object({ descriptor: descriptorSchema });

/**
 * - titular: es el dueño de la cuenta.
 * - no_titular: es otra persona (desconocida u otro guardia registrado).
 * - dudoso: no se distingue (luz, distancia): se sigue buscando.
 * - sin_rostro: la cuenta no tiene rostro con qué comparar.
 */
export type ResultadoVerificacion = 'titular' | 'no_titular' | 'dudoso' | 'sin_rostro';

// ---------- Incidencias de rostro (DA-31) ----------

/** Intentos rechazados: al marcar (cámara o servidor) o al registrar un rostro ya registrado. */
export const MOTIVOS_INCIDENCIA = [
  'pantalla',
  'rostro_de_otro',
  'no_titular',
  'reto_fallido',
  'registro_duplicado',
] as const;
export type MotivoIncidencia = (typeof MOTIVOS_INCIDENCIA)[number];

export const MOTIVO_INCIDENCIA_LABEL: Record<MotivoIncidencia, string> = {
  pantalla: 'Pantalla o foto',
  rostro_de_otro: 'Rostro de otro guardia',
  no_titular: 'No es el titular',
  reto_fallido: 'No completó el gesto',
  registro_duplicado: 'Rostro ya registrado',
};

/** Motivos graves (se muestran en rojo); los demás en naranja. */
export const MOTIVOS_GRAVES: readonly MotivoIncidencia[] = [
  'pantalla',
  'rostro_de_otro',
  'registro_duplicado',
];

/**
 * Lo que reporta la cámara (multipart con `foto`): pantalla o foto, persona que no es el titular
 * (con su vector, el servidor dice si es otro guardia) o gesto no completado. DA-28, DA-29, DA-30.
 */
export const incidenciaCreateSchema = z.object({
  tipo: z.enum(['entrada', 'salida'], 'Tipo de marca inválido'),
  motivo: z.enum(['pantalla', 'no_titular', 'reto_fallido'], 'Motivo inválido'),
  descriptor: desdeJson(descriptorSchema).optional(),
});
export type IncidenciaCreateInput = z.infer<typeof incidenciaCreateSchema>;

export const CONCLUSIONES_INCIDENCIA = ['falsa_alarma', 'confirmada'] as const;
export type ConclusionIncidencia = (typeof CONCLUSIONES_INCIDENCIA)[number];

export const CONCLUSION_INCIDENCIA_LABEL: Record<ConclusionIncidencia, string> = {
  falsa_alarma: 'Falsa alarma',
  confirmada: 'Confirmada',
};

export const incidenciasQuerySchema = paginationQuerySchema.extend({
  estado: z.enum(['pendientes', 'revisadas']).default('pendientes'),
  /** Busca en el nombre o correo del guardia y en el sitio. */
  q: z.string().trim().max(100).optional(),
  guardiaId: z.coerce.number().int().positive().optional(),
  /** Solo en revisadas. */
  conclusion: z.enum(CONCLUSIONES_INCIDENCIA).optional(),
});
export type IncidenciasQuery = z.infer<typeof incidenciasQuerySchema>;

/** Al revisar se elige la conclusión (DA-35). */
export const revisarIncidenciaSchema = z.object({
  conclusion: z.enum(CONCLUSIONES_INCIDENCIA, 'Elige la conclusión'),
  nota: z.string().trim().max(255, 'Máximo 255 caracteres').optional(),
});

export interface IncidenciaRostro {
  id: number;
  guardia: GuardiaResumen;
  motivo: MotivoIncidencia;
  /** Entrada o salida; null si fue al registrar el rostro. */
  tipoMarca: TipoMarcacion | null;
  /** Foto del intento (URL firmada). */
  foto: string;
  /** Rostro registrado del guardia, para comparar (URL firmada). */
  rostroRegistrado: string | null;
  /** Guardia al que corresponde la cara (rostro de otro / registro duplicado). */
  rostroDe: { id: number; nombre: string } | null;
  sitio: { id: number; nombre: string } | null;
  creadaEn: string;
  revisadaPor: string | null;
  revisadaEn: string | null;
  conclusion: ConclusionIncidencia | null;
  nota: string | null;
}

export const ESTADOS_ROSTRO = ['pendiente', 'aprobado', 'rechazado'] as const;
export type EstadoRostro = (typeof ESTADOS_ROSTRO)[number];

export const ESTADO_ROSTRO_LABEL: Record<EstadoRostro, string> = {
  pendiente: 'Pendiente de revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

/** Rostro de un guardia (sin los vectores). `id` identifica ese rostro (trazabilidad de marcas). */
export interface RostroRegistro {
  id: number;
  estado: EstadoRostro;
  /** true si lo registró el propio guardia (pendiente de revisión hasta que lo aprueben). */
  autoregistro: boolean;
  fotoUrl: string;
  /** Todas las fotos del registro, para revisarlas. */
  fotos: string[];
  registradoEn: string;
  registradoPor: string;
  muestras: number;
  revisadoPor: string | null;
  revisadoEn: string | null;
  motivoRechazo: string | null;
}

/** Rostro pendiente de revisión, con su guardia. */
export interface RostroPendiente {
  guardia: GuardiaResumen;
  rostro: RostroRegistro;
}

/** Situación del rostro del guardia en sesión (pantalla "Marcar"). */
export interface MiRostro {
  estado: EstadoRostro | 'sin_registro';
  motivoRechazo: string | null;
}

export const rechazoRostroSchema = z.object({
  motivo: z.string().trim().min(3, 'Escribe el motivo').max(255, 'Máximo 255 caracteres'),
});

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
  /** Radio de la geocerca (DA-36); si falta, RADIO_GEOCERCA_M. */
  radioM?: number;
  /** Horario de la asignación (DA-32): turno de 24/12 h desde `horaInicio`, o eventual con `horaFin`. */
  turno?: Turno | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  /** Horas y días del turno (DA-37). */
  horas?: number | null;
  dias?: DiasTurno | null;
  /** Vigencia de la asignación (para saber si le toca un día, en ciclos). */
  tipo?: TipoAsignacion;
  desde?: string;
  hasta?: string | null;
  /** Lo cubre ese día (DA-39): motivo y a quién cubre. */
  cobertura?: { motivo: string; cubreA: string | null } | null;
  /** Días en que no le toca por un cambio de turno aprobado (TC-22). */
  pausas?: string[];
}

/** Turno del guardia (DA-40): para "Tu turno empieza a las…" y "Descansas hoy, tu próximo turno…". */
export interface TurnoDelGuardia {
  sitio: { id: number; nombre: string; lat: number | null; lng: number | null; radioM: number | null };
  entrada: string;
  salida: string;
  cobertura: { motivo: string; cubreA: string | null } | null;
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

/** Entrada y salida llegan como multipart (con `foto`); por eso los números se convierten. */
export const marcacionCreateSchema = z.object({
  /** Generado en el dispositivo: evita duplicados si la misma marca se envía dos veces. */
  idCliente: z.uuid('Identificador inválido'),
  tipo: z.enum(TIPOS_MARCACION, 'Tipo de marca inválido'),
  // GPS obligatorio (DA-02).
  lat: z.coerce.number('Falta tu ubicación').min(-90).max(90),
  lng: z.coerce.number('Falta tu ubicación').min(-180).max(180),
  /** Precisión reportada por el GPS, en metros. */
  precisionM: z.coerce.number().min(0).max(100_000),
  /** Número de intento de reconocimiento facial en entrada/salida (se guarda como dato). */
  intento: z.coerce.number().int().min(1).max(99).default(1),
  /** Vector facial calculado en el dispositivo; falta si no se pudo leer el rostro. */
  descriptor: desdeJson(descriptorSchema).optional(),
  /** Tocó "No traigo lentes" aunque la cámara detectaba lentes (DA-44): la marca lleva alerta. */
  sinLentes: z.stringbool().optional(),
  /** Hora del reloj del celular al checar (ISO); el servidor la compara con la suya (AS2-04). */
  horaCelular: z.iso.datetime({ offset: true }).optional(),
  /**
   * Solo si se checó sin conexión: hora estimada de la checada (reloj corregido con la última hora del
   * servidor). Entra como hora de la marca, nunca en el futuro ni más de 72 h atrás (AS2-02).
   */
  capturadaEn: z.iso.datetime({ offset: true }).optional(),
});
export type MarcacionCreate = z.input<typeof marcacionCreateSchema>;
export type MarcacionCreateData = z.output<typeof marcacionCreateSchema>;

/**
 * Cerrar la jornada de un guardia que no pudo checar su salida (DA-49): admin o supervisor registran
 * la salida con motivo obligatorio y la hora (por omisión, la programada si ya pasó, o ahora).
 */
export const cerrarJornadaSchema = z.object({
  motivo: z.string().trim().min(3, 'Escribe el motivo').max(255, 'Máximo 255 caracteres'),
  /** Hora de salida (ISO); entre la entrada y ahora. */
  salidaEn: z.iso.datetime({ offset: true }).optional(),
});
export type CerrarJornadaInput = z.infer<typeof cerrarJornadaSchema>;

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
  /** URL firmada de la foto (entrada/salida). */
  foto: string | null;
  /** Resultado del reconocimiento: distancia al rostro registrado (null si no hay) e intentos. */
  rostro: { distancia: number | null; intentos: number } | null;
  /** Marcó con el rostro pendiente y después se aprobó: cuándo (ya no es alerta). */
  rostroAprobadoEn: string | null;
}

/** Entrada con sus marcas de comida y salida. */
export interface Jornada {
  entrada: Marcacion;
  /** Primera comida (las pantallas que muestran una sola). */
  inicioComida: Marcacion | null;
  finComida: Marcacion | null;
  /** Todas sus comidas en orden (DA-47) y cuántas le tocan según su turno. */
  comidas: { inicio: Marcacion; fin: Marcacion | null }[];
  comidasPermitidas: number;
  salida: Marcacion | null;
  sitio: { id: number; nombre: string } | null;
  /** Alertas de cualquiera de sus marcas, sin repetir. */
  alertas: AlertaMarcacion[];
  /** Entrada y salida programadas del turno (copia del horario al marcar la entrada, DA-32). */
  programada: { entrada: string; salida: string } | null;
  /** Minutos tarde (negativo: llegó antes). Null sin horario. */
  retardoMin: number | null;
  /** Minutos antes de la salida programada (negativo: salió después). Null sin horario o sin salida. */
  salidaAnticipadaMin: number | null;
}

/** Lo que necesita la pantalla "Marcar". */
export interface EstadoAsistencia {
  /** Jornada abierta, o la última de las últimas horas (para el resumen "Hoy"). */
  jornada: Jornada | null;
  /** Marcas permitidas ahora, en orden. */
  permitidas: TipoMarcacion[];
  /** Sitios asignados hoy. */
  sitios: SitioMarcable[];
  /** Si no tiene rostro (o se rechazó), al marcar primero se registra él mismo. */
  rostro: MiRostro;
  /** Turno en curso o que empieza en los próximos 30 min (DA-40). */
  turnoActual: TurnoDelGuardia | null;
  /** Siguiente turno si ahora no está en turno (hasta 14 días). */
  proximoTurno: TurnoDelGuardia | null;
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
  foto?: string | null;
}

/**
 * Una fila de la lista del día: la jornada de un guardia, o un guardia asignado ese día
 * que no ha marcado (`jornada: null`).
 */
/** Turno sin entrada del día (DA-45): aún no empieza, tolerancia, no se presentó (15 min) o falta (2 h). */
export const ESTADOS_TURNO = ['por_entrar', 'por_llegar', 'no_se_presento', 'falta'] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

export interface FilaAsistencia {
  guardia: GuardiaResumen;
  sitio: { id: number; nombre: string } | null;
  jornada: Jornada | null;
  /** Sin marcas: su hora de entrada y en qué va (solo si su asignación tiene horario). */
  turno?: { entrada: string; estado: EstadoTurno; horas: number | null } | null;
  /** Está cubriendo este sitio (DA-39). */
  cobertura?: boolean;
}

/**
 * Tablero del día para admin y supervisor (DA-51): lo que necesita atención ahora. Una jornada
 * cuenta en una sola clase.
 * - `sin_llegar`: le tocaba entrar y no ha checado (no se presentó o ya es falta).
 * - `sin_salida`: su jornada ya debió terminar y sigue abierta.
 * - `comida_abierta`: salió a comer y no regresa (más de 1 h).
 */
export const CLASES_TABLERO = ['sin_llegar', 'sin_salida', 'comida_abierta'] as const;
export type ClaseTablero = (typeof CLASES_TABLERO)[number];

export interface TableroItem {
  clase: ClaseTablero;
  /** La fila de asistencia (con `turno` si no llegó, o `jornada` si ya checó). */
  fila: FilaAsistencia;
  /** Minutos desde la hora de entrada (sin llegar), desde que debió salir o desde que salió a comer. */
  minutos: number;
}

export interface TableroAsistencia {
  fecha: string;
  items: TableroItem[];
}

/** Ficha de un guardia: sus jornadas del mes (solo lectura, DA-08). */
export interface AsistenciaGuardia {
  guardia: GuardiaResumen;
  /** Rostro registrado, para comparar con la foto de cada marca. */
  rostro: RostroRegistro | null;
  jornadas: Jornada[];
  /** Sitios y horarios que tiene hoy (directos o por grupo). */
  asignaciones: MiSitio[];
}

/** Lo que se borraría al eliminar definitivamente un sitio (solo admin, DA-50). */
export interface HistorialSitio {
  asignaciones: number;
  marcas: number;
  reportes: number;
  coberturas: number;
}

/** Lo que se borraría al eliminar definitivamente un cliente con sus sitios (solo admin, DA-50). */
export interface HistorialCliente extends HistorialSitio {
  sitios: number;
  contactos: number;
  /** Usuarios del portal de este cliente: no se borran, quedan sin cliente. */
  usuariosPortal: number;
}

/** Lo que se borraría al eliminar definitivamente a un usuario (solo admin). */
export interface HistorialUsuario {
  marcas: number;
  rostros: number;
  reportes: number;
  seguimientos: number;
  asignaciones: number;
}
