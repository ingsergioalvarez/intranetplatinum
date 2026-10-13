import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env';

// Llave propia derivada del secreto de JWT (no reutiliza la firma de tokens).
const llave = () => createHmac('sha256', env.JWT_ACCESS_SECRET).update('archivos-v1').digest();

const firma = (clave: string, exp: number) =>
  createHmac('sha256', llave()).update(`${clave}:${exp}`).digest('base64url');

/** URL relativa para descargar un archivo sin token de sesión, válida `ttlMin` minutos. */
export function firmarArchivo(clave: string, ttlMin = env.ARCHIVOS_URL_TTL_MIN, ahora = Date.now()) {
  const exp = Math.floor(ahora / 1000) + ttlMin * 60;
  return `/api/archivos/${clave}?exp=${exp}&sig=${firma(clave, exp)}`;
}

/** Verifica firma y caducidad. */
export function verificarFirma(clave: string, exp: number, sig: string, ahora = Date.now()) {
  if (!Number.isFinite(exp) || exp * 1000 < ahora) return false;
  const esperada = Buffer.from(firma(clave, exp));
  const recibida = Buffer.from(sig);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}
