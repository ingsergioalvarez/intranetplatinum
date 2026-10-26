import type { Permiso, Rol } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

/** Usuario con lo necesario para autenticar (incluye hash y estado de bloqueo). */
export interface UsuarioAuth {
  id: number;
  nombre: string;
  email: string;
  passwordHash: string;
  activo: boolean;
  debeCambiarPassword: boolean;
  deletedAt: Date | null;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
  rol: Rol;
  permisos: Permiso[];
  clienteId?: number | null;
  clienteNombre?: string | null;
}

export interface RefreshTokenRecord {
  id: number;
  usuarioId: number;
  expiraEn: Date;
  revocadoEn: Date | null;
}

export interface NuevoRefreshToken {
  usuarioId: number;
  tokenHash: string;
  expiraEn: Date;
  ip?: string;
  userAgent?: string;
}

/** Acceso a datos de autenticación, independiente del ORM. */
export abstract class AuthRepository {
  abstract findUsuarioByEmail(email: string): Promise<UsuarioAuth | null>;
  abstract findUsuarioById(id: number): Promise<UsuarioAuth | null>;
  abstract registrarIntentoFallido(id: number, intentos: number, bloqueadoHasta: Date | null): Promise<void>;
  /** Reinicia intentos fallidos y bloqueo, y guarda la fecha de último acceso. */
  abstract registrarAccesoExitoso(id: number): Promise<void>;
  /** Guarda la nueva contraseña y quita la marca de temporal. */
  abstract actualizarPassword(id: number, passwordHash: string): Promise<void>;

  abstract crearRefreshToken(data: NuevoRefreshToken): Promise<void>;
  abstract findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /**
   * Revoca el token actual y crea el nuevo de forma atómica.
   * Devuelve false si el token ya estaba revocado (otra petición lo rotó antes).
   */
  abstract rotarRefreshToken(id: number, nuevo: NuevoRefreshToken): Promise<boolean>;
  abstract revocarRefreshToken(id: number): Promise<void>;
  abstract revocarRefreshTokensDeUsuario(usuarioId: number): Promise<void>;
}

const usuarioAuthInclude = {
  rol: { include: { permisos: { include: { permiso: true } } } },
  cliente: { select: { id: true, nombreComercial: true } },
} as const;

export class PrismaAuthRepository extends AuthRepository {
  async findUsuarioByEmail(email: string) {
    const u = await getPrisma().usuario.findUnique({ where: { email }, include: usuarioAuthInclude });
    return u && this.toUsuarioAuth(u);
  }

  async findUsuarioById(id: number) {
    const u = await getPrisma().usuario.findUnique({ where: { id }, include: usuarioAuthInclude });
    return u && this.toUsuarioAuth(u);
  }

  async registrarIntentoFallido(id: number, intentos: number, bloqueadoHasta: Date | null) {
    await getPrisma().usuario.update({ where: { id }, data: { intentosFallidos: intentos, bloqueadoHasta } });
  }

  async registrarAccesoExitoso(id: number) {
    await getPrisma().usuario.update({
      where: { id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
    });
  }

  async actualizarPassword(id: number, passwordHash: string) {
    await getPrisma().usuario.update({ where: { id }, data: { passwordHash, debeCambiarPassword: false } });
  }

  async crearRefreshToken(data: NuevoRefreshToken) {
    await getPrisma().refreshToken.create({ data });
  }

  async findRefreshToken(tokenHash: string) {
    return getPrisma().refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, usuarioId: true, expiraEn: true, revocadoEn: true },
    });
  }

  async rotarRefreshToken(id: number, nuevo: NuevoRefreshToken) {
    return getPrisma().$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id, revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
      if (count === 0) return false;
      await tx.refreshToken.create({ data: nuevo });
      return true;
    });
  }

  async revocarRefreshToken(id: number) {
    await getPrisma().refreshToken.updateMany({
      where: { id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }

  async revocarRefreshTokensDeUsuario(usuarioId: number) {
    await getPrisma().refreshToken.updateMany({
      where: { usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }

  private toUsuarioAuth(u: {
    id: number;
    nombre: string;
    email: string;
    passwordHash: string;
    activo: boolean;
    debeCambiarPassword: boolean;
    deletedAt: Date | null;
    intentosFallidos: number;
    bloqueadoHasta: Date | null;
    rol: { clave: string; permisos: { permiso: { clave: string } }[] };
    clienteId?: number | null;
    cliente?: { id: number; nombreComercial: string } | null;
  }): UsuarioAuth {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      passwordHash: u.passwordHash,
      activo: u.activo,
      debeCambiarPassword: u.debeCambiarPassword,
      deletedAt: u.deletedAt,
      intentosFallidos: u.intentosFallidos,
      bloqueadoHasta: u.bloqueadoHasta,
      rol: u.rol.clave as Rol,
      permisos: u.rol.permisos.map((rp) => rp.permiso.clave as Permiso),
      clienteId: u.clienteId ?? u.cliente?.id ?? null,
      clienteNombre: u.cliente?.nombreComercial ?? null,
    };
  }
}
