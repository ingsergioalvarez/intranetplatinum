const fechaHora = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** `12 oct 2026, 16:20` en hora local; `—` si no hay fecha. */
export function formatFechaHora(iso: string | null | undefined): string {
  return iso ? fechaHora.format(new Date(iso)) : '—';
}
