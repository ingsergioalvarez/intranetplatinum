import { z } from 'zod';
import type { Permiso } from '../constants/permisos';
import type { Rol } from '../constants/roles';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Correo inválido')),
  password: z.string().min(1, 'Escribe tu contraseña').max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Regla de contraseña: mínimo 10 caracteres, con letras y números. */
export const passwordSchema = z
  .string()
  .min(10, 'Mínimo 10 caracteres')
  .max(100, 'Máximo 100 caracteres')
  .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, 'Debe incluir al menos una letra')
  .regex(/\d/, 'Debe incluir al menos un número');

export const cambiarPasswordSchema = z
  .object({
    actual: z.string().max(200).optional(),
    nueva: passwordSchema,
  })
  .refine((d) => !d.actual || d.nueva !== d.actual, {
    path: ['nueva'],
    message: 'La nueva contraseña debe ser distinta a la actual',
  });

export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;

/** Usuario en sesión, tal como lo devuelve la API en login y refresh. */
export interface SessionUser {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  permisos: Permiso[];
  /** Tiene contraseña temporal: solo puede cambiarla (D-012). */
  debeCambiarPassword: boolean;
  clienteId?: number | null;
  clienteNombre?: string | null;
}

/** Respuesta de `POST /auth/login` y `POST /auth/refresh`. El refresh token viaja en cookie httpOnly. */
export interface AuthSession {
  user: SessionUser;
  accessToken: string;
}
