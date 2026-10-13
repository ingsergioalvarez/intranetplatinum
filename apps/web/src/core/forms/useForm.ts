import { useState, type ChangeEvent } from 'react';
import { ApiError } from '../api';
import { erroresDeCampos } from './fieldErrors';

interface SchemaLike<TOut> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: TOut }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Estado de un formulario: valores, errores por campo y si cambió respecto al inicial.
 * `bind('campo')` conecta Input/Select/Textarea; `bindCheck('campo')` conecta un Checkbox.
 */
export function useForm<T extends Record<string, unknown>>(inicial: T) {
  const [values, setValues] = useState<T>(inicial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const set = <K extends keyof T>(campo: K, valor: T[K]) => {
    setValues((v) => ({ ...v, [campo]: valor }));
    setErrors((e) => ({ ...e, [campo]: undefined }));
  };

  const bind = <K extends keyof T>(campo: K) => ({
    value: (values[campo] ?? '') as string,
    onChange: (e: ChangeEvent<Campo>) => set(campo, e.target.value as T[K]),
  });

  const bindCheck = <K extends keyof T>(campo: K) => ({
    checked: Boolean(values[campo]),
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(campo, e.target.checked as T[K]),
  });

  /** Valida con el esquema; si falla, marca los errores y devuelve null. */
  const validar = <TOut>(schema: SchemaLike<TOut>, datos: unknown = values): TOut | null => {
    const r = schema.safeParse(datos);
    if (r.success) return r.data;
    setErrors(erroresDeCampos(r.error) as Partial<Record<keyof T, string>>);
    return null;
  };

  /** Aplica los errores por campo de una respuesta de la API. Devuelve true si había alguno. */
  const aplicarErrorApi = (error: unknown) => {
    const campos = error instanceof ApiError ? error.fieldErrors : {};
    if (Object.keys(campos).length === 0) return false;
    setErrors(campos as Partial<Record<keyof T, string>>);
    return true;
  };

  const cambiado = (Object.keys(inicial) as (keyof T)[]).some((k) => values[k] !== inicial[k]);

  return { values, errors, set, bind, bindCheck, validar, aplicarErrorApi, setErrors, cambiado };
}
