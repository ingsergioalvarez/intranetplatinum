import {
  HORAS_RECONSULTA_CASO,
  duracionPatronMin,
  sumarDiasFecha,
  type CasoCobertura,
  type CasosCoberturaLista,
  type CoberturaCreada,
  type CoberturaData,
  type EstadoCaso,
  type ResolverCasoData,
  type VistaPreviaCaso,
  type VistaPreviaCasoQuery,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, hoyISO, type AccionCtx } from '../../core';
import { horaLocal } from '../asistencia/formato';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import type { TurnosFn } from '../coberturas/coberturas.service';
import type { Alcance } from '../sitios/alcance';
import type { Candidato, CasoRow, CasosCoberturaRepository } from './casos.repository';
import { aTramo, planearSiguiente } from './plan';

const MIN = 60_000;
const HORA = 3_600_000;
const RUTA = '/asistencia/casos';
/** Si no se sabe de quién es el turno que se queda sin cubrir, se asume uno igual al del guardia. */
const TURNO_SUPUESTO_HORAS = 12;

/** Crea una cobertura (la del módulo de coberturas): se usa para mandar a alguien a cubrir. */
export type CubrirFn = (data: CoberturaData, ctx: AccionCtx, alcance: Alcance | null) => Promise<CoberturaCreada>;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
/** `el 29 oct a las 8:00 p.m.` */
const cuando = (d: Date) => `el ${fechaCorta(hoyISO(undefined, d))} a las ${horaLocal(d)}`;
const duracion = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

const noEncontrado = () => HttpError.notFound('Caso no encontrado');

interface Relevo {
  id: number;
  nombre: string;
  inicio: Date;
  fin: Date;
  horas: number;
}

/**
 * Casos de cobertura (AS6-05, AS6-06, DA-56): un guardia sigue en el sitio porque su relevo no llega
 * (o porque dijo que sigue en turno). El supervisor deja el plan completo desde el inicio: si el
 * relevo viene en camino, si no llegará (el guardia cubre ese turno) o si manda a otro; y, si el
 * guardia cubre, qué pasa con su siguiente turno (lo trabaja normal o descansa según su patrón) y
 * quién cubre el hueco. Todo queda en la auditoría, en la bitácora y con avisos.
 */
export class CasosCoberturaService extends BaseService {
  constructor(
    private readonly repo: CasosCoberturaRepository,
    private readonly turnos: TurnosFn,
    private readonly cubrir: CubrirFn,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly bitacora: RegistrarBitacora = sinBitacora,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  private enAlcance(c: Candidato, alcance: Alcance | null) {
    return !alcance || alcance.sitioIds.has(c.entrada.sitio.id) || alcance.guardiaIds.has(c.entrada.usuarioId);
  }

  private async cargar(entradaId: number, alcance: Alcance | null) {
    const c = await this.repo.candidato(entradaId);
    if (!c || !this.enAlcance(c, alcance)) throw noEncontrado();
    return c;
  }

  /** Cuánto dura el turno del guardia (para suponer el del relevo si no se sabe). */
  private turnoMs(c: Candidato) {
    const { programadaEntrada: e, programadaSalida: s } = c.entrada;
    return e && s && s.getTime() > e.getTime() ? s.getTime() - e.getTime() : TURNO_SUPUESTO_HORAS * HORA;
  }

  /** Quién no llegó y el turno que debía cubrir. */
  private async relevoDe(c: Candidato): Promise<Relevo | null> {
    const salida = c.entrada.programadaSalida;
    if (!salida) return null;
    const r = await this.repo.relevoDe(c.entrada.sitio.id, salida, c.entrada.usuarioId);
    if (!r) return null;
    // Duración del turno del relevo: la de su asignación; si no se encuentra, la del guardia.
    const fecha = hoyISO(undefined, r.inicio);
    const propios = (await this.turnos(fecha, fecha)).filter(
      (t) => t.guardia.id === r.id && t.sitio.id === c.entrada.sitio.id && !!t.patron.horaInicio,
    );
    const dur = propios.map((t) => duracionPatronMin(t.patron)).find((d): d is number => !!d);
    const ms = dur ? dur * MIN : this.turnoMs(c);
    return { id: r.id, nombre: r.nombre, inicio: r.inicio, fin: new Date(r.inicio.getTime() + ms), horas: Math.round((ms / HORA) * 10) / 10 };
  }

  /** Hasta cuándo cubre: el fin del turno del relevo, o uno del largo del suyo desde su hora de salida. */
  private finCubierto(c: Candidato, relevo: Relevo | null, elegido: Date | null = null) {
    if (elegido) return elegido;
    if (relevo) return relevo.fin;
    const salida = c.entrada.programadaSalida ?? this.ahora();
    return new Date(salida.getTime() + this.turnoMs(c));
  }

  /** La hora hasta la que se queda debe ser futura y estar dentro de un día después de su salida. */
  private validarLimite(c: Candidato, relevo: Relevo | null, elegido: Date | null) {
    const fin = this.finCubierto(c, relevo, elegido);
    const salida = c.entrada.programadaSalida ?? c.horaExtra.desde;
    const error = (message: string) => HttpError.badRequest('Datos inválidos', [{ path: 'finCubierto', message }]);
    if (fin.getTime() <= this.ahora().getTime()) {
      throw error(
        elegido
          ? 'Esa hora ya pasó: elige una que aún no llegue'
          : `La hora que corresponde (${horaLocal(fin)}) ya pasó: indica hasta qué hora se queda`,
      );
    }
    if (fin.getTime() <= salida.getTime()) throw error('Debe ser después de su hora de salida');
    if (fin.getTime() - salida.getTime() > 24 * HORA) throw error('Máximo 24 h después de su hora de salida');
  }

  private estadoDe(c: Candidato): EstadoCaso {
    if (!c.caso) return 'nuevo';
    return c.caso.estado === 'resuelto' ? 'resuelto' : 'en_espera';
  }

  private async aCaso(c: Candidato): Promise<CasoCobertura> {
    const relevo = await this.relevoDe(c);
    return {
      entradaId: c.entrada.id,
      estado: this.estadoDe(c),
      guardia: { id: c.entrada.usuarioId, nombre: c.entrada.guardia },
      sitio: { id: c.entrada.sitio.id, nombre: c.entrada.sitio.nombre },
      desde: (c.entrada.programadaSalida ?? c.horaExtra.desde).toISOString(),
      horaExtra: { id: c.horaExtra.id, estado: c.horaExtra.estado },
      relevo: relevo && {
        id: relevo.id,
        nombre: relevo.nombre,
        inicio: relevo.inicio.toISOString(),
        fin: relevo.fin.toISOString(),
        horas: relevo.horas,
      },
      decision: c.caso?.decision ?? null,
      siguiente: c.caso?.siguiente ?? null,
      regresaEn: c.caso?.regresaEn?.toISOString() ?? null,
      nota: c.caso?.nota ?? null,
    };
  }

  // ---------- Admin y supervisor ----------

  async listar(alcance: Alcance | null): Promise<CasosCoberturaLista> {
    const candidatos = (await this.repo.candidatos()).filter((c) => this.enAlcance(c, alcance));
    const items = await Promise.all(candidatos.map((c) => this.aCaso(c)));
    // Primero los que esperan una decisión.
    const orden = { nuevo: 0, en_espera: 1, resuelto: 2 };
    items.sort((a, b) => orden[a.estado] - orden[b.estado] || a.desde.localeCompare(b.desde));
    return { items, pendientes: items.filter((i) => i.estado !== 'resuelto').length };
  }

  /** Lo que pasaría con su siguiente turno y su descanso, para que el supervisor lo vea antes de confirmar. */
  async vistaPrevia(entradaId: number, q: VistaPreviaCasoQuery, alcance: Alcance | null): Promise<VistaPreviaCaso> {
    const c = await this.cargar(entradaId, alcance);
    return this.calcularPlan(c, await this.relevoDe(c), q.descansoExtraHoras, q.finCubierto ? new Date(q.finCubierto) : null);
  }

  private async calcularPlan(c: Candidato, relevo: Relevo | null, descansoExtraHoras: number, elegido: Date | null = null) {
    const fin = this.finCubierto(c, relevo, elegido);
    const ref = hoyISO(undefined, fin);
    const todos = await this.turnos(sumarDiasFecha(ref, -8), sumarDiasFecha(ref, 21));
    return planearSiguiente({
      turnos: todos.filter((t) => t.guardia.id === c.entrada.usuarioId),
      entrada: c.entrada.registradaEn,
      salidaProgramada: c.entrada.programadaSalida ?? c.horaExtra.desde,
      finCubierto: fin,
      descansoExtraHoras,
    });
  }

  async resolver(entradaId: number, input: ResolverCasoData, ctx: AccionCtx, alcance: Alcance | null) {
    const c = await this.cargar(entradaId, alcance);
    if (c.caso?.estado === 'resuelto') throw HttpError.conflict('Este caso ya tiene un plan');
    if (c.horaExtra.estado !== 'abierta') throw HttpError.conflict('El guardia ya terminó sus horas extra');
    const relevo = await this.relevoDe(c);
    const elegido = input.finCubierto ? new Date(input.finCubierto) : null;
    if (input.decision === 'no_llegara') this.validarLimite(c, relevo, elegido);
    const nota = input.nota?.trim() || null;
    const { sitio } = c.entrada;
    const base = {
      relevoId: relevo?.id ?? null,
      relevoInicio: relevo?.inicio ?? null,
      descansoExtraHoras: 0,
      siguiente: null,
      finCubierto: null,
      regresaEn: null,
      limiteExtra: null,
      coberturaId: null,
      resueltoPorId: ctx.actorId,
      reconsultarEn: null,
      nota,
    };
    let caso: CasoRow;
    let detalle: string;
    let paraGuardia: string;
    const advertencias: string[] = [];

    if (input.decision === 'en_camino') {
      const aviso = relevo ? `${relevo.nombre} viene en camino` : 'su relevo viene en camino';
      caso = await this.repo.guardarCaso(c.entrada, {
        ...base,
        estado: 'en_espera',
        decision: 'en_camino',
        reconsultarEn: new Date(this.ahora().getTime() + HORAS_RECONSULTA_CASO * HORA),
      });
      detalle = `El supervisor indicó que ${aviso}; ${c.entrada.guardia} sigue en ${sitio.nombre} mientras llega`;
      paraGuardia = `Tu supervisor sabe que sigues en ${sitio.nombre}: ${aviso}. Quédate en tu puesto; si pasan ${HORAS_RECONSULTA_CASO} h te avisamos del plan`;
    } else if (input.decision === 'otro_cubre') {
      const cubridor = await this.repo.guardia(input.cubridorId!);
      if (!cubridor) throw HttpError.badRequest('Elige un guardia activo');
      const tramo = relevo
        ? aTramo(relevo.inicio, relevo.fin)
        : aTramo(c.entrada.programadaSalida ?? this.ahora(), this.finCubierto(c, null));
      const { cobertura } = await this.cubrir(
        {
          usuarioId: cubridor.id,
          sitioId: sitio.id,
          desde: tramo.fecha,
          horaInicio: tramo.horaInicio,
          horas: tramo.horas,
          motivo: relevo ? `Cubre a ${relevo.nombre} (no se presentó)` : `Cubre el turno que deja ${c.entrada.guardia}`,
          ...(relevo ? { cubreAId: relevo.id } : {}),
        },
        ctx,
        alcance,
      );
      caso = await this.repo.guardarCaso(c.entrada, {
        ...base,
        estado: 'resuelto',
        decision: 'otro_cubre',
        coberturaId: cobertura.id,
      });
      detalle = `El supervisor mandó a ${cubridor.nombre} a cubrir ${sitio.nombre} (${horaLocal(tramo.inicio)}); ${c.entrada.guardia} entrega y marca su salida`;
      paraGuardia = `${cubridor.nombre} llega a cubrir ${sitio.nombre} a las ${horaLocal(tramo.inicio)}; entrégale el puesto y marca tu salida`;
    } else {
      const extra = input.descansoExtraHoras;
      const vista = await this.calcularPlan(c, relevo, input.siguiente === 'descansa' ? extra : 0, elegido);
      const fin = new Date(vista.finCubierto);
      let regresaEn: Date | null = null;
      let coberturaId: number | null = null;
      if (input.siguiente === 'descansa') {
        // 1) Quien cubre el hueco y, si regresa a la mitad de un turno, su propia entrada tarde: primero
        // las coberturas, porque pueden fallar (conflictos) y entonces no se toca nada más.
        if (vista.huecos.length && input.cubridorId) {
          const cubridor = await this.repo.guardia(input.cubridorId);
          if (!cubridor) throw HttpError.badRequest('Elige un guardia activo');
          for (const h of vista.huecos) {
            const { cobertura } = await this.cubrir(
              {
                usuarioId: cubridor.id,
                sitioId: sitio.id,
                desde: h.fecha,
                horaInicio: h.horaInicio,
                horas: h.horas,
                motivo: `Cubre el descanso de ${c.entrada.guardia} (cubrió un turno de más)`,
                cubreAId: c.entrada.usuarioId,
              },
              ctx,
              alcance,
            );
            coberturaId ??= cobertura.id;
          }
        }
        if (vista.entraTarde) {
          await this.cubrir(
            {
              usuarioId: c.entrada.usuarioId,
              sitioId: sitio.id,
              desde: vista.entraTarde.fecha,
              horaInicio: vista.entraTarde.horaInicio,
              horas: vista.entraTarde.horas,
              motivo: 'Regresa de su descanso (plan de cobertura)',
            },
            ctx,
            alcance,
          );
        }
        regresaEn = vista.vuelveA ? new Date(vista.vuelveA) : null;
      }
      caso = await this.repo.guardarCaso(c.entrada, {
        ...base,
        estado: 'resuelto',
        decision: 'no_llegara',
        siguiente: input.siguiente!,
        descansoExtraHoras: input.siguiente === 'descansa' ? extra : 0,
        finCubierto: fin,
        regresaEn,
        limiteExtra: input.siguiente === 'normal' && vista.limiteExtra ? new Date(vista.limiteExtra) : null,
        coberturaId,
      });
      if (input.siguiente === 'descansa') {
        // 2) Los turnos que se salta quedan en pausa (sin falta ni retardo).
        await this.repo.crearPausas(
          caso.id,
          c.entrada.usuarioId,
          [...vista.huecos.map((h) => h.fecha), ...(vista.entraTarde ? [vista.entraTarde.fecha] : [])],
        );
      }
      const quien = relevo ? `el turno de ${relevo.nombre}` : 'ese turno';
      if (input.siguiente === 'normal') {
        detalle = `El supervisor confirmó que ${c.entrada.guardia} cubre ${quien} hasta las ${horaLocal(fin)} en ${sitio.nombre} y trabaja normal su siguiente turno${vista.limiteExtra ? ` (${cuando(new Date(vista.limiteExtra))})` : ''}`;
        paraGuardia = `Tu supervisor confirmó el plan: cubres ${quien} en ${sitio.nombre} hasta las ${horaLocal(fin)}; a esa hora marca tu salida${vista.limiteExtra ? `. Tu siguiente turno empieza ${cuando(new Date(vista.limiteExtra))} y lo trabajas normal: marca tu salida y luego tu entrada` : ''}`;
      } else {
        const vuelve = regresaEn ? `te presentas ${cuando(regresaEn)}` : 'no tienes turno próximo';
        detalle = `El supervisor confirmó que ${c.entrada.guardia} cubre ${quien} hasta las ${horaLocal(fin)} en ${sitio.nombre} y descansa${extra ? ` (${extra} h más que su patrón)` : ''}; regresa ${regresaEn ? cuando(regresaEn) : 'sin turno próximo'}${vista.huecos.length && !input.cubridorId ? '. Queda un turno sin cubrir' : ''}`;
        paraGuardia = `Tu supervisor confirmó el plan: cubres ${quien} en ${sitio.nombre} hasta las ${horaLocal(fin)}; a esa hora marca tu salida. Después descansas y ${vuelve}`;
      }
      // Cansancio: si descansa, solo importa lo que ya lleva al cubrir ese turno.
      advertencias.push(...vista.advertencias.filter((a) => input.siguiente === 'normal' || a.startsWith('Para cubrir')));
    }

    await this.audit.registrarAccion(ctx, 'casos_cobertura.resolver', 'casos_cobertura', caso.id, {
      guardiaId: c.entrada.usuarioId,
      sitio: sitio.nombre,
      decision: input.decision,
      siguiente: input.siguiente ?? null,
      descansoExtraHoras: input.descansoExtraHoras,
      cubridorId: input.cubridorId ?? null,
      nota,
    });
    await this.bitacora({
      usuarioIds: [c.entrada.usuarioId],
      tipo: 'cobertura',
      detalle: `${detalle}${nota ? `. Nota: ${nota}` : ''}`,
      datos: { casoId: caso.id, decision: input.decision },
      sitioId: sitio.id,
      actorId: ctx.actorId,
    });
    await this.avisar([c.entrada.usuarioId], { tipo: 'cobertura', mensaje: paraGuardia, ruta: '/marcar' });
    // Quien no es el supervisor del sitio (p. ej. un admin) deja constancia para él.
    if (sitio.supervisorId && sitio.supervisorId !== ctx.actorId) {
      await this.avisar([sitio.supervisorId], { tipo: 'cobertura', mensaje: `${sitio.nombre}: ${detalle}`, ruta: RUTA });
    }
    if (advertencias.length) {
      await this.avisar(await this.repo.revisoresDe(sitio.id), {
        tipo: 'cobertura',
        mensaje: `${c.entrada.guardia} · ${sitio.nombre}: ${advertencias[0]}`,
        ruta: RUTA,
      });
    }
    return this.aCaso({ ...c, caso });
  }

  // ---------- Guardia ----------

  /** El guardia avisa que no puede quedarse: el supervisor decide quién cubre. */
  async noPuedoQuedarme(usuarioId: number) {
    const c = await this.repo.candidatoDe(usuarioId);
    if (!c) throw HttpError.conflict('No tienes horas extra abiertas');
    const { sitio, guardia } = c.entrada;
    await this.bitacora({
      usuarioIds: [usuarioId],
      tipo: 'cobertura',
      detalle: `Avisó que no puede quedarse en ${sitio.nombre}: el supervisor debe mandar a otro guardia`,
      datos: { entradaId: c.entrada.id },
      sitioId: sitio.id,
      actorId: usuarioId,
    });
    await this.avisar(await this.repo.revisoresDe(sitio.id), {
      tipo: 'cobertura',
      mensaje: `${guardia} · ${sitio.nombre}: avisó que no puede quedarse. Manda a otro guardia a cubrir`,
      ruta: RUTA,
    });
    return { ok: true };
  }

  // ---------- Vigilancia del servidor (cada minuto) ----------

  async revisar() {
    const ahora = this.ahora();

    // 1. Un guardia sigue en el sitio y su relevo no llegó (o dijo que sigue en turno): se avisa una vez.
    for (const c of await this.repo.candidatos()) {
      if (c.caso) continue;
      try {
        const relevo = await this.relevoDe(c);
        if (!relevo && c.horaExtra.origen !== 'guardia_extiende') continue;
        if (!(await this.repo.marcarEnviado(`caso:${c.entrada.id}`))) continue;
        const { sitio, guardia, usuarioId } = c.entrada;
        await this.avisar(await this.repo.revisoresDe(sitio.id), {
          tipo: 'cobertura',
          mensaje: relevo
            ? `${sitio.nombre}: ${relevo.nombre} no llegó (le tocaba a las ${horaLocal(relevo.inicio)}) y ${guardia} sigue en el sitio. Define el plan`
            : `${sitio.nombre}: ${guardia} sigue en el sitio después de su hora. Define el plan`,
          ruta: RUTA,
        });
        await this.avisar([usuarioId], {
          tipo: 'cobertura',
          mensaje: `Tu supervisor ya sabe que sigues en ${sitio.nombre}. Quédate en tu puesto mientras define el plan`,
          ruta: '/marcar',
        });
      } catch (err) {
        console.error('[casos cobertura] No se pudo avisar del caso', c.entrada.id, err);
      }
    }

    // 1b. Pasó la hora hasta la que se podía quedar y sigue en el sitio: se le dice que marque su salida.
    for (const c of await this.repo.candidatos()) {
      const fin = c.caso?.estado === 'resuelto' && c.caso.decision === 'no_llegara' ? c.caso.finCubierto : null;
      if (!fin || fin.getTime() > ahora.getTime()) continue;
      try {
        if (!(await this.repo.marcarEnviado(`caso-limite:${c.entrada.id}`))) continue;
        const { sitio, guardia, usuarioId } = c.entrada;
        await this.avisar([usuarioId], {
          tipo: 'cobertura',
          mensaje: `Ya pasó tu hora autorizada en ${sitio.nombre} (${horaLocal(fin)}). Marca tu salida y retírate; lo que pase de esa hora lo revisa tu supervisor`,
          ruta: '/marcar',
        });
        await this.avisar(await this.repo.revisoresDe(sitio.id), {
          tipo: 'cobertura',
          mensaje: `${guardia} · ${sitio.nombre}: pasó la hora que autorizaste (${horaLocal(fin)}) y sigue en el sitio. Las horas después de esa hora quedarán por aprobar`,
          ruta: RUTA,
        });
      } catch (err) {
        console.error('[casos cobertura] No se pudo avisar de la hora límite', c.entrada.id, err);
      }
    }

    // 2. "Viene en camino" y no llegó: se vuelve a preguntar.
    for (const c of await this.repo.paraReconsultar(ahora)) {
      if (!c.caso) continue;
      const esperando = Math.floor((ahora.getTime() - (c.entrada.programadaSalida ?? c.horaExtra.desde).getTime()) / MIN);
      await this.avisar(await this.repo.revisoresDe(c.entrada.sitio.id), {
        tipo: 'cobertura',
        mensaje: `${c.entrada.guardia} · ${c.entrada.sitio.nombre}: lleva ${duracion(Math.max(esperando, 0))} de más esperando a su relevo. Define qué hacer`,
        ruta: RUTA,
      });
      await this.repo.actualizarCaso(c.caso.id, {
        reconsultarEn: new Date(ahora.getTime() + HORAS_RECONSULTA_CASO * HORA),
      });
    }
  }
}
