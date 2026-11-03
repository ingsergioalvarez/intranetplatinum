import {
  MENSAJE_TELEFONO_OBLIGATORIO,
  ROLES,
  ROLES_CON_TELEFONO,
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
  calcularCambios,
  carteraDe,
  esSuperAdmin,
  propietarioParaCrear,
  generateTemporaryPassword,
  hashPassword,
  type AccionCtx,
  type AuthUser,
} from '../../core';
import type { UsuariosRepository } from './usuarios.repository';

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

  /** Un admin ve a sus usuarios y a sí mismo; el super admin ve todos (y puede filtrar por dueño o sin asignar). */
  list({ page, limit, ...filtro }: UsuarioFiltro, actor: AuthUser): Promise<Paginated<Usuario>> {
    const cartera = carteraDe(actor);
    return this.repo.findPaged(
      cartera === undefined
        ? filtro
        : {
            ...filtro,
            propietarioId: undefined,
            sinAsignar: undefined,
            cartera: { adminId: cartera, tambien: [actor.id] },
          },
      { page, limit },
    );
  }

  /** Con `actor`, lo que está fuera de su cartera se responde como si no existiera. */
  async getById(id: number, actor?: AuthUser): Promise<Usuario> {
    const usuario = await this.repo.findById(id);
    if (!usuario) throw HttpError.notFound('Usuario no encontrado');
    if (actor) {
      const cartera = carteraDe(actor);
      if (
        cartera !== undefined &&
        usuario.id !== cartera &&
        usuario.id !== actor.id &&
        usuario.propietario?.id !== cartera
      ) {
        throw HttpError.notFound('Usuario no encontrado');
      }
    }
    return usuario;
  }

  /** El super admin solo puede tocarse a sí mismo (y nadie más puede dar de baja ni reiniciar su cuenta). */
  private protegerSuperAdmin(objetivo: Usuario, actor: AuthUser) {
    if (objetivo.esSuperAdmin && objetivo.id !== actor.id) {
      throw HttpError.forbidden('Nadie más puede modificar la cuenta del super admin');
    }
  }

  /** Solo el super admin maneja cuentas de administrador. */
  private exigirSuperAdminParaAdmin(rol: Usuario['rol'] | undefined, actor: AuthUser) {
    if (rol === ROLES.ADMIN && !esSuperAdmin(actor)) {
      throw HttpError.forbidden('Solo el super admin puede crear o cambiar administradores');
    }
  }

  /** Alta con contraseña temporal que el usuario cambia al entrar (D-012). */
  async crear(data: UsuarioCreate, ctx: AccionCtx, actor: AuthUser): Promise<UsuarioConPassword> {
    this.exigirSuperAdminParaAdmin(data.rol, actor);
    if (await this.repo.findByEmail(data.email)) throw correoDuplicado();

    const passwordTemporal = generateTemporaryPassword();
    const usuario = await this.repo.create({
      ...data,
      // Quien lo crea es su dueño (A-65): lo ve y lo administra.
      propietarioId: propietarioParaCrear(actor),
      passwordHash: await hashPassword(passwordTemporal),
      debeCambiarPassword: true,
    });
    await this.auditar(ctx, 'usuarios.crear', usuario.id, {
      email: usuario.email,
      rol: usuario.rol,
    });
    return { usuario, passwordTemporal };
  }

  async actualizar(id: number, data: UsuarioUpdate, ctx: AccionCtx, actor: AuthUser): Promise<Usuario> {
    const actual = await this.getById(id, actor);
    this.protegerSuperAdmin(actual, actor);
    this.exigirSuperAdminParaAdmin(actual.rol, actor);
    if (data.rol && data.rol !== actual.rol) this.exigirSuperAdminParaAdmin(data.rol, actor);

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

    // Guardias y supervisores no pueden quedarse sin teléfono de contacto (se marca en una emergencia, A-60).
    const rolFinal = data.rol ?? actual.rol;
    const telefonoFinal = data.telefono !== undefined ? data.telefono : actual.telefono;
    if (
      (data.telefono !== undefined || data.rol) &&
      ROLES_CON_TELEFONO.includes(rolFinal) &&
      !telefonoFinal
    ) {
      throw HttpError.badRequest(MENSAJE_TELEFONO_OBLIGATORIO, [
        { path: 'telefono', message: MENSAJE_TELEFONO_OBLIGATORIO },
      ]);
    }

    const { antes, despues, hayCambios } = calcularCambios<Usuario>(actual, data);
    if (!hayCambios) return actual;

    const usuario = await this.repo.update(id, despues);
    await this.auditar(ctx, 'usuarios.editar', id, { antes, despues });
    return usuario;
  }

  /** Baja lógica (D-006): no puede entrar ni renovar sesión; se revocan sus sesiones al instante. */
  async darDeBaja(id: number, ctx: AccionCtx, actor: AuthUser): Promise<void> {
    if (id === ctx.actorId) throw HttpError.badRequest('No puedes darte de baja a ti mismo');
    const usuario = await this.getById(id, actor);
    this.protegerSuperAdmin(usuario, actor);
    this.exigirSuperAdminParaAdmin(usuario.rol, actor);
    if (usuario.deletedAt) return;
    if (usuario.rol === ROLES.ADMIN && (await this.repo.countAdminsActivos()) <= 1) throw ultimoAdmin();

    await this.repo.softDelete(id);
    await this.repo.revocarSesiones(id);
    // Lo que no se transfirió antes queda sin asignar (solo lo ve el super admin) hasta que se reparta (A-65).
    const soltado = usuario.rol === ROLES.ADMIN ? await this.repo.soltarCartera(id) : null;
    await this.auditar(ctx, 'usuarios.baja', id, { email: usuario.email, ...(soltado && { sinAsignar: soltado }) });
  }

  async reactivar(id: number, ctx: AccionCtx, actor: AuthUser): Promise<void> {
    const usuario = await this.getById(id, actor);
    this.exigirSuperAdminParaAdmin(usuario.rol, actor);
    if (!usuario.deletedAt) return;
    await this.repo.restore(id);
    await this.auditar(ctx, 'usuarios.reactivar', id, { email: usuario.email });
  }

  /** Genera una contraseña temporal, desbloquea la cuenta y cierra sus sesiones (D-012). */
  async resetPassword(id: number, ctx: AccionCtx, actor: AuthUser): Promise<UsuarioConPassword> {
    if (id === ctx.actorId) {
      throw HttpError.badRequest('Para cambiar tu propia contraseña usa "Cambiar contraseña"');
    }
    const actual = await this.getById(id, actor);
    this.protegerSuperAdmin(actual, actor);
    this.exigirSuperAdminParaAdmin(actual.rol, actor);
    if (actual.deletedAt) throw HttpError.conflict('El usuario está dado de baja; reactívalo primero');

    const passwordTemporal = generateTemporaryPassword();
    await this.repo.setPasswordTemporal(id, await hashPassword(passwordTemporal));
    await this.repo.revocarSesiones(id);
    await this.auditar(ctx, 'usuarios.reset_password', id, { email: actual.email });
    return { usuario: await this.getById(id, actor), passwordTemporal };
  }

  private auditar(ctx: AccionCtx, accion: string, id: number, datos: Record<string, unknown>) {
    this.log(accion, { actorId: ctx.actorId, usuarioId: id });
    return this.audit.registrarAccion(ctx, accion, 'usuarios', id, datos);
  }
}
