import { z } from 'zod';
import type { Permiso } from '../constants/permisos';
import type { Rol } from '../constants/roles';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Correo inválido')),
  password: z.string().min(1, 'Escribe tu contraseña').max(200),
  /** Clave de este celular si ya tiene perfil rápido guardado (A-40, solo guardias). */
  dispositivoToken: z.string().max(200).optional(),
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

/** PIN del perfil rápido (A-40): 4 dígitos. */
export const pinSchema = z.string().regex(/^\d{4}$/, 'El PIN son 4 dígitos');

/** Entrar con la tarjeta de un perfil guardado en este celular (A-40). */
export const perfilRapidoSchema = z.object({
  token: z.string().min(1).max(200),
  pin: pinSchema,
});
export type PerfilRapidoInput = z.infer<typeof perfilRapidoSchema>;

/** "Quitar de este dispositivo" desde la pantalla de entrada: basta la clave del propio celular. */
export const quitarPerfilSchema = z.object({ token: z.string().min(1).max(200) });

/** Crear o cambiar el PIN: pide la contraseña actual. */
export const definirPinSchema = z.object({
  pin: pinSchema,
  password: z.string().min(1, 'Escribe tu contraseña').max(200),
});
export type DefinirPinInput = z.infer<typeof definirPinSchema>;

/** Intentos de PIN antes de bloquear la tarjeta. */
export const PIN_MAX_INTENTOS = 5;

/** Celular con perfil rápido, tal como se lista. */
export interface DispositivoUsuarioVista {
  id: number;
  etiqueta: string;
  tienePin: boolean;
  /** Bloqueado por PIN incorrecto: se libera al entrar con contraseña. */
  bloqueado: boolean;
  ultimoUso: string | null;
  createdAt: string;
}

/** Celular de este inicio de sesión (solo guardias). `token` solo viene al crearse. */
export interface DispositivoSesion {
  id: number;
  token?: string;
  tienePin: boolean;
}

/** Respuesta de `POST /auth/login` y `POST /auth/refresh`. El refresh token viaja en cookie httpOnly. */
export interface AuthSession {
  user: SessionUser;
  accessToken: string;
  /** Perfil rápido de este celular (A-40); solo en el login de un guardia. */
  dispositivo?: DispositivoSesion;
}
