interface IssueLike {
  path: PropertyKey[];
  message: string;
}

/** Convierte errores de validación (zod) en `{ campo: mensaje }`, el primero por campo. */
export function erroresDeCampos<T extends string>(error: {
  issues: IssueLike[];
}): Partial<Record<T, string>> {
  const out: Partial<Record<T, string>> = {};
  for (const issue of error.issues) {
    const campo = String(issue.path[0]) as T;
    out[campo] ??= issue.message;
  }
  return out;
}
