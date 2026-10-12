import type { CookieOptions, Request, Response } from 'express';
import type { AuthSession, CambiarPasswordInput, LoginInput } from '@platinum/shared';
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

export class AuthController extends BaseController {
  constructor(private readonly service: AuthService) {
    super();
  }

  login = async (req: Request, res: Response) => {
    const sesion = await this.service.login(this.body<LoginInput>(req), requestContext(req));
    return this.ok(res, this.enviarSesion(res, sesion));
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
