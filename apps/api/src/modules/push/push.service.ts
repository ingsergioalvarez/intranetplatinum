import {
  tipsParaRoles,
  tituloDeAviso,
  type ClavePush,
  type PayloadPush,
  type QuitarSuscripcionPushInput,
  type SuscripcionPushInput,
  type TipoAviso,
} from '@platinum/shared';
import { BaseService } from '../../core';
import type { PushRepository, SuscripcionRow } from './push.repository';
import { turnoDeTip } from './tips';

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
  urgente?: boolean;
}

/** El texto del push es corto: en la pantalla bloqueada no cabe más. */
const CUERPO_MAX = 160;

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] || 'ti';

/**
 * Notificaciones push (A-20): guarda los celulares suscritos y les manda cada aviso de la campanita,
 * aunque la app esté cerrada. Sin `enviador` (servidor sin claves) todo queda apagado y nunca rompe nada.
 *
 * Un celular puede estar ligado a varias cuentas (A-77). Si lo usan varias, la notificación dice "para NOMBRE" y no
 * muestra el contenido en la pantalla bloqueada; con una sola cuenta nada cambia.
 */
export class PushService extends BaseService {
  constructor(
    private readonly repo: PushRepository,
    private readonly enviador: EnviadorPush | null,
    private readonly publicKey: string | null,
    private readonly zona = 'America/Mexico_City',
  ) {
    super();
  }

  clave(): ClavePush {
    return { publicKey: this.enviador ? this.publicKey : null };
  }

  async suscribir(usuarioId: number, s: SuscripcionPushInput, userAgent?: string | null) {
    await this.repo.guardar(usuarioId, { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent }, s.dispositivoId ?? null);
  }

  async quitar(usuarioId: number, { endpoint }: QuitarSuscripcionPushInput) {
    await this.repo.quitar(usuarioId, endpoint);
  }

  /** Lo que se muestra: completo en un celular de una sola cuenta; "para NOMBRE" y sin contenido si es compartido. */
  private payloadDe(s: SuscripcionRow, aviso: AvisoPush): PayloadPush {
    const titulo = tituloDeAviso(aviso.tipo, aviso.titulo);
    const base = {
      ruta: aviso.reporteId ? `/reportes/${aviso.reporteId}` : (aviso.ruta ?? '/'),
      tipo: aviso.tipo,
      ...(aviso.urgente ? { urgente: true } : {}),
    };
    if (!s.compartida) return { titulo, cuerpo: aviso.mensaje.slice(0, CUERPO_MAX), ...base };
    const para = primerNombre(s.nombre);
    return aviso.urgente
      ? // Una emergencia conserva su título: cada segundo cuenta. Los datos se ven al abrir.
        { titulo: `${titulo} · para ${para}`, cuerpo: 'Abre la app para ver los datos de la alerta', para: s.usuarioId, ...base }
      : { titulo: `Platinum · para ${para}`, cuerpo: 'Tienes un aviso nuevo', para: s.usuarioId, ...base };
  }

  /** Manda el aviso a todos los celulares de esos usuarios. Nunca lanza error: es un extra del aviso. */
  async enviar(usuarioIds: number[], aviso: AvisoPush) {
    if (!this.enviador) return;
    try {
      const subs = await this.repo.deUsuarios([...new Set(usuarioIds)]);
      await Promise.all(
        subs.map(async (s) => {
          try {
            const payload = JSON.stringify(this.payloadDe(s, aviso));
            if ((await this.enviador!.enviar(s, payload)) === 'expirada') await this.repo.quitarPorId(s.id);
          } catch (err) {
            this.log('No se pudo mandar un push', { suscripcion: s.id, error: String(err) });
          }
        }),
      );
    } catch (err) {
      this.log('No se pudieron mandar los push', { error: String(err) });
    }
  }

  /**
   * Tips (A-78): si toca (martes o viernes desde las 10:30) manda uno a cada celular, una sola vez aunque tenga varias
   * cuentas, de los que le sirven según los roles de sus cuentas. Cada celular rota por su lista. Devuelve a cuántos
   * celulares se mandó. Nunca lanza error.
   */
  async enviarTips(ahora = new Date()): Promise<number> {
    if (!this.enviador) return 0;
    try {
      const turno = turnoDeTip(ahora, this.zona);
      if (!turno || !(await this.repo.reservarTip(turno.slot))) return 0;
      const telefonos = await this.repo.telefonos();
      let enviados = 0;
      await Promise.all(
        telefonos.map(async (t) => {
          const lista = tipsParaRoles(t.roles);
          if (lista.length === 0) return;
          const tip = lista[turno.indice % lista.length];
          const payload: PayloadPush = { titulo: 'Platinum · Tip', cuerpo: tip.titulo, ruta: `/?tip=${tip.id}`, tipo: 'tip' };
          try {
            const r = await this.enviador!.enviar(t, JSON.stringify(payload));
            if (r === 'expirada') await this.repo.quitarPorId(t.id);
            else enviados++;
          } catch (err) {
            this.log('No se pudo mandar un tip', { suscripcion: t.id, error: String(err) });
          }
        }),
      );
      return enviados;
    } catch (err) {
      this.log('No se pudieron mandar los tips', { error: String(err) });
      return 0;
    }
  }
}
