import { z } from 'zod';
import { horaSchema, type Asignacion, type TipoAsignacion, type Turno } from './clientes';
import { fechaSchema } from './comunes';

// ---------- Catálogo de turnos y cobertura del sitio (DA-37) ----------

/**
 * Qué días trabaja un turno a partir de su primer día:
 * - diario: todos los días.
 * - ciclo: trabaja N días y descansa M (1 y 1 = un día sí, uno no; 1 y 2 = 24x48…).
 * - semanal: ciertos días de la semana (0 = domingo … 6 = sábado).
 */
export type DiasTurno =
  | { tipo: 'diario' }
  | { tipo: 'ciclo'; trabaja: number; descansa: number }
  | { tipo: 'semanal'; semana: number[] };

export const diasTurnoSchema = z.discriminatedUnion(
  'tipo',
  [
    z.object({ tipo: z.literal('diario') }),
    z.object({
      tipo: z.literal('ciclo'),
      trabaja: z.coerce.number().int().min(1, 'Mínimo 1 día').max(30, 'Máximo 30 días'),
      descansa: z.coerce.number().int().min(1, 'Mínimo 1 día').max(30, 'Máximo 30 días'),
    }),
    z.object({
      tipo: z.literal('semanal'),
      semana: z
        .array(z.number().int().min(0).max(6))
        .min(1, 'Elige al menos un día')
        .transform((d) => [...new Set(d)].sort()),
    }),
  ],
  'Elige qué días trabaja',
);

/**
 * Borrar un turno que está asignado: por cada sitio activo que lo usa hay que elegir el turno nuevo que
 * lo reemplaza (los guardias pasan a ese turno y se les avisa). Sin asignaciones se borra directo.
 */
export const eliminarTurnoSchema = z
  .object({
    reemplazos: z
      .array(z.object({ sitioId: z.coerce.number().int().positive(), turnoId: z.coerce.number().int().positive() }))
      .max(300)
      .default([]),
  })
  .default({ reemplazos: [] });
export type EliminarTurnoInput = z.input<typeof eliminarTurnoSchema>;
export type EliminarTurnoData = z.output<typeof eliminarTurnoSchema>;

/** Un sitio que usa un turno (para decir a dónde está asignado antes de borrarlo). */
export interface UsoTurnoSitio {
  sitio: { id: number; nombre: string };
  /** Sitio y cliente activos: si lo está, hay que elegir un turno que lo reemplace. */
  activo: boolean;
  /** Es de quien consulta (siempre en el admin); un supervisor no cambia sitios de otro. */
  propio: boolean;
  /** Guardias o grupos asignados con este turno. */
  asignados: string[];
}

export interface UsoTurno {
  turno: { id: number; nombre: string };
  sitios: UsoTurnoSitio[];
  puedeBorrar: boolean;
  /** Por qué no puede borrarlo quien consulta. */
  motivo: string | null;
}

/** Horas que se ofrecen como atajo (el supervisor puede poner otras). */
export const HORAS_SUGERIDAS = [24, 12, 8] as const;

const SEMANA_CORTA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** "Todos los días", "Un día sí, uno no", "Trabaja 1 día, descansa 2", "Lun a Sáb", "Lun, Mié, Vie". */
export function textoDias(d: DiasTurno): string {
  if (d.tipo === 'diario') return 'Todos los días';
  if (d.tipo === 'ciclo') {
    if (d.trabaja === 1 && d.descansa === 1) return 'Un día sí, uno no';
    const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;
    return `Trabaja ${dias(d.trabaja)}, descansa ${dias(d.descansa)}`;
  }
  const s = [...d.semana].sort();
  if (s.length === 7) return 'Todos los días';
  // Rango seguido de lunes en adelante (p. ej. Lun a Sáb).
  const lunesPrimero = s.map((x) => (x + 6) % 7).sort((a, b) => a - b);
  const seguidos = lunesPrimero.every((x, i) => i === 0 || x === lunesPrimero[i - 1] + 1);
  if (seguidos && s.length > 2) {
    return `${SEMANA_CORTA[(lunesPrimero[0] + 1) % 7]} a ${SEMANA_CORTA[(lunesPrimero.at(-1)! + 1) % 7]}`;
  }
  return lunesPrimero.map((x) => SEMANA_CORTA[(x + 1) % 7]).join(', ');
}

/** Hora de salida: entrada + horas (`HH:MM`). */
export function horaSalida(horas: number, entrada: string): string {
  const [h, m] = entrada.split(':').map(Number);
  return `${String((h + horas) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const turnoSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del turno').max(80, 'Máximo 80 caracteres'),
  horas: z.coerce
    .number('Escribe las horas')
    .int('Solo horas enteras')
    .min(1, 'Mínimo 1 hora')
    .max(24, 'Máximo 24 horas'),
  horaEntrada: horaSchema,
  dias: diasTurnoSchema,
});
export type TurnoInput = z.input<typeof turnoSchema>;
export type TurnoData = z.output<typeof turnoSchema>;

/** Turno del catálogo. */
export interface TurnoCatalogo {
  id: number;
  nombre: string;
  horas: number;
  horaEntrada: string;
  horaSalida: string;
  dias: DiasTurno;
  activo: boolean;
  /** Asignaciones vigentes o programadas que lo usan. */
  enUso: number;
}

/**
 * Asignar un turno del catálogo en un sitio a varios guardias y/o grupos a la vez. Cada uno con su
 * primer día de turno. `hasta` opcional: sin él, el turno no tiene fin. `reemplazar`: guardias que
 * ya tienen otro horario en este sitio y pasan a este (su asignación anterior termina un día antes).
 */
export const asignarTurnoSchema = z
  .object({
    turnoId: z.coerce.number().int().positive('Elige un turno'),
    hasta: fechaSchema.nullish(),
    guardias: z
      .array(z.object({ usuarioId: z.coerce.number().int().positive(), desde: fechaSchema }))
      .max(100)
      .default([]),
    grupos: z
      .array(z.object({ grupoId: z.coerce.number().int().positive(), desde: fechaSchema }))
      .max(50)
      .default([]),
    reemplazar: z.array(z.coerce.number().int().positive()).max(300).default([]),
  })
  .superRefine((a, ctx) => {
    if (a.guardias.length + a.grupos.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['guardias'], message: 'Elige al menos un guardia o un grupo' });
    }
    if (a.hasta && [...a.guardias, ...a.grupos].some((x) => x.desde > a.hasta!)) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'Debe ser igual o posterior al primer día' });
    }
  });
export type AsignarTurnoInput = z.input<typeof asignarTurnoSchema>;
export type AsignarTurnoData = z.output<typeof asignarTurnoSchema>;

/** Asignación de un guardia con lo necesario para revisar cruces. */
export type AsignacionDeGuardia = PatronTurno & {
  asignacionId: number;
  sitio: { id: number; nombre: string };
  /** Grupo por el que la tiene; null si es directa. */
  grupo: string | null;
  turnoId: number | null;
  turnoNombre: string | null;
};

/** Guardia para elegir al asignar (con su foto y lo que ya tiene asignado). */
export interface GuardiaDisponible {
  id: number;
  nombre: string;
  email: string;
  /** Foto de referencia de su rostro (URL firmada), si tiene. */
  foto: string | null;
  /** Asignaciones vigentes o programadas, directas o por sus grupos. */
  asignaciones: AsignacionDeGuardia[];
}

// ---------- Calendario de turnos (compartido por la vista y el servidor) ----------

/** Lo necesario para saber qué días y a qué horas trabaja una asignación. */
export interface PatronTurno {
  tipo: TipoAsignacion;
  /** Solo en asignaciones anteriores al catálogo (24x24 / 12x12). */
  turno?: Turno | null;
  horas: number | null;
  dias: DiasTurno | null;
  horaInicio: string | null;
  horaFin: string | null;
  desde: string;
  hasta: string | null;
}

export const patronDe = (a: Asignacion): PatronTurno => ({
  tipo: a.tipo,
  turno: a.turno,
  horas: a.horas,
  dias: a.dias,
  horaInicio: a.horaInicio,
  horaFin: a.horaFin,
  desde: a.desde,
  hasta: a.hasta,
});

const numeroDia = (fecha: string) => Math.round(Date.parse(`${fecha}T00:00:00Z`) / 86_400_000);
const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** `AAAA-MM-DD` desplazado `n` días. */
export function sumarDiasFecha(fecha: string, n: number) {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Días de trabajo del patrón (las asignaciones anteriores al catálogo se deducen de su turno). */
export function diasDe(a: PatronTurno): DiasTurno {
  if (a.tipo === 'eventual') return { tipo: 'diario' };
  if (a.dias) return a.dias;
  return a.turno === '24x24' ? { tipo: 'ciclo', trabaja: 1, descansa: 1 } : { tipo: 'diario' };
}

/** Duración en minutos: horas del turno, o de inicio a fin en eventos. */
function duracionMin(a: PatronTurno): number | null {
  if (a.tipo !== 'eventual') {
    const horas = a.horas ?? (a.turno === '24x24' ? 24 : a.turno === '12x12' ? 12 : null);
    if (horas) return horas * 60;
  }
  if (!a.horaInicio || !a.horaFin) return null;
  return (minutos(a.horaFin) - minutos(a.horaInicio) + 1440) % 1440 || 1440;
}

/** Duración en minutos del turno de una asignación (null si no se puede saber). */
export const duracionPatronMin = (a: PatronTurno) => duracionMin(a);

/** ¿El turno empieza ese día? */
export function trabajaEl(fecha: string, a: PatronTurno): boolean {
  if (fecha < a.desde || (a.hasta && fecha > a.hasta)) return false;
  const d = diasDe(a);
  if (d.tipo === 'ciclo')
    return (numeroDia(fecha) - numeroDia(a.desde)) % (d.trabaja + d.descansa) < d.trabaja;
  if (d.tipo === 'semanal') return d.semana.includes(new Date(`${fecha}T12:00:00Z`).getUTCDay());
  return true;
}

/** Tramos [inicio, fin) en minutos absolutos (día × 1440 + minuto) de los turnos que empiezan en [desde, hasta]. */
function tramos(a: PatronTurno, desde: string, hasta: string): [number, number][] {
  const dur = duracionMin(a);
  if (!a.horaInicio || !dur) return [];
  const res: [number, number][] = [];
  for (let f = desde; f <= hasta; f = sumarDiasFecha(f, 1)) {
    if (trabajaEl(f, a)) {
      const ini = numeroDia(f) * 1440 + minutos(a.horaInicio);
      res.push([ini, ini + dur]);
    }
  }
  return res;
}

/** Días a revisar para cubrir un ciclo completo de ambos patrones (semana, N + M, etc.). */
function ventana(a: PatronTurno, b: PatronTurno) {
  const largo = (p: PatronTurno) => {
    const d = diasDe(p);
    return d.tipo === 'ciclo' ? d.trabaja + d.descansa : 7;
  };
  return Math.min(Math.max(largo(a) * largo(b), 7), 120);
}

/** Desde cuándo y hasta cuándo coinciden dos asignaciones (null si nunca). */
function traslape(a: PatronTurno, b: PatronTurno) {
  const inicio = a.desde > b.desde ? a.desde : b.desde;
  const finA = a.hasta ?? '9999-12-31';
  const finB = b.hasta ?? '9999-12-31';
  const fin = finA < finB ? finA : finB;
  if (fin < inicio) return null;
  const tope = sumarDiasFecha(inicio, ventana(a, b));
  return { inicio, fin: fin < tope ? fin : tope };
}

/** ¿Los horarios de dos asignaciones se enciman en algún momento? (DA-37) */
export function seCruzan(a: PatronTurno, b: PatronTurno): boolean {
  const r = traslape(a, b);
  if (!r) return false;
  // Un día antes por turnos que cruzan la noche.
  const desde = sumarDiasFecha(r.inicio, -1);
  const ta = tramos(a, desde, r.fin);
  const tb = tramos(b, desde, r.fin);
  return ta.some(([i1, f1]) => tb.some(([i2, f2]) => i1 < f2 && i2 < f1));
}

/** ¿Trabajan exactamente los mismos días a las mismas horas (mismo turno y misma fase)? */
export function mismoHorario(a: PatronTurno, b: PatronTurno): boolean {
  if (a.horaInicio !== b.horaInicio || duracionMin(a) !== duracionMin(b)) return false;
  const inicio = a.desde > b.desde ? a.desde : b.desde;
  const dias = ventana(a, b);
  for (let i = 0; i < dias; i++) {
    const f = sumarDiasFecha(inicio, i);
    if (trabajaEl(f, { ...a, desde: a.desde, hasta: null }) !== trabajaEl(f, { ...b, hasta: null }))
      return false;
  }
  return true;
}

/**
 * Horas del día sin nadie de turno (`HH:MM` a `HH:MM`), considerando también los turnos que
 * vienen del día anterior. Vacío si el día está cubierto completo.
 */
export function huecosDelDia(fecha: string, asignaciones: PatronTurno[]): { desde: string; hasta: string }[] {
  const base = numeroDia(fecha) * 1440;
  const cubiertos = asignaciones
    .flatMap((a) => tramos(a, sumarDiasFecha(fecha, -1), fecha))
    .map(([i, f]) => [Math.max(i, base) - base, Math.min(f, base + 1440) - base] as const)
    .filter(([i, f]) => f > i)
    .sort((x, y) => x[0] - y[0]);
  const huecos: { desde: string; hasta: string }[] = [];
  let cursor = 0;
  for (const [i, f] of cubiertos) {
    if (i > cursor) huecos.push({ desde: hhmm(cursor), hasta: hhmm(i) });
    cursor = Math.max(cursor, f);
  }
  // Hasta la medianoche se escribe 00:00.
  if (cursor < 1440) huecos.push({ desde: hhmm(cursor), hasta: '00:00' });
  return huecos;
}

/**
 * Día A / Día B de un turno "un día sí, uno no": los que empiezan el mismo día (o con diferencia
 * par) que `referencia` son A; los demás, B.
 */
export function letraDia(desde: string, referencia: string): 'A' | 'B' {
  return (((numeroDia(desde) - numeroDia(referencia)) % 2) + 2) % 2 === 0 ? 'A' : 'B';
}

/** ¿El patrón es "un día sí, uno no"? (para mostrar Día A / Día B) */
export const esUnoYUno = (d: DiasTurno | null | undefined) =>
  d?.tipo === 'ciclo' && d.trabaja === 1 && d.descansa === 1;
