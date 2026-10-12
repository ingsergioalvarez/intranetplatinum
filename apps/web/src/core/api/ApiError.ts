import type { ApiError as ApiErrorBody } from '@platinum/shared';

/** Error tipado de la API. `code` coincide con los códigos del backend (VALIDATION_ERROR, FORBIDDEN, ...). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromBody(status: number, body?: ApiErrorBody) {
    return new ApiError(status, body?.code ?? 'UNKNOWN', body?.message ?? 'Error inesperado', body?.details);
  }

  static network() {
    return new ApiError(0, 'NETWORK_ERROR', 'Sin conexión con el servidor. Revisa tu internet.');
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isValidation() {
    return this.code === 'VALIDATION_ERROR';
  }

  /**
   * Errores por campo: `{ email: 'Correo inválido' }`. Vienen en validaciones (400)
   * y en conflictos con campo identificado (409, p. ej. correo duplicado).
   */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as { path?: string; message?: string }[])
        .filter((d) => d?.path && d.message)
        .map((d) => [d.path!, d.message!]),
    );
  }
}
