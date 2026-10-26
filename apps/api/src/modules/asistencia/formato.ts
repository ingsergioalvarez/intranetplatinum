import { horaLegible } from '@platinum/shared';
import { env } from '../../config/env';

/** `1:05 p.m.` de un instante, en la zona del negocio. */
export function horaLocal(fecha: Date | string) {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: env.APP_TIMEZONE,
  }).format(new Date(fecha));
  return horaLegible(hhmm);
}
