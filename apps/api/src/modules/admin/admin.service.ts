import type { HistorialUsuario } from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, StorageService, type AccionCtx } from '../../core';
import type { AdminRepository } from './admin.repository';

/** Acciones exclusivas del administrador. */
export class AdminService extends BaseService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditLogger,
  ) {
    super();
  }

  /** Lo que se perdería al eliminar al usuario (para mostrarlo en la confirmación). */
  async historial(id: number): Promise<HistorialUsuario> {
    await this.usuario(id);
    return this.repo.historial(id);
  }

  /**
   * Elimina definitivamente al usuario con todo su historial (marcas, rostros, reportes...).
   * Pensado para limpiar cuentas de prueba; para personal real se usa "Dar de baja".
   */
  async eliminarUsuario(id: number, ctx: AccionCtx): Promise<void> {
    if (id === ctx.actorId) throw HttpError.badRequest('No puedes eliminar tu propia cuenta');
    const usuario = await this.usuario(id);
    if (
      usuario.rol === 'admin' &&
      usuario.activo &&
      !usuario.deletedAt &&
      (await this.repo.adminsActivos()) <= 1
    ) {
      throw HttpError.conflict('No se puede eliminar al único administrador activo');
    }
    const historial = await this.repo.historial(id);
    const archivos = await this.repo.eliminarUsuario(id);
    await Promise.all(archivos.map((a) => this.storage.eliminar(a).catch(() => undefined)));
    await this.audit.registrarAccion(ctx, 'usuarios.eliminar_definitivo', 'usuarios', id, {
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      ...historial,
      archivos: archivos.length,
    });
    this.log('Usuario eliminado definitivamente', { id, email: usuario.email });
  }

  private async usuario(id: number) {
    const u = await this.repo.findUsuario(id);
    if (!u) throw HttpError.notFound('Usuario no encontrado');
    return u;
  }
}
