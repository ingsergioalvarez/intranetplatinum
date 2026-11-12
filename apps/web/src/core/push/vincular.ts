import { api } from '../api';
import { useAuthStore } from '../auth/authStore';
import { perfilDeUsuario } from '../auth/perfiles';

/** Suscripción push de este navegador, si ya existe. */
async function suscripcionActual() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager?.getSubscription()) ?? null;
}

/**
 * Liga este celular a la cuenta en sesión (A-77). Si la cuenta tiene su perfil rápido guardado aquí, lo manda: así el
 * celular sigue recibiendo sus avisos aunque cierre sesión y entre otra persona. Sin perfil, solo mientras tenga la
 * sesión abierta. No hace nada si no hay sesión o el celular no tiene notificaciones activas.
 */
export async function registrarEsteCelular(sub?: PushSubscription | null) {
  const user = useAuthStore.getState().user;
  if (!user) return;
  const s = sub ?? (await suscripcionActual());
  if (!s) return;
  const dispositivoId = perfilDeUsuario(user.id)?.dispositivoId;
  await api.post('/push/suscripciones', { ...s.toJSON(), ...(dispositivoId ? { dispositivoId } : {}) });
}

/**
 * Al cerrar sesión: si la cuenta no tiene su perfil rápido en este celular, deja de recibir avisos aquí (no pidió que el
 * celular la recordara). Si lo tiene, sigue recibiéndolos. Nunca falla: cerrar sesión no depende de esto.
 */
export async function soltarEsteCelularSiNoEstaGuardada() {
  try {
    const user = useAuthStore.getState().user;
    if (!user || perfilDeUsuario(user.id)) return;
    const s = await suscripcionActual();
    if (s) await api.delete('/push/suscripciones', { body: { endpoint: s.endpoint }, skipAuthRefresh: true });
  } catch {
    // Sin red o sin sesión: el servidor suelta esta cuenta cuando otra entre en el celular.
  }
}
