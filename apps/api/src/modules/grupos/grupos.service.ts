import type { Grupo, GrupoData } from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, calcularCambios, hoyISO, type AccionCtx } from '../../core';
import type { GrupoFiltro, GruposRepository } from './grupos.repository';

const nombreRepetido = () =>
  HttpError.conflict('Ya existe un grupo con ese nombre', [
    { path: 'nombre', message: 'Ya existe un grupo con ese nombre' },
  ]);

/** Grupos de guardias (F2-06): un guardia puede estar en varios (D-017). */
export class GruposService extends BaseService {
  constructor(
    private readonly repo: GruposRepository,
    private readonly audit: AuditLogger,
    private readonly hoy: () => string = () => hoyISO(),
  ) {
    super();
  }

  listar(filtro: GrupoFiltro) {
    return this.repo.listar(filtro, this.hoy());
  }

  async getById(id: number): Promise<Grupo> {
    const grupo = await this.repo.findById(id, this.hoy());
    if (!grupo) throw HttpError.notFound('Grupo no encontrado');
    return grupo;
  }

  async crear(data: GrupoData, usuarioIds: number[], ctx: AccionCtx): Promise<Grupo> {
    if (await this.repo.nombreOcupado(data.nombre)) throw nombreRepetido();
    const integrantes = await this.validarIntegrantes(usuarioIds);
    const id = await this.repo.crear(data);
    await this.repo.setIntegrantes(id, integrantes);
    await this.audit.registrarAccion(ctx, 'grupos.crear', 'grupos_guardias', id, {
      nombre: data.nombre,
      integrantes,
    });
    return this.getById(id);
  }

  async actualizar(id: number, data: Partial<GrupoData>, ctx: AccionCtx): Promise<Grupo> {
    const actual = await this.editable(id);
    if (data.nombre && data.nombre !== actual.nombre && (await this.repo.nombreOcupado(data.nombre, id))) {
      throw nombreRepetido();
    }
    const { antes, despues, hayCambios } = calcularCambios<GrupoData>(actual, data);
    if (!hayCambios) return actual;
    await this.repo.actualizar(id, despues);
    await this.audit.registrarAccion(ctx, 'grupos.editar', 'grupos_guardias', id, { antes, despues });
    return this.getById(id);
  }

  /** Reemplaza la lista de integrantes (solo guardias activos). */
  async setIntegrantes(id: number, usuarioIds: number[], ctx: AccionCtx): Promise<Grupo> {
    const actual = await this.editable(id);
    const integrantes = await this.validarIntegrantes(usuarioIds);
    const antes = actual.integrantes.map((i) => i.id);
    await this.repo.setIntegrantes(id, integrantes);
    await this.audit.registrarAccion(ctx, 'grupos.integrantes', 'grupos_guardias', id, {
      agregados: integrantes.filter((u) => !antes.includes(u)),
      quitados: antes.filter((u) => !integrantes.includes(u)),
    });
    return this.getById(id);
  }

  /** Baja: los guardias dejan de ver los sitios del grupo; sus asignaciones terminan hoy. */
  async darDeBaja(id: number, ctx: AccionCtx) {
    const grupo = await this.getById(id);
    if (grupo.deletedAt) return;
    await this.repo.softDelete(id, this.hoy());
    await this.audit.registrarAccion(ctx, 'grupos.baja', 'grupos_guardias', id, {
      nombre: grupo.nombre,
      asignacionesTerminadas: grupo.asignacionesVigentes,
    });
  }

  async reactivar(id: number, ctx: AccionCtx) {
    const grupo = await this.getById(id);
    if (!grupo.deletedAt) return;
    await this.repo.restore(id);
    await this.audit.registrarAccion(ctx, 'grupos.reactivar', 'grupos_guardias', id, {
      nombre: grupo.nombre,
    });
  }

  private async editable(id: number) {
    const grupo = await this.getById(id);
    if (grupo.deletedAt) throw HttpError.conflict('El grupo está dado de baja; reactívalo primero');
    return grupo;
  }

  private async validarIntegrantes(usuarioIds: number[]) {
    const unicos = [...new Set(usuarioIds)];
    const validos = await this.repo.guardiasActivos(unicos);
    if (validos.length !== unicos.length) {
      throw HttpError.badRequest('Datos inválidos', [
        { path: 'usuarioIds', message: 'Solo se pueden agregar guardias activos' },
      ]);
    }
    return unicos;
  }
}
