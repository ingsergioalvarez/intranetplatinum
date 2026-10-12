/**
 * Base de todos los servicios de negocio. Punto común para logging
 * y, a partir de F1-10, registro en auditoría.
 */
export abstract class BaseService {
  protected readonly name: string;

  constructor() {
    this.name = new.target.name;
  }

  protected log(message: string, extra?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'test') return;
    console.log(`[${this.name}] ${message}`, extra ?? '');
  }
}
