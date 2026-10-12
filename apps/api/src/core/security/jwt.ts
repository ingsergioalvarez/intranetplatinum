import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import type { AuthUser } from '../types/auth';

interface AccessTokenPayload {
  sub: string;
  email: string;
  rol: AuthUser['rol'];
  permisos: string[];
  /** Debe cambiar contraseña (solo se incluye cuando es true). */
  dcp?: true;
}

export function signAccessToken(user: AuthUser): string {
  const payload: AccessTokenPayload = {
    sub: String(user.id),
    email: user.email,
    rol: user.rol,
    permisos: user.permisos,
    ...(user.debeCambiarPassword ? { dcp: true as const } : {}),
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn'],
  });
}

/** Lanza si el token es inválido o expiró. */
export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  return {
    id: Number(payload.sub),
    email: payload.email,
    rol: payload.rol,
    permisos: payload.permisos ?? [],
    debeCambiarPassword: payload.dcp === true,
  };
}
