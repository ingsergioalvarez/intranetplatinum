import {
  RESULTADO_EMERGENCIA_LABEL,
  ROLES,
  SEGUNDOS_ESCALAR_EMERGENCIA,
  TIPO_EMERGENCIA_LABEL,
  type ContactoTelefono,
  type Emergencia,
  type EmergenciaCerrarInput,
  type EmergenciaCreateInput,
  type EmergenciaTipoInput,
  type EmergenciasLista,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, hoyISO, type AccionCtx, type AuthUser } from '../../core';
import { sinAtencion, type AvisosAtencion } from '../avisos/atencion';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { EmergenciaRow, EmergenciasRepository } from './emergencias.repository';

const RUTA = '/asistencia/emergencias';

const aEmergencia = (
  { createdAt, acusadaEn, cerradaEn, ...e }: EmergenciaRow,
  supervisor?: ContactoTelefono | null,
): Emergencia => ({
  ...e,
  ...(supervisor !== undefined && { supervisor }),
  createdAt: createdAt.toISOString(),
  acusadaEn: acusadaEn?.toISOString() ?? null,
  cerradaEn: cerradaEn?.toISOString() ?? null,
});

/**
 * Botón de pánico (A-60). Se manda al instante, sin preguntar nada: ubicación, hora del servidor y sitio salen
 * de aquí. Avisa (con push urgente) al supervisor del sitio y a los admin; si nadie la acusa en un minuto la
 * alerta se repite a todos los supervisores y admin hasta que alguien la reciba. Todo queda en auditoría.
 */
export class EmergenciasService extends BaseService {
  constructor(
    private readonly repo: EmergenciasRepository,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly atencion: AvisosAtencion = sinAtencion,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  /** A quién le llega la alerta: el supervisor del sitio y los admin; o, si la lanza un supervisor/admin, los demás. */
  private async destinatarios(e: EmergenciaRow, supervisorDelSitio: number | null) {
    const admins = await this.repo.admins();
    const supervisores =
      e.usuario.rol === ROLES.GUARDIA && supervisorDelSitio ? [supervisorDelSitio] : await this.repo.supervisores();
    return [...new Set([...admins, ...supervisores])].filter((id) => id !== e.usuario.id);
  }

  private mensaje(e: EmergenciaRow) {
    return `${e.usuario.nombre} pidió ayuda${e.sitio ? ` en ${e.sitio.nombre}` : ''}`;
  }

  /** Lanza la alerta. Si ya tiene una activa, devuelve esa (un doble toque no la duplica). */
  async crear(input: EmergenciaCreateInput, user: AuthUser, ctx: AccionCtx): Promise<Emergencia> {
    const previa = await this.repo.activaDe(user.id);
    if (previa) return aEmergencia(previa, await this.supervisorDe(user));
    const sitio = user.rol === ROLES.GUARDIA ? await this.repo.sitioDe(user.id, hoyISO()) : null;
    const e = await this.repo.crear({ usuarioId: user.id, sitioId: sitio?.id ?? null, ...input });
    await this.audit.registrarAccion(ctx, 'emergencias.crear', 'emergencias', e.id, {
      sitio: e.sitio?.nombre ?? null,
      lat: e.lat,
      lng: e.lng,
      bateria: e.bateria,
    });
    await this.avisar(await this.destinatarios(e, sitio?.supervisorId ?? null), {
      tipo: 'emergencia',
      titulo: 'EMERGENCIA',
      mensaje: this.mensaje(e),
      ruta: RUTA,
      entidad: { tipo: 'emergencia', id: e.id },
      urgente: true,
    });
    return aEmergencia(e, await this.supervisorDe(user));
  }

  /** A quién llamar desde la alerta propia: el supervisor del sitio del guardia (null si no tiene). */
  private async supervisorDe(user: AuthUser): Promise<ContactoTelefono | null> {
    if (user.rol !== ROLES.GUARDIA) return null;
    const id = (await this.repo.sitioDe(user.id, hoyISO()))?.supervisorId;
    return id ? this.repo.contactoDe(id) : null;
  }

  /** La activa del propio usuario (para que vea su estado), o null. */
  async mia(user: AuthUser): Promise<Emergencia | null> {
    const e = await this.repo.activaDe(user.id);
    return e && aEmergencia(e, await this.supervisorDe(user));
  }

  /** Quien la lanzó dice de qué se trata (después de enviar). Solo él. */
  async fijarTipo(id: number, { tipo }: EmergenciaTipoInput, user: AuthUser, ctx: AccionCtx): Promise<Emergencia> {
    await this.propia(id, user);
    await this.repo.fijarTipo(id, tipo);
    await this.audit.registrarAccion(ctx, 'emergencias.tipo', 'emergencias', id, { tipo });
    return aEmergencia((await this.repo.findById(id))!);
  }

  /** "Fue sin querer": quien la lanzó la cierra como falsa alarma y se avisa a quienes la recibieron. */
  async cancelar(id: number, user: AuthUser, ctx: AccionCtx): Promise<Emergencia> {
    const e = await this.propia(id, user);
    await this.repo.cerrar(id, {
      cerradaEn: this.ahora(),
      cerradaPor: e.usuario.nombre,
      resultado: 'falsa_alarma',
      nota: 'Fue sin querer (la canceló quien la lanzó)',
    });
    await this.atencion.atender({ tipo: 'emergencia', id }, { porId: user.id, resultado: 'Falsa alarma (sin querer)' });
    await this.audit.registrarAccion(ctx, 'emergencias.cancelar', 'emergencias', id, {});
    const sitio = e.usuario.rol === ROLES.GUARDIA ? await this.repo.sitioDe(e.usuario.id, hoyISO()) : null;
    await this.avisar(await this.destinatarios(e, sitio?.supervisorId ?? null), {
      tipo: 'emergencia',
      titulo: 'Falsa alarma',
      mensaje: `${e.usuario.nombre} avisó que fue sin querer`,
      ruta: RUTA,
    });
    return aEmergencia((await this.repo.findById(id))!);
  }

  private async propia(id: number, user: AuthUser) {
    const e = await this.repo.findById(id);
    if (!e || e.usuario.id !== user.id) throw HttpError.notFound('Emergencia no encontrada');
    if (e.estado !== 'activa') throw HttpError.conflict('Esta emergencia ya se cerró');
    return e;
  }

  /** Admin y supervisor: activas o todas, lo más nuevo arriba. */
  async listar(soloActivas: boolean): Promise<EmergenciasLista> {
    const filas = await this.repo.listar(soloActivas, 100);
    return { items: filas.map((f) => aEmergencia(f)), activas: filas.filter((f) => f.estado === 'activa').length };
  }

  /** "Voy en camino": queda registrado quién la recibió y se le avisa a quien la lanzó. */
  async acusar(id: number, user: AuthUser, ctx: AccionCtx): Promise<Emergencia> {
    const e = await this.repo.findById(id);
    if (!e) throw HttpError.notFound('Emergencia no encontrada');
    if (e.estado !== 'activa') throw HttpError.conflict('Esta emergencia ya se cerró');
    if (e.acusadaEn) return aEmergencia(e);
    const por = (await this.repo.nombreDe(user.id)) ?? 'Alguien';
    await this.repo.acusar(id, user.id, por, this.ahora());
    await this.atencion.atender({ tipo: 'emergencia', id }, { porId: user.id, resultado: 'En camino' });
    await this.audit.registrarAccion(ctx, 'emergencias.acusar', 'emergencias', id, { por });
    await this.avisar([e.usuario.id], {
      tipo: 'emergencia',
      titulo: 'Te están ayudando',
      mensaje: `${por} recibió tu alerta y va en camino`,
      ruta: null,
      urgente: true,
    });
    return aEmergencia((await this.repo.findById(id))!);
  }

  /** Cerrar con resultado: atendida, falsa alarma u otro (con nota). Admin y supervisor. */
  async cerrar(id: number, { resultado, nota }: EmergenciaCerrarInput, user: AuthUser, ctx: AccionCtx): Promise<Emergencia> {
    const e = await this.repo.findById(id);
    if (!e) throw HttpError.notFound('Emergencia no encontrada');
    if (e.estado !== 'activa') throw HttpError.conflict('Esta emergencia ya se cerró');
    const por = (await this.repo.nombreDe(user.id)) ?? 'Alguien';
    await this.repo.cerrar(id, { cerradaEn: this.ahora(), cerradaPor: por, resultado, nota: nota?.trim() || null });
    await this.atencion.atender(
      { tipo: 'emergencia', id },
      { porId: user.id, resultado: RESULTADO_EMERGENCIA_LABEL[resultado] },
    );
    await this.audit.registrarAccion(ctx, 'emergencias.cerrar', 'emergencias', id, { resultado, nota: nota ?? null });
    await this.avisar([e.usuario.id], {
      tipo: 'emergencia',
      titulo: 'Emergencia cerrada',
      mensaje: `${por} cerró tu alerta: ${RESULTADO_EMERGENCIA_LABEL[resultado]}`,
      ruta: null,
    });
    return aEmergencia((await this.repo.findById(id))!);
  }

  /** Cada minuto: repite la alerta (a todos los supervisores y admin) de las que nadie ha recibido. */
  async escalar() {
    const ahora = this.ahora();
    const antes = new Date(ahora.getTime() - SEGUNDOS_ESCALAR_EMERGENCIA * 1000);
    for (const e of await this.repo.porEscalar(antes, antes)) {
      await this.repo.marcarEscalada(e.id, ahora);
      await this.audit.registrar({
        usuarioId: null,
        accion: 'emergencias.escalar',
        entidad: 'emergencias',
        entidadId: e.id,
        datos: { veces: e.escaladas + 1 },
      });
      const todos = [...new Set([...(await this.repo.admins()), ...(await this.repo.supervisores())])].filter(
        (id) => id !== e.usuario.id,
      );
      await this.avisar(todos, {
        tipo: 'emergencia',
        titulo: 'SIN RESPUESTA',
        mensaje: `${this.mensaje(e)}${e.tipo ? ` (${TIPO_EMERGENCIA_LABEL[e.tipo]})` : ''}. Nadie la ha recibido`,
        ruta: RUTA,
        urgente: true,
      });
    }
  }
}
