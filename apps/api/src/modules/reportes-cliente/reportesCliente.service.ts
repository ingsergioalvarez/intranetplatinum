import {
  ESTATUS_REPORTE_CLIENTE_LABEL,
  ROLES,
  type AtenderReporteClienteData,
  type OpcionesReporteCliente,
  type ReporteCliente,
  type ReporteClienteCreateData,
  type ReportesClienteLista,
} from '@platinum/shared';
import { BaseService, AuditLogger, HttpError, carteraDe, hoyISO, type AccionCtx, type AuthUser } from '../../core';
import { sinAtencion, type AvisosAtencion } from '../avisos/atencion';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type {
  ReporteClienteRow,
  ReportesClienteRepository,
  VisibilidadReporteCliente,
} from './reportesCliente.repository';

const RUTA = '/reportes-cliente';
const LIMITE = 100;

const campo = (path: string, message: string) =>
  new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [{ path, message }]);

/**
 * Reportes que levanta el cliente sobre el servicio o sobre un guardia concreto (A-59). Le llegan al supervisor
 * del sitio (o al admin dueño si el sitio no tiene supervisor); si son urgentes, a ambos al momento. El guardia
 * nunca se entera: no tiene acceso ni recibe avisos. Quien lo atiende lo toma a revisión o lo resuelve con una
 * respuesta que el cliente ve en su pantalla.
 */
export class ReportesClienteService extends BaseService {
  constructor(
    private readonly repo: ReportesClienteRepository,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly atencion: AvisosAtencion = sinAtencion,
    private readonly hoy: () => string = () => hoyISO(),
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  private aReporte({ createdAt, atendidoEn, ...r }: ReporteClienteRow): ReporteCliente {
    return { ...r, createdAt: createdAt.toISOString(), atendidoEn: atendidoEn?.toISOString() ?? null };
  }

  /** Cliente: los de su empresa; supervisor: los de sus sitios; admin: los de sus clientes; super admin: todos. */
  private visibilidad(user: AuthUser): VisibilidadReporteCliente {
    if (user.rol === ROLES.CLIENTE) {
      if (!user.clienteId) throw HttpError.forbidden();
      return { tipo: 'cliente', clienteId: user.clienteId };
    }
    if (user.rol === ROLES.SUPERVISOR) return { tipo: 'supervisor', usuarioId: user.id };
    if (user.rol === ROLES.ADMIN) {
      const cartera = carteraDe(user);
      return cartera === undefined ? { tipo: 'todos' } : { tipo: 'cartera', propietarioId: cartera };
    }
    throw HttpError.forbidden();
  }

  async listar(user: AuthUser): Promise<ReportesClienteLista> {
    const filas = await this.repo.listar(this.visibilidad(user), LIMITE);
    // Los que siguen sin resolver primero (los urgentes arriba); el orden de llegada se conserva dentro de cada grupo.
    const peso = (r: ReporteClienteRow) => (r.estatus === 'resuelto' ? 0 : r.urgente ? 2 : 1);
    filas.sort((a, b) => peso(b) - peso(a));
    return { items: filas.map((f) => this.aReporte(f)), pendientes: filas.filter((f) => f.estatus !== 'resuelto').length };
  }

  /** Sitios de su empresa y guardias de cada uno, para armar el formulario. */
  opciones(user: AuthUser): Promise<OpcionesReporteCliente> {
    if (!user.clienteId) throw HttpError.forbidden();
    return this.repo.opciones(user.clienteId, this.hoy());
  }

  async crear(user: AuthUser, data: ReporteClienteCreateData, ctx: AccionCtx): Promise<ReporteCliente> {
    if (!user.clienteId) throw HttpError.forbidden();
    const sitio = await this.repo.sitioDelCliente(data.sitioId, user.clienteId);
    if (!sitio) throw campo('sitioId', 'Elige un sitio de tu empresa');
    let guardia: { id: number; nombre: string } | null = null;
    if (data.tipo === 'guardia') {
      guardia = await this.repo.guardiaReciente(sitio.id, data.guardiaId!, this.hoy());
      if (!guardia) throw campo('guardiaId', 'Elige un guardia de este sitio');
    }

    const fila = await this.repo.crear({
      clienteId: user.clienteId,
      sitioId: sitio.id,
      guardiaId: guardia?.id ?? null,
      creadoPorId: user.id,
      tipo: data.tipo,
      urgente: data.urgente,
      asunto: data.asunto,
      descripcion: data.descripcion,
    });
    await this.audit.registrarAccion(ctx, 'reportes_cliente.crear', 'reportes_cliente', fila.id, {
      sitioId: sitio.id,
      tipo: data.tipo,
      guardiaId: guardia?.id ?? null,
      urgente: data.urgente,
    });

    // Supervisor del sitio; el admin dueño del cliente lo recibe si no hay supervisor o si es urgente. Si no hay
    // nadie asignado, el super admin.
    const admins = await this.repo.adminsDe({ sitioId: sitio.id });
    const supervisores = sitio.supervisorId ? [sitio.supervisorId] : [];
    let destino = data.urgente || supervisores.length === 0 ? [...supervisores, ...admins] : supervisores;
    if (destino.length === 0) destino = await this.repo.superAdmins();
    const sobre = guardia ? ` · sobre ${guardia.nombre}` : '';
    await this.avisar(
      destino.filter((id) => id !== user.id),
      {
        tipo: 'asignacion',
        titulo: data.urgente ? 'Reporte URGENTE de un cliente' : 'Reporte de un cliente',
        mensaje: `${fila.cliente.nombreComercial} · ${sitio.nombre}${sobre}: ${data.asunto}`,
        ruta: RUTA,
        entidad: { tipo: 'reporte_cliente', id: fila.id },
        urgente: data.urgente,
      },
    );
    return this.aReporte(fila);
  }

  /** Supervisor o admin: lo toma a revisión o lo resuelve; el cliente que lo levantó recibe un aviso. */
  async atender(id: number, user: AuthUser, { estatus, respuesta }: AtenderReporteClienteData, ctx: AccionCtx): Promise<ReporteCliente> {
    const fila = await this.repo.findById(id, this.visibilidad(user));
    if (!fila) throw HttpError.notFound('Reporte no encontrado');
    if (fila.estatus === 'resuelto') throw HttpError.conflict('Este reporte ya está resuelto');
    if (fila.estatus === estatus) throw HttpError.conflict('Este reporte ya está en revisión');

    const por = await this.repo.nombreDe(user.id);
    await this.repo.atender(id, { estatus, atendidoEn: this.ahora(), atendidoPor: por, respuesta: respuesta || null });
    await this.atencion.atender(
      { tipo: 'reporte_cliente', id },
      { porId: user.id, resultado: ESTATUS_REPORTE_CLIENTE_LABEL[estatus] },
    );
    await this.audit.registrarAccion(ctx, `reportes_cliente.${estatus}`, 'reportes_cliente', id, {
      sitioId: fila.sitio.id,
      guardiaId: fila.guardia?.id ?? null,
    });
    await this.avisar(
      [fila.creadoPor.id].filter((u) => u !== user.id),
      {
        tipo: 'asignacion',
        titulo: estatus === 'resuelto' ? 'Tu reporte fue resuelto' : 'Tu reporte está en revisión',
        mensaje: `${fila.asunto}${respuesta ? `: ${respuesta}` : ''}`,
        ruta: RUTA,
      },
    );
    return this.aReporte((await this.repo.findById(id, this.visibilidad(user)))!);
  }
}
