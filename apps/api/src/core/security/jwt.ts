import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import type { AlcanceRol } from '@platinum/shared';
import type { AuthUser } from '../types/auth';

interface AccessTokenPayload {
  sub: string;
  email: string;
  rol: AuthUser['rol'];
  permisos: string[];
  /** Alcance del rol (C-11 parte 4). */
  alc?: AlcanceRol;
  /** Debe cambiar contraseña (solo se incluye cuando es true). */
  dcp?: true;
  /** Super admin (solo se incluye cuando es true). */
  sup?: true;
  /** Empresa del usuario (C-08). */
  emp?: number;
}

export function signAccessToken(user: AuthUser): string {
  const payload: AccessTokenPayload = {
    sub: String(user.id),
    email: user.email,
    rol: user.rol,
    permisos: user.permisos,
    ...(user.alcance ? { alc: user.alcance } : {}),
    ...(user.debeCambiarPassword ? { dcp: true as const } : {}),
    ...(user.esSuperAdmin ? { sup: true as const } : {}),
    ...(user.empresaId ? { emp: user.empresaId } : {}),
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
    alcance: payload.alc,
    debeCambiarPassword: payload.dcp === true,
    esSuperAdmin: payload.sup === true,
    empresaId: payload.emp ?? null,
  };
}
