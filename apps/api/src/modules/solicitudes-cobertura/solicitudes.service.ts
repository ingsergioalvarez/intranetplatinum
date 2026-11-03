import {
  HORAS_RECORDAR_SOLICITUD,
  HORAS_REPETIR_SOLICITUD,
  MOTIVO_CANCELAR_SOLICITUD_LABEL,
  ROLES,
  sumarDiasFecha,
  textoMotivoLista,
  type CancelarSolicitudInput,
  type SolicitudCobertura,
  type SolicitudesLista,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, type AccionCtx, type AuthUser } from '../../core';
import { sinAtencion, type AvisosAtencion } from '../avisos/atencion';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { SolicitudRow, SolicitudesRepository } from './solicitudes.repository';

const RUTA = '/asistencia/solicitudes';
const HORA = 3_600_000;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;

/** Lo que otros módulos necesitan de las solicitudes: crearlas y cerrarlas al asignar la cobertura. */
export interface SolicitudesPuerto {
  crear(d: {
    sitioId: number;
    sitioNombre: string;
    solicitanteId: number;
    guardiaId: number | null;
    guardiaNombre: string | null;
    fecha: string;
    motivo: string;
  }): Promise<void>;
  cerrarPorCobertura(d: {
    sitioId: number;
    sitioNombre: string;
    desde: string;
    hasta: string;
    guardiaNombre: string;
    coberturaId: number;
    actorId: number;
  }): Promise<void>;
}

export const sinSolicitudes: SolicitudesPuerto = {
  crear: async () => undefined,
  cerrarPorCobertura: async () => undefined,
};

const aSolicitud = ({ recordadaEn: _r, createdAt, cerradaEn, ...s }: SolicitudRow): SolicitudCobertura => ({
  ...s,
  createdAt: createdAt.toISOString(),
  cerradaEn: cerradaEn?.toISOString() ?? null,
});

/**
 * Solicitudes de cobertura (A-39, completa A-26): el supervisor que necesita un guardia de otro supervisor
 * la pide al admin; queda guardada, el admin la atiende desde el calendario del sitio y se cierra sola al
 * asignar la cobertura (avisando a quien la pidió). El supervisor ve solo las suyas y puede cancelarlas; si
 * pasan horas sin atenderse se le recuerda al admin.
 */
export class SolicitudesCoberturaService extends BaseService implements SolicitudesPuerto {
  constructor(
    private readonly repo: SolicitudesRepository,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly atencion: AvisosAtencion = sinAtencion,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  /** La crea el supervisor al pedir un guardia de otro supervisor; avisa a los admin. */
  async crear(d: Parameters<SolicitudesPuerto['crear']>[0]) {
    const s = await this.repo.crear({
      sitioId: d.sitioId,
      solicitanteId: d.solicitanteId,
      guardiaId: d.guardiaId,
      fecha: d.fecha,
      motivo: d.motivo,
    });
    await this.audit.registrar({
      usuarioId: d.solicitanteId,
      accion: 'solicitudes_cobertura.crear',
      entidad: 'solicitudes_cobertura',
      entidadId: s.id,
      datos: { sitio: d.sitioNombre, guardia: d.guardiaNombre, fecha: d.fecha, motivo: d.motivo },
    });
    const admins = (await this.repo.admins()).filter((id) => id !== d.solicitanteId);
    await this.avisar(admins, {
      tipo: 'cobertura',
      titulo: 'Solicitud de cobertura',
      mensaje: `${s.solicitante.nombre} pide un guardia de otro supervisor para ${d.sitioNombre} (${fechaCorta(d.fecha)}${
        d.guardiaNombre ? `, por ${d.guardiaNombre}` : ''
      }). Elige quién cubre desde el calendario`,
      ruta: RUTA,
      entidad: { tipo: 'solicitud', id: s.id },
    });
  }

  /** Admin: todas; supervisor: solo las que él pidió. Las pendientes primero. */
  async listar(user: AuthUser): Promise<SolicitudesLista> {
    const filas = await this.repo.listar(user.rol === ROLES.ADMIN ? null : user.id, 100);
    return { items: filas.map(aSolicitud), pendientes: filas.filter((f) => f.estado === 'pendiente').length };
  }

  /** Cancelar una pendiente: quien la pidió o el admin, con motivo. */
  async cancelar(id: number, { categoria, nota }: CancelarSolicitudInput, user: AuthUser, ctx: AccionCtx) {
    const s = await this.repo.findById(id);
    if (!s || (user.rol !== ROLES.ADMIN && s.solicitante.id !== user.id)) {
      throw HttpError.notFound('Solicitud no encontrada');
    }
    if (s.estado !== 'pendiente') throw HttpError.conflict('Esta solicitud ya se cerró');
    const motivo = textoMotivoLista(MOTIVO_CANCELAR_SOLICITUD_LABEL[categoria], nota);
    const por = await this.repo.nombreDe(ctx.actorId);
    await this.repo.cerrar(id, { estado: 'cancelada', cerradaEn: this.ahora(), cerradaPor: por, resolucion: motivo });
    await this.atencion.atender({ tipo: 'solicitud', id }, { porId: ctx.actorId, resultado: 'Cancelada' });
    await this.audit.registrarAccion(ctx, 'solicitudes_cobertura.cancelar', 'solicitudes_cobertura', id, {
      sitio: s.sitio.nombre,
      motivo,
    });
    // Si la cancela un admin, se entera quien la pidió; si la cancela quien la pidió, se enteran los admin.
    const destino =
      s.solicitante.id === ctx.actorId ? (await this.repo.admins()).filter((a) => a !== ctx.actorId) : [s.solicitante.id];
    await this.avisar(destino, {
      tipo: 'cobertura',
      titulo: 'Solicitud de cobertura cancelada',
      mensaje: `La solicitud para ${s.sitio.nombre} (${fechaCorta(s.fecha)}) se canceló${por ? ` por ${por}` : ''}: ${motivo}`,
      ruta: RUTA,
    });
    return aSolicitud((await this.repo.findById(id))!);
  }

  /**
   * Al asignar una cobertura en un sitio se cierran sus solicitudes pendientes de esos días (o del día
   * anterior, porque el sitio pudo quedar solo la noche antes) y se avisa a quien las pidió.
   */
  async cerrarPorCobertura(d: Parameters<SolicitudesPuerto['cerrarPorCobertura']>[0]) {
    const desde = sumarDiasFecha(d.desde, -1);
    const lista = (await this.repo.pendientesDelSitio(d.sitioId)).filter((s) => s.fecha >= desde && s.fecha <= d.hasta);
    if (lista.length === 0) return;
    const por = await this.repo.nombreDe(d.actorId);
    const rango = d.desde === d.hasta ? `el ${fechaCorta(d.desde)}` : `del ${fechaCorta(d.desde)} al ${fechaCorta(d.hasta)}`;
    for (const s of lista) {
      await this.repo.cerrar(s.id, {
        estado: 'atendida',
        cerradaEn: this.ahora(),
        cerradaPor: por,
        resolucion: `${d.guardiaNombre} cubre ${rango}`,
        coberturaId: d.coberturaId,
      });
      await this.atencion.atender({ tipo: 'solicitud', id: s.id }, { porId: d.actorId, resultado: 'Atendida' });
      await this.audit.registrar({
        usuarioId: d.actorId,
        accion: 'solicitudes_cobertura.atender',
        entidad: 'solicitudes_cobertura',
        entidadId: s.id,
        datos: { sitio: d.sitioNombre, guardia: d.guardiaNombre, coberturaId: d.coberturaId },
      });
      if (s.solicitante.id !== d.actorId) {
        await this.avisar([s.solicitante.id], {
          tipo: 'cobertura',
          titulo: 'Tu solicitud de cobertura se atendió',
          mensaje: `Para ${d.sitioNombre}: ${d.guardiaNombre} cubre ${rango}`,
          ruta: RUTA,
        });
      }
    }
  }

  /** Vigilancia (cada minuto): a las 2 h sin atender se le recuerda al admin, y cada 4 h mientras siga igual. */
  async recordar() {
    const ahora = this.ahora();
    const pendientes = await this.repo.porRecordar(
      new Date(ahora.getTime() - HORAS_RECORDAR_SOLICITUD * HORA),
      new Date(ahora.getTime() - HORAS_REPETIR_SOLICITUD * HORA),
    );
    if (pendientes.length === 0) return;
    const admins = await this.repo.admins();
    for (const s of pendientes) {
      const horas = Math.floor((ahora.getTime() - s.createdAt.getTime()) / HORA);
      await this.avisar(admins, {
        tipo: 'cobertura',
        titulo: 'Solicitud de cobertura sin atender',
        mensaje: `${s.solicitante.nombre} pidió un guardia para ${s.sitio.nombre} (${fechaCorta(s.fecha)}) hace ${horas} h y sigue sin atenderse`,
        ruta: RUTA,
        entidad: { tipo: 'solicitud', id: s.id },
      });
      await this.repo.marcarRecordada(s.id, ahora);
    }
  }
}
