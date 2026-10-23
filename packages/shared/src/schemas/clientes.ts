import type { DiasTurno } from './turnos';
import { z } from 'zod';
import { coordenada, fechaSchema, textoOpcional } from './comunes';
import type { ReglasAviso } from './avisos';
import { paginationQuerySchema } from './pagination';

const emailOpcional = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v || null)
  .pipe(z.email('Correo inválido').max(160).nullable())
  .nullish();

/** RFC mexicano: 12 caracteres (persona moral) o 13 (persona física). */
const rfcOpcional = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => v || null)
  .pipe(
    z
      .string()
      .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, 'RFC inválido (12 o 13 caracteres)')
      .nullable(),
  )
  .nullish();

// ---------- Clientes ----------

export const ESTATUS_CLIENTE = ['activo', 'suspendido'] as const;
export type EstatusCliente = (typeof ESTATUS_CLIENTE)[number];

export const ESTATUS_CLIENTE_LABEL: Record<EstatusCliente, string> = {
  activo: 'Activo',
  suspendido: 'Suspendido',
};

const clienteBase = z.object({
  nombreComercial: z.string().trim().min(2, 'Escribe el nombre comercial').max(150),
  razonSocial: z.string().trim().min(2, 'Escribe la razón social').max(200),
  rfc: rfcOpcional,
  giro: textoOpcional(100),
  direccionFiscal: textoOpcional(300),
  telefono: textoOpcional(30),
  email: emailOpcional,
  estatus: z.enum(ESTATUS_CLIENTE),
  notas: textoOpcional(2000),
});

export const clienteCreateSchema = clienteBase.extend({
  estatus: z.enum(ESTATUS_CLIENTE).default('activo'),
});

export type ClienteCreate = z.input<typeof clienteCreateSchema>;
export type ClienteCreateData = z.output<typeof clienteCreateSchema>;

// Sin valores por defecto: un PATCH parcial no debe tocar campos omitidos (p. ej. estatus).
export const clienteUpdateSchema = clienteBase.partial();
export type ClienteUpdate = z.input<typeof clienteUpdateSchema>;

export const clienteFiltroSchema = paginationQuerySchema.extend({
  /** Busca en nombre comercial, razón social y RFC. */
  q: z.string().trim().max(100).optional(),
  estatus: z.enum(ESTATUS_CLIENTE).optional(),
  estado: z.enum(['activos', 'baja', 'todos']).default('activos'),
});

export type ClienteFiltro = z.infer<typeof clienteFiltroSchema>;

export interface Cliente {
  id: number;
  nombreComercial: string;
  razonSocial: string;
  rfc: string | null;
  giro: string | null;
  direccionFiscal: string | null;
  telefono: string | null;
  email: string | null;
  logoUrl: string | null;
  estatus: EstatusCliente;
  notas: string | null;
  createdAt: string;
  deletedAt: string | null;
}

/** Fila de la lista de clientes con totales. */
export interface ClienteResumen extends Cliente {
  totalSitios: number;
  totalContactos: number;
  /** Nombre del primer responsable, para mostrar en la lista. */
  responsable: string | null;
}

// ---------- Contactos ----------

export const contactoSchema = z
  .object({
    nombre: z.string().trim().min(2, 'Escribe el nombre').max(120),
    puesto: textoOpcional(100),
    telefono: textoOpcional(30),
    celular: textoOpcional(30),
    email: emailOpcional,
    esResponsable: z.boolean().default(false),
    recibeNotificaciones: z.boolean().default(false),
    prioridad: z.coerce.number().int().min(0).max(99).default(0),
  })
  .refine((c) => !c.recibeNotificaciones || !!c.email, {
    path: ['email'],
    message: 'Para recibir notificaciones necesita correo',
  });

export type ContactoInput = z.input<typeof contactoSchema>;
export type ContactoData = z.output<typeof contactoSchema>;

export interface Contacto {
  id: number;
  clienteId: number;
  nombre: string;
  puesto: string | null;
  telefono: string | null;
  celular: string | null;
  email: string | null;
  esResponsable: boolean;
  recibeNotificaciones: boolean;
  prioridad: number;
}

// ---------- Sitios ----------

/** Radio de la geocerca de un sitio si no se indica otro (DA-36). */
export const RADIO_SITIO_DEFAULT_M = 100;

export const sitioSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del sitio').max(150),
  direccion: textoOpcional(300),
  referencias: textoOpcional(300),
  lat: coordenada(-90, 90),
  lng: coordenada(-180, 180),
  /** Radio en metros para marcar asistencia (sitios grandes: plazas, bodegas). */
  radioM: z.coerce
    .number('Escribe el radio en metros')
    .int('Solo metros enteros')
    .min(20, 'Mínimo 20 m')
    .max(2000, 'Máximo 2,000 m')
    .default(RADIO_SITIO_DEFAULT_M),
});

export type SitioInput = z.input<typeof sitioSchema>;
export type SitioData = z.output<typeof sitioSchema>;

export interface Sitio {
  id: number;
  clienteId: number;
  nombre: string;
  direccion: string | null;
  referencias: string | null;
  lat: number | null;
  lng: number | null;
  radioM: number;
  deletedAt: string | null;
  /** Asignaciones (de guardia o de grupo) vigentes hoy. */
  asignacionesVigentes: number;
  /** Supervisor del sitio (DA-45): recibe sus avisos y revisa a sus guardias. */
  supervisor: { id: number; nombre: string } | null;
}

/** Asignar o quitar (null) el supervisor de un sitio (DA-45). */
export const supervisorSitioSchema = z.object({
  supervisorId: z.number().int().positive().nullable(),
});
export type SupervisorSitioInput = z.infer<typeof supervisorSitioSchema>;

/** Supervisor que se puede asignar a un sitio, con cuántos sitios tiene ya. */
export interface SupervisorOpcion {
  id: number;
  nombre: string;
  email: string;
  sitios: number;
}

// ---------- Asignación de sitios a guardias o grupos (F2-05, F2-07, D-017) ----------

/** Diurno, nocturno y mixto ya no se ofrecen (DA-32); se conservan en asignaciones viejas. */
export const TURNOS = ['24x24', '12x12', 'diurno', 'nocturno', 'mixto'] as const;
export type Turno = (typeof TURNOS)[number];

/** Turnos que se pueden asignar: jornada de 24 h o de 12 h desde la hora de entrada (DA-32). */
export const TURNOS_JORNADA = ['24x24', '12x12'] as const;
export type TurnoJornada = (typeof TURNOS_JORNADA)[number];

export const HORAS_TURNO: Record<TurnoJornada, number> = { '24x24': 24, '12x12': 12 };

export const TURNO_LABEL: Record<Turno, string> = {
  '24x24': '24 h',
  '12x12': '12 h',
  diurno: 'Diurno',
  nocturno: 'Nocturno',
  mixto: 'Mixto',
};

export const esTurnoJornada = (t: Turno | null | undefined): t is TurnoJornada =>
  t === '24x24' || t === '12x12';

/** Hora de salida del turno: entrada + 24 h (misma hora) o + 12 h. */
export function horaSalidaTurno(turno: TurnoJornada, entrada: string): string {
  const [h, m] = entrada.split(':').map(Number);
  return `${String((h + HORAS_TURNO[turno]) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** `08:00` → `8:00 a.m.`; `20:30` → `8:30 p.m.` */
export function horaLegible(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}

export const TIPOS_ASIGNACION = ['fija', 'temporal', 'eventual'] as const;
export type TipoAsignacion = (typeof TIPOS_ASIGNACION)[number];

export const TIPO_ASIGNACION_LABEL: Record<TipoAsignacion, string> = {
  fija: 'Fija',
  temporal: 'Temporal',
  eventual: 'Eventual',
};

export const TIPO_ASIGNACION_DESCRIPCION: Record<TipoAsignacion, string> = {
  fija: 'Desde una fecha, sin fecha de término',
  temporal: 'Por un periodo: del día de inicio al de término',
  eventual: 'Un evento puntual de uno o pocos días, con horario',
};

/** Días máximos de una asignación eventual. */
export const MAX_DIAS_EVENTUAL = 7;

/** Hora `HH:MM` (24 h). */
export const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)');

const idOpcional = z.coerce.number().int().positive().nullish();
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export const asignacionCreateSchema = z
  .object({
    /** Exactamente uno: guardia suelto o grupo. */
    usuarioId: idOpcional,
    grupoId: idOpcional,
    tipo: z.enum(TIPOS_ASIGNACION, 'Elige el tipo de asignación'),
    turno: z.enum(TURNOS).nullish(),
    desde: fechaSchema,
    hasta: fechaSchema.nullish(),
    horaInicio: horaSchema.nullish(),
    horaFin: horaSchema.nullish(),
  })
  .superRefine((a, ctx) => {
    const error = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (!!a.usuarioId === !!a.grupoId) error('usuarioId', 'Elige un guardia o un grupo');
    if (a.hasta && a.hasta < a.desde) error('hasta', 'Debe ser igual o posterior a la fecha de inicio');
    if (a.tipo === 'fija' && a.hasta) error('hasta', 'Una asignación fija no tiene fecha de término');
    if (a.tipo === 'temporal' && !a.hasta) error('hasta', 'Indica hasta cuándo');
    if (a.tipo !== 'eventual') {
      if (!esTurnoJornada(a.turno)) error('turno', 'Elige un turno de 24 h o de 12 h');
      if (!a.horaInicio) error('horaInicio', 'Indica la hora de entrada');
    }
    if (a.tipo === 'eventual') {
      if (!a.horaInicio) error('horaInicio', 'Indica la hora de inicio');
      if (!a.horaFin) error('horaFin', 'Indica la hora de término');
      if (a.hasta && diasEntre(a.desde, a.hasta) >= MAX_DIAS_EVENTUAL) {
        error('hasta', `Un evento dura máximo ${MAX_DIAS_EVENTUAL} días`);
      }
    }
  });

export type AsignacionCreate = z.input<typeof asignacionCreateSchema>;
export type AsignacionCreateData = z.output<typeof asignacionCreateSchema>;

export const asignacionUpdateSchema = z.object({
  /** Turno del catálogo (DA-37): copia su jornada y horario. */
  turnoId: z.coerce.number().int().positive().optional(),
  turno: z.enum(TURNOS_JORNADA, 'Elige un turno de 24 h o de 12 h').optional(),
  /** Hora de entrada (fija/temporal); la salida se recalcula. */
  horaInicio: horaSchema.optional(),
  hasta: fechaSchema.nullish(),
});

export type AsignacionUpdate = z.infer<typeof asignacionUpdateSchema>;

/**
 * Último día en que el sitio es visible: fija = sin fin; temporal = hasta;
 * eventual = último día del evento, +1 si el horario cruza la medianoche.
 */
export function calcularVigenteHasta(
  a: Pick<AsignacionCreateData, 'tipo' | 'desde' | 'hasta' | 'horaInicio' | 'horaFin'>,
): string | null {
  if (a.tipo !== 'eventual') return a.hasta ?? null;
  const ultimo = a.hasta ?? a.desde;
  if (a.horaInicio && a.horaFin && a.horaFin <= a.horaInicio) {
    return new Date(Date.parse(`${ultimo}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  }
  return ultimo;
}

export interface Asignacion {
  id: number;
  sitioId: number;
  tipo: TipoAsignacion;
  /** Uno de los dos. */
  guardia: { id: number; nombre: string; email: string; telefono: string | null } | null;
  grupo: { id: number; nombre: string; integrantes: number } | null;
  turno: Turno | null;
  horaInicio: string | null;
  horaFin: string | null;
  /** Turno del catálogo (DA-37); null en eventos, asignaciones anteriores o si se borró el turno. */
  turnoCatalogo: { id: number; nombre: string } | null;
  /** Copia del horario del turno: horas de trabajo y qué días (null en eventos y anteriores). */
  horas: number | null;
  dias: DiasTurno | null;
  desde: string;
  hasta: string | null;
  vigente: boolean;
}

/** Sitio asignado hoy al guardia en sesión, directo o por grupo (`GET /sitios/mios`). */
export interface MiSitio {
  asignacionId: number;
  tipo: TipoAsignacion;
  /** Nombre del grupo si la asignación es por grupo. */
  grupo: string | null;
  turno: Turno | null;
  horaInicio: string | null;
  horaFin: string | null;
  horas: number | null;
  dias: DiasTurno | null;
  desde: string;
  hasta: string | null;
  sitio: Pick<Sitio, 'id' | 'nombre' | 'direccion' | 'referencias' | 'lat' | 'lng' | 'radioM'>;
  cliente: { id: number; nombreComercial: string };
  /** Cubre este sitio (DA-39): mientras dura, sus sitios propios quedan en pausa. */
  cobertura?: { id: number; motivo: string; cubreA: string | null } | null;
}

// ---------- Grupos de guardias (F2-06) ----------

export const grupoSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del grupo').max(80),
  descripcion: textoOpcional(255),
});

export type GrupoInput = z.input<typeof grupoSchema>;
export type GrupoData = z.output<typeof grupoSchema>;

export const integrantesSchema = z.object({
  usuarioIds: z.array(z.coerce.number().int().positive()).max(300),
});

export interface Grupo {
  id: number;
  nombre: string;
  descripcion: string | null;
  deletedAt: string | null;
  integrantes: { id: number; nombre: string; email: string }[];
  /** Sitios asignados al grupo vigentes hoy. */
  asignacionesVigentes: number;
}

export interface ClienteDetalle extends Cliente {
  contactos: Contacto[];
  sitios: Sitio[];
  reglasAviso: ReglasAviso;
}
