import { useQuery } from '@tanstack/react-query';
import type { BandejaAvisos } from '@platinum/shared';
import { api } from '../../core/api';
import { seccionDeAviso } from './avisosSeccion';

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
