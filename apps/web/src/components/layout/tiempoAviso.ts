const diaLocal = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Hoy / Ayer / Anteriores, para agrupar avisos. */
export function grupoDe(iso: string, ahora: Date) {
  const d = new Date(iso);
  if (diaLocal(d) === diaLocal(ahora)) return 'Hoy';
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  return diaLocal(d) === diaLocal(ayer) ? 'Ayer' : 'Anteriores';
}

/** "hace 5 min", "hace 2 h"; de ayer o antes, la hora o la fecha. */
export function horaRelativa(iso: string, ahora: Date) {
  const d = new Date(iso);
  const min = Math.floor((ahora.getTime() - d.getTime()) / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (diaLocal(d) === diaLocal(ahora)) return `hace ${Math.floor(min / 60)} h`;
  if (grupoDe(iso, ahora) === 'Ayer') {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
