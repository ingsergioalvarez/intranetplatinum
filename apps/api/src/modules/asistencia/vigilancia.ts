import {
  horaLegible,
  sumarDiasFecha,
  trabajaEl,
  type PatronTurno,
  type TipoEventoBitacora,
} from '@platinum/shared';
import { hoyISO, inicioDelDia } from '../../core';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { DestinoRevision } from './asistencia.repository';

/** Un guardia con un turno asignado en un sitio (directo o por su grupo). */
export interface TurnoProgramado {
  /** Asignación del turno; null si es una cobertura. */
  asignacionId: number | null;
  /** Cobertura de otro sitio (DA-39). */
  coberturaId?: number;
  sitio: { id: number; nombre: string };
  guardia: { id: number; nombre: string };
  patron: PatronTurno;
  /** Días en que el guardia cubre otro sitio: su turno normal queda en pausa (sin faltas). */
  pausas?: { desde: string; hasta: string }[];
}

export interface TurnoDiaRow {
  id: number;
  usuarioId: number;
  sitioId: number;
  programadaEntrada: Date;
  avisoGuardiaEn: Date | null;
  noSePresentoEn: Date | null;
  faltaEn: Date | null;
  faltaEventoId: number | null;
  entradaId: number | null;
}

export interface EventoVigilancia {
  usuarioId: number;
  tipo: TipoEventoBitacora;
  detalle: string;
  sitioId: number;
  ocurrioEn: Date;
  datos?: Record<string, string | number | boolean | null>;
}

/** Datos para vigilar los turnos sin entrada (DA-45). */
export abstract class VigilanciaRepository {
  /** Asignaciones con hora de entrada vigentes en algún día del rango, una por guardia. */
  abstract turnosVigentes(desde: string, hasta: string): Promise<TurnoProgramado[]>;
  /** ¿Checó entrada entre esos instantes? */
  abstract huboEntrada(usuarioId: number, desde: Date, hasta: Date): Promise<boolean>;
  abstract findTurnoDia(usuarioId: number, programadaEntrada: Date): Promise<TurnoDiaRow | null>;
  abstract crearTurnoDia(data: {
    usuarioId: number;
    sitioId: number;
    asignacionId: number | null;
    programadaEntrada: Date;
  }): Promise<TurnoDiaRow>;
  abstract actualizarTurnoDia(id: number, data: Partial<Omit<TurnoDiaRow, 'id'>>): Promise<void>;
  /** Turnos del guardia que siguen sin entrada desde ese instante (para ligarles su llegada). */
  abstract sinEntrada(usuarioId: number, desde: Date): Promise<(TurnoDiaRow & { sitio: string })[]>;
  /** Guarda el evento en la bitácora y devuelve su id. */
  abstract crearEvento(evento: EventoVigilancia): Promise<number>;
  /** Agrega datos al evento (p. ej. la hora de llegada a una falta). */
  abstract completarEvento(
    id: number,
    datos: Record<string, string | number | boolean | null>,
  ): Promise<void>;
  /** A quién avisar (supervisor del sitio; sin supervisor, el admin). */
  abstract revisoresDe(destino: DestinoRevision): Promise<number[]>;
  /**
   * ¿Estaba trabajando en ese instante? Una jornada que empezó antes y no se cerró, o que se cerró después
   * de ese instante (se quedó en horas extra): su turno siguiente no es falta ni retardo (AS6-07).
   */
  async trabajandoEn(_usuarioId: number, _instante: Date): Promise<boolean> {
    return false;
  }
}

/** Aviso al guardia sin entrada (DA-45). */
export const MIN_AVISO_GUARDIA = 5;
/** Aviso al supervisor: tolerancia (10) + 5 de margen (DA-38). */
export const MIN_NO_SE_PRESENTO = 15;
/** Sin entrada a las 2 h: falta (DA-38). */
export const MIN_FALTA = 120;
/** Después de la falta ya no hay nada que revisar del turno. */
const VENTANA_MIN = MIN_FALTA + 30;
/** Una entrada hasta 3 h antes de la hora cuenta para el turno (llegó temprano). */
const ANTES_MS = 3 * 3_600_000;

const minutosDe = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** `25 min`, `1 h 05 min` */
const duracionTexto = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

/**
 * Vigila los turnos que empiezan sin entrada (DA-38, DA-45). Corre cada minuto:
 * - 5 min sin entrada: aviso al guardia.
 * - 15 min: aviso al supervisor "no se presentó" y queda en la bitácora.
 * - 2 h: falta en la bitácora (sin aviso).
 * Si el guardia checa después de la falta, el supervisor recibe "llegó tarde" para decidir.
 */
export class VigilanciaTurnos {
  constructor(
    private readonly repo: VigilanciaRepository,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async revisar() {
    const ahora = this.ahora();
    const hoy = hoyISO(undefined, ahora);
    const ayer = sumarDiasFecha(hoy, -1);
    const turnos = await this.repo.turnosVigentes(ayer, hoy);
    for (const t of turnos) {
      for (const fecha of [ayer, hoy]) {
        if (!t.patron.horaInicio || !trabajaEl(fecha, t.patron)) continue;
        if (!t.coberturaId && t.pausas?.some((p) => fecha >= p.desde && fecha <= p.hasta)) continue;
        const programada = new Date(inicioDelDia(fecha).getTime() + minutosDe(t.patron.horaInicio) * 60_000);
        const min = Math.floor((ahora.getTime() - programada.getTime()) / 60_000);
        if (min < MIN_AVISO_GUARDIA || min > VENTANA_MIN) continue;
        try {
          await this.revisarTurno(t, programada, min, ahora);
        } catch (err) {
          console.error('[vigilancia] No se pudo revisar el turno', t.guardia.id, err);
        }
      }
    }
  }

  private async revisarTurno(t: TurnoProgramado, programada: Date, min: number, ahora: Date) {
    const existente = await this.repo.findTurnoDia(t.guardia.id, programada);
    if (existente?.faltaEn || existente?.entradaId) return;
    if (await this.repo.huboEntrada(t.guardia.id, new Date(programada.getTime() - ANTES_MS), ahora)) return;
    // Sigue en la jornada anterior (horas extra): su turno empezó con él en el sitio.
    if (await this.repo.trabajandoEn(t.guardia.id, programada)) return;
    const fila =
      existente ??
      (await this.repo.crearTurnoDia({
        usuarioId: t.guardia.id,
        sitioId: t.sitio.id,
        asignacionId: t.asignacionId,
        programadaEntrada: programada,
      }));
    const hora = horaLegible(t.patron.horaInicio!);

    if (!fila.avisoGuardiaEn) {
      await this.avisar([t.guardia.id], {
        tipo: 'retardo',
        titulo: 'Aún no checas tu entrada',
        mensaje: `Tu turno en ${t.sitio.nombre} empezó a las ${hora} y aún no checas tu entrada`,
        ruta: '/marcar',
      });
      await this.repo.actualizarTurnoDia(fila.id, { avisoGuardiaEn: ahora });
    }
    if (min >= MIN_NO_SE_PRESENTO && !fila.noSePresentoEn) {
      const ruta = `/asistencia/guardias/${t.guardia.id}?vista=bitacora&cat=incidencias`;
      await this.avisar(await this.repo.revisoresDe({ sitioId: t.sitio.id, guardiaId: t.guardia.id }), {
        tipo: 'retardo',
        titulo: 'No se presentó a su turno',
        mensaje: `${t.guardia.nombre} · ${t.sitio.nombre}: no se presentó a su turno de las ${hora} (pasaron ${MIN_NO_SE_PRESENTO} min)`,
        ruta,
      });
      await this.repo.crearEvento({
        usuarioId: t.guardia.id,
        tipo: 'no_se_presento',
        detalle: `No se presentó a su turno de las ${hora} en ${t.sitio.nombre} (${MIN_NO_SE_PRESENTO} min sin entrada)`,
        sitioId: t.sitio.id,
        ocurrioEn: new Date(programada.getTime() + MIN_NO_SE_PRESENTO * 60_000),
      });
      await this.repo.actualizarTurnoDia(fila.id, { noSePresentoEn: ahora });
    }
    if (min >= MIN_FALTA && !fila.faltaEn) {
      const eventoId = await this.repo.crearEvento({
        usuarioId: t.guardia.id,
        tipo: 'falta',
        detalle: `Faltó a su turno de las ${hora} en ${t.sitio.nombre} (2 h sin entrada)`,
        sitioId: t.sitio.id,
        ocurrioEn: new Date(programada.getTime() + MIN_FALTA * 60_000),
        datos: { programada: programada.toISOString() },
      });
      await this.repo.actualizarTurnoDia(fila.id, { faltaEn: ahora, faltaEventoId: eventoId });
    }
  }

  /**
   * El guardia checó entrada: se liga a sus turnos sin entrada de las últimas horas. Si ya tenía
   * falta, el supervisor recibe "llegó tarde" para aceptar la asistencia o dejar la falta.
   */
  async alLlegar(usuarioId: number, guardia: string, entrada: { id: number; registradaEn: Date }) {
    const filas = await this.repo.sinEntrada(
      usuarioId,
      new Date(entrada.registradaEn.getTime() - 26 * 3_600_000),
    );
    for (const f of filas) {
      await this.repo.actualizarTurnoDia(f.id, { entradaId: entrada.id });
      if (!f.faltaEn || !f.faltaEventoId) continue;
      const tarde = Math.round((entrada.registradaEn.getTime() - f.programadaEntrada.getTime()) / 60_000);
      await this.repo.completarEvento(f.faltaEventoId, {
        llegoEn: entrada.registradaEn.toISOString(),
        retardoMin: tarde,
      });
      await this.avisar(await this.repo.revisoresDe({ sitioId: f.sitioId, guardiaId: usuarioId }), {
        tipo: 'retardo',
        titulo: 'Llegó tarde con falta: ¿aceptas?',
        mensaje: `${guardia} · ${f.sitio}: llegó ${duracionTexto(tarde)} tarde (tenía falta). ¿Aceptas la asistencia?`,
        ruta: `/asistencia/guardias/${usuarioId}?vista=bitacora&cat=incidencias`,
      });
    }
  }
}
