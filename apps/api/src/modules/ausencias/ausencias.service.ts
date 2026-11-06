import {
  COMPROBANTE_AUSENCIA,
  MOTIVO_CANCELAR_AUSENCIA_LABEL,
  MOTIVO_RECHAZAR_AUSENCIA_LABEL,
  PERMISOS,
  ROLES,
  TIPO_AUSENCIA_LABEL,
  diasDeAusencia,
  textoMotivoLista,
  type Ausencia,
  type AusenciaCreateData,
  type AusenciasLista,
  type CancelarAusenciaInput,
  type ResolverAusenciaInput,
  type VistaPreviaAusencia,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseService,
  HttpError,
  detectarImagen,
  firmarArchivo,
  alcanceDe,
  hoyISO,
  tienePermiso,
  type AccionCtx,
  type AuthUser,
  type StorageService,
} from '../../core';
import { sinAtencion, type AvisosAtencion } from '../avisos/atencion';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import { exigirGuardia, type Alcance } from '../sitios/alcance';
import type { AusenciaRow, AusenciasRepository } from './ausencias.repository';

const RUTA_ADMIN = '/asistencia/ausencias';
const RUTA_GUARDIA = '/mis-ausencias';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
const rangoTexto = (desde: string, hasta: string) =>
  desde === hasta ? `el ${fechaCorta(desde)}` : `del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;

/** Archivo recibido por multer (en memoria). */
export interface ArchivoComprobante {
  buffer: Buffer;
  size: number;
}

const campo = (path: string, message: string) =>
  new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [{ path, message }]);

/**
 * Ausencias justificadas por adelantado (A-43): vacaciones, incapacidad, permiso… Solo el admin las aprueba
 * (o las registra directo); el guardia pide la suya y el supervisor, la de un guardia suyo. Aprobada, sus días
 * no generan "No se presentó" ni "Falta", las faltas que ya estuvieran marcadas en esos días se justifican solas
 * y todo sale en el reporte como "Ausencia justificada". Lo médico exige comprobante.
 */
export class AusenciasService extends BaseService {
  constructor(
    private readonly repo: AusenciasRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly bitacora: RegistrarBitacora = sinBitacora,
    private readonly atencion: AvisosAtencion = sinAtencion,
    private readonly hoy: () => string = () => hoyISO(),
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  private aAusencia(r: AusenciaRow): Ausencia {
    const { comprobanteClave, createdAt, resueltaEn, ...a } = r;
    return {
      ...a,
      dias: diasDeAusencia(r.desde, r.hasta),
      comprobante: comprobanteClave ? firmarArchivo(comprobanteClave) : null,
      createdAt: createdAt.toISOString(),
      resueltaEn: resueltaEn?.toISOString() ?? null,
    };
  }

  /** Según el alcance de su rol: todas, las de las personas de su alcance o solo las suyas. Las pendientes primero. */
  async listar(user: AuthUser, alcance: Alcance | null): Promise<AusenciasLista> {
    // Quien solo ve lo suyo, las suyas; el resto, las de las personas de su alcance (toda la empresa = todas).
    const ids = alcanceDe(user) === 'propio' ? [user.id] : alcance ? [...alcance.guardiaIds] : null;
    const filas = await this.repo.listar(ids, 100);
    return { items: filas.map((f) => this.aAusencia(f)), pendientes: filas.filter((f) => f.estado === 'pendiente').length };
  }

  /** Las faltas de esos días que se justificarían solas (para avisarle al admin antes de guardar). */
  async vistaPrevia(usuarioId: number, desde: string, hasta: string, alcance: Alcance | null): Promise<VistaPreviaAusencia> {
    exigirGuardia(alcance, usuarioId);
    const e = await this.repo.eventosAfectados(usuarioId, desde, hasta);
    return { faltas: e.length, fechas: [...new Set(e.map((x) => x.fecha))].sort() };
  }

  /** Pedir (guardia o supervisor) o registrar directo (admin) una ausencia. */
  async crear(
    data: AusenciaCreateData,
    foto: ArchivoComprobante | undefined,
    user: AuthUser,
    ctx: AccionCtx,
    alcance: Alcance | null,
  ): Promise<Ausencia> {
    const usuarioId = alcanceDe(user) === 'propio' ? user.id : data.usuarioId;
    if (!usuarioId) throw campo('usuarioId', 'Elige el guardia');
    exigirGuardia(alcance, usuarioId);
    const guardia = await this.repo.guardia(usuarioId);
    if (!guardia || !guardia.activo || guardia.rol !== ROLES.COLABORADOR) throw campo('usuarioId', 'Elige un guardia activo');

    // Lo médico exige comprobante; el resto, según el tipo.
    const regla = COMPROBANTE_AUSENCIA[data.tipo];
    const mime = foto && detectarImagen(foto.buffer);
    if (foto && !mime) throw campo('foto', 'El comprobante debe ser una foto (JPG, PNG, WebP o HEIC)');
    if (regla === 'obligatorio' && !foto) throw campo('foto', 'Adjunta la foto del comprobante');
    if (await this.repo.hayTraslape(usuarioId, data.desde, data.hasta)) {
      throw HttpError.conflict('Ya tiene una ausencia pendiente o aprobada en esas fechas', [
        { path: 'desde', message: 'Se cruza con otra ausencia de este guardia' },
      ]);
    }

    const clave = foto && mime ? await this.storage.guardar(foto.buffer, mime, 'ausencias') : null;
    let fila: AusenciaRow;
    try {
      fila = await this.repo.crear({
        usuarioId,
        tipo: data.tipo,
        desde: data.desde,
        hasta: data.hasta,
        motivo: data.motivo || null,
        solicitanteId: user.id,
        comprobanteClave: clave,
      });
    } catch (err) {
      if (clave) await this.storage.eliminar(clave).catch(() => undefined);
      throw err;
    }
    await this.audit.registrarAccion(ctx, 'ausencias.crear', 'ausencias', fila.id, {
      guardiaId: usuarioId,
      tipo: data.tipo,
      desde: data.desde,
      hasta: data.hasta,
      conComprobante: !!clave,
    });

    // Quien puede resolver ausencias la registra directo: queda aprobada. Lo demás espera su aprobación.
    if (tienePermiso(user, PERMISOS.AUSENCIAS_RESOLVER)) return this.aAusencia(await this.aplicar(fila, user.id, ctx, 'ausencias.registrar'));

    const rango = rangoTexto(data.desde, data.hasta);
    const quien =
      user.rol === ROLES.COLABORADOR ? guardia.nombre : `${(await this.repo.nombreDe(user.id)) ?? 'Un supervisor'} (por ${guardia.nombre})`;
    await this.avisar(await this.repo.admins({ guardiaId: guardia.id }), {
      tipo: 'asignacion',
      titulo: 'Solicitud de ausencia',
      mensaje: `${quien} pide ${TIPO_AUSENCIA_LABEL[data.tipo].toLowerCase()} ${rango}${
        regla === 'no' ? '' : clave ? ' (con comprobante)' : ''
      }. Apruébala o recházala`,
      ruta: RUTA_ADMIN,
      entidad: { tipo: 'ausencia', id: fila.id },
    });
    if (user.rol !== ROLES.COLABORADOR) {
      await this.avisar([usuarioId], {
        tipo: 'asignacion',
        titulo: 'Pidieron una ausencia por ti',
        mensaje: `Tu supervisor pidió ${TIPO_AUSENCIA_LABEL[data.tipo].toLowerCase()} ${rango} a tu nombre. La resuelve el administrador`,
        ruta: RUTA_GUARDIA,
      });
    }
    return this.aAusencia(fila);
  }

  /**
   * Deja la ausencia aprobada: justifica las faltas que ya hubiera en esos días, la anota en la bitácora del
   * guardia y avisa al guardia, a quien la pidió y a los supervisores del guardia (su sitio puede quedar sin
   * cubrir). Las checadas ya registradas no se tocan.
   */
  private async aplicar(fila: AusenciaRow, actorId: number, ctx: AccionCtx, accion: string): Promise<AusenciaRow> {
    const en = this.ahora();
    const tipo = TIPO_AUSENCIA_LABEL[fila.tipo];
    const afectados = await this.repo.eventosAfectados(fila.guardia.id, fila.desde, fila.hasta);
    await this.repo.justificarEventos(afectados.map((e) => e.id), `Ausencia justificada: ${tipo}`, actorId, en);
    for (const e of afectados) {
      await this.atencion.atender({ tipo: 'bitacora', id: e.id }, { porId: actorId, resultado: 'Ausencia justificada' });
    }
    const por = await this.repo.nombreDe(actorId);
    await this.repo.resolver(fila.id, { estado: 'aprobada', resueltaEn: en, resueltaPor: por, faltasJustificadas: afectados.length });
    await this.atencion.atender({ tipo: 'ausencia', id: fila.id }, { porId: actorId, resultado: 'Aprobada' });
    const rango = rangoTexto(fila.desde, fila.hasta);
    await this.audit.registrarAccion(ctx, accion, 'ausencias', fila.id, {
      guardiaId: fila.guardia.id,
      tipo: fila.tipo,
      desde: fila.desde,
      hasta: fila.hasta,
      faltasJustificadas: afectados.length,
    });
    await this.bitacora({
      usuarioIds: [fila.guardia.id],
      tipo: 'ausencia',
      detalle: `Ausencia justificada: ${tipo} ${rango}${fila.motivo ? `. ${fila.motivo}` : ''}${
        afectados.length ? `. Justificó ${afectados.length} ${afectados.length === 1 ? 'falta' : 'faltas'} de esos días` : ''
      }`,
      actorId,
    });

    const aviso = { tipo: 'asignacion' as const };
    if (fila.guardia.id !== actorId) {
      await this.avisar([fila.guardia.id], {
        ...aviso,
        titulo: 'Tu ausencia fue aprobada',
        mensaje: `${tipo} ${rango}: no se te cuenta como falta`,
        ruta: RUTA_GUARDIA,
      });
    }
    if (fila.solicitante.id !== actorId && fila.solicitante.id !== fila.guardia.id) {
      await this.avisar([fila.solicitante.id], {
        ...aviso,
        titulo: 'Ausencia aprobada',
        mensaje: `${fila.guardia.nombre}: ${tipo.toLowerCase()} ${rango}`,
        ruta: RUTA_ADMIN,
      });
    }
    return (await this.repo.findById(fila.id))!;
  }

  /** El admin aprueba o rechaza una solicitud pendiente. */
  async resolver(id: number, input: ResolverAusenciaInput, ctx: AccionCtx): Promise<Ausencia> {
    const fila = await this.repo.findById(id);
    if (!fila) throw HttpError.notFound('Ausencia no encontrada');
    if (fila.estado !== 'pendiente') throw HttpError.conflict('Esta solicitud ya se resolvió');
    if (input.decision === 'aprobar') {
      return this.aAusencia(await this.aplicar(fila, ctx.actorId, ctx, 'ausencias.aprobar'));
    }
    const motivo = textoMotivoLista(MOTIVO_RECHAZAR_AUSENCIA_LABEL[input.categoria!], input.nota);
    const por = await this.repo.nombreDe(ctx.actorId);
    await this.repo.resolver(id, { estado: 'rechazada', resueltaEn: this.ahora(), resueltaPor: por, resolucion: motivo });
    await this.atencion.atender({ tipo: 'ausencia', id }, { porId: ctx.actorId, resultado: 'Rechazada' });
    await this.audit.registrarAccion(ctx, 'ausencias.rechazar', 'ausencias', id, { guardiaId: fila.guardia.id, motivo });
    const destino = [...new Set([fila.guardia.id, fila.solicitante.id])].filter((u) => u !== ctx.actorId);
    await this.avisar(destino, {
      tipo: 'asignacion',
      titulo: 'Ausencia rechazada',
      mensaje: `Se rechazó la ausencia de ${fila.guardia.nombre} (${TIPO_AUSENCIA_LABEL[fila.tipo].toLowerCase()} ${rangoTexto(fila.desde, fila.hasta)}): ${motivo}`,
      ruta: fila.guardia.id === destino[0] ? RUTA_GUARDIA : RUTA_ADMIN,
    });
    return this.aAusencia((await this.repo.findById(id))!);
  }

  /**
   * Cancelar: una pendiente, quien la pidió o quien puede resolver; una aprobada que aún no empieza, solo quien puede resolver. Una ya
   * empezada no se cancela (sus faltas ya se justificaron).
   */
  async cancelar(id: number, { categoria, nota }: CancelarAusenciaInput, user: AuthUser, ctx: AccionCtx): Promise<Ausencia> {
    const fila = await this.repo.findById(id);
    const esAdmin = tienePermiso(user, PERMISOS.AUSENCIAS_RESOLVER);
    if (!fila || (!esAdmin && fila.solicitante.id !== user.id && fila.guardia.id !== user.id)) {
      throw HttpError.notFound('Ausencia no encontrada');
    }
    if (fila.estado === 'pendiente') {
      if (!esAdmin && fila.solicitante.id !== user.id) throw HttpError.forbidden('Solo quien la pidió puede cancelarla');
    } else if (fila.estado === 'aprobada') {
      if (!esAdmin) throw HttpError.forbidden('Pídele a quien aprueba ausencias que la cancele');
      if (fila.desde <= this.hoy()) throw HttpError.conflict('Esta ausencia ya empezó y no se puede cancelar');
    } else {
      throw HttpError.conflict('Esta ausencia ya no se puede cancelar');
    }
    const motivo = textoMotivoLista(MOTIVO_CANCELAR_AUSENCIA_LABEL[categoria], nota);
    const por = await this.repo.nombreDe(ctx.actorId);
    await this.repo.resolver(id, { estado: 'cancelada', resueltaEn: this.ahora(), resueltaPor: por, resolucion: motivo });
    await this.atencion.atender({ tipo: 'ausencia', id }, { porId: ctx.actorId, resultado: 'Cancelada' });
    await this.audit.registrarAccion(ctx, 'ausencias.cancelar', 'ausencias', id, { guardiaId: fila.guardia.id, motivo });
    const rango = rangoTexto(fila.desde, fila.hasta);
    await this.avisar(
      [...new Set([fila.guardia.id, fila.solicitante.id, ...(await this.repo.admins({ guardiaId: fila.guardia.id }))])].filter(
        (u) => u !== ctx.actorId,
      ),
      {
        tipo: 'asignacion',
        titulo: 'Ausencia cancelada',
        mensaje: `Se canceló la ausencia de ${fila.guardia.nombre} (${TIPO_AUSENCIA_LABEL[fila.tipo].toLowerCase()} ${rango}): ${motivo}`,
        ruta: RUTA_ADMIN,
      },
    );
    return this.aAusencia((await this.repo.findById(id))!);
  }
}
