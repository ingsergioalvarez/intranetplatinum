import {
  MEDIDA_LABEL,
  MOTIVO_FALTA_LABEL,
  MOTIVO_JUSTIFICAR_LABEL,
  TIPOS_INCIDENCIA,
  TIPOS_JUSTIFICABLES,
  TIPO_EVENTO_BITACORA_LABEL,
  claseIncidencia,
  incidenciaCuenta,
  incidenciaPendiente,
  textoMotivoLista,
  type ConfirmarFaltaInput,
  type DecisionFalta,
  type EventoBitacora,
  type IncidenciasDeGuardia,
  type IncidenciasMesQuery,
  type JustificarBitacoraInput,
  type MedidaDisciplinaria,
  type Paginated,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, firmarArchivo, inicioDelDia, type AccionCtx } from '../../core';
import { exigirGuardia, guardiaEnAlcance, type Alcance } from '../sitios/alcance';
import { sinMedidas, type MedidasPuerto } from '../medidas/medidas';
import type { BitacoraRepository, EventoBitacoraRow } from './bitacora.repository';

/** Inicio del mes `AAAA-MM` y del siguiente (zona del negocio). */
function rangoDelMes(mes: string): [Date, Date] {
  const [a, m] = mes.split('-').map(Number);
  const siguiente = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
  return [inicioDelDia(`${mes}-01`), inicioDelDia(`${siguiente}-01`)];
}

const aEvento = (r: EventoBitacoraRow): EventoBitacora => ({
  id: r.id,
  guardia: { id: r.guardia.id, nombre: r.guardia.nombre },
  tipo: r.tipo,
  ocurrioEn: r.ocurrioEn.toISOString(),
  detalle: r.detalle,
  datos: (r.datos as Record<string, unknown> | null) ?? null,
  sitio: r.sitio,
  actor: r.actor,
  foto: r.incidencia ? firmarArchivo(r.incidencia.fotoClave) : r.fotoMarca && firmarArchivo(r.fotoMarca),
  marcacionId: r.marcacionId,
  incidencia: r.incidencia && {
    id: r.incidencia.id,
    motivo: r.incidencia.motivo,
    revisadaPor: r.incidencia.revisadaPor,
    revisadaEn: r.incidencia.revisadaEn?.toISOString() ?? null,
    conclusion: r.incidencia.conclusion,
    nota: r.incidencia.nota,
  },
  decision: r.decision && {
    tipo: r.decision,
    por: r.decididoPor,
    en: r.decididoEn!.toISOString(),
    motivo: r.decisionMotivo,
  },
  justificacion: r.justificadoEn && {
    motivo: r.justificacion!,
    por: r.justificadoPor,
    en: r.justificadoEn.toISOString(),
  },
  comentarios: r.comentarios.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
});

/**
 * Bitácora del guardia (DA-41): todo lo que le pasó, para control interno de supervisor y admin.
 * Pueden comentar cualquier evento y justificar los de asistencia (no cuentan en el resumen).
 */
export class BitacoraService extends BaseService {
  constructor(
    private readonly repo: BitacoraRepository,
    private readonly audit: AuditLogger,
    private readonly ahora: () => Date = () => new Date(),
    /** Medidas disciplinarias (A-48): historial formal del guardia. */
    private readonly medidas: MedidasPuerto = sinMedidas,
  ) {
    super();
  }

  /** Historial formal de medidas disciplinarias del guardia (A-48, A-49). */
  async medidasDelGuardia(usuarioId: number, alcance: Alcance | null = null): Promise<MedidaDisciplinaria[]> {
    exigirGuardia(alcance, usuarioId);
    if (!(await this.repo.existeGuardia(usuarioId))) throw HttpError.notFound('Guardia no encontrado');
    return this.medidas.delGuardia(usuarioId);
  }

  /** Eventos del mes `AAAA-MM` (zona del negocio), del más nuevo al más viejo. */
  async delGuardia(
    usuarioId: number,
    mes: string,
    alcance: Alcance | null = null,
  ): Promise<EventoBitacora[]> {
    exigirGuardia(alcance, usuarioId);
    if (!(await this.repo.existeGuardia(usuarioId))) throw HttpError.notFound('Guardia no encontrado');
    const rows = await this.repo.eventos(usuarioId, ...rangoDelMes(mes));
    return rows.map(aEvento);
  }

  /**
   * Incidencias del mes por guardia (DA-42): todos los guardias activos (y quien haya tenido alguna),
   * con cuántas de asistencia y de rostro tuvo (sin las justificadas) y cuántas faltan por atender.
   * Primero quien tiene pendientes.
   */
  async incidenciasPorGuardia(mes: string, alcance: Alcance | null = null): Promise<IncidenciasDeGuardia[]> {
    const [eventos, guardias] = await Promise.all([
      this.repo.eventosDeTodos(TIPOS_INCIDENCIA, ...rangoDelMes(mes)),
      this.repo.guardiasActivos(),
    ]);
    const nueva = (guardia: IncidenciasDeGuardia['guardia']) => ({
      guardia,
      asistencia: 0,
      rostro: 0,
      pendientes: 0,
    });
    const filas = new Map<number, IncidenciasDeGuardia>(
      guardias
        .filter((g) => guardiaEnAlcance(alcance, g.id))
        .map(({ fotoClave, ...g }) => [g.id, nueva({ ...g, foto: fotoClave && firmarArchivo(fotoClave) })]),
    );
    for (const r of eventos) {
      if (!guardiaEnAlcance(alcance, r.usuarioId)) continue;
      const fila = filas.get(r.usuarioId) ?? nueva({ ...r.guardia, foto: null });
      filas.set(r.usuarioId, fila);
      const e = aEvento(r);
      if (incidenciaCuenta(e)) fila[claseIncidencia(e.tipo)!]++;
      if (incidenciaPendiente(e)) fila.pendientes++;
    }
    return [...filas.values()].sort(
      (a, b) =>
        b.pendientes - a.pendientes ||
        b.asistencia + b.rostro - (a.asistencia + a.rostro) ||
        a.guardia.nombre.localeCompare(b.guardia.nombre, 'es'),
    );
  }

  /** Incidencias del mes de todos los guardias (lista general), con filtros. */
  async incidencias(
    { mes, clase, estado, q, page, limit }: IncidenciasMesQuery,
    alcance: Alcance | null = null,
  ): Promise<Paginated<EventoBitacora>> {
    const texto = q?.toLowerCase();
    const filas = (await this.repo.eventosDeTodos(TIPOS_INCIDENCIA, ...rangoDelMes(mes)))
      .filter((r) => guardiaEnAlcance(alcance, r.usuarioId))
      .filter(
        (r) =>
          !texto ||
          [r.guardia.nombre, r.guardia.email, r.sitio?.nombre].some((t) => t?.toLowerCase().includes(texto)),
      )
      .map(aEvento)
      .filter((e) => !clase || claseIncidencia(e.tipo) === clase)
      .filter((e) => !estado || incidenciaPendiente(e) === (estado === 'pendientes'));
    return { items: filas.slice((page - 1) * limit, page * limit), total: filas.length, page, limit };
  }

  private async evento(id: number, alcance: Alcance | null) {
    const e = await this.repo.findById(id);
    if (!e || !guardiaEnAlcance(alcance, e.usuarioId)) throw HttpError.notFound('Evento no encontrado');
    return e;
  }

  async comentar(
    id: number,
    texto: string,
    ctx: AccionCtx,
    alcance: Alcance | null = null,
  ): Promise<EventoBitacora> {
    const e = await this.evento(id, alcance);
    await this.repo.comentar(id, ctx.actorId, texto);
    await this.audit.registrarAccion(ctx, 'bitacora.comentar', 'bitacora_eventos', id, {
      guardiaId: e.usuarioId,
      texto,
    });
    return aEvento((await this.repo.findById(id))!);
  }

  async justificar(
    id: number,
    { categoria, nota }: JustificarBitacoraInput,
    ctx: AccionCtx,
    alcance: Alcance | null = null,
  ): Promise<EventoBitacora> {
    const e = await this.evento(id, alcance);
    const motivo = textoMotivoLista(MOTIVO_JUSTIFICAR_LABEL[categoria], nota);
    if (!TIPOS_JUSTIFICABLES.includes(e.tipo)) {
      throw HttpError.badRequest(`${TIPO_EVENTO_BITACORA_LABEL[e.tipo]} no se justifica`);
    }
    if (e.justificadoEn) throw HttpError.conflict('Ya está justificado');
    await this.repo.justificar(id, ctx.actorId, motivo, this.ahora());
    await this.audit.registrarAccion(ctx, 'bitacora.justificar', 'bitacora_eventos', id, {
      guardiaId: e.usuarioId,
      tipo: e.tipo,
      motivo,
    });
    return aEvento((await this.repo.findById(id))!);
  }

  /**
   * Confirmar una falta (A-48): lo contrario de justificarla. Vale para la falta sin llegada y para la
   * que el guardia cubrió tarde ("Dejar la falta"). Motivo obligatorio y medida disciplinaria opcional.
   */
  async confirmarFalta(
    id: number,
    { categoria, nota, medida }: ConfirmarFaltaInput,
    ctx: AccionCtx,
    alcance: Alcance | null = null,
  ): Promise<EventoBitacora> {
    let e = await this.evento(id, alcance);
    if (e.tipo !== 'falta' && e.tipo !== 'no_se_presento') {
      throw HttpError.badRequest('Solo se confirma una falta o un "No se presentó"');
    }
    if (e.justificadoEn) throw HttpError.conflict('Ya está justificado');
    if (e.decision) throw HttpError.conflict('Ya se decidió');
    // Sin esperar las 2 h: se crea la falta y la decisión se toma sobre ella.
    if (e.tipo === 'no_se_presento') {
      id = await this.repo.crearFaltaDesde(e, this.ahora());
      e = (await this.repo.findById(id))!;
    }
    const motivo = textoMotivoLista(MOTIVO_FALTA_LABEL[categoria], nota);
    await this.repo.decidir(id, ctx.actorId, 'falta', this.ahora(), motivo);
    await this.audit.registrarAccion(ctx, 'bitacora.confirmar_falta', 'bitacora_eventos', id, {
      guardiaId: e.usuarioId,
      motivo,
      medida: medida ?? 'ninguna',
    });
    if (medida && medida !== 'ninguna') {
      await this.medidas.aplicar({
        usuarioId: e.usuarioId,
        tipo: medida,
        origen: 'falta',
        motivo,
        eventoId: id,
        sitioId: e.sitio?.id ?? null,
        sitio: e.sitio?.nombre ?? null,
        actorId: ctx.actorId,
      });
      await this.audit.registrarAccion(ctx, 'bitacora.aplicar_medida', 'bitacora_eventos', id, {
        guardiaId: e.usuarioId,
        medida: MEDIDA_LABEL[medida],
      });
    }
    return aEvento((await this.repo.findById(id))!);
  }

  /**
   * Falta con llegada tarde (DA-45): el supervisor acepta la asistencia (la falta deja de contar; el
   * retardo se queda salvo que se justifique) o deja la falta. Una sola vez.
   */
  async decidir(
    id: number,
    decision: DecisionFalta,
    ctx: AccionCtx,
    alcance: Alcance | null = null,
  ): Promise<EventoBitacora> {
    const e = await this.evento(id, alcance);
    const datos = (e.datos ?? {}) as Record<string, unknown>;
    if (e.tipo !== 'falta' || !datos.llegoEn) {
      throw HttpError.badRequest('Solo se decide en una falta en la que el guardia llegó después');
    }
    if (e.decision) throw HttpError.conflict('Ya se decidió');
    await this.repo.decidir(id, ctx.actorId, decision, this.ahora());
    await this.audit.registrarAccion(ctx, 'bitacora.decidir_falta', 'bitacora_eventos', id, {
      guardiaId: e.usuarioId,
      decision,
    });
    return aEvento((await this.repo.findById(id))!);
  }
}
