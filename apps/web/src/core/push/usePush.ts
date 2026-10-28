import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ClavePush } from '@platinum/shared';
import { api } from '../api';

export type EstadoPush =
  /** Cargando o sin saber todavía. */
  | 'cargando'
  /** Este navegador no puede recibir push, o el servidor no lo tiene encendido: no se muestra nada. */
  | 'no_disponible'
  | 'bloqueado'
  | 'apagado'
  | 'activo';

/** La clave pública viene en base64url; el navegador la pide como bytes. */
function aBytes(base64Url: string) {
  const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const texto = atob(base64);
  return Uint8Array.from(texto, (c) => c.charCodeAt(0));
}

const soportado = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * Notificaciones push de este navegador (A-20): si están activas y cómo activarlas (no hay forma de apagarlas desde la app). Al
 * abrir la app con push activo vuelve a registrar el celular, así el aviso llega al usuario que
 * tiene la sesión abierta (por si en el mismo celular entró otra persona antes).
 */
export function usePush() {
  const [estado, setEstado] = useState<EstadoPush>('cargando');
  const [trabajando, setTrabajando] = useState(false);
  const clave = useQuery({
    queryKey: ['push', 'clave'],
    queryFn: () => api.get<ClavePush>('/push/clave'),
    enabled: soportado(),
    staleTime: Infinity,
  });
  const publicKey = clave.data?.publicKey ?? null;

  const registro = useCallback(async () => {
    // Sin service worker (por ejemplo en desarrollo sin HTTPS) no hay push.
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  }, []);

  const revisar = useCallback(async () => {
    if (!soportado()) return setEstado('no_disponible');
    if (clave.isPending) return setEstado('cargando');
    if (!publicKey) return setEstado('no_disponible');
    const reg = await registro();
    if (!reg) return setEstado('no_disponible');
    if (Notification.permission === 'denied') return setEstado('bloqueado');
    const sub = await reg.pushManager.getSubscription();
    if (sub && Notification.permission === 'granted') {
      // Se vuelve a registrar para el usuario actual (no hace nada si ya era suyo).
      void api.post('/push/suscripciones', sub.toJSON()).catch(() => undefined);
      return setEstado('activo');
    }
    setEstado('apagado');
  }, [clave.isPending, publicKey, registro]);

  useEffect(() => {
    void revisar();
  }, [revisar]);

  // Si la persona fue a los permisos del navegador y volvió, se revisa de nuevo sin que toque nada.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void revisar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [revisar]);

  /** Pide permiso (hay que llamarlo desde un toque del usuario) y registra el celular. Devuelve el error si falla. */
  const activar = useCallback(async () => {
    if (!publicKey) return 'Las notificaciones no están disponibles en este momento';
    setTrabajando(true);
    try {
      const reg = await registro();
      if (!reg) return 'Abre la app instalada o con conexión segura para activar las notificaciones';
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueado' : 'apagado');
        return permiso === 'denied' ? 'Bloqueaste las notificaciones; actívalas en los permisos del navegador' : null;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(publicKey) }));
      await api.post('/push/suscripciones', sub.toJSON());
      setEstado('activo');
      return null;
    } catch {
      return 'No se pudieron activar las notificaciones. Intenta de nuevo';
    } finally {
      setTrabajando(false);
    }
  }, [publicKey, registro]);

  return { estado, trabajando, activar, revisar };
}
