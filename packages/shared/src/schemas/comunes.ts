import { z } from 'zod';

/** Texto opcional: vacío o solo espacios se guarda como null. */
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => v || null)
    .nullish();

/** Coordenada opcional (número o texto, p. ej. desde un formulario multipart). */
export const coordenada = (min: number, max: number) =>
  z
    .union([z.number(), z.string().trim()])
    .transform((v) => (v === '' ? null : Number(v)))
    .pipe(z.number().min(min, 'Coordenada fuera de rango').max(max, 'Coordenada fuera de rango').nullable())
    .nullish();

/** Fecha `AAAA-MM-DD` (sin hora; se interpreta en la zona del negocio). */
export const fechaSchema = z.iso.date('Fecha inválida');

/** Id numérico que puede llegar como texto (query o multipart). */
export const idCoerce = (mensaje = 'Selecciona una opción') =>
  z.coerce.number(mensaje).int().positive(mensaje);
