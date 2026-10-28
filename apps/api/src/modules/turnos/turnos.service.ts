import {
  horaLegible,
  textoDias,
  type EliminarTurnoData,
  type TurnoCatalogo,
  type TurnoData,
  type UsoTurno,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, hoyISO, type AccionCtx } from '../../core';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { Alcance } from '../sitios/alcance';
import type { TurnosRepository, UsoDetalle } from './turnos.repository';

const nombreRepetido = () =>
  HttpError.conflict('Ya existe un turno con ese nombre', [
    { path: 'nombre', message: 'Ya existe un turno con ese nombre' },
  ]);

/** "12 h · entrada 8:00 a.m. (todos los días)" */
export const horarioTexto = (t: { horas: number; horaEntrada: string; dias: TurnoData['dias'] }) =>
  `${t.horas} h · entrada ${horaLegible(t.horaEntrada)} (${textoDias(t.dias).toLowerCase()})`;

/**
 * Catálogo de turnos (DA-37). Editar el horario de un turno lo cambia en todas sus asignaciones
 * vigentes o programadas (de ahí en adelante: las marcas ya hechas guardan su copia) y avisa a sus
 * guardias. Borrarlo lo puede hacer el supervisor o el admin: sin asignaciones se borra directo; si está
 * asignado, por cada sitio activo hay que elegir el turno nuevo que lo reemplaza (los guardias pasan a ese
 * turno y se les avisa). Un supervisor solo cambia sus sitios.
 */
export class TurnosService extends BaseService {
  constructor(
    private readonly repo: TurnosRepository,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly hoy: () => string = () => hoyISO(),
    private readonly bitacora: RegistrarBitacora = sinBitacora,
  ) {
    super();
  }

  listar() {
    return this.repo.listar(this.hoy());
  }

  async getById(id: number): Promise<TurnoCatalogo> {
    const t = await this.repo.findById(id, this.hoy());
    if (!t) throw HttpError.notFound('Turno no encontrado');
    return t;
  }

  async crear(data: TurnoData, ctx: AccionCtx): Promise<TurnoCatalogo> {
    if (await this.repo.nombreOcupado(data.nombre)) throw nombreRepetido();
    const id = await this.repo.crear(data);
    await this.audit.registrarAccion(ctx, 'turnos.crear', 'turnos', id, { ...data });
    return this.getById(id);
  }

  async actualizar(id: number, data: TurnoData, ctx: AccionCtx): Promise<TurnoCatalogo> {
    const actual = await this.getById(id);
    if (data.nombre !== actual.nombre && (await this.repo.nombreOcupado(data.nombre, id))) {
      throw nombreRepetido();
    }
    const antes = {
      nombre: actual.nombre,
      horas: actual.horas,
      horaEntrada: actual.horaEntrada,
      dias: actual.dias,
    };
    const cambiaHorario =
      data.horas !== actual.horas ||
      data.horaEntrada !== actual.horaEntrada ||
      JSON.stringify(data.dias) !== JSON.stringify(actual.dias);
    if (!cambiaHorario && data.nombre === actual.nombre) return actual;
    await this.repo.actualizar(id, data);

    if (cambiaHorario) {
      const hoy = this.hoy();
      const usos = await this.repo.usos(id, hoy);
      await this.repo.copiarHorario(id, hoy, data);
      // Un aviso por guardia y sitio con su nuevo horario.
      const porSitio = new Map<string, Set<number>>();
      for (const u of usos) {
        const ids = porSitio.get(u.sitio) ?? new Set<number>();
        for (const g of u.usuarioId ? [u.usuarioId] : u.integrantes) ids.add(g);
        porSitio.set(u.sitio, ids);
      }
      for (const [sitio, ids] of porSitio) {
        await this.bitacora({
          usuarioIds: [...ids],
          tipo: 'asignacion_cambio',
          detalle: `Nuevo horario en ${sitio} (cambió el turno "${actual.nombre}"): ${horarioTexto(data)}`,
          actorId: ctx.actorId,
        });
        await this.avisar([...ids], {
          tipo: 'asignacion',
          titulo: 'Cambió tu horario',
          mensaje: `Cambió tu horario en ${sitio}: ${horarioTexto(data)}`,
          ruta: '/',
        });
      }
    }
    await this.audit.registrarAccion(ctx, 'turnos.editar', 'turnos', id, { antes, despues: data });
    return this.getById(id);
  }

  /** Se desactiva solo si nadie lo usa (vigente o programado). */
  async darDeBaja(id: number, ctx: AccionCtx) {
    const t = await this.getById(id);
    if (!t.activo) return;
    if (t.enUso > 0) {
      throw HttpError.conflict(
        `El turno está asignado ${t.enUso === 1 ? 'una vez' : `${t.enUso} veces`}. Quítalo de los sitios primero.`,
      );
    }
    await this.repo.setActivo(id, false);
    await this.audit.registrarAccion(ctx, 'turnos.baja', 'turnos', id, { nombre: t.nombre });
  }

  async reactivar(id: number, ctx: AccionCtx) {
    const t = await this.getById(id);
    if (t.activo) return;
    await this.repo.setActivo(id, true);
    await this.audit.registrarAccion(ctx, 'turnos.reactivar', 'turnos', id, { nombre: t.nombre });
  }

  /** Agrupa las asignaciones por sitio. */
  private porSitio(usos: UsoDetalle[], alcance: Alcance | null) {
    const mapa = new Map<number, { uso: UsoDetalle; asignados: string[]; guardias: Set<number> }>();
    for (const u of usos) {
      const g = mapa.get(u.sitio.id) ?? { uso: u, asignados: [], guardias: new Set<number>() };
      if (!g.asignados.includes(u.asignado)) g.asignados.push(u.asignado);
      for (const id of u.usuarioId ? [u.usuarioId] : u.integrantes) g.guardias.add(id);
      mapa.set(u.sitio.id, g);
    }
    return [...mapa.values()].map((g) => ({
      ...g,
      propio: !alcance || alcance.sitioIds.has(g.uso.sitio.id),
    }));
  }

  /** A dónde está asignado el turno y si quien consulta puede borrarlo (para avisarle antes de borrar). */
  async uso(id: number, alcance: Alcance | null): Promise<UsoTurno> {
    const t = await this.getById(id);
    const sitios = this.porSitio(await this.repo.usosDetalle(id, this.hoy()), alcance);
    const ajenos = sitios.filter((s) => s.uso.activo && !s.propio);
    return {
      turno: { id: t.id, nombre: t.nombre },
      sitios: sitios.map((s) => ({
        sitio: { id: s.uso.sitio.id, nombre: s.uso.sitio.nombre },
        activo: s.uso.activo,
        propio: s.propio,
        asignados: s.asignados,
      })),
      puedeBorrar: ajenos.length === 0,
      motivo: ajenos.length
        ? `Lo usan sitios de otro supervisor (${ajenos.map((s) => s.uso.sitio.nombre).join(', ')}). Pídele al admin que lo borre.`
        : null,
    };
  }

  /**
   * Borra el turno. Sin asignaciones se borra directo. Si está asignado, por cada sitio activo que lo usa
   * hay que elegir el turno nuevo que lo reemplaza: los guardias pasan a ese turno y se les avisa. Los
   * sitios dados de baja no necesitan reemplazo (sus asignaciones conservan su copia del horario).
   */
  async eliminar(id: number, input: EliminarTurnoData, ctx: AccionCtx, alcance: Alcance | null) {
    const t = await this.getById(id);
    const hoy = this.hoy();
    const sitios = this.porSitio(await this.repo.usosDetalle(id, hoy), alcance);
    const activos = sitios.filter((s) => s.uso.activo);

    const ajenos = activos.filter((s) => !s.propio);
    if (ajenos.length) {
      throw HttpError.forbidden(
        `Lo usan sitios de otro supervisor (${ajenos.map((s) => s.uso.sitio.nombre).join(', ')}). Pídele al admin que lo borre.`,
      );
    }
    const faltan = activos.filter((s) => !input.reemplazos.some((r) => r.sitioId === s.uso.sitio.id));
    if (faltan.length) {
      throw HttpError.conflict(
        `Elige el turno nuevo de ${faltan.map((s) => s.uso.sitio.nombre).join(', ')} antes de borrar "${t.nombre}"`,
        faltan.map((s) => ({ path: `reemplazo.${s.uso.sitio.id}`, message: `Elige un turno para ${s.uso.sitio.nombre}` })),
      );
    }
    // Los reemplazos tienen que existir, estar activos y no ser el mismo turno.
    const nuevos = new Map<number, TurnoCatalogo>();
    for (const s of activos) {
      const turnoId = input.reemplazos.find((r) => r.sitioId === s.uso.sitio.id)!.turnoId;
      const nuevo = turnoId === id ? null : await this.repo.findById(turnoId, hoy);
      if (!nuevo || !nuevo.activo) {
        throw HttpError.badRequest(`El turno nuevo de ${s.uso.sitio.nombre} no es válido`, [
          { path: `reemplazo.${s.uso.sitio.id}`, message: 'Elige otro turno activo' },
        ]);
      }
      nuevos.set(s.uso.sitio.id, nuevo);
    }

    for (const s of activos) {
      const nuevo = nuevos.get(s.uso.sitio.id)!;
      await this.repo.reasignar(id, hoy, s.uso.sitio.id, nuevo);
      const ids = [...s.guardias];
      if (ids.length) {
        await this.bitacora({
          usuarioIds: ids,
          tipo: 'asignacion_cambio',
          detalle: `Cambió su turno en ${s.uso.sitio.nombre}: se eliminó "${t.nombre}" y ahora es "${nuevo.nombre}" (${horarioTexto(nuevo)})`,
          sitioId: s.uso.sitio.id,
          actorId: ctx.actorId,
        });
        await this.avisar(ids, {
          tipo: 'asignacion',
          titulo: 'Cambió tu turno',
          mensaje: `Cambió tu turno en ${s.uso.sitio.nombre}: ahora es "${nuevo.nombre}" (${horarioTexto(nuevo)})`,
          ruta: '/',
        });
      }
    }
    await this.repo.eliminar(id);
    await this.audit.registrarAccion(ctx, 'turnos.eliminar', 'turnos', id, {
      nombre: t.nombre,
      horas: t.horas,
      horaEntrada: t.horaEntrada,
      dias: t.dias,
      asignacionesQueLoUsaban: t.enUso,
      reemplazos: activos.map((s) => ({ sitio: s.uso.sitio.nombre, turno: nuevos.get(s.uso.sitio.id)!.nombre })),
      sitiosDeBaja: sitios.filter((s) => !s.uso.activo).map((s) => s.uso.sitio.nombre),
    });
  }
}
