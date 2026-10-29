import {
  MAX_ACCESOS_CLIENTE,
  ROLES,
  type AccesoCliente,
  type AccesoClienteCreado,
  type AccesoClienteData,
  type ClienteCreateData,
  type ClienteDetalle,
  ClienteFiltro,
  ClienteResumen,
  Contacto,
  ContactoData,
  Paginated,
  ReglasAviso,
  Sitio,
  SitioData,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseService,
  HttpError,
  calcularCambios,
  generateTemporaryPassword,
  hashPassword,
  hoyISO,
  type AccionCtx,
} from '../../core';
import type { ClienteUpdateData, ClientesRepository } from './clientes.repository';

const rfcDuplicado = () =>
  HttpError.conflict('Ya existe un cliente con este RFC', [
    { path: 'rfc', message: 'Ya existe un cliente con este RFC' },
  ]);

export class ClientesService extends BaseService {
  constructor(
    private readonly repo: ClientesRepository,
    private readonly audit: AuditLogger,
    /** Inyectable en pruebas. */
    private readonly hoy: () => string = () => hoyISO(),
  ) {
    super();
  }

  // ---------- Clientes ----------

  list({ page, limit, ...filtro }: ClienteFiltro): Promise<Paginated<ClienteResumen>> {
    return this.repo.findPaged(filtro, { page, limit });
  }

  async getById(id: number): Promise<ClienteResumen> {
    const cliente = await this.repo.findById(id);
    if (!cliente) throw HttpError.notFound('Cliente no encontrado');
    return cliente;
  }

  /** Ficha completa: datos, contactos y sitios (incluye sitios de baja para el historial). */
  async getDetalle(id: number): Promise<ClienteDetalle> {
    const { totalSitios: _s, totalContactos: _c, responsable: _r, ...cliente } = await this.getById(id);
    const [contactos, sitios, reglasAviso, accesos] = await Promise.all([
      this.repo.listContactos(id),
      this.repo.listSitios(id, this.hoy(), true),
      this.repo.getReglasAviso(id),
      this.repo.listAccesos(id),
    ]);
    return { ...cliente, contactos, sitios, reglasAviso, accesos };
  }

  async crear(data: ClienteCreateData, ctx: AccionCtx): Promise<ClienteResumen> {
    if (data.rfc && (await this.repo.findByRfc(data.rfc))) throw rfcDuplicado();
    const cliente = await this.repo.create(data);
    await this.auditar(ctx, 'clientes.crear', 'clientes', cliente.id, {
      nombreComercial: cliente.nombreComercial,
    });
    return cliente;
  }

  async actualizar(id: number, data: ClienteUpdateData, ctx: AccionCtx): Promise<ClienteResumen> {
    const actual = await this.getById(id);
    if (actual.deletedAt) throw HttpError.conflict('El cliente está dado de baja; reactívalo primero');
    if (data.rfc && data.rfc !== actual.rfc) {
      const otro = await this.repo.findByRfc(data.rfc);
      if (otro && otro.id !== id) throw rfcDuplicado();
    }

    const { antes, despues, hayCambios } = calcularCambios<ClienteUpdateData>(actual, data);
    if (!hayCambios) return actual;
    const cliente = await this.repo.update(id, despues);
    await this.auditar(ctx, 'clientes.editar', 'clientes', id, { antes, despues });
    return cliente;
  }

  /** Baja lógica (D-006): sus sitios dejan de aparecer a los guardias. */
  async darDeBaja(id: number, ctx: AccionCtx): Promise<void> {
    const cliente = await this.getById(id);
    if (cliente.deletedAt) return;
    await this.repo.softDelete(id);
    await this.auditar(ctx, 'clientes.baja', 'clientes', id, { nombreComercial: cliente.nombreComercial });
  }

  async reactivar(id: number, ctx: AccionCtx): Promise<void> {
    const cliente = await this.getById(id);
    if (!cliente.deletedAt) return;
    await this.repo.restore(id);
    await this.auditar(ctx, 'clientes.reactivar', 'clientes', id, {
      nombreComercial: cliente.nombreComercial,
    });
  }

  // ---------- Reglas de aviso (F3-09) ----------

  async actualizarReglasAviso(id: number, reglas: ReglasAviso, ctx: AccionCtx): Promise<ReglasAviso> {
    await this.clienteEditable(id);
    const antes = await this.repo.getReglasAviso(id);
    // Una excepción igual a la regla por defecto no aporta nada: se descarta.
    const limpias: ReglasAviso = {
      porDefecto: reglas.porDefecto,
      porPrioridad: Object.fromEntries(
        Object.entries(reglas.porPrioridad).filter(([, d]) => d && d !== reglas.porDefecto),
      ),
    };
    await this.repo.setReglasAviso(id, limpias);
    await this.auditar(ctx, 'clientes.reglas_aviso', 'clientes', id, { antes, despues: limpias });
    return limpias;
  }

  // ---------- Acceso del cliente (A-29) ----------

  /**
   * Da acceso a la intranet a una persona del cliente: crea su usuario (rol cliente) con contraseña
   * temporal, o liga a un usuario cliente que ya existía. Máximo MAX_ACCESOS_CLIENTE activos. Su correo
   * queda como contacto que recibe los avisos de reportes.
   */
  async crearAcceso(clienteId: number, data: AccesoClienteData, ctx: AccionCtx): Promise<AccesoClienteCreado> {
    await this.clienteEditable(clienteId);
    const accesos = await this.repo.listAccesos(clienteId);
    if (accesos.filter((a) => a.activo).length >= MAX_ACCESOS_CLIENTE) {
      throw HttpError.conflict(`Un cliente puede tener máximo ${MAX_ACCESOS_CLIENTE} usuarios con acceso`);
    }

    const existente = await this.repo.findUsuarioPorEmail(data.email);
    let acceso: AccesoCliente;
    let passwordTemporal: string | null = null;
    if (existente) {
      const error = (message: string) => HttpError.conflict(message, [{ path: 'email', message }]);
      if (existente.rol !== ROLES.CLIENTE) throw error('Ese correo ya pertenece a un usuario que no es cliente');
      if (existente.deletedAt) throw error('Ese usuario está dado de baja; reactívalo primero');
      if (existente.clienteId === clienteId) throw error('Ese usuario ya tiene acceso a este cliente');
      if (existente.clienteId) throw error('Ese usuario ya está ligado a otro cliente');
      acceso = await this.repo.ligarAcceso(existente.id, clienteId);
    } else {
      passwordTemporal = generateTemporaryPassword();
      acceso = await this.repo.crearAcceso(clienteId, {
        nombre: data.nombre,
        email: data.email,
        passwordHash: await hashPassword(passwordTemporal),
      });
    }

    // Que los avisos le lleguen también por correo: contacto con "Recibe notificaciones".
    const contactos = await this.repo.listContactos(clienteId);
    if (!contactos.some((c) => c.email === data.email)) {
      await this.repo.createContacto(clienteId, {
        nombre: data.nombre,
        puesto: null,
        telefono: null,
        celular: null,
        email: data.email,
        esResponsable: contactos.length === 0,
        recibeNotificaciones: true,
        prioridad: 0,
      });
    }

    await this.auditar(ctx, 'clientes.acceso_crear', 'usuarios', acceso.id, {
      clienteId,
      email: acceso.email,
      ligado: passwordTemporal === null,
    });
    return { acceso, passwordTemporal };
  }

  // ---------- Contactos (F2-03) ----------

  async crearContacto(clienteId: number, data: ContactoData, ctx: AccionCtx): Promise<Contacto> {
    await this.clienteEditable(clienteId);
    const contacto = await this.repo.createContacto(clienteId, data);
    await this.auditar(ctx, 'clientes.contacto_crear', 'cliente_contactos', contacto.id, {
      clienteId,
      nombre: contacto.nombre,
    });
    return contacto;
  }

  async actualizarContacto(
    clienteId: number,
    contactoId: number,
    data: ContactoData,
    ctx: AccionCtx,
  ): Promise<Contacto> {
    await this.clienteEditable(clienteId);
    const actual = await this.contactoDe(clienteId, contactoId);
    const { antes, despues, hayCambios } = calcularCambios<ContactoData>(actual, data);
    if (!hayCambios) return actual;
    const contacto = await this.repo.updateContacto(contactoId, data);
    await this.auditar(ctx, 'clientes.contacto_editar', 'cliente_contactos', contactoId, {
      clienteId,
      antes,
      despues,
    });
    return contacto;
  }

  async eliminarContacto(clienteId: number, contactoId: number, ctx: AccionCtx): Promise<void> {
    await this.clienteEditable(clienteId);
    const contacto = await this.contactoDe(clienteId, contactoId);
    await this.repo.softDeleteContacto(contactoId);
    await this.auditar(ctx, 'clientes.contacto_eliminar', 'cliente_contactos', contactoId, {
      clienteId,
      nombre: contacto.nombre,
    });
  }

  // ---------- Sitios (F2-04) ----------

  async crearSitio(clienteId: number, data: SitioData, ctx: AccionCtx): Promise<Sitio> {
    await this.clienteEditable(clienteId);
    const sitio = await this.repo.createSitio(clienteId, data);
    await this.auditar(ctx, 'clientes.sitio_crear', 'sitios', sitio.id, { clienteId, nombre: sitio.nombre });
    return sitio;
  }

  async actualizarSitio(clienteId: number, sitioId: number, data: SitioData, ctx: AccionCtx): Promise<Sitio> {
    await this.clienteEditable(clienteId);
    const actual = await this.sitioDe(clienteId, sitioId);
    if (actual.deletedAt) throw HttpError.conflict('El sitio está dado de baja; reactívalo primero');
    const { antes, despues, hayCambios } = calcularCambios<SitioData>(actual, data);
    if (!hayCambios) return actual;
    await this.repo.updateSitio(sitioId, despues);
    await this.auditar(ctx, 'clientes.sitio_editar', 'sitios', sitioId, { clienteId, antes, despues });
    return this.sitioDe(clienteId, sitioId);
  }

  /** Baja del sitio: termina hoy las asignaciones vigentes de guardias. */
  async darDeBajaSitio(clienteId: number, sitioId: number, ctx: AccionCtx): Promise<void> {
    await this.clienteEditable(clienteId);
    const sitio = await this.sitioDe(clienteId, sitioId);
    if (sitio.deletedAt) return;
    await this.repo.softDeleteSitio(sitioId, this.hoy());
    await this.auditar(ctx, 'clientes.sitio_baja', 'sitios', sitioId, {
      clienteId,
      nombre: sitio.nombre,
      asignacionesTerminadas: sitio.asignacionesVigentes,
    });
  }

  async reactivarSitio(clienteId: number, sitioId: number, ctx: AccionCtx): Promise<void> {
    await this.clienteEditable(clienteId);
    const sitio = await this.sitioDe(clienteId, sitioId);
    if (!sitio.deletedAt) return;
    await this.repo.restoreSitio(sitioId);
    await this.auditar(ctx, 'clientes.sitio_reactivar', 'sitios', sitioId, {
      clienteId,
      nombre: sitio.nombre,
    });
  }

  // ---------- Apoyo ----------

  private async clienteEditable(id: number) {
    const cliente = await this.getById(id);
    if (cliente.deletedAt) throw HttpError.conflict('El cliente está dado de baja; reactívalo primero');
    return cliente;
  }

  /** El contacto debe pertenecer al cliente de la ruta (evita editar contactos ajenos por id). */
  private async contactoDe(clienteId: number, contactoId: number) {
    const contacto = await this.repo.findContacto(contactoId);
    if (!contacto || contacto.clienteId !== clienteId) throw HttpError.notFound('Contacto no encontrado');
    return contacto;
  }

  private async sitioDe(clienteId: number, sitioId: number) {
    const sitio = await this.repo.findSitio(sitioId, this.hoy());
    if (!sitio || sitio.clienteId !== clienteId) throw HttpError.notFound('Sitio no encontrado');
    return sitio;
  }

  private auditar(
    ctx: AccionCtx,
    accion: string,
    entidad: string,
    id: number,
    datos: Record<string, unknown>,
  ) {
    this.log(accion, { actorId: ctx.actorId, [entidad]: id });
    return this.audit.registrarAccion(ctx, accion, entidad, id, datos);
  }
}
