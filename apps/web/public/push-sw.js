/* global self */
// Notificaciones push (A-20). El service worker de la app (generado por vite-plugin-pwa) carga este
// archivo con `importScripts`. El navegador lo despierta aunque la app esté cerrada o el teléfono bloqueado.

self.addEventListener('push', (event) => {
  const datos = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();
  event.waitUntil(
    self.registration.showNotification(datos.titulo || 'Platinum', {
      body: datos.cuerpo || '',
      icon: '/icon-192.png',
      // Android pinta el badge en la barra de estado: solo usa su transparencia (escudo blanco).
      badge: '/push-badge.png',
      vibrate: [200, 100, 200],
      actions: [{ action: 'ver', title: 'Ver' }],
      data: { ruta: datos.ruta || '/' },
    }),
  );
});

// Al tocar la notificación se abre la app en la pantalla del aviso (o se reutiliza la ventana abierta).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ruta = (event.notification.data && event.notification.data.ruta) || '/';
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const v of ventanas) {
        if ('focus' in v) {
          await v.focus();
          if ('navigate' in v) await v.navigate(ruta).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(ruta);
    })(),
  );
});
