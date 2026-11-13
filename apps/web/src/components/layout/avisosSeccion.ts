import type { Aviso } from '@platinum/shared';

/**
 * A qué botón del menú pertenece un aviso (A-57): los de un reporte, a "Reportes"; el resto, al botón cuya
 * ruta es el comienzo de la ruta del aviso (p. ej. `/asistencia/guardias/4?...` → Asistencia). Los avisos
 * sin pantalla propia solo cuentan en la campanita.
 */
export function seccionDeAviso(a: Pick<Aviso, 'reporteId' | 'tipo' | 'ruta'>, rutas: string[]): string | null {
  if ((a.reporteId != null || a.tipo.startsWith('reporte_')) && rutas.includes('/reportes')) return '/reportes';
  const base = (a.ruta ?? '').split('?')[0];
  let mejor: string | null = null;
  for (const to of rutas) {
    if (to === '/' || !(base === to || base.startsWith(`${to}/`))) continue;
    if (!mejor || to.length > mejor.length) mejor = to;
  }
  return mejor;
}

/**
 * Los avisos sin leer que explican la burbuja de la sección en la que está quien mira (A-85): solo en la pantalla
 * principal de la sección (la ruta es exactamente la del botón), los más nuevos primero. Es lo mismo que cuenta la
 * burbuja, así que los números coinciden.
 */
export function avisosDeLaSeccion(items: Aviso[], rutas: string[], pathname: string): Aviso[] {
  if (!rutas.includes(pathname)) return [];
  return items
    .filter((a) => !a.leido && seccionDeAviso(a, rutas) === pathname)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

/** A dónde lleva "Ver": el reporte, o la pantalla del aviso. Sin destino propio, no hay "Ver". */
export function destinoDeAviso(a: Pick<Aviso, 'reporteId' | 'ruta'>): string | null {
  if (a.reporteId != null) return `/reportes/${a.reporteId}`;
  return a.ruta || null;
}

/** ¿Vale la pena ofrecer "Ver"? Solo si el destino es otra pantalla distinta de donde ya está quien mira. */
export function ofreceVer(a: Pick<Aviso, 'reporteId' | 'ruta'>, pathname: string): boolean {
  const destino = destinoDeAviso(a);
  return destino !== null && destino.split('?')[0] !== pathname;
}
