import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;

// Sin caracteres que se confunden al dictarlos o copiarlos a mano (0/O, 1/l/I).
const LETRAS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITOS = '23456789';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Contraseña temporal legible (D-012): cumple `passwordSchema` (letras y números)
 * y se muestra una sola vez al administrador.
 */
export function generateTemporaryPassword(length = 12): string {
  const todos = LETRAS + DIGITOS;
  const chars = [LETRAS[randomInt(LETRAS.length)], DIGITOS[randomInt(DIGITOS.length)]];
  while (chars.length < length) chars.push(todos[randomInt(todos.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
