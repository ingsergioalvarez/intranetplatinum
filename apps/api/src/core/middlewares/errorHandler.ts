import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import type { ApiResponse } from '@platinum/shared';
import { isProduction } from '../../config/env';
import { HttpError } from '../errors/HttpError';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Ruta no encontrada: ${req.method} ${req.path}`));
};

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', details);
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo excede el tamaño permitido' : err.message;
    return new HttpError(400, 'UPLOAD_ERROR', message, { field: err.field });
  }

  // JSON mal formado en el body
  if (err instanceof SyntaxError && 'body' in err) {
    return HttpError.badRequest('JSON inválido');
  }

  return new HttpError(500, 'INTERNAL_ERROR', 'Error interno del servidor');
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const httpError = toHttpError(err);

  if (httpError.status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body: ApiResponse<never> = {
    ok: false,
    error: {
      code: httpError.code,
      message: httpError.message,
      details: httpError.details ?? (!isProduction && httpError.status >= 500 ? String(err) : undefined),
    },
  };
  res.status(httpError.status).json(body);
};
