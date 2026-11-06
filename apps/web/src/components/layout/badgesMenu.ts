import { useQuery } from '@tanstack/react-query';
import type { Aviso, BandejaAvisos } from '@platinum/shared';
import { api } from '../../core/api';

/**
 * A qué botón del menú pertenece un aviso (A-57): al botón cuya
 * ruta es el comienzo de la ruta del aviso (p. ej. `/asistencia/guardias/4?...` → Asistencia). Los avisos
 * sin pantalla propia solo cuentan en la campanita.
 */
export function seccionDeAviso(a: Pick<Aviso, 'ruta'>, rutas: string[]): string | null {
  const base = (a.ruta ?? '').split('?')[0];
  let mejor: string | null = null;
  for (const to of rutas) {
    if (to === '/' || !(base === to || base.startsWith(`${to}/`))) continue;
    if (!mejor || to.length > mejor.length) mejor = to;
  }
  return mejor;
}

/**
 * Avisos sin leer por botón del menú (A-57), para la burbuja roja con número. Usa la misma consulta de la
 * campanita (cada minuto y al volver a la pestaña), así que los números coinciden y bajan cuando algo se
 * atiende (A-54).
 */
export function useBadgesMenu(rutas: string[]): Map<string, number> {
  const bandeja = useQuery({
    queryKey: ['avisos'],
    queryFn: () => api.get<BandejaAvisos>('/avisos'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const mapa = new Map<string, number>();
  for (const a of bandeja.data?.items ?? []) {
    if (a.leido) continue;
    const seccion = seccionDeAviso(a, rutas);
    if (seccion) mapa.set(seccion, (mapa.get(seccion) ?? 0) + 1);
  }
  return mapa;
}
