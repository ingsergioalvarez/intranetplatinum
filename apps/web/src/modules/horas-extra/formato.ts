import { duracionExtra, type HoraExtra } from '@platinum/shared';
import { formatHora } from '../asistencia/formato';

/** Rango de la hora extra: `8:00 p.m. → 10:30 p.m. · 2 h 30 min`. */
export function rangoHoraExtra(h: Pick<HoraExtra, 'desde' | 'hasta' | 'minutos'>) {
  if (!h.hasta) return `desde ${formatHora(h.desde)} · sin salida aún`;
  const dur = h.minutos !== null ? ` · ${duracionExtra(h.minutos)}` : '';
  return `${formatHora(h.desde)} → ${formatHora(h.hasta)}${dur}`;
}
