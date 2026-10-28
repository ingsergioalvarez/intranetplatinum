import { env } from '../../config/env';
import { PrismaPushRepository } from './push.repository';
import { PushService, type AvisoPush } from './push.service';
import { crearEnviadorWebPush } from './webpush';

/** Servicio compartido: se crea con las claves del `.env`; sin ellas el push queda apagado. */
export const pushService = new PushService(
  new PrismaPushRepository(),
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
    ? crearEnviadorWebPush(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT)
    : null,
  env.VAPID_PUBLIC_KEY ?? null,
);

/**
 * Se llama justo después de crear los avisos de la campanita. No espera ni lanza error: el push es un
 * extra y nunca debe retrasar ni romper la operación que originó el aviso.
 */
export function notificarPush(usuarioIds: number[], aviso: AvisoPush) {
  void pushService.enviar(usuarioIds, aviso);
}
