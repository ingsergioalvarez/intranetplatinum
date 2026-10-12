import {
  ROLES,
  type Paginated,
  type Usuario,
  type UsuarioConPassword,
  type UsuarioCreate,
  type UsuarioFiltro,
  type UsuarioUpdate,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseService,
  HttpError,
  generateTemporaryPassword,
  hashPassword,
  type RequestContext,
} from '../../core';
import type { UsuariosRepository } from './usuarios.repository';

/** Contexto de una acción administrativa: quién la hace y desde dónde. */
export interface AccionCtx extends RequestContext {
  actorId: number;
}

const correoDuplicado = () =>
  HttpError.conflict('Ya existe un usuario con este correo', [
    { path: 'email', message: 'Ya existe un usuario con este correo' },
  ]);

const ultimoAdmin = () => HttpError.conflict('Debe quedar al menos un administrador activo en el sistema');

export class UsuariosService extends BaseService {
  constructor(
    private readonly repo: UsuariosRepository,
    private readonly audit: AuditLogger,
  ) {
    super();
  }

  list({ page, limit, ...filtro }: UsuarioFiltro): Promise<Paginated<Usuario>> {
    return this.repo.findPaged(filtro, { page, limit });
  }

  async getById(id: number): Promise<Usuario> {
    const usuario = await this.repo.findById(id);
    if (!usuario) throw HttpError.notFound('Usuario no encontrado');
    return usuario;
  }

  /** Alta con contraseña temporal que el usuario cambia al entrar (D-012). */
  async crear(data: UsuarioCreate, ctx: AccionCtx): Promise<UsuarioConPassword> {
    if (await this.repo.findByEmail(data.email)) throw correoDuplicado();

    const passwordTemporal = generateTemporaryPassword();
    const usuario = await this.repo.create({
      ...data,
      passwordHash: await hashPassword(passwordTemporal),
      debeCambiarPassword: true,
    });
    await this.auditar(ctx, 'usuarios.crear', usuario.id, {
      email: usuario.email,
      rol: usuario.rol,
    });
    return { usuario, passwordTemporal };
  }

  async actualizar(id: number, data: UsuarioUpdate, ctx: AccionCtx): Promise<Usuario> {
    const actual = await this.getById(id);

    if (data.email && data.email !== actual.email) {
      const otro = await this.repo.findByEmail(data.email);
      if (otro && otro.id !== id) throw correoDuplicado();
    }
    if (data.rol && data.rol !== actual.rol) {
      if (id === ctx.actorId) throw HttpError.badRequest('No puedes cambiar tu propio rol');
      if (actual.rol === ROLES.ADMIN && !actual.deletedAt && (await this.repo.countAdminsActivos()) <= 1) {
        throw ultimoAdmin();
      }
    }

    const cambios = Object.fromEntries(
      Object.entries(data).filter(([k, v]) => v !== undefined && v !== actual[k as keyof Usuario]),
    );
    if (Object.keys(cambios).length === 0) return actual;

    const usuario = await this.repo.update(id, cambios);
    await this.auditar(ctx, 'usuarios.editar', id, {
      antes: Object.fromEntries(Object.keys(cambios).map((k) => [k, actual[k as keyof Usuario]])),
      despues: cambios,
    });
    return usuario;
  }

  /** Baja lógica (D-006): no puede entrar ni renovar sesión; se revocan sus sesiones al instante. */
  async darDeBaja(id: number, ctx: AccionCtx): Promise<void> {
    if (id === ctx.actorId) throw HttpError.badRequest('No puedes darte de baja a ti mismo');
    const usuario = await this.getById(id);
    if (usuario.deletedAt) return;
    if (usuario.rol === ROLES.ADMIN && (await this.repo.countAdminsActivos()) <= 1) throw ultimoAdmin();

    await this.repo.softDelete(id);
    await this.repo.revocarSesiones(id);
    await this.auditar(ctx, 'usuarios.baja', id, { email: usuario.email });
  }

  async reactivar(id: number, ctx: AccionCtx): Promise<void> {
    const usuario = await this.getById(id);
    if (!usuario.deletedAt) return;
    await this.repo.restore(id);
    await this.auditar(ctx, 'usuarios.reactivar', id, { email: usuario.email });
  }

  /** Genera una contraseña temporal, desbloquea la cuenta y cierra sus sesiones (D-012). */
  async resetPassword(id: number, ctx: AccionCtx): Promise<UsuarioConPassword> {
    if (id === ctx.actorId) {
      throw HttpError.badRequest('Para cambiar tu propia contraseña usa "Cambiar contraseña"');
    }
    const actual = await this.getById(id);
    if (actual.deletedAt) throw HttpError.conflict('El usuario está dado de baja; reactívalo primero');

    const passwordTemporal = generateTemporaryPassword();
    await this.repo.setPasswordTemporal(id, await hashPassword(passwordTemporal));
    await this.repo.revocarSesiones(id);
    await this.auditar(ctx, 'usuarios.reset_password', id, { email: actual.email });
    return { usuario: await this.getById(id), passwordTemporal };
  }

  private auditar(ctx: AccionCtx, accion: string, id: number, datos: Record<string, unknown>) {
    const { actorId, ip, userAgent } = ctx;
    this.log(accion, { actorId, usuarioId: id });
    return this.audit.registrar({
      usuarioId: actorId,
      accion,
      entidad: 'usuarios',
      entidadId: id,
      datos,
      ip,
      userAgent,
    });
  }
}
