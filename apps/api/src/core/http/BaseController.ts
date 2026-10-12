import type { Request, Response } from 'express';
import type { ApiResponse, Paginated } from '@platinum/shared';
import { HttpError } from '../errors/HttpError';

/**
 * Base de controladores. Los handlers se declaran como propiedades flecha
 * para poder pasarlos directo al router sin perder `this`.
 * Express 5 propaga los errores de handlers async al errorHandler.
 */
export abstract class BaseController {
  protected ok<T>(res: Response, data: T, status = 200) {
    const body: ApiResponse<T> = { ok: true, data };
    return res.status(status).json(body);
  }

  protected created<T>(res: Response, data: T) {
    return this.ok(res, data, 201);
  }

  protected paginated<T>(res: Response, page: Paginated<T>) {
    return this.ok(res, page);
  }

  protected noContent(res: Response) {
    return res.status(204).end();
  }

  /** Datos ya validados por el middleware `validate`. */
  protected body<T>(req: Request): T {
    return (req.validated?.body ?? req.body) as T;
  }

  protected query<T>(req: Request): T {
    return (req.validated?.query ?? req.query) as T;
  }

  protected params<T>(req: Request): T {
    return (req.validated?.params ?? req.params) as T;
  }

  protected currentUser(req: Request) {
    if (!req.user) throw HttpError.unauthorized();
    return req.user;
  }
}
