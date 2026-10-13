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

export const sitioSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del sitio').max(150),
  direccion: textoOpcional(300),
  referencias: textoOpcional(300),
  lat: coordenada(-90, 90),
  lng: coordenada(-180, 180),
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
  deletedAt: string | null;
  /** Guardias con asignación vigente hoy. */
  guardiasVigentes: number;
}

// ---------- Asignación de guardias ----------

export const TURNOS = ['diurno', 'nocturno', '24x24', 'mixto'] as const;
export type Turno = (typeof TURNOS)[number];

export const TURNO_LABEL: Record<Turno, string> = {
  diurno: 'Diurno',
  nocturno: 'Nocturno',
  '24x24': '24 × 24',
  mixto: 'Mixto',
};

export const asignacionCreateSchema = z
  .object({
    usuarioId: z.coerce.number().int().positive('Selecciona un guardia'),
    turno: z.enum(TURNOS, 'Selecciona un turno'),
    desde: fechaSchema,
    hasta: fechaSchema.nullish(),
  })
  .refine((a) => !a.hasta || a.hasta >= a.desde, {
    path: ['hasta'],
    message: 'Debe ser igual o posterior a la fecha de inicio',
  });

export type AsignacionCreate = z.infer<typeof asignacionCreateSchema>;

export const asignacionUpdateSchema = z.object({
  turno: z.enum(TURNOS).optional(),
  hasta: fechaSchema.nullish(),
});

export type AsignacionUpdate = z.infer<typeof asignacionUpdateSchema>;

export interface Asignacion {
  id: number;
  sitioId: number;
  usuarioId: number;
  guardia: { id: number; nombre: string; email: string; telefono: string | null };
  turno: Turno;
  desde: string;
  hasta: string | null;
  vigente: boolean;
}

/** Sitio asignado al guardia en sesión (`GET /sitios/mios`). */
export interface MiSitio {
  asignacionId: number;
  turno: Turno;
  desde: string;
  hasta: string | null;
  sitio: Pick<Sitio, 'id' | 'nombre' | 'direccion' | 'referencias' | 'lat' | 'lng'>;
  cliente: { id: number; nombreComercial: string };
}

export interface ClienteDetalle extends Cliente {
  contactos: Contacto[];
  sitios: Sitio[];
  reglasAviso: ReglasAviso;
}
