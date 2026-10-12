import { createHash, randomBytes } from 'node:crypto';

/** Token opaco aleatorio (refresh, recuperación de contraseña). Se entrega al cliente en claro. */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/** Hash SHA-256 hex (64 caracteres) con el que se guarda el token en BD. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
