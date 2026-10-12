export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message = 'Solicitud inválida', details?: unknown) {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'No autenticado') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'No tienes permiso para esta acción') {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Conflicto con el estado actual', details?: unknown) {
    return new HttpError(409, 'CONFLICT', message, details);
  }

  static tooMany(message = 'Demasiadas solicitudes, intenta más tarde') {
    return new HttpError(429, 'TOO_MANY_REQUESTS', message);
  }
}
