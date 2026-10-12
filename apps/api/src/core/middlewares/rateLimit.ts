import { rateLimit as expressRateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { HttpError } from '../errors/HttpError';

interface RateLimitOptions {
  /** Ventana en minutos. */
  windowMin: number;
  /** Peticiones permitidas por IP dentro de la ventana. */
  max: number;
  message?: string;
}

/** Límite de peticiones por IP (en memoria). Responde 429 con el formato estándar de error. */
export function rateLimit({ windowMin, max, message }: RateLimitOptions): RequestHandler {
  return expressRateLimit({
    windowMs: windowMin * 60_000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(HttpError.tooMany(message)),
  });
}
