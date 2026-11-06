import { z } from 'zod';
import type { Permiso } from '../constants/permisos';
import { ROLES, type Rol } from '../constants/roles';
import { paginationQuerySchema } from './pagination';

/** Clave de un rol: cualquiera de los 4 base o uno creado por la empresa (C-11 parte 5). */
export type ClaveRol = Rol | (string & {});

/** Texto opcional: vacío o solo espacios se guarda como null. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullish();

/** Guardias y supervisores deben tener un teléfono de contacto: es el que se marca en una emergencia (A-60). */
export const ROLES_CON_TELEFONO: readonly string[] = [ROLES.COLABORADOR, ROLES.SUPERVISOR, ROLES.JEFE];
export const MENSAJE_TELEFONO_OBLIGATORIO = 'Escribe el teléfono de contacto (puede ser el de la empresa)';

const rolClaveSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{1,30}$/, 'Selecciona un rol');

const usuarioBaseSchema = z.object({
  nombre: z.string().trim().min(3, 'Escribe el nombre completo').max(120),
  email: z.string().trim().toLowerCase().pipe(z.email('Correo inválido').max(160)),
  /** Teléfono de contacto: puede ser el compartido de la empresa. Obligatorio en guardias y supervisores. */
  telefono: textoOpcional(30),
  /** Número personal, opcional: si lo tiene, es el que se marca primero. */
  telefonoPersonal: textoOpcional(30),
  rol: rolClaveSchema,
});

export const usuarioCreateSchema = usuarioBaseSchema.superRefine((v, ctx) => {
  if (ROLES_CON_TELEFONO.includes(v.rol) && !v.telefono) {
    ctx.addIssue({ code: 'custom', path: ['telefono'], message: MENSAJE_TELEFONO_OBLIGATORIO });
  }
});

export type UsuarioCreate = z.infer<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = usuarioBaseSchema.partial();

export type UsuarioUpdate = z.infer<typeof usuarioUpdateSchema>;

export const ESTADOS_USUARIO = ['activos', 'baja', 'todos'] as const;
export type EstadoUsuarioFiltro = (typeof ESTADOS_USUARIO)[number];

export const usuarioFiltroSchema = paginationQuerySchema.extend({
  /** Busca en nombre, correo y teléfono. */
  q: z.string().trim().max(100).optional(),
  rol: rolClaveSchema.optional(),
  estado: z.enum(ESTADOS_USUARIO).default('activos'),
});

export type UsuarioFiltro = z.infer<typeof usuarioFiltroSchema>;

/** Usuario tal como lo expone la API (fechas en ISO). */
export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  telefonoPersonal: string | null;
  rol: Rol;
  /** Nombre visible del rol en la empresa (C-11 parte 5). */
  rolNombre?: string;
  /** Permisos individuales adicionales otorgados a esta persona (C-11 parte 5). */
  permisosPropios?: Permiso[];
  /** Super admin (A-65). */
  esSuperAdmin: boolean;
  /** Área a la que pertenece (C-10); null = sin área. */
  areaId: number | null;
  activo: boolean;
  debeCambiarPassword: boolean;
  bloqueadoHasta: string | null;
  ultimoAcceso: string | null;
  createdAt: string;
  deletedAt: string | null;
}

/** Respuesta de alta y de reset: la contraseña temporal se muestra una sola vez (D-012). */
export interface UsuarioConPassword {
  usuario: Usuario;
  passwordTemporal: string;
}

export type EtiquetaTelefono = 'personal' | 'empresa';

/** A qué número se llama a una persona: el personal si lo tiene, si no el de contacto (empresa). */
export interface ContactoTelefono {
  nombre: string;
  telefono: string | null;
  telefonoEtiqueta: EtiquetaTelefono | null;
}

export function telefonoDeContacto(u: {
  telefono?: string | null;
  telefonoPersonal?: string | null;
}): { telefono: string | null; telefonoEtiqueta: EtiquetaTelefono | null } {
  if (u.telefonoPersonal) return { telefono: u.telefonoPersonal, telefonoEtiqueta: 'personal' };
  if (u.telefono) return { telefono: u.telefono, telefonoEtiqueta: 'empresa' };
  return { telefono: null, telefonoEtiqueta: null };
}
