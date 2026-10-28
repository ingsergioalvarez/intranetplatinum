/** `mié 28 oct, 8:00 a.m.` de un instante, en la hora local. */
const completo = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export const cuando = (iso: string | null | undefined) => (iso ? completo.format(new Date(iso)).replace(/\./g, '') : '—');

/** `AAAA-MM-DD` local de un instante. */
export const fechaLocal = (iso: string) => new Intl.DateTimeFormat('en-CA').format(new Date(iso));

/** `HH:MM` local de un instante. */
export const hora24 = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

/** `1 h 05 min` / `25 min` */
export const duracionTexto = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

/** Valor de un `<input type="datetime-local">` (`AAAA-MM-DDTHH:MM`, hora local) de un instante. */
export const aInputLocal = (iso: string) => `${fechaLocal(iso)}T${hora24(iso)}`;
