import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';

/**
 * Cifrado reversible de secretos guardados en la base (p. ej. la contraseña del correo, A-87): AES-256-GCM con una clave
 * derivada de `CONFIG_SECRET` (o, si no existe, de `JWT_REFRESH_SECRET`). Formato: `v1:<iv>:<etiqueta>:<texto>` en base64.
 * Si cambia el secreto, lo guardado ya no se puede leer y hay que volver a escribirlo en la pantalla.
 */
const clave = (secreto?: string) => createHash('sha256').update(secreto ?? env.CONFIG_SECRET ?? env.JWT_REFRESH_SECRET).digest();

export function cifrarSecreto(texto: string, secreto?: string): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', clave(secreto), iv);
  const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  return ['v1', iv.toString('base64'), cifrador.getAuthTag().toString('base64'), cifrado.toString('base64')].join(':');
}

/** Devuelve el texto original, o `null` si no se puede leer (secreto distinto o dato dañado). */
export function descifrarSecreto(valor: string, secreto?: string): string | null {
  try {
    const [version, iv, etiqueta, cifrado] = valor.split(':');
    if (version !== 'v1' || !iv || !etiqueta || cifrado === undefined) return null;
    const descifrador = createDecipheriv('aes-256-gcm', clave(secreto), Buffer.from(iv, 'base64'));
    descifrador.setAuthTag(Buffer.from(etiqueta, 'base64'));
    return Buffer.concat([descifrador.update(Buffer.from(cifrado, 'base64')), descifrador.final()]).toString('utf8');
  } catch {
    return null;
  }
}
