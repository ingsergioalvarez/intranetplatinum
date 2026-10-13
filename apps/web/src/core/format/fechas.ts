const fechaHora = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const fechaCorta = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });

/** `12 oct 2026, 16:20` en hora local; `—` si no hay fecha. */
export function formatFechaHora(iso: string | null | undefined): string {
  return iso ? fechaHora.format(new Date(iso)) : '—';
}

/** Fecha sin hora `AAAA-MM-DD` → `12 oct 2026` (sin corrimiento por zona horaria). */
export function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const [a, m, d] = fecha.slice(0, 10).split('-').map(Number);
  return fechaCorta.format(new Date(a, m - 1, d));
}

/** Hoy `AAAA-MM-DD` en la hora local del dispositivo. */
export function hoyLocal(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date());
}
