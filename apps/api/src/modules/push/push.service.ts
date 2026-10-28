import {
  tituloDeAviso,
  type ClavePush,
  type PayloadPush,
  type QuitarSuscripcionPushInput,
  type SuscripcionPushInput,
  type TipoAviso,
} from '@platinum/shared';
import { BaseService } from '../../core';
import type { PushRepository, SuscripcionRow } from './push.repository';

/** Manda un push a un navegador. `expirada` = el navegador ya no existe (se borra su suscripción). */
export interface EnviadorPush {
  enviar(s: Pick<SuscripcionRow, 'endpoint' | 'p256dh' | 'auth'>, payload: string): Promise<'ok' | 'expirada'>;
}

export interface AvisoPush {
  tipo: TipoAviso;
  /** Título propio del aviso (A-22); sin él se usa el genérico del tipo. */
  titulo?: string;
  mensaje: string;
  ruta?: string | null;
  reporteId?: number | null;
}

/** El texto del push es corto: en la pantalla bloqueada no cabe más. */
const CUERPO_MAX = 160;

/**
 * Notificaciones push (A-20): guarda los celulares suscritos y les manda cada aviso de la campanita,
 * aunque la app esté cerrada. Sin `enviador` (servidor sin claves) todo queda apagado y nunca rompe nada.
 */
export class PushService extends BaseService {
  constructor(
    private readonly repo: PushRepository,
    private readonly enviador: EnviadorPush | null,
    private readonly publicKey: string | null,
  ) {
    super();
  }

  clave(): ClavePush {
    return { publicKey: this.enviador ? this.publicKey : null };
  }

  async suscribir(usuarioId: number, s: SuscripcionPushInput, userAgent?: string | null) {
    await this.repo.guardar(usuarioId, { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent });
  }

  async quitar(usuarioId: number, { endpoint }: QuitarSuscripcionPushInput) {
    await this.repo.quitar(usuarioId, endpoint);
  }

  /** Manda el aviso a todos los celulares de esos usuarios. Nunca lanza error: es un extra del aviso. */
  async enviar(usuarioIds: number[], aviso: AvisoPush) {
    if (!this.enviador) return;
    try {
      const payload: PayloadPush = {
        titulo: tituloDeAviso(aviso.tipo, aviso.titulo),
        cuerpo: aviso.mensaje.slice(0, CUERPO_MAX),
        ruta: aviso.reporteId ? `/reportes/${aviso.reporteId}` : (aviso.ruta ?? '/'),
        tipo: aviso.tipo,
      };
      const texto = JSON.stringify(payload);
      const subs = await this.repo.deUsuarios([...new Set(usuarioIds)]);
      await Promise.all(
        subs.map(async (s) => {
          try {
            if ((await this.enviador!.enviar(s, texto)) === 'expirada') await this.repo.quitarPorId(s.id);
          } catch (err) {
            this.log('No se pudo mandar un push', { suscripcion: s.id, error: String(err) });
          }
        }),
      );
    } catch (err) {
      this.log('No se pudieron mandar los push', { error: String(err) });
    }
  }
}
