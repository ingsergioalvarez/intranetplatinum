import { z } from 'zod';
import { ROLES, type Rol } from '../constants/roles';
import { paginationQuerySchema } from './pagination';

const roles = Object.values(ROLES) as [Rol, ...Rol[]];

/** Texto opcional: vacío o solo espacios se guarda como null. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullish();

/** Guardias y supervisores deben tener un teléfono de contacto: es el que se marca en una emergencia (A-60). */
export const ROLES_CON_TELEFONO: readonly Rol[] = [ROLES.GUARDIA, ROLES.SUPERVISOR];
export const MENSAJE_TELEFONO_OBLIGATORIO = 'Escribe el teléfono de contacto (puede ser el de la empresa)';

const usuarioBaseSchema = z.object({
  nombre: z.string().trim().min(3, 'Escribe el nombre completo').max(120),
  email: z.string().trim().toLowerCase().pipe(z.email('Correo inválido').max(160)),
  /** Teléfono de contacto: puede ser el compartido de la empresa. Obligatorio en guardias y supervisores. */
  telefono: textoOpcional(30),
  /** Número personal, opcional: si lo tiene, es el que se marca primero. */
  telefonoPersonal: textoOpcional(30),
  rol: z.enum(roles, 'Selecciona un rol'),
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
  rol: z.enum(roles).optional(),
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
