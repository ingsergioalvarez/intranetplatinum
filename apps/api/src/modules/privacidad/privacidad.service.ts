import {
  AVISO_PRIVACIDAD_VERSION,
  type AceptarAvisoData,
  type AvisoPrivacidadLista,
  type EstadoAvisoPrivacidad,
  type FiltroAvisoPrivacidad,
} from '@platinum/shared';
import { BaseService, AuditLogger, HttpError, carteraDe, type AccionCtx, type AuthUser } from '../../core';
import { sinAtencion, type AvisosAtencion } from '../avisos/atencion';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { AceptacionFila, PrivacidadRepository } from './privacidad.repository';

const RUTA_GUARDIA = '/marcar';
const RUTA_ADMIN = '/privacidad';

const estadoDe = (a: AceptacionFila | null | undefined): EstadoAvisoPrivacidad => ({
  versionVigente: AVISO_PRIVACIDAD_VERSION,
  aceptada: !!a,
  vigente: a?.version === AVISO_PRIVACIDAD_VERSION,
  versionAceptada: a?.version ?? null,
  aceptadaEn: a?.aceptadaEn.toISOString() ?? null,
});

/**
 * Aviso de privacidad por el uso del rostro (A-68). El guardia lo lee y lo acepta; sin ninguna aceptación el
 * servidor no le deja checar ni registrar su rostro. Si el texto cambia (nueva versión) se le muestra de nuevo,
 * pero no se le bloquea el checador: solo se bloquea a quien nunca aceptó. Al guardia y a su admin les llega un
 * aviso de campanita mientras falte, que se marca atendido cuando acepta.
 */
export class PrivacidadService extends BaseService {
  constructor(
    private readonly repo: PrivacidadRepository,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly atencion: AvisosAtencion = sinAtencion,
  ) {
    super();
  }

  /** ¿Puede checar? Sí si alguna vez aceptó el aviso. */
  async aceptoAlguna(usuarioId: number) {
    return !!(await this.repo.ultimaAceptacion(usuarioId));
  }

  /** Cómo está el guardia. Si nunca aceptó, le deja (una sola vez) el aviso de campanita a él y a su admin. */
  async estado(user: AuthUser): Promise<EstadoAvisoPrivacidad> {
    const estado = estadoDe(await this.repo.ultimaAceptacion(user.id));
    if (!estado.aceptada) await this.recordar(user);
    return estado;
  }

  async aceptar(user: AuthUser, { version }: AceptarAvisoData, ctx: AccionCtx): Promise<EstadoAvisoPrivacidad> {
    if (version !== AVISO_PRIVACIDAD_VERSION) {
      throw HttpError.conflict('El aviso de privacidad cambió. Vuelve a leerlo antes de aceptar.');
    }
    await this.repo.aceptar({ usuarioId: user.id, version, ip: ctx.ip, userAgent: ctx.userAgent });
    await this.audit.registrarAccion(ctx, 'privacidad.aceptar', 'usuarios', user.id, { version });
    await this.atencion.atender(
      { tipo: 'aviso_privacidad', id: user.id },
      { porId: user.id, resultado: 'Aceptó el aviso de privacidad' },
    );
    return estadoDe(await this.repo.ultimaAceptacion(user.id));
  }

  /** Quién ya aceptó y quién falta, dentro de la cartera de quien consulta. */
  async guardias(actor: AuthUser, filtro: FiltroAvisoPrivacidad = 'todos'): Promise<AvisoPrivacidadLista> {
    const guardias = await this.repo.guardias(carteraDe(actor));
    const aceptaciones = await this.repo.ultimasAceptaciones(guardias.map((g) => g.id));
    const items = guardias
      .map((g) => {
        const e = estadoDe(aceptaciones.get(g.id));
        return {
          id: g.id,
          nombre: g.nombre,
          aceptada: e.aceptada,
          vigente: e.vigente,
          versionAceptada: e.versionAceptada,
          aceptadaEn: e.aceptadaEn,
        };
      })
      .sort((a, b) => Number(a.vigente) - Number(b.vigente) || a.nombre.localeCompare(b.nombre, 'es'));
    return {
      versionVigente: AVISO_PRIVACIDAD_VERSION,
      items: filtro === 'pendientes' ? items.filter((g) => !g.vigente) : items,
      sinAceptar: items.filter((g) => !g.aceptada).length,
      pendientes: items.filter((g) => !g.vigente).length,
    };
  }

  private async recordar(user: AuthUser) {
    if (await this.repo.hayAvisoPendiente(user.id)) return;
    const entidad = { tipo: 'aviso_privacidad', id: user.id } as const;
    await this.avisar([user.id], {
      tipo: 'asignacion',
      titulo: 'Acepta el aviso de privacidad',
      mensaje: 'Para poder checar necesitas leer y aceptar el aviso de privacidad por el uso de tu rostro.',
      ruta: RUTA_GUARDIA,
      entidad,
    });
    const admins = await this.repo.adminsDe({ guardiaId: user.id });
    const nombre = await this.repo.nombreDe(user.id);
    await this.avisar(admins, {
      tipo: 'asignacion',
      titulo: 'Guardia sin aceptar el aviso de privacidad',
      mensaje: `${nombre ?? 'Un guardia'} aún no acepta el aviso de privacidad y no puede checar.`,
      ruta: RUTA_ADMIN,
      entidad,
    });
  }
}
