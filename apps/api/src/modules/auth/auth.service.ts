import {
  PIN_MAX_INTENTOS,
  ROLES,
  type AuthSession,
  type CambiarPasswordInput,
  type DefinirPinInput,
  type DispositivoSesion,
  type DispositivoUsuarioVista,
  type LoginInput,
  type PerfilRapidoInput,
  type SessionUser,
} from '@platinum/shared';
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
import type { AuthRepository, DispositivoRow, UsuarioAuth } from './auth.repository';

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
const dispositivoInvalido = () =>
  new HttpError(401, 'DEVICE_INVALID', 'Este perfil ya no está disponible en este celular. Entra con tu contraseña.');

const vistaDispositivo = (d: DispositivoRow): DispositivoUsuarioVista => ({
  id: d.id,
  etiqueta: d.etiqueta,
  tienePin: d.pinHash !== null,
  bloqueado: d.bloqueadoEn !== null,
  ultimoUso: d.ultimoUso?.toISOString() ?? null,
  createdAt: d.createdAt.toISOString(),
});

/** Nombre corto del celular a partir del user agent ("Android · Chrome"). */
function etiquetaDeCelular(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  const sistema = /iphone|ipad/i.test(ua) ? 'iPhone' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'Mac' : 'Celular';
  const nav = /edg\//i.test(ua) ? 'Edge' : /firefox/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : '';
  return nav ? `${sistema} · ${nav}` : sistema;
}

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

  async login({ email, password, dispositivoToken }: LoginInput, ctx: RequestContext): Promise<IssuedSession> {
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
    // Guardias: el celular recuerda su perfil sin preguntar (A-40).
    if (usuario.rol === ROLES.GUARDIA) sesion.dispositivo = await this.vincularDispositivo(usuario, dispositivoToken, ctx);
    return sesion;
  }

  /**
   * Liga este celular al guardia: si ya traía una clave vigente suya la reutiliza (y entrar con contraseña
   * libera un bloqueo por PIN); si no, crea una nueva y devuelve la clave una sola vez.
   */
  private async vincularDispositivo(
    usuario: UsuarioAuth,
    token: string | undefined,
    ctx: RequestContext,
  ): Promise<DispositivoSesion> {
    const existente = token ? await this.repo.findDispositivoPorToken(hashToken(token)) : null;
    if (existente && existente.usuarioId === usuario.id && !existente.revocadoEn) {
      await this.repo.registrarUsoDispositivo(existente.id);
      return { id: existente.id, tienePin: existente.pinHash !== null };
    }
    const nuevo = generateOpaqueToken();
    const d = await this.repo.crearDispositivo({
      usuarioId: usuario.id,
      tokenHash: hashToken(nuevo),
      etiqueta: etiquetaDeCelular(ctx.userAgent),
    });
    await this.audit.registrar({ ...ctx, usuarioId: usuario.id, accion: 'auth.dispositivo_guardado', entidad: 'dispositivos_usuario', entidadId: d.id });
    return { id: d.id, token: nuevo, tienePin: false };
  }

  /** Entrar con la tarjeta del perfil guardado en este celular y su PIN (A-40). */
  async loginConPin({ token, pin }: PerfilRapidoInput, ctx: RequestContext): Promise<IssuedSession> {
    const d = await this.repo.findDispositivoPorToken(hashToken(token));
    if (!d || d.revocadoEn) throw dispositivoInvalido();
    const usuario = await this.repo.findUsuarioById(d.usuarioId);
    if (!usuario || !usuario.activo || usuario.deletedAt || usuario.rol !== ROLES.GUARDIA) {
      await this.repo.revocarDispositivo(d.id);
      throw dispositivoInvalido();
    }
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) throw this.cuentaBloqueada(usuario.bloqueadoHasta);
    if (!d.pinHash) {
      throw new HttpError(400, 'PIN_NOT_SET', 'Este perfil no tiene PIN. Entra con tu contraseña.');
    }
    if (d.bloqueadoEn) {
      throw new HttpError(423, 'PIN_BLOCKED', 'Demasiados PIN incorrectos. Entra con tu contraseña para volver a usarlo.');
    }
    if (!(await verifyPassword(pin, d.pinHash))) {
      const intentos = d.intentosFallidos + 1;
      const bloquear = intentos >= PIN_MAX_INTENTOS;
      await this.repo.registrarFalloPin(d.id, intentos, bloquear ? new Date() : null);
      await this.audit.registrar({
        ...ctx,
        usuarioId: usuario.id,
        accion: bloquear ? 'auth.pin_bloqueado' : 'auth.pin_fallido',
        datos: { intentos },
      });
      if (bloquear) {
        throw new HttpError(423, 'PIN_BLOCKED', 'Demasiados PIN incorrectos. Entra con tu contraseña para volver a usarlo.');
      }
      throw new HttpError(401, 'PIN_INVALID', `PIN incorrecto. Te quedan ${PIN_MAX_INTENTOS - intentos} intentos.`, {
        intentosRestantes: PIN_MAX_INTENTOS - intentos,
      });
    }
    await this.repo.registrarUsoDispositivo(d.id);
    await this.repo.registrarAccesoExitoso(usuario.id);
    const sesion = await this.emitirSesion(usuario, ctx);
    await this.audit.registrar({ ...ctx, usuarioId: usuario.id, accion: 'auth.login_pin' });
    return { ...sesion, dispositivo: { id: d.id, tienePin: true } };
  }

  // ---------- Dispositivos (A-40) ----------

  /** "Quitar de este dispositivo" desde la pantalla de entrada: quien tiene la clave del celular puede quitarla. Idempotente. */
  async quitarPerfilRapido(token: string, ctx: RequestContext): Promise<void> {
    const d = await this.repo.findDispositivoPorToken(hashToken(token));
    if (!d || d.revocadoEn) return;
    await this.repo.revocarDispositivo(d.id);
    await this.audit.registrar({ ...ctx, usuarioId: d.usuarioId, accion: 'auth.dispositivo_quitado', entidad: 'dispositivos_usuario', entidadId: d.id });
  }

  /** Celulares con perfil rápido de un guardia. */
  async dispositivosDe(usuarioId: number): Promise<DispositivoUsuarioVista[]> {
    return (await this.repo.dispositivosDe(usuarioId)).map(vistaDispositivo);
  }

  private async propio(usuarioId: number, id: number): Promise<DispositivoRow> {
    const d = await this.repo.findDispositivo(id);
    if (!d || d.revocadoEn || d.usuarioId !== usuarioId) throw HttpError.notFound('Celular no encontrado');
    return d;
  }

  /** El guardia crea o cambia el PIN de este celular; pide su contraseña. */
  async definirPin(usuarioId: number, id: number, { pin, password }: DefinirPinInput, ctx: RequestContext) {
    const d = await this.propio(usuarioId, id);
    const usuario = await this.repo.findUsuarioById(usuarioId);
    if (!usuario || !(await verifyPassword(password, usuario.passwordHash))) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [{ path: 'password', message: 'La contraseña no es correcta' }]);
    }
    await this.repo.guardarPin(d.id, await hashPassword(pin));
    await this.audit.registrar({ ...ctx, usuarioId, accion: d.pinHash ? 'auth.pin_cambiado' : 'auth.pin_creado', entidad: 'dispositivos_usuario', entidadId: d.id });
  }

  async quitarPin(usuarioId: number, id: number, ctx: RequestContext) {
    const d = await this.propio(usuarioId, id);
    await this.repo.guardarPin(d.id, null);
    await this.audit.registrar({ ...ctx, usuarioId, accion: 'auth.pin_quitado', entidad: 'dispositivos_usuario', entidadId: d.id });
  }

  /** El guardia quita este celular de sus perfiles rápidos. */
  async quitarMiDispositivo(usuarioId: number, id: number, ctx: RequestContext) {
    const d = await this.propio(usuarioId, id);
    await this.repo.revocarDispositivo(d.id);
    await this.audit.registrar({ ...ctx, usuarioId, accion: 'auth.dispositivo_quitado', entidad: 'dispositivos_usuario', entidadId: d.id });
  }

  /** Admin: quita un celular de un guardia (p. ej. si lo perdió). */
  async quitarDispositivoDe(actorId: number, usuarioId: number, id: number, ctx: RequestContext) {
    const d = await this.propio(usuarioId, id);
    await this.repo.revocarDispositivo(d.id);
    await this.audit.registrar({ ...ctx, usuarioId: actorId, accion: 'auth.dispositivo_quitado_admin', entidad: 'dispositivos_usuario', entidadId: d.id, datos: { guardiaId: usuarioId } });
  }

  async quitarTodosDe(actorId: number, usuarioId: number, ctx: RequestContext): Promise<number> {
    const quitados = await this.repo.revocarDispositivosDeUsuario(usuarioId);
    await this.audit.registrar({ ...ctx, usuarioId: actorId, accion: 'auth.dispositivos_quitados_admin', entidad: 'usuarios', entidadId: usuarioId, datos: { quitados } });
    return quitados;
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
   * Con contraseña temporal no se exige la contraseña actual (ya la comprobó en el login).
   * En cambio voluntario sí es obligatoria. Cierra todas las sesiones del usuario y emite una nueva.
   */
  async cambiarPassword(
    usuarioId: number,
    { actual, nueva }: CambiarPasswordInput,
    ctx: RequestContext,
  ): Promise<IssuedSession> {
    const usuario = await this.repo.findUsuarioById(usuarioId);
    if (!usuario || !usuario.activo || usuario.deletedAt) throw HttpError.unauthorized();

    const tieneActual = Boolean(actual && actual.trim());
    if (usuario.debeCambiarPassword) {
      if (tieneActual && !(await verifyPassword(actual!, usuario.passwordHash))) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [
          { path: 'actual', message: 'La contraseña actual no es correcta' },
        ]);
      }
      if (await verifyPassword(nueva, usuario.passwordHash)) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [
          { path: 'nueva', message: 'La nueva contraseña debe ser distinta a la actual' },
        ]);
      }
    } else {
      if (!tieneActual) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [
          { path: 'actual', message: 'Escribe tu contraseña actual' },
        ]);
      }
      if (!(await verifyPassword(actual!, usuario.passwordHash))) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [
          { path: 'actual', message: 'La contraseña actual no es correcta' },
        ]);
      }
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
      clienteId: u.clienteId ?? null,
      clienteNombre: u.clienteNombre ?? null,
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
      clienteId: u.clienteId ?? null,
      clienteNombre: u.clienteNombre ?? null,
    };
  }
}
