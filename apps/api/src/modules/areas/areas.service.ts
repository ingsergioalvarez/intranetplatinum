import type {
  Area,
  AreaCreate,
  AreaFiltro,
  AreaUpdate,
  CandidatoArea,
  PersonaDeArea,
} from '@platinum/shared';
import { ROLES } from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, type AccionCtx } from '../../core';
import type { AreaFila, AreasRepository } from './areas.repository';

const clave = (texto: string) => texto.trim().toLocaleLowerCase('es');

/** Estructura de la empresa: áreas con subáreas, una por persona y su jefe (C-10). */
export class AreasService extends BaseService {
  constructor(
    private readonly repo: AreasRepository,
    private readonly audit: AuditLogger,
  ) {
    super();
  }

  /** Nombre completo de cada área ("RH / Nómina") y cuántas personas hay en ella y en sus subáreas. */
  private armar(filas: AreaFila[]): Map<number, Area> {
    const porId = new Map(filas.map((f) => [f.id, f]));
    const hijos = new Map<number | null, AreaFila[]>();
    for (const f of filas) hijos.set(f.padreId, [...(hijos.get(f.padreId) ?? []), f]);

    const ruta = (f: AreaFila): string => {
      const padre = f.padreId === null ? undefined : porId.get(f.padreId);
      return padre ? `${ruta(padre)} / ${f.nombre}` : f.nombre;
    };
    const total = (f: AreaFila): number =>
      f.personas + (hijos.get(f.id) ?? []).filter((h) => !h.deletedAt).reduce((n, h) => n + total(h), 0);

    return new Map(
      filas.map((f) => [
        f.id,
        {
          id: f.id,
          nombre: f.nombre,
          nombreCompleto: ruta(f),
          padreId: f.padreId,
          jefe: f.jefeId === null ? null : { id: f.jefeId, nombre: f.jefeNombre ?? '' },
          personas: f.personas,
          personasTotal: total(f),
          subareas: (hijos.get(f.id) ?? []).filter((h) => !h.deletedAt).length,
          deletedAt: f.deletedAt?.toISOString() ?? null,
        } satisfies Area,
      ]),
    );
  }

  async list({ estado }: AreaFiltro): Promise<Area[]> {
    const todas = [...this.armar(await this.repo.todas()).values()];
    const visibles = todas.filter((a) => (estado === 'todas' ? true : estado === 'bajas' ? !!a.deletedAt : !a.deletedAt));
    return visibles.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
  }

  private async cargar() {
    const filas = await this.repo.todas();
    return { filas, areas: this.armar(filas) };
  }

  private activa(areas: Map<number, Area>, id: number): Area {
    const a = areas.get(id);
    if (!a) throw HttpError.notFound('Área no encontrada');
    if (a.deletedAt) throw HttpError.conflict('El área está dada de baja; reactívala primero');
    return a;
  }

  /** Ids del área y de todas sus subáreas (a cualquier nivel). */
  private descendientes(filas: AreaFila[], id: number): number[] {
    const ids = [id];
    for (const f of filas) if (f.padreId === id) ids.push(...this.descendientes(filas, f.id));
    return ids;
  }

  /** No puede haber dos áreas con el mismo nombre dentro de la misma área superior. */
  private sinRepetir(filas: AreaFila[], nombre: string, padreId: number | null, ignorar?: number) {
    const repetida = filas.some(
      (f) => !f.deletedAt && f.id !== ignorar && f.padreId === padreId && clave(f.nombre) === clave(nombre),
    );
    if (repetida) throw HttpError.conflict('Ya existe un área con ese nombre en ese lugar', [{ path: 'nombre', message: 'Ya existe un área con ese nombre en ese lugar' }]);
  }

  async crear({ nombre, padreId, jefeId }: AreaCreate, ctx: AccionCtx): Promise<Area> {
    const { filas, areas } = await this.cargar();
    if (padreId) this.activa(areas, padreId);
    this.sinRepetir(filas, nombre, padreId ?? null);
    if (jefeId) await this.personaParaJefe(jefeId);
    const nueva = await this.repo.crear({ nombre: nombre.trim(), padreId: padreId ?? null });
    if (jefeId) await this.hacerJefe(nueva.id, jefeId, ctx);
    await this.registrar(ctx, 'areas.crear', nueva.id, { nombre: nueva.nombre, padreId: padreId ?? null, jefeId: jefeId ?? null });
    return this.getById(nueva.id);
  }

  async getById(id: number): Promise<Area> {
    const area = (await this.cargar()).areas.get(id);
    if (!area) throw HttpError.notFound('Área no encontrada');
    return area;
  }

  async actualizar(id: number, cambios: AreaUpdate, ctx: AccionCtx): Promise<Area> {
    const { filas, areas } = await this.cargar();
    const actual = this.activa(areas, id);
    const antes: Record<string, unknown> = {};
    const despues: Record<string, unknown> = {};
    const datos: { nombre?: string; padreId?: number | null } = {};

    const nombre = cambios.nombre?.trim();
    const padreId = cambios.padreId === undefined ? actual.padreId : cambios.padreId;

    if (cambios.padreId !== undefined && cambios.padreId !== actual.padreId) {
      if (cambios.padreId !== null) {
        this.activa(areas, cambios.padreId);
        if (this.descendientes(filas, id).includes(cambios.padreId)) {
          throw HttpError.conflict('Un área no puede quedar dentro de sus propias subáreas', [{ path: 'padreId', message: 'No puede quedar dentro de sus propias subáreas' }]);
        }
      }
      datos.padreId = cambios.padreId;
      antes.padreId = actual.padreId;
      despues.padreId = cambios.padreId;
    }
    if (nombre !== undefined && nombre !== actual.nombre) {
      datos.nombre = nombre;
      antes.nombre = actual.nombre;
      despues.nombre = nombre;
    }
    if (datos.nombre !== undefined || datos.padreId !== undefined) {
      this.sinRepetir(filas, datos.nombre ?? actual.nombre, padreId, id);
      await this.repo.actualizar(id, datos);
    }
    if (cambios.jefeId !== undefined && cambios.jefeId !== (actual.jefe?.id ?? null)) {
      antes.jefeId = actual.jefe?.id ?? null;
      despues.jefeId = cambios.jefeId;
      if (cambios.jefeId === null) await this.repo.actualizar(id, { jefeId: null });
      else {
        await this.personaParaJefe(cambios.jefeId);
        await this.hacerJefe(id, cambios.jefeId, ctx);
      }
      // El jefe anterior deja de serlo: si ya no encabeza ninguna área vuelve a Colaborador.
      if (actual.jefe) await this.soltarJefes([actual.jefe.id], ctx);
    }
    if (Object.keys(despues).length > 0) await this.registrar(ctx, 'areas.editar', id, { antes, despues });
    return this.getById(id);
  }

  /** La persona pasa a formar parte del área y queda como su jefe (el jefe pertenece a su área) y con el rol Jefe. */
  private async hacerJefe(areaId: number, usuarioId: number, ctx: AccionCtx) {
    await this.repo.asignar(usuarioId, areaId);
    await this.repo.actualizar(areaId, { jefeId: usuarioId });
    // Un admin se queda como admin: no se le baja de nivel.
    const u = await this.personaActiva(usuarioId);
    if (u.rol !== ROLES.ADMIN && u.rol !== ROLES.JEFE && (await this.repo.ponerRol(usuarioId, ROLES.JEFE))) {
      await this.registrar(ctx, 'areas.rol_jefe', usuarioId, { nombre: u.nombre, de: u.rol, a: ROLES.JEFE });
    }
  }

  /** Quien tiene rol cliente es del portal del cliente: no puede encabezar un área. */
  private async personaParaJefe(usuarioId: number) {
    const u = await this.personaActiva(usuarioId);
    if (u.rol === ROLES.CLIENTE) throw HttpError.conflict('Un usuario del portal de clientes no puede ser jefe de un área');
    return u;
  }

  /** Quien dejó de ser jefe y ya no encabeza ninguna área vuelve a Colaborador (si su rol era Jefe). */
  private async soltarJefes(usuarioIds: number[], ctx: AccionCtx) {
    const { filas } = await this.cargar();
    for (const id of new Set(usuarioIds)) {
      if (filas.some((f) => !f.deletedAt && f.jefeId === id)) continue;
      if (await this.repo.ponerRol(id, ROLES.GUARDIA, ROLES.JEFE)) {
        await this.registrar(ctx, 'areas.rol_jefe', id, { de: ROLES.JEFE, a: ROLES.GUARDIA });
      }
    }
  }

  private async personaActiva(usuarioId: number) {
    const u = await this.repo.usuario(usuarioId);
    if (!u) throw HttpError.notFound('Persona no encontrada');
    return u;
  }

  /** Baja del área y de todas sus subáreas: sus personas quedan sin área. */
  async darDeBaja(id: number, ctx: AccionCtx): Promise<void> {
    const { filas, areas } = await this.cargar();
    const area = areas.get(id);
    if (!area) throw HttpError.notFound('Área no encontrada');
    if (area.deletedAt) return;
    const ids = this.descendientes(filas, id).filter((i) => !areas.get(i)?.deletedAt);
    const jefes = ids.flatMap((i) => (areas.get(i)?.jefe ? [areas.get(i)!.jefe!.id] : []));
    await this.repo.darDeBaja(ids);
    await this.soltarJefes(jefes, ctx);
    await this.registrar(ctx, 'areas.baja', id, {
      nombre: area.nombreCompleto,
      areasDadasDeBaja: ids.length,
      personasSinArea: ids.reduce((n, i) => n + (areas.get(i)?.personas ?? 0), 0),
    });
  }

  /** Borrado definitivo del área y de todas sus subáreas, también las dadas de baja. Las personas quedan sin área. */
  async eliminar(id: number, ctx: AccionCtx): Promise<void> {
    const { filas, areas } = await this.cargar();
    const area = areas.get(id);
    if (!area) throw HttpError.notFound('Área no encontrada');
    // Del área hacia sus subáreas; al revés para borrar primero las de más abajo.
    const ids = this.descendientes(filas, id);
    const jefes = ids.flatMap((i) => (areas.get(i)?.jefe ? [areas.get(i)!.jefe!.id] : []));
    await this.repo.eliminar([...ids].reverse());
    await this.soltarJefes(jefes, ctx);
    await this.registrar(ctx, 'areas.eliminar', id, {
      nombre: area.nombreCompleto,
      areasEliminadas: ids.map((i) => areas.get(i)?.nombreCompleto ?? String(i)),
      personasSinArea: ids.reduce((n, i) => n + (areas.get(i)?.personas ?? 0), 0),
    });
  }

  async reactivar(id: number, ctx: AccionCtx): Promise<void> {
    const { areas } = await this.cargar();
    const area = areas.get(id);
    if (!area) throw HttpError.notFound('Área no encontrada');
    if (!area.deletedAt) return;
    if (area.padreId !== null && areas.get(area.padreId)?.deletedAt) {
      throw HttpError.conflict('Reactiva primero el área superior');
    }
    await this.repo.reactivar(id);
    await this.registrar(ctx, 'areas.reactivar', id, { nombre: area.nombreCompleto });
  }

  async personas(areaId: number): Promise<PersonaDeArea[]> {
    const { areas } = await this.cargar();
    const area = areas.get(areaId);
    if (!area) throw HttpError.notFound('Área no encontrada');
    const jefeId = area.jefe?.id ?? null;
    return (await this.repo.personas(areaId)).map((p) => ({ ...p, esJefe: p.id === jefeId }));
  }

  /** Mover a una persona a un área (null = sin área). */
  async asignar(usuarioId: number, areaId: number | null, ctx: AccionCtx): Promise<void> {
    const usuario = await this.personaActiva(usuarioId);
    const { areas } = await this.cargar();
    if (areaId !== null) this.activa(areas, areaId);
    if (usuario.areaId === areaId) return;
    await this.repo.asignar(usuarioId, areaId);
    // Si era jefe de otra área, deja de serlo al irse de ella.
    await this.soltarJefes([usuarioId], ctx);
    await this.registrar(ctx, 'areas.asignar_persona', usuarioId, {
      nombre: usuario.nombre,
      de: usuario.areaId === null ? null : (areas.get(usuario.areaId)?.nombreCompleto ?? null),
      a: areaId === null ? null : (areas.get(areaId)?.nombreCompleto ?? null),
    });
  }

  async candidatos(q: string | undefined): Promise<CandidatoArea[]> {
    const { areas } = await this.cargar();
    return (await this.repo.candidatos(q)).map(({ area, ...p }) => ({
      ...p,
      area: area && areas.get(area.id) ? { id: area.id, nombreCompleto: areas.get(area.id)!.nombreCompleto } : null,
    }));
  }

  private registrar(ctx: AccionCtx, accion: string, id: number, datos: Record<string, unknown>) {
    this.log(accion, { actorId: ctx.actorId, areas: id });
    return this.audit.registrarAccion(ctx, accion, accion === 'areas.asignar_persona' || accion === 'areas.rol_jefe' ? 'usuarios' : 'areas', id, datos);
  }
}
