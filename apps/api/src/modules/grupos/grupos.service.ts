import type { Grupo, GrupoData } from '@platinum/shared';
import {
  AuditLogger,
  BaseService,
  HttpError,
  calcularCambios,
  carteraDe,
  enCartera,
  hoyISO,
  propietarioParaCrear,
  type AccionCtx,
  type AuthUser,
} from '../../core';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
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
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly bitacora: RegistrarBitacora = sinBitacora,
  ) {
    super();
  }

  /** Avisa a los guardias que entran o salen del grupo (DA-34) y lo deja en su bitácora (DA-41). */
  private async avisarIntegrantes(nombre: string, agregados: number[], quitados: number[], actorId: number) {
    await this.bitacora({
      usuarioIds: agregados,
      tipo: 'grupo_alta',
      detalle: `Entró al grupo ${nombre}`,
      actorId,
    });
    await this.bitacora({
      usuarioIds: quitados,
      tipo: 'grupo_baja',
      detalle: `Salió del grupo ${nombre}`,
      actorId,
    });
    await this.avisar(agregados, {
      tipo: 'grupo',
      titulo: 'Te agregaron a un grupo',
      mensaje: `Te agregaron al grupo ${nombre}`,
      ruta: '/mis-sitios',
    });
    await this.avisar(quitados, {
      tipo: 'grupo',
      titulo: 'Ya no estás en el grupo',
      mensaje: `Ya no formas parte del grupo ${nombre}`,
      ruta: '/mis-sitios',
    });
  }

  /** Cada admin ve sus grupos (y un supervisor, los de su admin); el super admin, todos (A-65). */
  listar(filtro: GrupoFiltro, actor: AuthUser) {
    return this.repo.listar(filtro, this.hoy(), carteraDe(actor));
  }

  /** Con `actor`, un grupo de otra cartera se responde como si no existiera. */
  async getById(id: number, actor?: AuthUser): Promise<Grupo> {
    const grupo = await this.repo.findById(id, this.hoy());
    if (!grupo) throw HttpError.notFound('Grupo no encontrado');
    if (actor && !enCartera(actor, grupo.propietario?.id ?? null)) throw HttpError.notFound('Grupo no encontrado');
    return grupo;
  }

  async crear(data: GrupoData, usuarioIds: number[], ctx: AccionCtx): Promise<Grupo> {
    if (await this.repo.nombreOcupado(data.nombre)) throw nombreRepetido();
    const integrantes = await this.validarIntegrantes(usuarioIds, ctx);
    const id = await this.repo.crear(data, ctx.actor ? propietarioParaCrear(ctx.actor) : null);
    await this.repo.setIntegrantes(id, integrantes);
    await this.audit.registrarAccion(ctx, 'grupos.crear', 'grupos_guardias', id, {
      nombre: data.nombre,
      integrantes,
    });
    await this.avisarIntegrantes(data.nombre, integrantes, [], ctx.actorId);
    return this.getById(id);
  }

  async actualizar(id: number, data: Partial<GrupoData>, ctx: AccionCtx): Promise<Grupo> {
    const actual = await this.editable(id, ctx);
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
    const actual = await this.editable(id, ctx);
    const integrantes = await this.validarIntegrantes(usuarioIds, ctx);
    const antes = actual.integrantes.map((i) => i.id);
    await this.repo.setIntegrantes(id, integrantes);
    const agregados = integrantes.filter((u) => !antes.includes(u));
    const quitados = antes.filter((u) => !integrantes.includes(u));
    await this.audit.registrarAccion(ctx, 'grupos.integrantes', 'grupos_guardias', id, {
      agregados,
      quitados,
    });
    await this.avisarIntegrantes(actual.nombre, agregados, quitados, ctx.actorId);
    return this.getById(id);
  }

  /** Baja: los guardias dejan de ver los sitios del grupo; sus asignaciones terminan hoy. */
  async darDeBaja(id: number, ctx: AccionCtx) {
    const grupo = await this.getById(id, ctx.actor);
    if (grupo.deletedAt) return;
    await this.repo.softDelete(id, this.hoy());
    await this.audit.registrarAccion(ctx, 'grupos.baja', 'grupos_guardias', id, {
      nombre: grupo.nombre,
      asignacionesTerminadas: grupo.asignacionesVigentes,
    });
    await this.bitacora({
      usuarioIds: grupo.integrantes.map((i) => i.id),
      tipo: 'grupo_baja',
      detalle: `Se dio de baja el grupo ${grupo.nombre}${
        grupo.asignacionesVigentes ? ': terminan hoy sus asignaciones' : ''
      }`,
      actorId: ctx.actorId,
    });
  }

  async reactivar(id: number, ctx: AccionCtx) {
    const grupo = await this.getById(id, ctx.actor);
    if (!grupo.deletedAt) return;
    await this.repo.restore(id);
    await this.audit.registrarAccion(ctx, 'grupos.reactivar', 'grupos_guardias', id, {
      nombre: grupo.nombre,
    });
  }

  private async editable(id: number, ctx: AccionCtx) {
    const grupo = await this.getById(id, ctx.actor);
    if (grupo.deletedAt) throw HttpError.conflict('El grupo está dado de baja; reactívalo primero');
    return grupo;
  }

  private async validarIntegrantes(usuarioIds: number[], ctx: AccionCtx) {
    const unicos = [...new Set(usuarioIds)];
    // Un admin solo agrega a sus guardias (A-65).
    const validos = await this.repo.guardiasActivos(unicos, ctx.actor ? carteraDe(ctx.actor) : undefined);
    if (validos.length !== unicos.length) {
      throw HttpError.badRequest('Datos inválidos', [
        { path: 'usuarioIds', message: 'Solo se pueden agregar guardias activos' },
      ]);
    }
    return unicos;
  }
}
