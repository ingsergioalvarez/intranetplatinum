import {
  MAX_FOTOS_REPORTE,
  PERMISOS,
  ROLES,
  TRANSICIONES_ESTATUS,
  type Evidencia,
  type Paginated,
  type ReporteCreateData,
  type ReporteDetalle,
  type ReporteFiltro,
  type ReporteResumen,
  type SeguimientoCreateData,
  type SitioReportable,
} from '@platinum/shared';
import {
  BaseService,
  HttpError,
  StorageService,
  dateAFecha,
  detectarImagen,
  fechaADate,
  firmarArchivo,
  hoyISO,
  inicioDelDia,
  tienePermiso,
  type AuthUser,
} from '../../core';
import { notificadorNulo, type NotificadorReportes } from '../avisos/notificador';
import type { EvidenciaRow, FotoNueva, ReportesRepository, RestriccionSitio, Visibilidad } from './reportes.repository';

/** Archivo recibido por multer (en memoria). */
export interface ArchivoSubido {
  buffer: Buffer;
  size: number;
}

const errorFotos = (message: string) => HttpError.badRequest('Datos inválidos', [{ path: 'fotos', message }]);

/** Reportes de guardias (F3-02..F3-06): alta con fotos, consulta según rol y seguimiento. */
export class ReportesService extends BaseService {
  constructor(
    private readonly repo: ReportesRepository,
    private readonly storage: StorageService,
    private readonly hoy: () => string = () => hoyISO(),
    /** Avisos según la regla del cliente (D-016). */
    private readonly avisos: NotificadorReportes = notificadorNulo,
  ) {
    super();
  }

  // ---------- Consulta ----------

  async list(user: AuthUser, { page, limit, desde, hasta, mios, ...filtro }: ReporteFiltro) {
    const siguienteDia = (f: string) => dateAFecha(new Date(fechaADate(f).getTime() + 86_400_000));
    const page_: Paginated<ReporteResumen> = await this.repo.findPaged(
      {
        ...filtro,
        ...(mios && { creadoPorId: user.id }),
        ...((desde || hasta) && {
          creadoEntre: {
            desde: desde ? inicioDelDia(desde) : undefined,
            hasta: hasta ? inicioDelDia(siguienteDia(hasta)) : undefined,
          },
        }),
      },
      this.visibilidad(user),
      { page, limit },
    );
    return page_;
  }

  async detalle(user: AuthUser, id: number): Promise<ReporteDetalle> {
    const visibilidad = this.visibilidad(user);
    const r = await this.repo.findDetalle(id);
    if (!r || !(await this.repo.puedeVer(id, visibilidad))) throw HttpError.notFound('Reporte no encontrado');

    return {
      ...r,
      evidencias: r.evidencias.map(toEvidencia),
      seguimientos: r.seguimientos.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        evidencias: s.evidencias.map(toEvidencia),
      })),
      acciones: {
        comentar: tienePermiso(user, PERMISOS.REPORTES_SEGUIMIENTO),
        estatusPermitidos: tienePermiso(user, PERMISOS.REPORTES_ESTATUS)
          ? TRANSICIONES_ESTATUS[r.estatus]
          : [],
      },
    };
  }

  /** Sitios donde el usuario puede reportar o filtrar según su rol. */
  sitiosReportables(user: AuthUser): Promise<SitioReportable[]> {
    return this.repo.sitiosReportables(this.restriccionSitios(user));
  }

  // ---------- Alta (F3-04) ----------

  async crear(user: AuthUser, data: ReporteCreateData, archivos: ArchivoSubido[]): Promise<ReporteDetalle> {
    if (archivos.length === 0) throw errorFotos('Agrega al menos una foto como evidencia');
    const fotos = this.validarFotos(archivos);

    if (!(await this.repo.categoriaActiva(data.categoriaId))) {
      throw HttpError.badRequest('Datos inválidos', [
        { path: 'categoriaId', message: 'Categoría no disponible' },
      ]);
    }
    const sitio = await this.repo.sitioParaReportar(data.sitioId, this.restriccionSitios(user));
    if (!sitio) {
      throw HttpError.badRequest('Datos inválidos', [
        { path: 'sitioId', message: 'No puedes reportar en este sitio' },
      ]);
    }

    const guardadas = await this.guardarFotos(fotos);
    try {
      const { id, folio } = await this.repo.crear(
        { ...data, clienteId: sitio.clienteId, creadoPorId: user.id },
        guardadas,
        Number(this.hoy().slice(0, 4)),
      );
      this.log('reporte creado', { folio, usuarioId: user.id });
      const reporte = await this.detalle(user, id);
      await this.avisos.reporteCreado(reporte, user.id);
      return reporte;
    } catch (err) {
      await this.borrarFotos(guardadas);
      throw err;
    }
  }

  // ---------- Seguimiento (F3-05) ----------

  async agregarSeguimiento(
    user: AuthUser,
    reporteId: number,
    { comentario, estatus }: SeguimientoCreateData,
    archivos: ArchivoSubido[],
  ): Promise<ReporteDetalle> {
    const actual = await this.detalle(user, reporteId);
    const texto = comentario ?? null;
    if (!texto && !estatus && archivos.length === 0) {
      throw HttpError.badRequest('Datos inválidos', [
        { path: 'comentario', message: 'Escribe un comentario, agrega fotos o cambia el estatus' },
      ]);
    }
    if (estatus && estatus !== actual.estatus) {
      if (!tienePermiso(user, PERMISOS.REPORTES_ESTATUS))
        throw HttpError.forbidden('No puedes cambiar el estatus');
      if (!TRANSICIONES_ESTATUS[actual.estatus].includes(estatus)) {
        throw HttpError.badRequest('Datos inválidos', [
          { path: 'estatus', message: 'Ese cambio de estatus no está permitido' },
        ]);
      }
    }
    const cambia = estatus && estatus !== actual.estatus ? estatus : null;
    const fotos = this.validarFotos(archivos);

    const guardadas = await this.guardarFotos(fotos);
    try {
      await this.repo.agregarSeguimiento(
        reporteId,
        {
          usuarioId: user.id,
          comentario: texto,
          estatusAnterior: cambia ? actual.estatus : null,
          estatusNuevo: cambia,
        },
        guardadas,
      );
    } catch (err) {
      await this.borrarFotos(guardadas);
      throw err;
    }
    const reporte = await this.detalle(user, reporteId);
    if (cambia) await this.avisos.estatusCambiado(reporte, cambia, user.id);
    else
      await this.avisos.comentarioAgregado(
        reporte,
        user.id,
        reporte.seguimientos.at(-1)?.usuario.nombre ?? 'Alguien',
      );
    return reporte;
  }

  // ---------- Apoyo ----------

  private visibilidad(user: AuthUser): Visibilidad {
    if (tienePermiso(user, PERMISOS.REPORTES_VER_TODOS)) return { tipo: 'todos' };
    if (user.rol === ROLES.CLIENTE && user.clienteId && tienePermiso(user, PERMISOS.REPORTES_VER_PROPIOS)) {
      return { tipo: 'cliente', clienteId: user.clienteId };
    }
    if (user.rol === ROLES.GUARDIA && tienePermiso(user, PERMISOS.REPORTES_VER_PROPIOS)) {
      return { tipo: 'guardia', usuarioId: user.id, hoy: this.hoy() };
    }
    return { tipo: 'ninguno' };
  }

  /** Sitios que puede consultar/reportar según su rol. */
  private restriccionSitios(user: AuthUser): RestriccionSitio {
    if (tienePermiso(user, PERMISOS.REPORTES_VER_TODOS)) return null;
    if (user.rol === ROLES.CLIENTE && user.clienteId) {
      return { tipo: 'cliente', clienteId: user.clienteId };
    }
    return { tipo: 'guardia', usuarioId: user.id, hoy: this.hoy() };
  }

  /** Máximo de fotos y tipo real por firma de bytes (no por la extensión). */
  private validarFotos(archivos: ArchivoSubido[]) {
    if (archivos.length > MAX_FOTOS_REPORTE) throw errorFotos(`Máximo ${MAX_FOTOS_REPORTE} fotos`);
    return archivos.map((a, i) => {
      const mime = detectarImagen(a.buffer);
      if (!mime) throw errorFotos(`La foto ${i + 1} no es una imagen válida (JPG, PNG, WEBP o HEIC)`);
      return { ...a, mime };
    });
  }

  private async guardarFotos(fotos: (ArchivoSubido & { mime: string })[]): Promise<FotoNueva[]> {
    const guardadas: FotoNueva[] = [];
    try {
      for (const f of fotos) {
        guardadas.push({
          archivo: await this.storage.guardar(f.buffer, f.mime, 'reportes'),
          mime: f.mime,
          tamano: f.size,
        });
      }
      return guardadas;
    } catch (err) {
      await this.borrarFotos(guardadas);
      throw err;
    }
  }

  private async borrarFotos(fotos: FotoNueva[]) {
    await Promise.all(fotos.map((f) => this.storage.eliminar(f.archivo).catch(() => undefined)));
  }
}

function toEvidencia({ archivo, createdAt, ...e }: EvidenciaRow): Evidencia {
  return { ...e, url: firmarArchivo(archivo), createdAt: createdAt.toISOString() };
}
