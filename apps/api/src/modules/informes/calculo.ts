import {
  HORAS_TURNO,
  SALIDA_ANTICIPADA_MIN,
  TIPO_EVENTO_BITACORA_LABEL,
  TOLERANCIA_RETARDO_MIN,
  COMIDA_MIN,
  diasDe,
  sumarDiasFecha,
  textoDias,
  trabajaEl,
  type EstadoDiaInforme,
  type InformeDatos,
  type InformeDia,
  type InformeGuardia,
  type InformeHecho,
  type InformeResumen,
  type Jornada,
  type PatronTurno,
  type TipoEventoBitacora,
  type TipoInforme,
} from '@platinum/shared';
import { env } from '../../config/env';
import { hoyISO } from '../../core';
import type { EventoBitacoraRow } from '../bitacora/bitacora.repository';
import { MIN_FALTA, type TurnoProgramado } from '../asistencia/vigilancia';

/** Criterios que se imprimen en el reporte: son los que el sistema aplicó de verdad. */
export const CRITERIOS_INFORME = [
  `Retardo: entrada con más de ${TOLERANCIA_RETARDO_MIN} minutos de tolerancia sobre la hora programada.`,
  `Salida anticipada: salida ${SALIDA_ANTICIPADA_MIN} minutos o más antes de la hora programada.`,
  `Falta: turno programado sin entrada; se marca a las ${MIN_FALTA / 60} horas de la hora de entrada. Si el supervisor acepta la asistencia, cuenta como asistencia.`,
  'Horas trabajadas: de la entrada a la salida registradas (el tiempo de comida está incluido).',
  `Comida: se muestra a título informativo (${COMIDA_MIN} minutos por comida).`,
  'Las horas de entrada, comida y salida las pone el servidor; no se pueden editar. Una jornada cerrada por un supervisor lo indica.',
  'Los retardos, salidas anticipadas y faltas justificados por el supervisor no cuentan como incidencias.',
];

export interface GuardiaInforme {
  id: number;
  nombre: string;
  email: string;
}

/** Marcas de un guardia ya armadas como jornadas (de la más reciente a la más antigua). */
export type JornadaDe = Jornada & { usuarioId: number };

export interface EntradaCalculo {
  tipo: TipoInforme;
  desde: string;
  hasta: string;
  alcance: string;
  guardias: GuardiaInforme[];
  turnos: TurnoProgramado[];
  jornadas: JornadaDe[];
  eventos: EventoBitacoraRow[];
  /** Supervisor de cada sitio (por id). */
  supervisores: Map<number, string>;
  /** Limita el reporte a un sitio: solo cuenta lo que pasó en él. */
  sitioId?: number | null;
  /** Fecha de hoy (zona del negocio): lo posterior aún no pasa. */
  hoy: string;
  ahora: Date;
}

const vacio = (): InformeResumen => ({
  programados: 0,
  trabajados: 0,
  faltas: 0,
  justificadas: 0,
  porRevisar: 0,
  retardos: 0,
  retardoMin: 0,
  salidasAntes: 0,
  comidas: 0,
  minutosTrabajados: 0,
  minutosEsperados: 0,
});

export function sumarResumen(a: InformeResumen, b: InformeResumen): InformeResumen {
  const r = vacio();
  for (const k of Object.keys(r) as (keyof InformeResumen)[]) r[k] = (a[k] ?? 0) + (b[k] ?? 0);
  return r;
}

const fechaDe = (d: Date | string) => hoyISO(undefined, typeof d === 'string' ? new Date(d) : d);
const minutos = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 60_000);

/** `08:00` de un instante en la zona del negocio. */
const hora = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: env.APP_TIMEZONE,
  }).format(new Date(iso));

function duracionPatron(p: PatronTurno): number | null {
  if (p.horas) return p.horas * 60;
  if (p.turno && p.turno in HORAS_TURNO) return HORAS_TURNO[p.turno as keyof typeof HORAS_TURNO] * 60;
  if (!p.horaInicio || !p.horaFin) return null;
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  return (m(p.horaFin) - m(p.horaInicio) + 1440) % 1440 || 1440;
}

function horarioDe(p: PatronTurno): string | null {
  if (!p.horaInicio) return null;
  const dur = duracionPatron(p);
  if (!dur) return p.horaInicio.slice(0, 5);
  const ini = Number(p.horaInicio.slice(0, 2)) * 60 + Number(p.horaInicio.slice(3, 5));
  const fin = (ini + dur) % 1440;
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${hhmm(ini)} – ${hhmm(fin)}`;
}

/** El evento justificado o aceptado cubre a la marca (la de entrada o la de salida). */
const eventoDeMarca = (eventos: EventoBitacoraRow[], tipo: TipoEventoBitacora, ids: (number | undefined)[]) =>
  eventos.find((e) => e.tipo === tipo && e.marcacionId !== null && ids.includes(e.marcacionId));

function resumirDias(dias: InformeDia[]): InformeResumen {
  const r = vacio();
  for (const d of dias) {
    if (d.estado === 'descanso' || (d.estado === 'en_curso' && !d.entrada)) continue;
    const programado = d.esperadosMin !== null || d.horario !== null;
    if (programado) {
      r.programados += 1;
      r.minutosEsperados += d.esperadosMin ?? 0;
    }
    if (d.estado === 'falta') r.faltas += 1;
    else if (d.estado === 'falta_justificada') r.justificadas += 1;
    else if (d.estado === 'por_revisar') r.porRevisar = (r.porRevisar ?? 0) + 1;
    else if (d.entrada) {
      r.trabajados += 1;
      r.minutosTrabajados += d.minutos ?? 0;
    }
    if (d.estado === 'retardo') {
      r.retardos += 1;
      r.retardoMin += d.retardoMin ?? 0;
    }
    if ((d.salidaAnticipadaMin ?? 0) >= SALIDA_ANTICIPADA_MIN && !d.notas.some((n) => n.startsWith('Salida anticipada justificada'))) {
      r.salidasAntes += 1;
    }
    r.comidas += d.comidas.length;
  }
  return r;
}

/** Día por día de un guardia. */
function diasDelGuardia(g: GuardiaInforme, e: EntradaCalculo): InformeDia[] {
  const turnos = e.turnos.filter((t) => t.guardia.id === g.id && (!e.sitioId || t.sitio.id === e.sitioId));
  const jornadas = e.jornadas.filter(
    (j) => j.usuarioId === g.id && (!e.sitioId || j.sitio?.id === e.sitioId),
  );
  const eventos = e.eventos.filter((v) => v.usuarioId === g.id);
  const porFecha = new Map<string, JornadaDe[]>();
  for (const j of jornadas) {
    const f = j.programada ? fechaDe(j.programada.entrada) : fechaDe(j.entrada.registradaEn);
    if (f < e.desde || f > e.hasta) continue;
    porFecha.set(f, [...(porFecha.get(f) ?? []), j]);
  }
  const dias: InformeDia[] = [];

  for (let f = e.desde; f <= e.hasta && f <= e.hoy; f = sumarDiasFecha(f, 1)) {
    const delDia = turnos.filter(
      (t) =>
        trabajaEl(f, t.patron) && !t.pausas?.some((p) => f >= p.desde && f <= p.hasta),
    );
    const usadas = new Set<JornadaDe>();
    const candidatas = porFecha.get(f) ?? [];

    for (const t of delDia) {
      const j =
        candidatas.find((c) => !usadas.has(c) && c.sitio?.id === t.sitio.id) ??
        candidatas.find((c) => !usadas.has(c));
      if (j) usadas.add(j);
      dias.push(
        j
          ? diaConJornada(f, j, eventos, t, e)
          : diaSinJornada(f, t, eventos, e),
      );
    }
    // Jornadas que no eran de un turno programado (extras, cambios de sitio).
    for (const j of candidatas.filter((c) => !usadas.has(c))) {
      dias.push(diaConJornada(f, j, eventos, null, e));
    }
    if (delDia.length === 0 && candidatas.length === 0) {
      const asignado = turnos.some(
        (t) => !t.coberturaId && f >= t.patron.desde && (!t.patron.hasta || f <= t.patron.hasta),
      );
      if (asignado) dias.push(diaDescanso(f, turnos));
    }
  }
  return dias;
}

function diaDescanso(f: string, turnos: TurnoProgramado[]): InformeDia {
  const t = turnos.find((x) => !x.coberturaId && f >= x.patron.desde && (!x.patron.hasta || f <= x.patron.hasta));
  return {
    fecha: f,
    sitio: t?.sitio.nombre ?? null,
    horario: null,
    entrada: null,
    retardoMin: null,
    salidaAnticipadaMin: null,
    comidas: [],
    salida: null,
    minutos: null,
    esperadosMin: null,
    estado: 'descanso',
    cobertura: false,
    notas: [],
  };
}

function diaSinJornada(f: string, t: TurnoProgramado, eventos: EventoBitacoraRow[], e: EntradaCalculo): InformeDia {
  const falta = eventos.find(
    (v) =>
      v.tipo === 'falta' &&
      v.sitio?.id === t.sitio.id &&
      fechaDe(typeof (v.datos as { programada?: string } | null)?.programada === 'string'
        ? (v.datos as { programada: string }).programada
        : v.ocurrioEn) === f,
  );
  const notas: string[] = [];
  let estado: EstadoDiaInforme = 'falta';
  if (!falta && f === e.hoy) estado = 'en_curso';
  if (falta?.justificacion) {
    estado = 'falta_justificada';
    notas.push(`Falta justificada por ${falta.justificadoPor ?? 'el supervisor'}: ${falta.justificacion}`);
  } else if (falta && falta.decision !== 'falta') {
    // El supervisor aún no la revisa: no cuenta como falta hasta que la confirme (A-51).
    estado = 'por_revisar';
    notas.push('Falta sin revisar: no cuenta como falta hasta que el supervisor la confirme.');
  }
  if (t.coberturaId) notas.push('Cubría otro sitio');
  const base: InformeDia = {
    fecha: f,
    sitio: t.sitio.nombre,
    horario: horarioDe(t.patron),
    entrada: null,
    retardoMin: null,
    salidaAnticipadaMin: null,
    comidas: [],
    salida: null,
    minutos: null,
    esperadosMin: duracionPatron(t.patron),
    estado,
    cobertura: !!t.coberturaId,
    notas,
  };
  return base;
}

function diaConJornada(
  f: string,
  j: JornadaDe,
  eventos: EventoBitacoraRow[],
  t: TurnoProgramado | null,
  e: EntradaCalculo,
): InformeDia {
  const entradaIso = j.entrada.registradaEn;
  const salidaIso = j.salida?.registradaEn ?? null;
  const notas: string[] = [];
  const ids = [j.entrada.id, j.salida?.id];
  const retardoMin = j.retardoMin;
  const cerrada = j.alertas.includes('cerrada_por_supervisor');

  // Mandado a casa por llegar tarde (A-25): cuenta como falta y sus horas no cuentan.
  const evRetardo = eventoDeMarca(eventos, 'retardo', ids);
  if (evRetardo?.decision === 'enviado_a_casa') {
    return {
      ...base(f, j, t, e),
      estado: evRetardo.justificacion ? 'falta_justificada' : 'falta',
      notas: [
        `Llegó a las ${hora(entradaIso)}; ${evRetardo.decididoPor ?? 'el supervisor'} lo mandó a casa y cuenta como falta.`,
      ],
    };
  }

  let estado: EstadoDiaInforme = 'completa';
  const retardo = (retardoMin ?? 0) > TOLERANCIA_RETARDO_MIN;
  if (retardo) {
    const ev = evRetardo;
    if (ev?.justificacion) {
      notas.push(`Retardo justificado por ${ev.justificadoPor ?? 'el supervisor'}: ${ev.justificacion}`);
    } else {
      estado = 'retardo';
    }
  }
  // Falta con llegada tarde: el supervisor decide si cuenta como falta.
  const falta = eventos.find(
    (v) =>
      v.tipo === 'falta' &&
      fechaDe(typeof (v.datos as { programada?: string } | null)?.programada === 'string'
        ? (v.datos as { programada: string }).programada
        : v.ocurrioEn) === f,
  );
  if (falta) {
    if (falta.decision === 'falta') {
      return {
        ...base(f, j, t, e),
        entrada: null,
        retardoMin: null,
        salidaAnticipadaMin: null,
        comidas: [],
        salida: null,
        minutos: null,
        estado: falta.justificacion ? 'falta_justificada' : 'falta',
        notas: [`Llegó a las ${hora(entradaIso)}; el supervisor dejó la falta.`],
      };
    }
    if (falta.decision === 'asistencia') {
      notas.push(`Llegó tarde; ${falta.decididoPor ?? 'el supervisor'} aceptó la asistencia.`);
    } else {
      notas.push('Llegó después de la falta; el supervisor aún no decide.');
    }
  }
  if ((j.salidaAnticipadaMin ?? 0) >= SALIDA_ANTICIPADA_MIN) {
    const ev = eventoDeMarca(eventos, 'salida_anticipada', ids);
    if (ev?.justificacion) {
      notas.push(`Salida anticipada justificada por ${ev.justificadoPor ?? 'el supervisor'}: ${ev.justificacion}`);
    }
  }
  if (cerrada) {
    estado = 'cerrada';
    const cierre = eventos.find(
      (v) => v.tipo === 'jornada_cerrada' && v.marcacionId !== null && ids.includes(v.marcacionId),
    );
    notas.push(
      cierre
        ? `Cerrada por ${cierre.actor ?? 'un supervisor'}: ${cierre.detalle}`
        : 'Jornada cerrada por un supervisor.',
    );
  } else if (!salidaIso) {
    const fin = j.programada ? Date.parse(j.programada.salida) : null;
    estado = fin !== null && fin > e.ahora.getTime() ? 'en_curso' : 'sin_salida';
    if (estado === 'sin_salida') notas.push('No registró su salida.');
  }
  for (const c of j.comidas) {
    if (c.inicio && !c.fin) notas.push('Comida sin cierre.');
  }
  const ev = eventos.find((v) => v.tipo === 'comida_fuera' && v.marcacionId === j.comidas[0]?.inicio.id);
  if (ev) notas.push(ev.justificacion ? `Comida fuera del sitio, justificada: ${ev.justificacion}` : 'Comida fuera del sitio.');
  if (t?.coberturaId) notas.push(`Cobertura en ${t.sitio.nombre}`);

  return {
    ...base(f, j, t, e),
    entrada: entradaIso,
    retardoMin,
    salidaAnticipadaMin: j.salidaAnticipadaMin,
    comidas: j.comidas.map((c) => ({ inicio: c.inicio.registradaEn, fin: c.fin?.registradaEn ?? null })),
    salida: salidaIso,
    minutos: salidaIso ? minutos(entradaIso, salidaIso) : null,
    estado,
    notas,
  };
}

function base(f: string, j: JornadaDe, t: TurnoProgramado | null, _e: EntradaCalculo): InformeDia {
  const horario = j.programada
    ? `${hora(j.programada.entrada)} – ${hora(j.programada.salida)}`
    : t
      ? horarioDe(t.patron)
      : null;
  return {
    fecha: f,
    sitio: j.sitio?.nombre ?? t?.sitio.nombre ?? null,
    horario,
    entrada: null,
    retardoMin: null,
    salidaAnticipadaMin: null,
    comidas: [],
    salida: null,
    minutos: null,
    esperadosMin: j.programada ? minutos(j.programada.entrada, j.programada.salida) : t ? duracionPatron(t.patron) : null,
    estado: 'completa',
    cobertura: !!t?.coberturaId,
    notas: [],
  };
}

/** Hechos relevantes: lo que el supervisor hizo o decidió, sin datos biométricos. */
const TIPOS_HECHO: readonly TipoEventoBitacora[] = [
  'jornada_cerrada',
  'cobertura',
  'cobertura_cancelada',
  'racha',
  'comida_sin_cierre',
  'sin_comida',
];
const TIPOS_JUSTIFICABLES_HECHO: readonly TipoEventoBitacora[] = [
  'retardo',
  'salida_anticipada',
  'comida_fuera',
  'falta',
];

const DECISION_TEXTO = {
  asistencia: 'decidió aceptar la asistencia',
  falta: 'decidió dejar la falta',
  aceptado: 'aceptó al guardia con su retardo',
  enviado_a_casa: 'lo mandó a casa; cuenta como falta',
} as const;

function hechos(eventos: EventoBitacoraRow[], e: EntradaCalculo): InformeHecho[] {
  const res: InformeHecho[] = [];
  for (const v of eventos) {
    const f = fechaDe(v.ocurrioEn);
    if (f < e.desde || f > e.hasta) continue;
    if (e.sitioId && v.sitio && v.sitio.id !== e.sitioId) continue;
    const etiqueta = TIPO_EVENTO_BITACORA_LABEL[v.tipo];
    if (TIPOS_HECHO.includes(v.tipo)) {
      res.push({ en: v.ocurrioEn.toISOString(), guardia: v.guardia.nombre, texto: `${etiqueta}: ${v.detalle}` });
    } else if (TIPOS_JUSTIFICABLES_HECHO.includes(v.tipo)) {
      if (v.justificacion) {
        res.push({
          en: v.ocurrioEn.toISOString(),
          guardia: v.guardia.nombre,
          texto: `${etiqueta} justificado por ${v.justificadoPor ?? 'el supervisor'}: ${v.justificacion}`,
        });
      } else if (v.decision && v.decision !== 'superado') {
        res.push({
          en: v.ocurrioEn.toISOString(),
          guardia: v.guardia.nombre,
          texto: `${etiqueta}: ${v.decididoPor ?? 'el supervisor'} ${DECISION_TEXTO[v.decision]}.`,
        });
      }
    }
  }
  return res.sort((a, b) => a.en.localeCompare(b.en));
}

/** Calcula el contenido del reporte con lo que existe en este momento (se congela al emitirlo). */
export function calcularInforme(e: EntradaCalculo): InformeDatos {
  const guardias: InformeGuardia[] = e.guardias.map((g) => {
    const dias = diasDelGuardia(g, e);
    const turnos = e.turnos.filter((t) => t.guardia.id === g.id && (!e.sitioId || t.sitio.id === e.sitioId));
    const sitios = [...new Set(dias.map((d) => d.sitio).filter((s): s is string => !!s))];
    const sitioIds = new Set(turnos.map((t) => t.sitio.id));
    return {
      id: g.id,
      nombre: g.nombre,
      email: g.email,
      sitios,
      supervisores: [...new Set([...sitioIds].map((id) => e.supervisores.get(id)).filter((s): s is string => !!s))],
      turnos: [
        ...new Set(
          turnos.map((t) => [t.coberturaId ? 'Cobertura' : textoDias(diasDe(t.patron)), horarioDe(t.patron)].filter(Boolean).join(' · ')),
        ),
      ],
      dias,
      resumen: resumirDias(dias),
    };
  });

  // Un reporte general solo trae a quien tuvo algo en el periodo.
  const visibles = e.tipo === 'personal' ? guardias : guardias.filter((g) => g.dias.length > 0);
  visibles.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const sitios = new Map<string, { guardias: Set<number>; resumen: InformeResumen }>();
  for (const g of visibles) {
    const porSitio = new Map<string, InformeDia[]>();
    for (const d of g.dias) {
      const s = d.sitio ?? 'Sin sitio';
      porSitio.set(s, [...(porSitio.get(s) ?? []), d]);
    }
    for (const [s, ds] of porSitio) {
      const x = sitios.get(s) ?? { guardias: new Set<number>(), resumen: vacio() };
      x.guardias.add(g.id);
      x.resumen = sumarResumen(x.resumen, resumirDias(ds));
      sitios.set(s, x);
    }
  }

  return {
    tipo: e.tipo,
    desde: e.desde,
    hasta: e.hasta,
    alcance: e.alcance,
    guardias: visibles,
    porSitio: [...sitios.entries()]
      .map(([sitio, x]) => ({ sitio, guardias: x.guardias.size, resumen: x.resumen }))
      .sort((a, b) => a.sitio.localeCompare(b.sitio, 'es')),
    resumen: visibles.reduce((t, g) => sumarResumen(t, g.resumen), vacio()),
    hechos: hechos(
      e.eventos.filter((v) => visibles.some((g) => g.id === v.usuarioId)),
      e,
    ),
    criterios: CRITERIOS_INFORME,
  };
}
