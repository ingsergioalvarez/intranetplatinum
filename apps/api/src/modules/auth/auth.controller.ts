import type { CookieOptions, Request, Response } from 'express';
import type {
  AuthSession,
  CambiarPasswordInput,
  DefinirPinInput,
  IdParam,
  LoginInput,
  PerfilRapidoInput,
} from '@platinum/shared';
import { isProduction } from '../../config/env';
import { BaseController, requestContext } from '../../core';
import type { AuthService, IssuedSession } from './auth.service';

/** Cookie httpOnly del refresh token; solo viaja a las rutas de auth. */
export const REFRESH_COOKIE = 'platinum_rt';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/api/auth',
};

interface UsuarioDispositivoParam {
  usuarioId: number;
}

export class AuthController extends BaseController {
  constructor(private readonly service: AuthService) {
    super();
  }

  login = async (req: Request, res: Response) => {
    const sesion = await this.service.login(this.body<LoginInput>(req), requestContext(req));
    return this.ok(res, this.enviarSesion(res, sesion));
  };

  quitarPerfilRapido = async (req: Request, res: Response) => {
    await this.service.quitarPerfilRapido(this.body<{ token: string }>(req).token, requestContext(req));
    return this.noContent(res);
  };

  perfilRapido = async (req: Request, res: Response) => {
    const sesion = await this.service.loginConPin(this.body<PerfilRapidoInput>(req), requestContext(req));
    return this.ok(res, this.enviarSesion(res, sesion));
  };

  /** El guardia: sus celulares, PIN y quitar. */
  misDispositivos = async (req: Request, res: Response) =>
    this.ok(res, await this.service.dispositivosDe(this.currentUser(req).id));

  definirPin = async (req: Request, res: Response) => {
    await this.service.definirPin(this.currentUser(req).id, this.params<IdParam>(req).id, this.body<DefinirPinInput>(req), requestContext(req));
    return this.noContent(res);
  };

  quitarPin = async (req: Request, res: Response) => {
    await this.service.quitarPin(this.currentUser(req).id, this.params<IdParam>(req).id, requestContext(req));
    return this.noContent(res);
  };

  quitarMiDispositivo = async (req: Request, res: Response) => {
    await this.service.quitarMiDispositivo(this.currentUser(req).id, this.params<IdParam>(req).id, requestContext(req));
    return this.noContent(res);
  };

  /** Admin: celulares de un guardia. */
  dispositivosDe = async (req: Request, res: Response) =>
    this.ok(res, await this.service.dispositivosDe(this.params<UsuarioDispositivoParam>(req).usuarioId));

  quitarDispositivoDe = async (req: Request, res: Response) => {
    const { usuarioId, id } = this.params<UsuarioDispositivoParam & IdParam>(req);
    await this.service.quitarDispositivoDe(this.currentUser(req).id, usuarioId, id, requestContext(req));
    return this.noContent(res);
  };

  quitarTodosDe = async (req: Request, res: Response) => {
    const quitados = await this.service.quitarTodosDe(this.currentUser(req).id, this.params<UsuarioDispositivoParam>(req).usuarioId, requestContext(req));
    return this.ok(res, { quitados });
  };

  refresh = async (req: Request, res: Response) => {
    try {
      const sesion = await this.service.refresh(this.refreshToken(req), requestContext(req));
      return this.ok(res, this.enviarSesion(res, sesion));
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      throw err;
    }
  };

  cambiarPassword = async (req: Request, res: Response) => {
    const sesion = await this.service.cambiarPassword(
      this.currentUser(req).id,
      this.body<CambiarPasswordInput>(req),
      requestContext(req),
    );
    return this.ok(res, this.enviarSesion(res, sesion));
  };

  logout = async (req: Request, res: Response) => {
    await this.service.logout(this.refreshToken(req), requestContext(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    return this.noContent(res);
  };

  private refreshToken(req: Request): string | undefined {
    return req.cookies?.[REFRESH_COOKIE];
  }

  private enviarSesion(
    res: Response,
    { refreshToken, refreshExpiraEn, ...sesion }: IssuedSession,
  ): AuthSession {
    res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, expires: refreshExpiraEn });
    return sesion;
  }
}
