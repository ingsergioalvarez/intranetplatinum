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

export const usuarioCreateSchema = z.object({
  nombre: z.string().trim().min(3, 'Escribe el nombre completo').max(120),
  email: z.string().trim().toLowerCase().pipe(z.email('Correo inválido').max(160)),
  telefono: textoOpcional(30),
  rol: z.enum(roles, 'Selecciona un rol'),
});

export type UsuarioCreate = z.infer<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = usuarioCreateSchema.partial();

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
