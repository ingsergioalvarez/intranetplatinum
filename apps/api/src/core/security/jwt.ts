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
  cid?: number;
  cnom?: string;
  /** Super admin (solo se incluye cuando es true). */
  sup?: true;
  /** Admin dueño del usuario (A-65). */
  pid?: number;
  /** Empresa del usuario (C-08). */
  emp?: number;
}

export function signAccessToken(user: AuthUser): string {
  const payload: AccessTokenPayload = {
    sub: String(user.id),
    email: user.email,
    rol: user.rol,
    permisos: user.permisos,
    ...(user.debeCambiarPassword ? { dcp: true as const } : {}),
    ...(user.clienteId ? { cid: user.clienteId } : {}),
    ...(user.clienteNombre ? { cnom: user.clienteNombre } : {}),
    ...(user.esSuperAdmin ? { sup: true as const } : {}),
    ...(user.propietarioId ? { pid: user.propietarioId } : {}),
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
    debeCambiarPassword: payload.dcp === true,
    clienteId: payload.cid ?? null,
    clienteNombre: payload.cnom ?? null,
    esSuperAdmin: payload.sup === true,
    propietarioId: payload.pid ?? null,
    empresaId: payload.emp ?? null,
  };
}
