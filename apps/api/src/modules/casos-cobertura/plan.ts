import {
  HORAS_CANSANCIO,
  duracionPatronMin,
  sumarDiasFecha,
  trabajaEl,
  type TramoPlan,
  type VistaPreviaCaso,
} from '@platinum/shared';
import { env } from '../../config/env';
import { hoyISO, inicioDelDia } from '../../core';
import type { TurnoProgramado } from '../asistencia/vigilancia';

const MIN = 60_000;
const HORA = 3_600_000;
/** Si el patrón no permite saber su descanso (no hay turno anterior a la vista), se asume este. */
const DESCANSO_SUPUESTO_HORAS = 12;
/** Días hacia atrás y adelante que se revisan para ubicar sus turnos. */
const ATRAS = 8;
const ADELANTE = 21;

const minutosDe = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export interface Ocurrencia {
  inicio: Date;
  fin: Date;
}

/** `HH:MM` de un instante en la zona del negocio. */
const hhmm = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: env.APP_TIMEZONE }).format(d);

/** Turnos propios (sin coberturas) del guardia que empiezan entre dos días; sin los días en pausa. */
export function turnosPropios(turnos: TurnoProgramado[], desde: string, hasta: string): Ocurrencia[] {
  const res = new Map<number, Ocurrencia>();
  for (const t of turnos) {
    if (t.coberturaId || !t.patron.horaInicio) continue;
    const dur = duracionPatronMin(t.patron);
    if (!dur) continue;
    for (let f = desde; f <= hasta; f = sumarDiasFecha(f, 1)) {
      if (!trabajaEl(f, t.patron) || t.pausas?.some((p) => f >= p.desde && f <= p.hasta)) continue;
      const inicio = new Date(inicioDelDia(f).getTime() + minutosDe(t.patron.horaInicio) * MIN);
      res.set(inicio.getTime(), { inicio, fin: new Date(inicio.getTime() + dur * MIN) });
    }
  }
  return [...res.values()].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/** Un tramo [inicio, fin) con lo necesario para mandar a alguien a cubrirlo. */
export function aTramo(inicio: Date, fin: Date): TramoPlan {
  return {
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    fecha: hoyISO(undefined, inicio),
    horaInicio: hhmm(inicio),
    horas: Math.min(24, Math.max(1, Math.ceil((fin.getTime() - inicio.getTime()) / HORA))),
  };
}

export interface EntradaPlan {
  /** Turnos del guardia (en cualquier sitio, con sus pausas); se usan solo los propios. */
  turnos: TurnoProgramado[];
  /** Cuándo entró a la jornada que sigue abierta. */
  entrada: Date;
  /** Su hora de salida programada: desde aquí son horas extra. */
  salidaProgramada: Date;
  /** Hasta cuándo cubre (fin del turno que cubre). */
  finCubierto: Date;
  /** Horas de descanso que el supervisor agrega a las del patrón. */
  descansoExtraHoras: number;
}

/**
 * Qué pasa con el siguiente turno del guardia que cubre un turno de más (AS6-06):
 * - "Lo trabaja normal": las horas extra terminan donde empieza su siguiente turno.
 * - "Descansa": su descanso es el del patrón (el tiempo entre el fin de un turno y el inicio del
 *   siguiente: 24 h en un 24x24, 12 h en un 12x12) más lo que agregue el supervisor. Regresa a las
 *   `regresaEn`: lo que quede de sus turnos antes de eso es un hueco por cubrir, y si regresa a la
 *   mitad de un turno entra tarde y termina a la hora original (el horario no se recorre).
 */
export function planearSiguiente(e: EntradaPlan): VistaPreviaCaso {
  const ref = hoyISO(undefined, e.finCubierto);
  const turnos = turnosPropios(e.turnos, sumarDiasFecha(ref, -ATRAS), sumarDiasFecha(ref, ADELANTE));

  // Normal: su primer turno propio que empieza después de su salida programada.
  const proximo = turnos.find((o) => o.inicio.getTime() >= e.salidaProgramada.getTime()) ?? null;
  // Descanso: su primer turno propio que empieza cuando ya terminó de cubrir.
  const siguiente = turnos.find((o) => o.inicio.getTime() >= e.finCubierto.getTime()) ?? null;

  let descansoPatronHoras: number | null = null;
  let regresaEn: Date | null = null;
  let vuelveA: Date | null = null;
  let entraTarde: TramoPlan | null = null;
  const huecos: TramoPlan[] = [];

  if (siguiente) {
    const anterior = [...turnos].reverse().find((o) => o.inicio.getTime() < siguiente.inicio.getTime());
    const gapMin = anterior ? Math.max(0, (siguiente.inicio.getTime() - anterior.fin.getTime()) / MIN) : null;
    descansoPatronHoras = gapMin === null ? null : Math.round((gapMin / 60) * 10) / 10;
    const descansoMs = ((descansoPatronHoras ?? DESCANSO_SUPUESTO_HORAS) + e.descansoExtraHoras) * HORA;
    regresaEn = new Date(e.finCubierto.getTime() + descansoMs);
    for (const o of turnos.filter((x) => x.inicio.getTime() >= e.finCubierto.getTime())) {
      if (o.inicio.getTime() >= regresaEn.getTime()) {
        vuelveA = o.inicio;
        break;
      }
      if (o.fin.getTime() <= regresaEn.getTime()) {
        huecos.push(aTramo(o.inicio, o.fin));
        continue;
      }
      huecos.push(aTramo(o.inicio, regresaEn));
      entraTarde = aTramo(regresaEn, o.fin);
      vuelveA = regresaEn;
      break;
    }
  }

  const limiteExtra = proximo ? proximo.inicio : null;
  // Horas seguidas en el sitio: hasta el fin de su siguiente turno si lo trabaja sin descanso.
  const finSeguido = proximo ? new Date(Math.max(proximo.fin.getTime(), e.finCubierto.getTime())) : e.finCubierto;
  const horasSeguidas = Math.round(((finSeguido.getTime() - e.entrada.getTime()) / HORA) * 10) / 10;
  const advertencias: string[] = [];
  if (horasSeguidas > HORAS_CANSANCIO) {
    advertencias.push(`Si trabaja también su siguiente turno llevará ${Math.round(horasSeguidas)} h seguidas en el sitio`);
  }
  const hastaCubrir = (e.finCubierto.getTime() - e.entrada.getTime()) / HORA;
  if (hastaCubrir > HORAS_CANSANCIO) {
    advertencias.push(`Para cubrir ese turno llevará ${Math.round(hastaCubrir)} h seguidas en el sitio`);
  }

  return {
    finCubierto: e.finCubierto.toISOString(),
    siguienteTurno: siguiente ? { inicio: siguiente.inicio.toISOString(), fin: siguiente.fin.toISOString() } : null,
    descansoPatronHoras,
    regresaEn: regresaEn?.toISOString() ?? null,
    vuelveA: vuelveA?.toISOString() ?? null,
    huecos,
    entraTarde,
    limiteExtra: limiteExtra?.toISOString() ?? null,
    horasSeguidas,
    advertencias,
  };
}
