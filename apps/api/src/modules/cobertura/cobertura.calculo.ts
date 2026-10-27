import {
  duracionPatronMin,
  horaLegible,
  sumarDiasFecha,
  trabajaEl,
  type CoberturaSitio,
  type DiaCobertura,
  type GuardiaCobertura,
  type SituacionGuardia,
  type TurnoCobertura,
  type TurnoDiaCobertura,
} from '@platinum/shared';
import { inicioDelDia } from '../../core';
import { MIN_FALTA, MIN_NO_SE_PRESENTO, type TurnoProgramado } from '../asistencia/vigilancia';

/** Lo que realmente pasó en el sitio, para pintar los días que ya empezaron. */
export interface RealesCobertura {
  turnosDia: {
    usuarioId: number;
    programadaEntrada: Date;
    entradaId: number | null;
    noSePresentoEn: Date | null;
    faltaEn: Date | null;
  }[];
  entradas: { usuarioId: number; registradaEn: Date }[];
  /** Horas extra no rechazadas, por guardia y día de la jornada. */
  extras: { usuarioId: number; fecha: string }[];
}

export interface EntradaCobertura {
  sitio: { id: number; nombre: string };
  desde: string;
  hasta: string;
  turnos: TurnoProgramado[];
  reales: RealesCobertura;
  ahora: Date;
}

/** Una entrada hasta 3 h antes de la hora cuenta para el turno (igual que la vigilancia). */
const ANTES_MS = 3 * 3_600_000;
/** Tope de la ventana para ligar una entrada con el turno cuando no hay registro del turno. */
const DESPUES_MAX_MIN = 6 * 60;
/** Pasado este tiempo sin entrada ni registro del turno, ya no se sabe qué pasó. */
const VENTANA_SIN_REGISTRO_MIN = MIN_FALTA + 30;

const minutosDe = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

interface Franja extends TurnoCobertura {
  durMin: number;
  /** Turno fijo del sitio: si nadie lo cubre un día de su vigencia, es un hueco. */
  base: boolean;
}

const claveDe = (horaInicio: string, durMin: number) => `${horaInicio}|${durMin}`;

function franjasDe(turnos: TurnoProgramado[]): Franja[] {
  const mapa = new Map<string, Franja>();
  for (const t of turnos) {
    const dur = t.patron.horaInicio ? duracionPatronMin(t.patron) : null;
    if (!t.patron.horaInicio || !dur) continue;
    const clave = claveDe(t.patron.horaInicio, dur);
    const base = !t.coberturaId && t.patron.tipo !== 'eventual';
    const actual = mapa.get(clave);
    if (actual) {
      actual.base ||= base;
      continue;
    }
    const horas = Math.round((dur / 60) * 10) / 10;
    mapa.set(clave, {
      clave,
      horaInicio: t.patron.horaInicio,
      horas,
      durMin: dur,
      base,
      etiqueta: `${horaLegible(t.patron.horaInicio)} · ${horas} h`,
    });
  }
  return [...mapa.values()].sort((a, b) => minutosDe(a.horaInicio) - minutosDe(b.horaInicio) || a.durMin - b.durMin);
}

function situacionDe(
  guardiaId: number,
  inicio: Date,
  durMin: number,
  ahora: Date,
  reales: RealesCobertura,
  turnosDia: Map<string, RealesCobertura['turnosDia'][number]>,
  entradasDe: Map<number, Date[]>,
): SituacionGuardia {
  const min = Math.floor((ahora.getTime() - inicio.getTime()) / 60_000);
  if (min < 0) return 'programado';
  const fila = turnosDia.get(`${guardiaId}|${inicio.getTime()}`);
  const hasta = inicio.getTime() + Math.min(durMin, DESPUES_MAX_MIN) * 60_000;
  const entro = (entradasDe.get(guardiaId) ?? []).some((e) => e.getTime() >= inicio.getTime() - ANTES_MS && e.getTime() < hasta);
  if (fila?.entradaId || entro) return 'presente';
  if (fila?.faltaEn) return 'falta';
  if (fila?.noSePresentoEn) return 'ausente';
  if (min < MIN_NO_SE_PRESENTO) return 'programado';
  return min <= VENTANA_SIN_REGISTRO_MIN ? 'ausente' : 'sin_registro';
}

/**
 * Cobertura de un sitio por día y turno (AS6-01). Cada turno del sitio (misma hora y duración) sale
 * una vez por día: cubierto, cubierto por una cobertura, con horas extra o sin cubrir. Los días que
 * ya empezaron se miden con lo que pasó (entradas, faltas); los demás, con lo planeado.
 */
export function calcularCobertura(e: EntradaCobertura): CoberturaSitio {
  const franjas = franjasDe(e.turnos);
  const turnosDia = new Map(e.reales.turnosDia.map((t) => [`${t.usuarioId}|${t.programadaEntrada.getTime()}`, t]));
  const entradasDe = new Map<number, Date[]>();
  for (const x of e.reales.entradas) entradasDe.set(x.usuarioId, [...(entradasDe.get(x.usuarioId) ?? []), x.registradaEn]);
  const extras = new Set(e.reales.extras.map((x) => `${x.usuarioId}|${x.fecha}`));

  const dias: DiaCobertura[] = [];
  for (let fecha = e.desde; fecha <= e.hasta; fecha = sumarDiasFecha(fecha, 1)) {
    const turnosDelDia: TurnoDiaCobertura[] = franjas.map((f) => {
      const inicio = new Date(inicioDelDia(fecha).getTime() + minutosDe(f.horaInicio) * 60_000);
      const delTurno = e.turnos.filter((t) => t.patron.horaInicio && claveDe(t.patron.horaInicio, duracionPatronMin(t.patron) ?? 0) === f.clave);
      // Se exige el turno mientras alguna asignación fija suya esté vigente ese día.
      const exigido =
        f.base &&
        delTurno.some((t) => !t.coberturaId && t.patron.tipo !== 'eventual' && fecha >= t.patron.desde && (!t.patron.hasta || fecha <= t.patron.hasta));

      const guardias = new Map<string, GuardiaCobertura>();
      for (const t of delTurno) {
        if (!trabajaEl(fecha, t.patron)) continue;
        if (!t.coberturaId && t.pausas?.some((p) => fecha >= p.desde && fecha <= p.hasta)) continue;
        const origen = t.coberturaId ? 'cobertura' : 'turno';
        const llave = `${t.guardia.id}|${origen}`;
        if (guardias.has(llave)) continue;
        guardias.set(llave, {
          id: t.guardia.id,
          nombre: t.guardia.nombre,
          origen,
          situacion: situacionDe(t.guardia.id, inicio, f.durMin, e.ahora, e.reales, turnosDia, entradasDe),
          extra: extras.has(`${t.guardia.id}|${fecha}`),
        });
      }
      const lista = [...guardias.values()];
      const base = { clave: f.clave, guardias: lista };

      if (lista.length === 0) {
        return exigido
          ? { ...base, estado: 'sin_cubrir', motivo: 'sin_asignar' }
          : { ...base, estado: 'sin_turno', motivo: null };
      }
      const cubre = lista.filter((g) => g.situacion === 'presente' || g.situacion === 'programado');
      if (cubre.length === 0) {
        if (lista.some((g) => g.situacion === 'falta')) return { ...base, estado: 'sin_cubrir', motivo: 'falta' };
        if (lista.some((g) => g.situacion === 'ausente')) return { ...base, estado: 'sin_cubrir', motivo: 'ausente' };
        return { ...base, estado: 'sin_registro', motivo: null };
      }
      if (cubre.some((g) => g.extra)) return { ...base, estado: 'extra', motivo: null };
      if (cubre.some((g) => g.origen === 'cobertura')) return { ...base, estado: 'cobertura', motivo: null };
      return { ...base, estado: 'cubierto', motivo: null };
    });
    dias.push({ fecha, turnos: turnosDelDia });
  }

  return {
    sitio: e.sitio,
    desde: e.desde,
    hasta: e.hasta,
    turnos: franjas.map(({ clave, horaInicio, horas, etiqueta }) => ({ clave, horaInicio, horas, etiqueta })),
    dias,
  };
}
