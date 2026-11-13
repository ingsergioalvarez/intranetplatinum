import { z } from 'zod';

/**
 * Correo saliente (SMTP) configurable desde la app (A-87): solo el super admin. La contraseña se guarda cifrada y nunca
 * se devuelve; en el formulario, vacía significa "no cambiarla".
 */
export const CIFRADOS_CORREO = ['starttls', 'ssl', 'ninguno'] as const;
export type CifradoCorreo = (typeof CIFRADOS_CORREO)[number];

export const CIFRADOS_CORREO_ETIQUETA: Record<CifradoCorreo, string> = {
  starttls: 'STARTTLS (puerto 587)',
  ssl: 'SSL/TLS (puerto 465)',
  ninguno: 'Ninguno',
};

/** Puerto habitual de cada cifrado, para sugerirlo al cambiar de opción. */
export const PUERTO_POR_CIFRADO: Record<CifradoCorreo, number> = { starttls: 587, ssl: 465, ninguno: 25 };

export const correoConfigSchema = z.object({
  host: z.string().trim().min(1, 'Escribe el servidor').max(255, 'Máximo 255 caracteres'),
  puerto: z.number({ error: 'Escribe el puerto' }).int('Debe ser un número entero').min(1, 'Puerto inválido').max(65535, 'Puerto inválido'),
  cifrado: z.enum(CIFRADOS_CORREO, { error: 'Elige el cifrado' }),
  /** Vacío = servidor sin autenticación. */
  usuario: z.string().trim().max(255, 'Máximo 255 caracteres'),
  /** Vacía o ausente = conservar la guardada. */
  password: z.string().max(255, 'Máximo 255 caracteres').optional(),
  remitenteNombre: z.string().trim().min(1, 'Escribe el nombre que se verá').max(100, 'Máximo 100 caracteres'),
  remitenteCorreo: z.string().trim().toLowerCase().email('Correo inválido').max(255, 'Máximo 255 caracteres'),
  activo: z.boolean(),
});
export type CorreoConfigInput = z.infer<typeof correoConfigSchema>;

/** La prueba usa lo que hay en el formulario, aunque todavía no se haya guardado. */
export const correoPruebaSchema = z.object({
  para: z.string().trim().toLowerCase().email('Correo inválido').max(255, 'Máximo 255 caracteres'),
  config: correoConfigSchema,
});
export type CorreoPruebaInput = z.infer<typeof correoPruebaSchema>;

export interface CorreoConfig {
  /** Ya hay datos guardados. */
  configurado: boolean;
  host: string;
  puerto: number;
  cifrado: CifradoCorreo;
  usuario: string;
  /** Hay una contraseña guardada (nunca se devuelve cuál). */
  tienePassword: boolean;
  remitenteNombre: string;
  remitenteCorreo: string;
  activo: boolean;
  actualizadoEn: string | null;
}

export interface ResultadoPruebaCorreo {
  enviado: boolean;
  /** Qué pasó, en palabras claras. */
  detalle: string;
}
