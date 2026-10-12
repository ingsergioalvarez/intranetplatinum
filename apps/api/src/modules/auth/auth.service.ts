import type { AuthSession, CambiarPasswordInput, LoginInput, SessionUser } from '@platinum/shared';
import { env } from '../../config/env';
import {
  AuditLogger,
  BaseService,
  HttpError,
  generateOpaqueToken,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword,
  type RequestContext,
} from '../../core';
import type { AuthRepository, UsuarioAuth } from './auth.repository';

/** Sesión emitida: lo que va en el body más el refresh token que va en cookie. */
export interface IssuedSession extends AuthSession {
  refreshToken: string;
  refreshExpiraEn: Date;
}

export interface AuthPolicy {
  maxIntentos: number;
  bloqueoMin: number;
  refreshDias: number;
}

/**
 * Un refresh token revocado hace menos de esto se considera una carrera entre pestañas
 * (no un robo): se rechaza sin cerrar las demás sesiones.
 */
const GRACIA_ROTACION_MS = 30_000;

const credencialesInvalidas = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
const refreshInvalido = () =>
  new HttpError(401, 'REFRESH_INVALID', 'Sesión expirada, vuelve a iniciar sesión');

export class AuthService extends BaseService {
  /** Hash de relleno para comparar aunque el correo no exista (mismo tiempo de respuesta). */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly repo: AuthRepository,
    private readonly audit: AuditLogger,
    private readonly policy: AuthPolicy = {
      maxIntentos: env.LOGIN_MAX_INTENTOS,
      bloqueoMin: env.LOGIN_BLOQUEO_MIN,
      refreshDias: env.JWT_REFRESH_EXPIRES_DAYS,
    },
  ) {
    super();
  }

  async login({ email, password }: LoginInput, ctx: RequestContext): Promise<IssuedSession> {
    const usuario = await this.repo.findUsuarioByEmail(email);

    if (!usuario) {
      this.dummyHash ??= hashPassword(generateOpaqueToken(16));
      await verifyPassword(password, await this.dummyHash);
      await this.audit.registrar({
        ...ctx,
        accion: 'auth.login_fallido',
        datos: { email, motivo: 'no_existe' },
      });
      throw credencialesInvalidas();
    }

    const ahora = new Date();
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
      await this.audit.registrar({
        ...ctx,
        usuarioId: usuario.id,
        accion: 'auth.login_fallido',
        datos: { motivo: 'bloqueado' },
      });
      throw this.cuentaBloqueada(usuario.bloqueadoHasta);
    }

    if (!(await verifyPassword(password, usuario.passwordHash))) {
      await this.registrarFallo(usuario, ctx);
    }

    if (!usuario.activo || usuario.deletedAt) {
      await this.audit.registrar({
        ...ctx,
        usuarioId: usuario.id,
        accion: 'auth.login_fallido',
        datos: { motivo: 'inactivo' },
      });
      throw new HttpError(403, 'USER_INACTIVE', 'Tu usuario está dado de baja. Contacta al administrador.');
    }

    await this.repo.registrarAccesoExitoso(usuario.id);
    const sesion = await this.emitirSesion(usuario, ctx);
    await this.audit.registrar({ ...ctx, usuarioId: usuario.id, accion: 'auth.login' });
    this.log('login', { usuarioId: usuario.id });
    return sesion;
  }

  async refresh(refreshToken: string | undefined, ctx: RequestContext): Promise<IssuedSession> {
    if (!refreshToken) throw refreshInvalido();
    const actual = await this.repo.findRefreshToken(hashToken(refreshToken));
    if (!actual) throw refreshInvalido();

    const ahora = Date.now();
    if (actual.revocadoEn) {
      if (ahora - actual.revocadoEn.getTime() > GRACIA_ROTACION_MS) {
        // Reutilización de un token ya rotado: posible robo. Se cierran todas las sesiones.
        await this.repo.revocarRefreshTokensDeUsuario(actual.usuarioId);
        await this.audit.registrar({
          ...ctx,
          usuarioId: actual.usuarioId,
          accion: 'auth.refresh_reutilizado',
        });
      }
      throw refreshInvalido();
    }
    if (actual.expiraEn.getTime() <= ahora) throw refreshInvalido();

    const usuario = await this.repo.findUsuarioById(actual.usuarioId);
    if (!usuario || !usuario.activo || usuario.deletedAt) {
      await this.repo.revocarRefreshTokensDeUsuario(actual.usuarioId);
      throw refreshInvalido();
    }

    const nuevo = this.nuevoRefreshToken(usuario.id, ctx);
    if (!(await this.repo.rotarRefreshToken(actual.id, nuevo.registro))) throw refreshInvalido();

    return {
      user: this.toSessionUser(usuario),
      accessToken: this.accessToken(usuario),
      refreshToken: nuevo.token,
      refreshExpiraEn: nuevo.registro.expiraEn,
    };
  }

  /** Cierra la sesión actual. Idempotente: sin token o con token inválido no falla. */
  async logout(refreshToken: string | undefined, ctx: RequestContext): Promise<void> {
    if (!refreshToken) return;
    const actual = await this.repo.findRefreshToken(hashToken(refreshToken));
    if (!actual || actual.revocadoEn) return;
    await this.repo.revocarRefreshToken(actual.id);
    await this.audit.registrar({ ...ctx, usuarioId: actual.usuarioId, accion: 'auth.logout' });
  }

  /**
   * Cambio de contraseña propio (también el obligatorio tras una temporal, D-012).
   * Cierra todas las sesiones del usuario y emite una nueva para este dispositivo.
   */
  async cambiarPassword(
    usuarioId: number,
    { actual, nueva }: CambiarPasswordInput,
    ctx: RequestContext,
  ): Promise<IssuedSession> {
    const usuario = await this.repo.findUsuarioById(usuarioId);
    if (!usuario || !usuario.activo || usuario.deletedAt) throw HttpError.unauthorized();
    if (!(await verifyPassword(actual, usuario.passwordHash))) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [
        { path: 'actual', message: 'La contraseña actual no es correcta' },
      ]);
    }

    await this.repo.actualizarPassword(usuario.id, await hashPassword(nueva));
    await this.repo.revocarRefreshTokensDeUsuario(usuario.id);
    const sesion = await this.emitirSesion({ ...usuario, debeCambiarPassword: false }, ctx);
    await this.audit.registrar({
      ...ctx,
      usuarioId: usuario.id,
      accion: 'auth.cambiar_password',
      datos: { eraTemporal: usuario.debeCambiarPassword },
    });
    return sesion;
  }

  /** Suma un intento fallido y bloquea la cuenta al llegar al máximo. Siempre lanza. */
  private async registrarFallo(usuario: UsuarioAuth, ctx: RequestContext): Promise<never> {
    const intentos = usuario.intentosFallidos + 1;
    if (intentos >= this.policy.maxIntentos) {
      const hasta = new Date(Date.now() + this.policy.bloqueoMin * 60_000);
      await this.repo.registrarIntentoFallido(usuario.id, 0, hasta);
      await this.audit.registrar({
        ...ctx,
        usuarioId: usuario.id,
        accion: 'auth.cuenta_bloqueada',
        datos: { intentos, hasta: hasta.toISOString() },
      });
      throw this.cuentaBloqueada(hasta);
    }
    await this.repo.registrarIntentoFallido(usuario.id, intentos, null);
    await this.audit.registrar({
      ...ctx,
      usuarioId: usuario.id,
      accion: 'auth.login_fallido',
      datos: { motivo: 'password', intentos },
    });
    throw credencialesInvalidas();
  }

  private cuentaBloqueada(hasta: Date) {
    const minutos = Math.max(1, Math.ceil((hasta.getTime() - Date.now()) / 60_000));
    return new HttpError(
      423,
      'ACCOUNT_LOCKED',
      `Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${minutos} min.`,
      { bloqueadoHasta: hasta.toISOString() },
    );
  }

  private async emitirSesion(usuario: UsuarioAuth, ctx: RequestContext): Promise<IssuedSession> {
    const nuevo = this.nuevoRefreshToken(usuario.id, ctx);
    await this.repo.crearRefreshToken(nuevo.registro);
    return {
      user: this.toSessionUser(usuario),
      accessToken: this.accessToken(usuario),
      refreshToken: nuevo.token,
      refreshExpiraEn: nuevo.registro.expiraEn,
    };
  }

  private nuevoRefreshToken(usuarioId: number, ctx: RequestContext) {
    const token = generateOpaqueToken();
    return {
      token,
      registro: {
        usuarioId,
        tokenHash: hashToken(token),
        expiraEn: new Date(Date.now() + this.policy.refreshDias * 86_400_000),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    };
  }

  private accessToken(u: UsuarioAuth) {
    return signAccessToken({
      id: u.id,
      email: u.email,
      rol: u.rol,
      permisos: u.permisos,
      debeCambiarPassword: u.debeCambiarPassword,
    });
  }

  private toSessionUser(u: UsuarioAuth): SessionUser {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      permisos: u.permisos,
      debeCambiarPassword: u.debeCambiarPassword,
    };
  }
}
