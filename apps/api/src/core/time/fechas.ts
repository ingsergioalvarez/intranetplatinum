import { env } from '../../config/env';

/** Fecha de hoy `AAAA-MM-DD` en la zona del negocio (`APP_TIMEZONE`). */
export function hoyISO(timeZone = env.APP_TIMEZONE, ahora = new Date()): string {
  // en-CA formatea como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(ahora);
}

/** `AAAA-MM-DD` → Date para columnas `@db.Date` (medianoche UTC, sin corrimiento). */
export function fechaADate(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

/** Columna `@db.Date` → `AAAA-MM-DD`. */
export function dateAFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Diferencia (ms) entre la hora local de `timeZone` y UTC en el instante dado. */
function desfase(timeZone: string, instante: Date): number {
  const nombre = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(instante)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = nombre?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const minutos = Number(m[2]) * 60 + Number(m[3]);
  return (m[1] === '-' ? -1 : 1) * minutos * 60_000;
}

/** Instante en que empieza el día `AAAA-MM-DD` en la zona del negocio (para filtros por fecha). */
export function inicioDelDia(fecha: string, timeZone = env.APP_TIMEZONE): Date {
  const utc = fechaADate(fecha);
  return new Date(utc.getTime() - desfase(timeZone, utc));
}
