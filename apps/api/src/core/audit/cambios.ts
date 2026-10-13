/**
 * Campos de `data` que realmente cambian respecto a `actual` (ignora undefined).
 * Devuelve también los valores previos, para auditar `{ antes, despues }`.
 */
export function calcularCambios<T extends object>(actual: T, data: Partial<T>) {
  const despues = Object.fromEntries(
    Object.entries(data).filter(([k, v]) => v !== undefined && v !== actual[k as keyof T]),
  ) as Partial<T>;
  const antes = Object.fromEntries(Object.keys(despues).map((k) => [k, actual[k as keyof T]])) as Partial<T>;
  return { despues, antes, hayCambios: Object.keys(despues).length > 0 };
}
