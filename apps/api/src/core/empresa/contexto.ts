import { AsyncLocalStorage } from 'node:async_hooks';
import { HttpError } from '../errors/HttpError';

/**
 * Empresa de la operación en curso (C-08, DC-014). Viaja con la petición (y con todo lo asíncrono que lance)
 * sin pasarla de función en función. La fija `authenticate` a partir del token; la tarea de cada minuto la fija
 * empresa por empresa; las operaciones de plataforma y de acceso piden `sinFiltroDeEmpresa`.
 */
interface Contexto {
  empresaId: number | null;
  /** Operación fuera de cualquier empresa (plataforma, inicio de sesión): sin filtro. */
  global: boolean;
}

const almacen = new AsyncLocalStorage<Contexto>();

const esPromesaPerezosa = (r: unknown): r is PromiseLike<unknown> =>
  typeof (r as { then?: unknown } | null | undefined)?.then === 'function';

/**
 * Corre `fn` dentro del contexto. Las consultas de Prisma son "perezosas": no se ejecutan hasta que alguien las espera.
 * Si `fn` devolviera una tal cual (`conEmpresa(1, () => prisma.x.findMany())`), se ejecutaría FUERA del contexto y con
 * la empresa equivocada. Por eso, si devuelve algo "esperable", se arranca aquí dentro.
 */
function dentro<T>(contexto: Contexto, fn: () => T): T {
  return almacen.run(contexto, () => {
    const r = fn();
    return (esPromesaPerezosa(r) ? Promise.resolve(r) : r) as T;
  });
}

/** Ejecuta `fn` como parte de la empresa indicada. */
export const conEmpresa = <T>(empresaId: number, fn: () => T): T => dentro({ empresaId, global: false }, fn);

/** Ejecuta `fn` sin empresa y sin filtro: solo para plataforma (super admin) y acceso (login, refresco). */
export const sinFiltroDeEmpresa = <T>(fn: () => T): T => dentro({ empresaId: null, global: true }, fn);

/**
 * Corre `trabajo` una vez por empresa, cada una en su propio contexto (para tareas sin petición, como la que corre cada
 * minuto). Si una empresa falla, las demás siguen; se devuelven los errores para registrarlos.
 */
export async function paraCadaEmpresa(
  ids: readonly number[],
  trabajo: (empresaId: number) => Promise<void>,
): Promise<{ empresaId: number; error: unknown }[]> {
  const errores: { empresaId: number; error: unknown }[] = [];
  for (const empresaId of ids) {
    try {
      await conEmpresa(empresaId, () => trabajo(empresaId));
    } catch (error) {
      errores.push({ empresaId, error });
    }
  }
  return errores;
}

/** Empresa del contexto, o null si no hay. */
export const empresaOpcional = (): number | null => almacen.getStore()?.empresaId ?? null;

/** ¿La operación se declaró fuera de cualquier empresa? */
export const esContextoGlobal = (): boolean => almacen.getStore()?.global === true;

/**
 * Empresa de la operación. Si no hay (un token anterior a las empresas, o código que olvidó fijarla) se niega:
 * nunca se asume una empresa, para no mostrar ni guardar datos en la equivocada.
 */
export function empresaActual(): number {
  const id = empresaOpcional();
  if (id === null) throw new HttpError(401, 'SIN_EMPRESA', 'Vuelve a iniciar sesión');
  return id;
}
