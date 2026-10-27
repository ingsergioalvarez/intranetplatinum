import {
  HORAS_ESCALAR_EXTRA,
  HORAS_PREGUNTA_EXTRA,
  JORNADA_MAX_HORAS,
  ROLES,
  TOLERANCIA_EXTRA_MIN,
  distanciaMetros,
  duracionExtra,
  trabajaEl,
  type CapturaHoraExtraInput,
  type CortarHoraExtraInput,
  type EstadoHoraExtra,
  type ExtenderHorarioInput,
  type HoraExtra,
  type HoraExtraGuardia,
  type HorasExtraPagina,
  type HorasExtraQuery,
  type OpcionesHorasExtra,
  type ReporteHorasExtra,
  type ReporteHorasExtraQuery,
  type ResolverHoraExtraInput,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseService,
  HttpError,
  hoyISO,
  inicioDelDia,
  type AccionCtx,
} from '../../core';
import type { MarcacionRow } from '../asistencia/asistencia.repository';
import type { MisSitiosFn } from '../asistencia/asistencia.service';
import { horaLocal } from '../asistencia/formato';
import type { TurnosFn } from '../coberturas/coberturas.service';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import type { Alcance } from '../sitios/alcance';
import type {
  CambiosHoraExtra,
  EntradaExtra,
  HoraExtraRow,
  HorasExtraRepository,
  SitioExtra,
} from './horasExtra.repository';
import type { HorasExtraPuerto } from './puerto';

const MIN = 60_000;
const HORA = 3_600_000;
/** Pendientes de decisión: lo que cuenta el contador del supervisor. */
const PENDIENTES: EstadoHoraExtra[] = ['por_aprobar', 'abierta', 'sin_salida'];
const RUTA = '/asistencia/horas-extra';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
const minutosEntre = (desde: Date, hasta: Date) => Math.floor((hasta.getTime() - desde.getTime()) / MIN);
const distanciaTexto = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

const noEncontrada = () => HttpError.notFound('Horas extra no encontradas');

/**
 * Horas extra (AS5, DA-55). Nacen solas (salida tarde, jornada sin salida, descanso trabajado) o las
 * pide el guardia o las captura el supervisor; ninguna cuenta hasta que un supervisor o admin la
 * aprueba. Cada paso queda en la auditoría, en la bitácora del guardia y avisa en la campanita.
 */
export class HorasExtraService extends BaseService implements HorasExtraPuerto {
  constructor(
    private readonly repo: HorasExtraRepository,
    private readonly turnos: TurnosFn,
    private readonly misSitios: MisSitiosFn,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly bitacora: RegistrarBitacora = sinBitacora,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  private aHora(r: HoraExtraRow): HoraExtra {
    return {
      id: r.id,
      guardia: r.guardia,
      sitio: { id: r.sitio.id, nombre: r.sitio.nombre },
      fecha: r.fecha,
      desde: r.desde.toISOString(),
      hasta: r.hasta?.toISOString() ?? null,
      minutos: r.minutos,
      origen: r.origen,
      estado: r.estado,
      motivo: r.motivo,
      resolucion: r.resueltoEn
        ? { por: r.resueltoPor, en: r.resueltoEn.toISOString(), nota: r.notaResolucion }
        : null,
      creadaEn: r.createdAt.toISOString(),
    };
  }

  private alcanceDe(alcance: Alcance | null) {
    return alcance
      ? { sitioIds: [...alcance.sitioIds], guardiaIds: [...alcance.guardiaIds] }
      : undefined;
  }

  private enAlcance(r: { sitio: { id: number }; guardia: { id: number } }, alcance: Alcance | null) {
    return !alcance || alcance.sitioIds.has(r.sitio.id) || alcance.guardiaIds.has(r.guardia.id);
  }

  /** Quien decide: el supervisor del sitio o, si no tiene, los admins. */
  private async revisores(sitio: SitioExtra) {
    return sitio.supervisorId ? [sitio.supervisorId] : await this.repo.admins();
  }

  private async cargar(id: number, alcance: Alcance | null) {
    const r = await this.repo.findById(id);
    if (!r || !this.enAlcance(r, alcance)) throw noEncontrada();
    return r;
  }

  /** Aviso en la campanita y renglón en la bitácora del guardia. */
  private async registrar(
    r: { id: number; guardia: { id: number }; sitio: { id: number } },
    detalle: string,
    datos: Record<string, string | number | boolean | null>,
    actorId: number | null = null,
  ) {
    await this.bitacora({
      usuarioIds: [r.guardia.id],
      tipo: 'horas_extra',
      detalle,
      datos: { horaExtraId: r.id, ...datos },
      sitioId: r.sitio.id,
      actorId,
    });
  }

  private async avisarPorAprobar(r: HoraExtraRow) {
    const t = r.minutos ? duracionExtra(r.minutos) : 'horas extra';
    await this.avisar(await this.revisores(r.sitio), {
      tipo: 'horas_extra',
      mensaje: `${r.guardia.nombre} · ${r.sitio.nombre}: ${t} de horas extra por aprobar (${fechaCorta(r.fecha)})`,
      ruta: RUTA,
    });
  }

  // ---------- Admin y supervisor ----------

  async opciones(alcance: Alcance | null): Promise<OpcionesHorasExtra> {
    const [guardias, sitios] = await Promise.all([this.repo.guardiasActivos(), this.repo.sitiosActivos()]);
    return {
      guardias: guardias.filter((g) => !alcance || alcance.guardiaIds.has(g.id)),
      sitios: sitios.filter((s) => !alcance || alcance.sitioIds.has(s.id)),
    };
  }

  async listar(q: HorasExtraQuery, alcance: Alcance | null): Promise<HorasExtraPagina> {
    const estados = q.estado === 'pendientes' ? PENDIENTES : q.estado ? [q.estado] : undefined;
    const filtro = { alcance: this.alcanceDe(alcance) };
    const [{ items, total }, pendientes] = await Promise.all([
      this.repo.listar({
        ...filtro,
        estados,
        guardiaId: q.guardiaId,
        desde: q.desde,
        hasta: q.hasta,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.repo.pendientes(filtro.alcance),
    ]);
    return { items: items.map((r) => this.aHora(r)), total, page: q.page, limit: q.limit, pendientes };
  }

  async resolver(id: number, input: ResolverHoraExtraInput, ctx: AccionCtx, alcance: Alcance | null) {
    const r = await this.cargar(id, alcance);
    const aprueba = input.decision === 'aprobar';
    if (aprueba && r.estado !== 'por_aprobar') {
      throw HttpError.conflict('Solo se aprueban las horas extra que ya terminaron');
    }
    if (!aprueba && !PENDIENTES.includes(r.estado)) throw HttpError.conflict('Estas horas extra ya se resolvieron');

    const nota = input.nota?.trim() || null;
    const nueva = await this.repo.actualizar(id, {
      estado: aprueba ? 'aprobada' : 'rechazada',
      resueltoPorId: ctx.actorId,
      resueltoEn: this.ahora(),
      notaResolucion: nota,
    });
    const t = r.minutos ? duracionExtra(r.minutos) : 'sin salida';
    await this.audit.registrarAccion(ctx, aprueba ? 'horas_extra.aprobar' : 'horas_extra.rechazar', 'horas_extra', id, {
      guardiaId: r.guardia.id,
      sitio: r.sitio.nombre,
      fecha: r.fecha,
      minutos: r.minutos,
      nota,
    });
    await this.registrar(
      r,
      `${aprueba ? 'Aprobó' : 'Rechazó'} las horas extra del ${fechaCorta(r.fecha)} en ${r.sitio.nombre} (${t})${nota ? `. Motivo: ${nota}` : ''}`,
      { decision: input.decision, minutos: r.minutos },
      ctx.actorId,
    );
    await this.avisar([r.guardia.id], {
      tipo: 'horas_extra',
      mensaje: aprueba
        ? `Tus horas extra del ${fechaCorta(r.fecha)} en ${r.sitio.nombre} (${t}) fueron aprobadas`
        : `Tus horas extra del ${fechaCorta(r.fecha)} en ${r.sitio.nombre} fueron rechazadas${nota ? `: ${nota}` : ''}`,
      ruta: '/marcar',
    });
    return this.aHora(nueva);
  }

  /** Fija la hora en que terminaron; quedan por aprobar. */
  async cortar(id: number, input: CortarHoraExtraInput, ctx: AccionCtx, alcance: Alcance | null) {
    const r = await this.cargar(id, alcance);
    if (!['abierta', 'sin_salida', 'por_aprobar'].includes(r.estado)) {
      throw HttpError.conflict('Estas horas extra ya se resolvieron');
    }
    const hasta = new Date(input.hasta);
    const ahora = this.ahora();
    const campo = (message: string) =>
      new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [{ path: 'hasta', message }]);
    if (hasta.getTime() <= r.desde.getTime()) throw campo('Debe ser después de que empezaron las horas extra');
    if (hasta.getTime() > ahora.getTime() + MIN) throw campo('No puede ser en el futuro');
    if (hasta.getTime() - r.desde.getTime() > JORNADA_MAX_HORAS * HORA) throw campo('Es demasiado tiempo');
    if (await this.repo.solapa(r.guardia.id, r.desde, hasta, r.id)) {
      throw HttpError.conflict('Se empalma con otras horas extra del guardia');
    }
    const minutos = minutosEntre(r.desde, hasta);
    const nueva = await this.repo.actualizar(id, { hasta, minutos, estado: 'por_aprobar' });
    await this.audit.registrarAccion(ctx, 'horas_extra.cortar', 'horas_extra', id, {
      guardiaId: r.guardia.id,
      hasta: hasta.toISOString(),
      minutos,
      nota: input.nota,
    });
    await this.registrar(
      r,
      `Fijó el fin de las horas extra del ${fechaCorta(r.fecha)} en ${r.sitio.nombre} a las ${horaLocal(hasta)} (${duracionExtra(minutos)}). Motivo: ${input.nota}`,
      { minutos },
      ctx.actorId,
    );
    return this.aHora(nueva);
  }

  /** Horas extra que el supervisor o el admin capturan: quedan aprobadas, con motivo. */
  async capturar(input: CapturaHoraExtraInput, ctx: AccionCtx, alcance: Alcance | null) {
    const guardia = await this.repo.findGuardia(input.guardiaId);
    if (!guardia || !guardia.activo || guardia.rol !== ROLES.GUARDIA) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [
        { path: 'guardiaId', message: 'Elige un guardia activo' },
      ]);
    }
    const hoy = hoyISO(undefined, this.ahora());
    const campo = (path: string, message: string) =>
      new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [{ path, message }]);
    if (input.fecha > hoy) throw campo('fecha', 'No puede ser un día futuro');

    const minutosDe = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
    const base = inicioDelDia(input.fecha).getTime();
    const desde = new Date(base + minutosDe(input.desde) * MIN);
    let hasta = new Date(base + minutosDe(input.hasta) * MIN);
    if (hasta.getTime() <= desde.getTime()) hasta = new Date(hasta.getTime() + 24 * HORA);
    if (hasta.getTime() > this.ahora().getTime() + MIN) throw campo('hasta', 'No puede ser en el futuro');

    const sitioId =
      input.sitioId ?? (await this.misSitios(guardia.id, input.fecha)).find((m) => m.sitio)?.sitio.id;
    if (!sitioId) throw campo('sitioId', 'El guardia no tiene un sitio ese día. Elige el sitio.');
    if (alcance && !alcance.sitioIds.has(sitioId) && !alcance.guardiaIds.has(guardia.id)) throw noEncontrada();
    if (await this.repo.solapa(guardia.id, desde, hasta)) {
      throw HttpError.conflict('Se empalma con otras horas extra del guardia');
    }

    const minutos = minutosEntre(desde, hasta);
    const creada = await this.repo.crear({
      usuarioId: guardia.id,
      sitioId,
      entradaId: null,
      fecha: input.fecha,
      desde,
      hasta,
      minutos,
      origen: 'captura_supervisor',
      estado: 'aprobada',
      motivo: input.motivo,
      resueltoPorId: ctx.actorId,
      resueltoEn: this.ahora(),
    });
    await this.audit.registrarAccion(ctx, 'horas_extra.capturar', 'horas_extra', creada.id, {
      guardiaId: guardia.id,
      sitio: creada.sitio.nombre,
      fecha: input.fecha,
      minutos,
      motivo: input.motivo,
    });
    await this.registrar(
      creada,
      `Capturó ${duracionExtra(minutos)} de horas extra del ${fechaCorta(input.fecha)} en ${creada.sitio.nombre} (${horaLocal(desde)} a ${horaLocal(hasta)}). Motivo: ${input.motivo}`,
      { minutos },
      ctx.actorId,
    );
    await this.avisar([guardia.id], {
      tipo: 'horas_extra',
      mensaje: `Se registraron ${duracionExtra(minutos)} de horas extra tuyas del ${fechaCorta(input.fecha)} en ${creada.sitio.nombre}`,
      ruta: '/marcar',
    });
    return this.aHora(creada);
  }

  async reporte(q: ReporteHorasExtraQuery, alcance: Alcance | null): Promise<ReporteHorasExtra> {
    if (q.hasta < q.desde) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [
        { path: 'hasta', message: 'Debe ser igual o posterior a la fecha inicial' },
      ]);
    }
    const { items } = await this.repo.listar({
      alcance: this.alcanceDe(alcance),
      guardiaId: q.guardiaId,
      desde: q.desde,
      hasta: q.hasta,
    });
    const porGuardia = new Map<number, ReporteHorasExtra['guardias'][number]>();
    for (const r of [...items].sort((a, b) => a.desde.getTime() - b.desde.getTime())) {
      const g = porGuardia.get(r.guardia.id) ?? {
        guardia: r.guardia,
        aprobadasMin: 0,
        pendientesMin: 0,
        registros: [],
      };
      if (r.estado === 'aprobada') g.aprobadasMin += r.minutos ?? 0;
      if (r.estado === 'por_aprobar') g.pendientesMin += r.minutos ?? 0;
      g.registros.push(this.aHora(r));
      porGuardia.set(r.guardia.id, g);
    }
    const guardias = [...porGuardia.values()].sort((a, b) => a.guardia.nombre.localeCompare(b.guardia.nombre, 'es'));
    return {
      desde: q.desde,
      hasta: q.hasta,
      guardias,
      aprobadasMin: guardias.reduce((s, g) => s + g.aprobadasMin, 0),
      pendientesMin: guardias.reduce((s, g) => s + g.pendientesMin, 0),
    };
  }

  // ---------- Guardia ----------

  /** El guardia dice que sigue en turno: se abre la solicitud y se avisa al supervisor. */
  async extender(usuarioId: number, input: ExtenderHorarioInput) {
    const entrada = await this.repo.ultimaEntrada(usuarioId);
    if (!entrada?.sitio || !entrada.programadaSalida) {
      throw HttpError.conflict('No tienes una jornada que extender');
    }
    const ahora = this.ahora();
    if (ahora.getTime() - entrada.registradaEn.getTime() >= JORNADA_MAX_HORAS * HORA) {
      throw HttpError.conflict('Tu jornada ya terminó');
    }
    const fin = entrada.programadaSalida;
    if (ahora.getTime() < fin.getTime()) throw HttpError.conflict('Tu turno aún no termina');

    const previa = await this.repo.porEntrada(entrada.id);
    if (previa && !(previa.origen === 'jornada_abierta' && previa.estado === 'abierta')) {
      throw HttpError.conflict('Ya hay horas extra registradas en esta jornada');
    }
    const salida = await this.repo.salidaDe(entrada.id);
    if (salida) {
      // Ya marcó su salida: para seguir contando tiene que seguir en el sitio.
      const coords = await this.repo.coordenadasSitio(entrada.sitio.id);
      if (coords) {
        if (input.lat === undefined || input.lng === undefined) throw HttpError.badRequest('Falta tu ubicación');
        const d = distanciaMetros({ lat: input.lat, lng: input.lng }, coords);
        if (d > coords.radioM) {
          throw new HttpError(
            409,
            'FUERA_DE_RANGO',
            `Estás a ${distanciaTexto(d)} de ${entrada.sitio.nombre}. Solo puedes extender tu horario dentro del sitio.`,
            { distanciaM: d, radioM: coords.radioM },
          );
        }
      }
    }
    const desde = salida && salida.getTime() > fin.getTime() ? salida : fin;
    const fila = previa
      ? await this.repo.actualizar(previa.id, { origen: 'guardia_extiende' })
      : await this.repo.crear({
          usuarioId,
          sitioId: entrada.sitio.id,
          entradaId: entrada.id,
          fecha: this.fechaDe(entrada),
          desde,
          hasta: null,
          minutos: null,
          origen: 'guardia_extiende',
          estado: 'abierta',
        });
    await this.audit.registrar({
      usuarioId,
      accion: 'horas_extra.extender',
      entidad: 'horas_extra',
      entidadId: fila.id,
      datos: { sitio: entrada.sitio.nombre, desde: desde.toISOString() },
    });
    await this.registrar(
      fila,
      `Pidió extender su horario en ${entrada.sitio.nombre} desde las ${horaLocal(desde)}`,
      { desde: desde.toISOString() },
    );
    await this.avisar(await this.revisores(entrada.sitio), {
      tipo: 'horas_extra',
      mensaje: `${entrada.guardia} · ${entrada.sitio.nombre}: pidió extender su horario desde las ${horaLocal(desde)}`,
      ruta: RUTA,
    });
    return { id: fila.id, estado: fila.estado, desde: fila.desde.toISOString(), hasta: null, minutos: null };
  }

  // ---------- Puerto de la asistencia ----------

  async paraGuardia(entrada: MarcacionRow, salida: MarcacionRow | null): Promise<HoraExtraGuardia | null> {
    const fin = entrada.programadaSalida;
    if (!fin) return null;
    const rec = await this.repo.porEntrada(entrada.id);
    const ahora = this.ahora().getTime();
    const base = salida && salida.registradaEn.getTime() > fin.getTime() ? salida.registradaEn : fin;
    const pasado = ahora >= base.getTime() + TOLERANCIA_EXTRA_MIN * MIN;
    const enVentana = ahora < base.getTime() + HORAS_PREGUNTA_EXTRA * HORA;
    // Ya contestó (o ya hay horas extra de otro origen): no se le vuelve a preguntar.
    const sinResponder = !rec || (rec.origen === 'jornada_abierta' && rec.estado === 'abierta');
    return {
      entradaId: entrada.id,
      finProgramado: fin.toISOString(),
      solicitud: rec
        ? {
            estado: rec.estado,
            desde: rec.desde.toISOString(),
            hasta: rec.hasta?.toISOString() ?? null,
            minutos: rec.minutos,
          }
        : null,
      preguntar: pasado && enVentana && sinResponder,
      requiereUbicacion: !!salida,
    };
  }

  async puedeSalidaFinal(entradaId: number) {
    const rec = await this.repo.porEntrada(entradaId);
    if (rec?.estado !== 'abierta' || rec.origen !== 'guardia_extiende') return false;
    return (await this.repo.salidaDe(entradaId)) !== null;
  }

  async alSalir({
    entrada,
    salida,
  }: {
    entrada: MarcacionRow;
    salida: { registradaEn: Date; final: boolean; porSupervisor: boolean };
  }) {
    const info = await this.repo.findEntrada(entrada.id);
    if (!info?.sitio) return;
    const hora = salida.registradaEn;
    const prog = entrada.programadaSalida;
    const rec = await this.repo.porEntrada(entrada.id);
    const descanso = await this.esDescanso(info);

    if (rec) {
      if (rec.estado !== 'abierta' && rec.estado !== 'sin_salida') return;
      const desde = descanso ? entrada.registradaEn : rec.desde;
      const hasta = hora.getTime() < desde.getTime() ? desde : hora;
      const minutos = minutosEntre(desde, hasta);
      const sinExtra = !descanso && (minutos <= 0 || (rec.origen === 'jornada_abierta' && minutos <= TOLERANCIA_EXTRA_MIN));
      if (sinExtra) {
        await this.repo.eliminar(rec.id);
        return;
      }
      const cambios: CambiosHoraExtra = {
        desde,
        hasta,
        minutos,
        estado: 'por_aprobar',
        origen: descanso ? 'cobertura_descanso' : rec.origen === 'jornada_abierta' ? 'salida_tardia' : rec.origen,
      };
      const nueva = await this.repo.actualizar(rec.id, cambios);
      await this.registrar(
        nueva,
        `Terminó sus horas extra en ${nueva.sitio.nombre}: ${duracionExtra(minutos)} por aprobar (${horaLocal(desde)} a ${horaLocal(hasta)})`,
        { minutos },
      );
      await this.avisarPorAprobar(nueva);
      return;
    }

    let desde: Date | null = null;
    let origen: 'cobertura_descanso' | 'salida_tardia' | null = null;
    if (descanso) {
      desde = entrada.registradaEn;
      origen = 'cobertura_descanso';
    } else if (!salida.porSupervisor && !salida.final && prog && minutosEntre(prog, hora) > TOLERANCIA_EXTRA_MIN) {
      desde = prog;
      origen = 'salida_tardia';
    }
    if (!desde || !origen) return;
    const minutos = minutosEntre(desde, hora);
    if (minutos <= 0) return;
    const creada = await this.repo.crear({
      usuarioId: entrada.usuarioId,
      sitioId: info.sitio.id,
      entradaId: entrada.id,
      fecha: this.fechaDe(info),
      desde,
      hasta: hora,
      minutos,
      origen,
      estado: 'por_aprobar',
    });
    await this.registrar(
      creada,
      origen === 'cobertura_descanso'
        ? `Trabajó en su día de descanso en ${creada.sitio.nombre}: ${duracionExtra(minutos)} por aprobar`
        : `Marcó su salida ${duracionExtra(minutos)} después de su hora en ${creada.sitio.nombre}: horas extra por aprobar`,
      { minutos, origen },
    );
    await this.avisarPorAprobar(creada);
  }

  // ---------- Vigilancia del servidor (cada minuto) ----------

  async revisar() {
    const ahora = this.ahora();

    // 1. Pasó su hora de salida + tolerancia y no ha marcado salida: se abre el registro y se avisa.
    const sinSalida = await this.repo.jornadasSinSalida(
      new Date(ahora.getTime() - TOLERANCIA_EXTRA_MIN * MIN),
      new Date(ahora.getTime() - JORNADA_MAX_HORAS * HORA),
    );
    for (const e of sinSalida) {
      try {
        await this.abrirPorFaltaDeSalida(e);
      } catch (err) {
        console.error('[horas extra] No se pudo abrir el registro de la jornada', e.id, err);
      }
    }

    // 2. Jornadas que se pasaron del límite sin que el guardia marcara su salida final.
    for (const r of await this.repo.abiertas()) {
      const entrada = r.entradaId ? await this.repo.findEntrada(r.entradaId) : null;
      if (!entrada || ahora.getTime() - entrada.registradaEn.getTime() < JORNADA_MAX_HORAS * HORA) continue;
      const nueva = await this.repo.actualizar(r.id, { estado: 'sin_salida' });
      await this.registrar(
        nueva,
        `Horas extra sin salida en ${nueva.sitio.nombre}: el guardia no marcó su salida; el supervisor define las horas`,
        {},
      );
      await this.avisar(await this.revisores(nueva.sitio), {
        tipo: 'horas_extra',
        mensaje: `${nueva.guardia.nombre} · ${nueva.sitio.nombre}: horas extra sin salida del ${fechaCorta(nueva.fecha)}. Fija la hora en que terminó`,
        ruta: RUTA,
      });
    }

    // 3. El supervisor no responde: el aviso sube a los admins.
    const antes = new Date(ahora.getTime() - HORAS_ESCALAR_EXTRA * HORA);
    for (const r of await this.repo.sinResponder(antes)) {
      await this.avisar(await this.repo.admins(), {
        tipo: 'horas_extra',
        mensaje: `${r.guardia.nombre} · ${r.sitio.nombre}: horas extra del ${fechaCorta(r.fecha)} llevan más de ${HORAS_ESCALAR_EXTRA} h sin respuesta`,
        ruta: RUTA,
      });
      await this.repo.actualizar(r.id, { escaladaEn: ahora });
    }
  }

  private async abrirPorFaltaDeSalida(e: EntradaExtra) {
    if (!e.sitio || !e.programadaSalida) return;
    const fila = await this.repo.crear({
      usuarioId: e.usuarioId,
      sitioId: e.sitio.id,
      entradaId: e.id,
      fecha: this.fechaDe(e),
      desde: e.programadaSalida,
      hasta: null,
      minutos: null,
      origen: 'jornada_abierta',
      estado: 'abierta',
    });
    const hora = horaLocal(e.programadaSalida);
    await this.registrar(
      fila,
      `Pasó su hora de salida (${hora}) en ${e.sitio.nombre} y no ha marcado su salida`,
      { salidaProgramada: e.programadaSalida.toISOString() },
    );
    await this.avisar(await this.revisores(e.sitio), {
      tipo: 'horas_extra',
      mensaje: `${e.guardia} · ${e.sitio.nombre}: no ha marcado su salida (le tocaba a las ${hora})`,
      ruta: RUTA,
    });
    await this.avisar([e.usuarioId], {
      tipo: 'horas_extra',
      mensaje: `Ya pasó tu hora de salida en ${e.sitio.nombre} (${hora}). Marca tu salida o avisa que sigues en turno`,
      ruta: '/marcar',
    });
  }

  // ---------- Apoyo ----------

  /** Día de la jornada (zona del negocio). */
  private fechaDe(e: { programadaEntrada: Date | null; registradaEn: Date }) {
    return hoyISO(undefined, e.programadaEntrada ?? e.registradaEn);
  }

  /**
   * ¿Trabajó en un día que no le tocaba (su descanso)? Un descanso movido con un cambio de turno
   * aprobado no cuenta. Sin turno propio (solo coberturas) no se puede saber, así que no.
   */
  private async esDescanso(e: EntradaExtra) {
    const fecha = this.fechaDe(e);
    if (await this.repo.descansoMovidoA(e.usuarioId, fecha)) return false;
    const propios = (await this.turnos(fecha, fecha)).filter(
      (t) => t.guardia.id === e.usuarioId && !t.coberturaId && !!t.patron.horaInicio,
    );
    if (propios.length === 0) return false;
    return !propios.some((t) => trabajaEl(fecha, t.patron));
  }
}
