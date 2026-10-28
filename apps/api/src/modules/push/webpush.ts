import webpush from 'web-push';
import type { EnviadorPush } from './push.service';

/** Manda los push con el protocolo Web Push (VAPID). Los navegadores los entregan aunque la app esté cerrada. */
export function crearEnviadorWebPush(publicKey: string, privateKey: string, subject: string): EnviadorPush {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return {
    async enviar(s, payload) {
      try {
        // TTL: si el celular está apagado, el aviso espera hasta 6 h; después ya no sirve.
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 6 * 60 * 60, urgency: 'high' },
        );
        return 'ok';
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return 'expirada';
        throw err;
      }
    },
  };
}
