import type { HistorialCliente, HistorialSitio, HistorialUsuario } from '@platinum/shared';
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

  // ---------- Sitios y clientes (DA-50) ----------

  async historialSitio(id: number): Promise<HistorialSitio> {
    await this.sitio(id);
    return this.repo.historialSitio(id);
  }

  async historialCliente(id: number): Promise<HistorialCliente> {
    await this.cliente(id);
    return this.repo.historialCliente(id);
  }

  /**
   * Elimina definitivamente el sitio con su historial (asignaciones, checadas, reportes...). Pensado
   * para limpiar pruebas o errores de captura; para un sitio que dejó de atenderse se usa "Dar de baja".
   */
  async eliminarSitio(id: number, ctx: AccionCtx): Promise<void> {
    const sitio = await this.sitio(id);
    const historial = await this.repo.historialSitio(id);
    const archivos = await this.repo.eliminarSitio(id);
    await this.borrarArchivos(archivos);
    await this.audit.registrarAccion(ctx, 'sitios.eliminar_definitivo', 'sitios', id, {
      nombre: sitio.nombre,
      clienteId: sitio.clienteId,
      ...historial,
      archivos: archivos.length,
    });
    this.log('Sitio eliminado definitivamente', { id, nombre: sitio.nombre });
  }

  /** Elimina definitivamente al cliente con todos sus sitios, reportes y contactos. */
  async eliminarCliente(id: number, ctx: AccionCtx): Promise<void> {
    const cliente = await this.cliente(id);
    const historial = await this.repo.historialCliente(id);
    const archivos = await this.repo.eliminarCliente(id);
    await this.borrarArchivos(archivos);
    await this.audit.registrarAccion(ctx, 'clientes.eliminar_definitivo', 'clientes', id, {
      nombre: cliente.nombre,
      ...historial,
      archivos: archivos.length,
    });
    this.log('Cliente eliminado definitivamente', { id, nombre: cliente.nombre });
  }

  private borrarArchivos(archivos: string[]) {
    return Promise.all(archivos.map((a) => this.storage.eliminar(a).catch(() => undefined)));
  }

  private async sitio(id: number) {
    const s = await this.repo.findSitio(id);
    if (!s) throw HttpError.notFound('Sitio no encontrado');
    return s;
  }

  private async cliente(id: number) {
    const c = await this.repo.findCliente(id);
    if (!c) throw HttpError.notFound('Cliente no encontrado');
    return c;
  }
}
