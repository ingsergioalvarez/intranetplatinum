import {
  CLAVES_OPCIONALES,
  esModuloOpcional,
  estadoDesde,
  mensajesProblemasModulos,
  problemasDeModulos,
  type ColorModo,
  type Empresa,
  type EmpresaAdministrador,
  type EmpresaAdminCreate,
  type EmpresaCreate,
  type EmpresaFiltro,
  type EmpresaMarca,
  type EmpresaModulosInput,
  type EmpresaResumen,
  type EmpresaUpdate,
  type EstadoModulos,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseService,
  HttpError,
  StorageService,
  calcularCambios,
  detectarImagen,
  firmarArchivo,
  generateTemporaryPassword,
  hashPassword,
  lectorModulos,
  validarSvg,
  type AccionCtx,
  type AuthUser,
} from '../../core';
import type { EmpresaFila, PlataformaRepository } from './plataforma.repository';

export interface ArchivoLogo {
  buffer: Buffer;
  mimetype: string;
}

/** Tipos de imagen permitidos para el ícono (el HEIC de las fotos no se usa aquí). */
const RASTER_LOGO = ['image/png', 'image/jpeg', 'image/webp'];

const MENSAJE_MODULOS = 'Esa combinación de módulos no es válida: falta algo que necesitan';

/** Plataforma (C-07): empresas, su marca, sus módulos y sus administradores. Solo el super admin. */
export class PlataformaService extends BaseService {
  constructor(
    private readonly repo: PlataformaRepository,
    private readonly audit: AuditLogger,
    private readonly storage: StorageService,
  ) {
    super();
  }

  private aEmpresa({ logoClave, createdAt, updatedAt, colorModo, ...f }: EmpresaFila): Empresa {
    return {
      ...f,
      colorModo: colorModo as ColorModo,
      logoUrl: logoClave ? firmarArchivo(logoClave) : null,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  }

  private async fila(id: number) {
    const fila = await this.repo.findById(id);
    if (!fila) throw HttpError.notFound('Empresa no encontrada');
    return fila;
  }

  async list(filtro: EmpresaFiltro, actor: AuthUser): Promise<EmpresaResumen[]> {
    const [filas, miEmpresa] = await Promise.all([this.repo.list(filtro), this.repo.empresaDe(actor.id)]);
    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      activa: f.activa,
      esMiEmpresa: f.id === miEmpresa,
      modulosActivos: f.modulosActivos,
      modulosOpcionales: CLAVES_OPCIONALES.length,
      administradores: f.administradores,
    }));
  }

  async getById(id: number): Promise<Empresa> {
    return this.aEmpresa(await this.fila(id));
  }

  async create(data: EmpresaCreate, ctx: AccionCtx): Promise<Empresa> {
    const fila = await this.repo.create(data);
    this.log('empresa creada', { id: fila.id });
    await this.audit.registrarAccion(ctx, 'plataforma.empresa_crear', 'empresas', fila.id, { nombre: fila.nombre });
    return this.aEmpresa(fila);
  }

  async update(id: number, data: EmpresaUpdate, ctx: AccionCtx): Promise<Empresa> {
    const actual = await this.fila(id);
    const { despues, antes, hayCambios } = calcularCambios(actual, data as Partial<EmpresaFila>);
    if (!hayCambios) return this.aEmpresa(actual);
    const fila = await this.repo.update(id, despues as EmpresaUpdate);
    await this.audit.registrarAccion(ctx, 'plataforma.empresa_editar', 'empresas', id, { antes, despues });
    return this.aEmpresa(fila);
  }

  /** Colores de la marca: por defecto, tomados del ícono o personalizados (C-14). En `defecto` no se guardan colores. */
  async marca(id: number, data: EmpresaMarca, ctx: AccionCtx): Promise<Empresa> {
    const actual = await this.fila(id);
    const { despues, antes, hayCambios } = calcularCambios(actual, {
      colorModo: data.colorModo,
      colorPrincipal: data.colorPrincipal,
      colorAcento: data.colorAcento,
    });
    if (!hayCambios) return this.aEmpresa(actual);
    const fila = await this.repo.update(id, despues);
    await this.audit.registrarAccion(ctx, 'plataforma.empresa_marca', 'empresas', id, { antes, despues });
    return this.aEmpresa(fila);
  }

  /** Una empresa nunca se borra: se desactiva (DC-009). */
  async desactivar(id: number, ctx: AccionCtx): Promise<Empresa> {
    const actual = await this.fila(id);
    if (ctx.actor && (await this.repo.empresaDe(ctx.actor.id)) === id) {
      throw HttpError.conflict('No puedes desactivar tu propia empresa');
    }
    if (!actual.activa) return this.aEmpresa(actual);
    const fila = await this.repo.update(id, { activa: false });
    await this.audit.registrarAccion(ctx, 'plataforma.empresa_desactivar', 'empresas', id, { nombre: actual.nombre });
    return this.aEmpresa(fila);
  }

  async reactivar(id: number, ctx: AccionCtx): Promise<Empresa> {
    const actual = await this.fila(id);
    if (actual.activa) return this.aEmpresa(actual);
    const fila = await this.repo.update(id, { activa: true });
    await this.audit.registrarAccion(ctx, 'plataforma.empresa_reactivar', 'empresas', id, { nombre: actual.nombre });
    return this.aEmpresa(fila);
  }

  // ---------- Módulos ----------

  async modulos(id: number): Promise<{ modulos: EstadoModulos }> {
    await this.fila(id);
    return { modulos: estadoDesde(await this.repo.modulosEncendidos(id)) };
  }

  /**
   * Aplica los cambios pedidos. El estado resultante debe ser válido (cada módulo encendido con lo que
   * necesita encendido); si no, no se guarda nada y se dice qué falta.
   */
  async actualizarModulos(id: number, { modulos: pedido }: EmpresaModulosInput, ctx: AccionCtx) {
    await this.fila(id);
    const actual = estadoDesde(await this.repo.modulosEncendidos(id));
    const cambios = Object.fromEntries(
      Object.entries(pedido).filter(([clave, encendido]) => esModuloOpcional(clave) && actual[clave] !== encendido),
    );
    const siguiente = { ...actual, ...cambios };

    if (problemasDeModulos(siguiente).length) {
      throw HttpError.conflict(
        MENSAJE_MODULOS,
        mensajesProblemasModulos(siguiente).map((message) => ({ path: 'modulos', message })),
      );
    }
    if (Object.keys(cambios).length === 0) return { modulos: actual };

    await this.repo.guardarModulos(id, cambios);
    lectorModulos.invalidar(id);
    const antes = Object.fromEntries(Object.keys(cambios).map((c) => [c, actual[c as keyof EstadoModulos]]));
    await this.audit.registrarAccion(ctx, 'plataforma.modulos_cambiar', 'empresas', id, { antes, despues: cambios });
    return { modulos: siguiente };
  }

  /** El super admin entra a trabajar en una empresa: queda en la auditoría (C-09). */
  async entrar(id: number, ctx: AccionCtx): Promise<Empresa> {
    const fila = await this.fila(id);
    if (!fila.activa) throw HttpError.conflict('Esa empresa está dada de baja');
    await this.audit.registrarAccion(ctx, 'plataforma.entrar_empresa', 'empresas', id, { empresa: fila.nombre });
    return this.aEmpresa(fila);
  }

  // ---------- Administradores ----------

  async administradores(id: number): Promise<EmpresaAdministrador[]> {
    await this.fila(id);
    return this.repo.administradores(id);
  }

  /** Alta con contraseña temporal que el administrador cambia al entrar (D-012). */
  async crearAdministrador(id: number, data: EmpresaAdminCreate, ctx: AccionCtx) {
    const empresa = await this.fila(id);
    if (!empresa.activa) throw HttpError.conflict('La empresa está desactivada');
    if (await this.repo.emailExiste(data.email)) {
      throw HttpError.conflict('Ya existe un usuario con este correo', [
        { path: 'email', message: 'Ya existe un usuario con este correo' },
      ]);
    }
    const passwordTemporal = generateTemporaryPassword();
    const admin = await this.repo.crearAdministrador({
      empresaId: id,
      nombre: data.nombre,
      email: data.email,
      telefono: data.telefono ?? null,
      passwordHash: await hashPassword(passwordTemporal),
    });
    await this.audit.registrarAccion(ctx, 'plataforma.administrador_crear', 'usuarios', admin.id, {
      empresaId: id,
      email: admin.email,
    });
    return { usuario: admin, passwordTemporal };
  }

  // ---------- Ícono ----------

  /** SVG, PNG, JPG o WebP de hasta 300 KB. El contenido se confirma por sus bytes, no por lo que declare el navegador. */
  async subirLogo(id: number, archivo: ArchivoLogo | undefined, ctx: AccionCtx): Promise<Empresa> {
    const actual = await this.fila(id);
    if (!archivo) throw HttpError.badRequest('Selecciona el ícono de la empresa');

    let mime: string;
    if (archivo.mimetype === 'image/svg+xml') {
      const r = validarSvg(archivo.buffer);
      if (!r.ok) throw HttpError.badRequest(r.motivo);
      mime = 'image/svg+xml';
    } else {
      const detectado = detectarImagen(archivo.buffer);
      if (!detectado || !RASTER_LOGO.includes(detectado)) {
        throw HttpError.badRequest('El ícono debe ser SVG, PNG, JPG o WebP');
      }
      mime = detectado;
    }

    const clave = await this.storage.guardar(archivo.buffer, mime, 'empresas');
    const fila = await this.repo.update(id, { logoClave: clave });
    if (actual.logoClave) await this.storage.eliminar(actual.logoClave);
    await this.audit.registrarAccion(ctx, 'plataforma.logo_cambiar', 'empresas', id, { tipo: mime });
    return this.aEmpresa(fila);
  }

  /**
   * Sin ícono se usan las iniciales de la empresa. Si sus colores venían del ícono, vuelven a la paleta por
   * defecto; los personalizados se conservan.
   */
  async quitarLogo(id: number, ctx: AccionCtx): Promise<Empresa> {
    const actual = await this.fila(id);
    if (!actual.logoClave) return this.aEmpresa(actual);
    const restablecer = actual.colorModo === 'logo';
    const fila = await this.repo.update(
      id,
      restablecer
        ? { logoClave: null, colorModo: 'defecto', colorPrincipal: null, colorAcento: null }
        : { logoClave: null },
    );
    await this.storage.eliminar(actual.logoClave);
    await this.audit.registrarAccion(ctx, 'plataforma.logo_quitar', 'empresas', id, { coloresRestablecidos: restablecer });
    return this.aEmpresa(fila);
  }
}
