import { JORNADA_MAX_HORAS, type Jornada } from '@platinum/shared';

const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
const dia = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const diaLargo = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const mes = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });

/** `06:53` */
export const formatHora = (iso: string | Date) => hora.format(new Date(iso));

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `Lun, 20 oct` */
export const formatDia = (iso: string) => mayuscula(dia.format(new Date(iso)));

/** `Lunes, 20 de octubre` */
export const formatDiaLargo = (d: Date) => mayuscula(diaLargo.format(d));

/** `2026-10` → `Octubre de 2026` */
export function formatMes(m: string) {
  const [a, n] = m.split('-').map(Number);
  return mayuscula(mes.format(new Date(a, n - 1, 1)));
}

/** Mes `AAAA-MM` desplazado `delta` meses. */
export function moverMes(m: string, delta: number) {
  const [a, n] = m.split('-').map(Number);
  const d = new Date(a, n - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Tiempo entre dos marcas: `8 h 09 min`. */
export function formatDuracion(desde: string, hasta: string) {
  const min = Math.max(0, Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 60_000));
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** Sin salida: la jornada sigue en curso mientras no pase el límite de horas. */
export function jornadaEnCurso(j: Jornada) {
  return !j.salida && Date.now() - new Date(j.entrada.registradaEn).getTime() < JORNADA_MAX_HORAS * 3_600_000;
}
