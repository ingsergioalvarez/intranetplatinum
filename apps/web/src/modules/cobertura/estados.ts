import { ArrowLeftRight, Check, CircleHelp, Minus, Timer, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { BadgeTone } from '../../components/ui';
import type { EstadoCobertura } from '@platinum/shared';

interface EstiloEstado {
  icono: LucideIcon;
  /** Color del ícono y del texto. */
  texto: string;
  /** Fondo de la celda. */
  fondo: string;
  tono: BadgeTone;
}

export const ESTILO_ESTADO: Record<EstadoCobertura, EstiloEstado> = {
  cubierto: { icono: Check, texto: 'text-emerald-700', fondo: 'bg-emerald-50', tono: 'success' },
  cobertura: { icono: ArrowLeftRight, texto: 'text-brand-700', fondo: 'bg-brand-50', tono: 'brand' },
  extra: { icono: Timer, texto: 'text-amber-700', fondo: 'bg-amber-50', tono: 'warning' },
  sin_cubrir: { icono: TriangleAlert, texto: 'text-red-700', fondo: 'bg-red-50', tono: 'danger' },
  sin_registro: { icono: CircleHelp, texto: 'text-slate-500', fondo: 'bg-slate-100', tono: 'neutral' },
  sin_turno: { icono: Minus, texto: 'text-slate-300', fondo: 'bg-white', tono: 'neutral' },
};

/** Del más grave al menos: para pintar un día con varios turnos con un solo color. */
const GRAVEDAD: EstadoCobertura[] = ['sin_cubrir', 'sin_registro', 'extra', 'cobertura', 'cubierto', 'sin_turno'];

export const peorEstado = (estados: EstadoCobertura[]): EstadoCobertura =>
  GRAVEDAD.find((e) => estados.includes(e)) ?? 'sin_turno';

// ---------- Fechas del calendario ----------

/** `AAAA-MM` desplazado `n` meses. */
export function sumarMes(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `Octubre de 2026` */
export function nombreMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return mayuscula(new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(a, m - 1, 1)),
  ));
}

export const primerDia = (mes: string) => `${mes}-01`;

export function ultimoDia(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** Semanas del mes (lunes a domingo); los días de otros meses van como null. */
export function semanasDelMes(mes: string): (string | null)[][] {
  const [a, m] = mes.split('-').map(Number);
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  // 0 = lunes … 6 = domingo
  const desfase = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7;
  const celdas: (string | null)[] = [
    ...Array<null>(desfase).fill(null),
    ...Array.from({ length: dias }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (celdas.length % 7) celdas.push(null);
  return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
}

/** `Miércoles 28 de octubre` */
export function diaLargo(fecha: string) {
  return mayuscula(new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${fecha}T12:00:00Z`),
  ));
}

/** `L`, `M`, `M`, `J`, `V`, `S`, `D` */
export const letraDiaSemana = (fecha: string) =>
  ['D', 'L', 'M', 'M', 'J', 'V', 'S'][new Date(`${fecha}T12:00:00Z`).getUTCDay()];

export const numeroDia = (fecha: string) => Number(fecha.slice(8, 10));

/** Primer nombre de un guardia (para celdas angostas). */
export const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre;

/** `AAAA-MM-DD` desplazado `n` días. */
export function sumarDiasISO(fecha: string, n: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Días que abarca la vista "Todos los sitios" y el contador del botón Calendario. */
export const DIAS_RESUMEN = 14;

export const rangoProximos = (hoy: string) => ({ desde: hoy, hasta: sumarDiasISO(hoy, DIAS_RESUMEN - 1) });
