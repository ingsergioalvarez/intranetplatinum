import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Valida body/query/params con zod y deja el resultado tipado en `req.validated`.
 * (En Express 5 `req.query` es de solo lectura, por eso no se sobrescribe.)
 * Los errores llegan al errorHandler como VALIDATION_ERROR (400).
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    req.validated = {
      body: schemas.body ? schemas.body.parse(req.body) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
    };
    next();
  };
}
