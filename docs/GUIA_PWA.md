# Guía: cómo armar una PWA que se comporte como una app real

Guía general y reutilizable para convertir una aplicación web en una **PWA (Progressive Web App)**: se instala en
el celular, abre a pantalla completa, funciona sin señal, manda notificaciones y se siente como una app nativa.
No depende de ningún proyecto en particular; los ejemplos usan React + Vite + Node, pero los conceptos aplican a
cualquier stack.

---

## Usar esta guía con una IA (prompt para armar la app entre los dos)

Si le pasas este archivo a una IA (Claude, ChatGPT, etc.), copia el siguiente prompt junto con el contenido de la
guía. La guía es un **mapa de referencia, no un reglamento**: sirve para que la IA sepa por dónde ir y qué
opciones existen, pero la app queda como tú quieras. La IA te entrevistará como si levantara requerimientos, te
propondrá opciones apoyándose en la guía, y construirá por etapas contigo.

````text
Eres mi arquitecto y desarrollador de PWA. Te adjunto una guía (GUIA_PWA.md) como material de referencia: te
dice qué piezas existen y cómo suelen resolverse para que una web se comporte como una app real. NO es un
reglamento. Cada proyecto es distinto: usa de la guía lo que sirva, ignora lo que no aplique y adáptala a lo que
yo necesito. Si yo quiero algo distinto a lo que dice la guía, se hace como yo diga, sin discutirlo ni recordarme
que va en contra de la guía.

El objetivo es armar entre los dos la app más correcta y parecida a una app real que sea posible para MI caso,
y que yo entienda cómo quedó. Tú aportas criterio técnico; yo decido. No escribas código hasta terminar la
fase 1 y que yo apruebe el resumen.

REGLAS
- Haz las preguntas por bloques de 3 a 5 como máximo, no todas juntas. Espera mi respuesta antes de seguir.
- En cada pregunta ofrece 2 o 3 opciones concretas, marca cuál recomiendas y explica por qué en una línea.
  Siempre puedo responder otra cosa, y esa será la que se use.
- Si no sé responder algo, propón un valor por defecto razonable y dime qué supuesto estás tomando.
- Solo avísame (una vez, en una línea) cuando algo que pido tenga una consecuencia técnica real que quizá no
  conozco, por ejemplo: "en iPhone esto no funciona sin instalar la app" o "esto deja datos sensibles
  expuestos". Después de avisar, respeta mi decisión y sigue. No pongas advertencias por rutina.
- No inventes requisitos. Si algo no está claro, pregunta.
- Explícame lo que vas haciendo para que yo entienda cómo funciona mi app: habla en español, sin tecnicismos
  innecesarios, y explica cada término la primera vez que lo uses.

FASE 1 — REQUERIMIENTOS (solo preguntas, sin código)
Bloque A, la app: ¿qué problema resuelve y quién la usa (roles)? ¿Desde qué dispositivos (celular, escritorio,
ambos) y cuál es el principal? ¿Cuáles son las 3 a 5 funciones más importantes? ¿Es de uso interno o pública?
Bloque B, el entorno: ¿qué stack uso o prefiero (si no tengo, recomiéndame uno)? ¿Ya existe un backend o base
de datos? ¿Dónde se va a desplegar y ¿tengo HTTPS? ¿Habrá una sola organización o varias?
Bloque C, comportamiento de app (secciones 3 y 4 de la guía): nombre, ícono y colores; ¿bloquear zoom?;
¿orientación fija?; ¿navegación inferior en celular?; ¿qué debe verse al instalarla en Android y en iPhone?
Bloque D, conexión (sección 5): ¿los usuarios tendrán señal inestable? ¿Qué acciones deben poder hacerse sin
conexión y guardarse para enviarse después? ¿Importa la hora exacta de lo que registran (evidencias)?
Bloque E, notificaciones (sección 6): ¿qué eventos deben avisar, a quién, y por qué canal (campanita interna,
push, ambos)? ¿Es obligatorio activarlas o es opcional?
Bloque F, dispositivo y seguridad (secciones 7 y 8): ¿usará cámara, GPS, archivos o fotos? ¿Cómo inician sesión
y qué roles o permisos hay? ¿Hay datos sensibles?

Al terminar la fase 1, entrégame un RESUMEN DE REQUERIMIENTOS con: alcance, decisiones tomadas, supuestos que
asumiste, lo que queda fuera por ahora, y riesgos. Pídeme que lo apruebe o corrija.

FASE 2 — PLAN
Propón un plan por etapas pequeñas, cada una con un criterio de aceptación que yo pueda comprobar. Orden
sugerido: (1) base instalable: HTTPS, manifest, íconos, service worker; (2) comportamiento de app: zoom, áreas
seguras, navegación, componentes móviles; (3) funciones principales de la app; (4) offline y cola de envío;
(5) notificaciones; (6) pruebas y despliegue. Quita o reordena etapas según mis respuestas. Espera mi visto bueno.

FASE 3 — CONSTRUCCIÓN, UNA ETAPA A LA VEZ
- Al empezar cada etapa dime qué vas a hacer y qué archivos tocarás.
- Implementa solo esa etapa, siguiendo la guía y los fragmentos que trae.
- Al terminar, dime cómo comprobarla (en el navegador, en el celular, en DevTools) y espera mi confirmación
  o mis cambios antes de pasar a la siguiente.
- Si yo cambio de opinión o decido algo distinto a la guía, ajusta el plan y dime brevemente qué cambia en la app.

FASE 4 — CIERRE
Usa el checklist de la sección 12 de la guía solo como lista de revisión: dime qué de lo que elegí quedó
cumplido, qué falta y qué no pudiste verificar (por ejemplo, pruebas en un iPhone real). Lo que yo decidí no
incluir no cuenta como pendiente. Deja por escrito cómo desplegar, cómo actualizar y qué hacer si falla.

Empieza ahora con el Bloque A.
````

**Consejos para quien lo use:**

- Pega la guía completa en la misma conversación (o adjúntala como archivo) para que la IA la use como referencia.
- Si algo de la guía no te sirve, dilo y la IA lo dejará fuera: la guía se adapta a tu proyecto, no al revés.
- Si ya tienes un proyecto, agrega al final del prompt: *"Ya existe este código: [ruta o descripción]. Adáptate a
  su estructura en lugar de proponer una nueva."*
- Si la IA tiene acceso al código (como Claude Code), pídele que también escriba un `PLAN.md` con las etapas y
  que marque cuáles va terminando, para no perder el hilo entre sesiones.
- Responde con confianza "usa tu recomendación" cuando no tengas preferencia: así avanzas más rápido sin perder
  el control de las decisiones importantes.

---

## 1. Qué es una PWA y cuándo conviene

Una PWA es una web normal (HTML, CSS, JS) a la que se le agregan tres piezas:

| Pieza | Qué hace |
|---|---|
| **Web App Manifest** | Archivo JSON que describe la app: nombre, íconos, colores, cómo abrirse. Hace que el navegador ofrezca "Instalar". |
| **Service Worker** | Script que corre en segundo plano, aparte de la página. Intercepta peticiones (caché/offline) y recibe notificaciones push. |
| **HTTPS** | Obligatorio. Sin HTTPS no hay service worker, ni push, ni cámara, ni GPS (la excepción es `localhost`). |

**Ventajas frente a una app nativa:** un solo código para Android, iOS y escritorio; sin tiendas de apps ni
revisiones; se actualiza sola al desplegar; instalación en 2 toques; costo mucho menor.

**Limitaciones reales (conviene saberlas antes de elegir):**

- iOS es más restrictivo que Android: el push solo funciona con la PWA **instalada en la pantalla de inicio**
  (iOS/iPadOS 16.4 o superior), y hay menos APIs disponibles.
- Sin acceso a funciones profundas del sistema: Bluetooth limitado, procesos en segundo plano continuos,
  integración con contactos/llamadas, widgets, etc.
- No aparece en las tiendas de apps (se puede empaquetar con TWA/Capacitor si se necesita, pero ya es otro tema).
- iOS puede borrar los datos del sitio (caché, IndexedDB) si la app no se usa por varias semanas.

Si el caso de uso es formularios, listados, cámara, GPS, notificaciones y trabajo con conexión inestable, una PWA
suele ser suficiente.

---

## 2. Requisitos previos

1. **HTTPS en producción.** Opciones: certificado normal, proxy/túnel (Cloudflare Tunnel, ngrok), o el
   hosting que ya lo trae.
2. **HTTPS también para probar en el celular.** `localhost` cuenta como seguro, pero el celular entra por la IP de
   la PC y ahí no. Soluciones: un certificado local de desarrollo (en Vite: `@vitejs/plugin-basic-ssl`), un túnel
   temporal, o depurar por USB con `chrome://inspect` (reenvía el puerto como `localhost`).
3. **Íconos** en PNG: 192×192, 512×512 y una versión *maskable* de 512×512 (ver sección 3).
4. **Un dominio estable.** El service worker y las suscripciones push quedan atados al origen; cambiar de dominio
   obliga a reinstalar y a volver a pedir permisos.

---

## 3. Instalación: el manifest

Ejemplo de `manifest.webmanifest` (con Vite se genera desde la configuración del plugin, ver sección 5):

```json
{
  "name": "Mi Aplicación",
  "short_name": "MiApp",
  "description": "Qué hace la app en una frase.",
  "lang": "es-MX",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#121d38",
  "theme_color": "#121d38",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Campos clave:

- **`display: "standalone"`**: abre sin barra de direcciones ni botones del navegador. Es lo que da la sensación
  de app. Otras opciones: `fullscreen` (sin barra de estado), `minimal-ui`, `browser`.
- **`start_url` y `scope`**: dónde abre y qué rutas considera "dentro" de la app. Navegar fuera del `scope` abre
  el navegador normal.
- **`background_color`**: color de la pantalla de carga (splash) mientras arranca.
- **`theme_color`**: color de la barra de estado/título. Conviene repetirlo en el HTML (ver abajo).
- **`orientation`**: bloquea la orientación. Úsalo solo si de verdad la app no funciona en horizontal.
- **Ícono maskable**: Android recorta los íconos en círculo, cuadrado redondeado, etc. Un ícono *maskable* deja
  un margen de seguridad (el logo ocupa solo el ~60 % central) para que no se corte. Se puede probar en
  <https://maskable.app>.

### Etiquetas en el `index.html`

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#121d38" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

- **`apple-touch-icon`** (PNG de 180×180) es el ícono que usa iOS al "Agregar a pantalla de inicio"; iOS no lee
  bien los íconos del manifest.
- **`viewport-fit=cover`** permite que la app use toda la pantalla, incluso detrás del notch; hay que compensar con
  las áreas seguras (sección 7).
- Si quieres modo pantalla completa en versiones antiguas de iOS: `<meta name="apple-mobile-web-app-capable" content="yes">`
  y `apple-mobile-web-app-status-bar-style`.

### Cómo se instala el usuario

- **Android / Chrome / Edge:** el navegador muestra "Instalar app" o "Agregar a pantalla de inicio" cuando se
  cumplen los criterios (HTTPS, manifest válido, service worker). Se puede disparar un botón propio escuchando
  `beforeinstallprompt`:

  ```ts
  let evento: any;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();      // evita el mini-aviso automático
    evento = e;              // guardarlo y mostrar tu propio botón "Instalar"
  });
  // al tocar tu botón:
  evento.prompt();
  ```
- **iOS / Safari:** no existe `beforeinstallprompt`. La persona debe tocar **Compartir → Agregar a pantalla de
  inicio**. Lo habitual es mostrar una pequeña instrucción visual solo en iOS cuando la app no está instalada.
- **Detectar si ya está instalada:** `window.matchMedia('(display-mode: standalone)').matches` (y
  `navigator.standalone` en iOS).

---

## 4. Comportamiento de "app real" (lo que la distingue de una web)

Estos ajustes son los que más cambian la sensación. Casi todos son CSS o una línea de JS.

### 4.1 Bloquear el zoom

En una app, el pellizco para hacer zoom a la página rompe el diseño. Se bloquea en tres capas, porque cada
plataforma respeta una distinta:

```html
<!-- 1. Viewport: Android/Chrome lo respetan; iOS lo ignora -->
<meta name="viewport"
  content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

```css
/* 2. CSS: quita el zoom por doble toque y el retraso de 300 ms */
html {
  touch-action: manipulation;
  -webkit-text-size-adjust: 100%;   /* evita que el navegador agrande el texto al girar el celular */
  -webkit-tap-highlight-color: transparent; /* quita el destello gris al tocar */
}
```

```ts
// 3. JS: iOS Safari ignora user-scalable=no; el pellizco se bloquea con este evento (solo existe en Safari)
document.addEventListener('gesturestart', (e) => e.preventDefault());
```

**Trampa clásica de iOS:** si un campo de texto tiene fuente menor a **16 px**, iOS hace zoom automático al
enfocarlo. Solución: `font-size: 16px` (en Tailwind, `text-base`) en todos los `input`, `select` y `textarea`.

**Advertencia de accesibilidad:** bloquear el zoom impide que personas con baja visión agranden el contenido
(incumple WCAG 1.4.4). Si la app es de uso interno y controlada, suele ser aceptable; si es pública, considera
permitirlo. Si bloqueas el zoom, compensa con tamaños de letra generosos y, donde tenga sentido (fotos,
mapas, planos), un visor propio con zoom.

### 4.2 Evitar scroll horizontal y "rebote"

```css
html { overflow-x: hidden; }                 /* red de seguridad: nada ensancha la página */
body { overscroll-behavior-y: none; }        /* quita el rebote/pull-to-refresh del navegador (opcional) */
```

- En cuadrículas para celular, usa columnas explícitas (`grid-cols-1`); un texto largo con `truncate` puede
  ensanchar una columna automática y aparecer scroll horizontal.
- `min-width: 0` en hijos de flex/grid que contengan texto largo.

### 4.3 Selección de texto y menú contextual

Para botones y elementos de interfaz (no para contenido que la gente deba copiar):

```css
.control { user-select: none; -webkit-touch-callout: none; }
```

No lo apliques al texto de lectura ni a los campos de formulario.

### 4.4 Altura de pantalla en celular: usa `dvh`

`100vh` en móvil incluye la barra del navegador y provoca saltos. Usa **`100dvh`** (altura dinámica del
viewport) o `min-h-dvh`. También `max-h-[92dvh]` para modales.

### 4.5 Áreas seguras (notch, barra de gestos)

Con `viewport-fit=cover`, el contenido llega hasta los bordes y debe respetar los recortes:

```css
.header { padding-top: env(safe-area-inset-top); }
.barra-inferior { padding-bottom: env(safe-area-inset-bottom); }
/* combinado con un mínimo */
.pie { padding-bottom: max(0.75rem, env(safe-area-inset-bottom)); }
```

Aplícalo a todo lo que se pegue a un borde: cabecera fija, barra de navegación inferior, pies de modal y botones
flotantes.

### 4.6 Navegación tipo app

- **Barra de pestañas inferior** en celular (alcanzable con el pulgar) y **menú lateral** en escritorio.
- Botones y zonas táctiles de **mínimo 44×44 px** (iOS) / 48×48 dp (Android); campos de **44 px de alto**.
- **Modales como *bottom-sheet*** en celular: suben desde abajo, con asa visible y botones fijos al pie; en
  escritorio se muestran centrados.
- **Tablas que se vuelven tarjetas** en pantallas angostas.
- Estados de carga con **esqueletos o spinners**, nunca pantalla en blanco.
- **Toasts** para confirmaciones breves; **diálogos de confirmación** para acciones destructivas.
- Botones que solo tienen ícono en celular: siempre con `aria-label`.
- Atributos de teclado que mejoran mucho la experiencia: `inputMode="numeric"`, `type="email"`, `type="tel"`,
  `autoComplete`, `enterKeyHint`.

### 4.7 Diseño mobile-first

Diseña primero a **360 px de ancho** (el Android común) y escala hacia arriba con breakpoints. Es mucho más fácil
ampliar un diseño de celular que reducir uno de escritorio.

### 4.8 Sensación de velocidad

- Carga diferida (*lazy loading*) de rutas pesadas.
- Mostrar el cambio de inmediato (*optimistic updates*) y reconciliar con el servidor después.
- Caché de datos en el cliente (TanStack Query, SWR) con revalidación al volver a enfocar la app.
- Comprimir imágenes **en el cliente** antes de subirlas (las cámaras de celular generan fotos de 5–12 MB).

---

## 5. Service Worker: caché y modo sin conexión

El service worker vive aparte de la página. Hace tres cosas: guarda archivos para abrir sin red, responde
peticiones desde caché y recibe notificaciones push.

### 5.1 Usar un generador (recomendado)

Escribir el service worker a mano es propenso a errores. Con Vite, el plugin **`vite-plugin-pwa`** (usa Workbox)
genera el manifest y el service worker:

```ts
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',                 // se actualiza solo al haber versión nueva
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  manifest: { /* ver sección 3 */ },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],   // lo que se guarda al instalar
    navigateFallback: '/index.html',                       // las rutas de la SPA abren sin red
    navigateFallbackDenylist: [/^\/api\//],                // la API nunca cae a index.html
    importScripts: ['push-sw.js'],                         // código propio (push) dentro del SW generado
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/modelos/'),
        handler: 'CacheFirst',                              // archivos pesados y fijos
        options: { cacheName: 'modelos', expiration: { maxEntries: 120 } },
      },
    ],
  },
  devOptions: { enabled: false },   // activar solo para probar el SW en desarrollo
});
```

Equivalentes en otros stacks: `next-pwa`/Serwist (Next.js), `@angular/pwa` (Angular), `workbox-cli` o
`workbox-build` (cualquiera).

### 5.2 Estrategias de caché (elige según el tipo de recurso)

| Estrategia | Qué hace | Úsala para |
|---|---|---|
| **Precache** | Guarda al instalar la app | El "cascarón" (HTML, JS, CSS, íconos) |
| **CacheFirst** | Sirve de caché; solo va a red si no está | Fuentes, imágenes fijas, modelos pesados |
| **NetworkFirst** | Intenta red; si falla, usa caché | Datos que cambian pero conviene tener respaldo |
| **StaleWhileRevalidate** | Sirve de caché y actualiza en segundo plano | Catálogos, avatares, contenido no crítico |
| **NetworkOnly** | Siempre red | Autenticación, operaciones de escritura |

Regla práctica: **nunca caches respuestas de autenticación ni de `POST`** y excluye la API del *fallback* de
navegación.

### 5.3 Actualizaciones: el punto que más sorprende

Un service worker nuevo **se instala pero no toma control** hasta que se cierran todas las pestañas/ventanas de
la app. Opciones:

- **`registerType: 'autoUpdate'`**: el SW nuevo se activa solo y la página se recarga. Simple, pero puede
  interrumpir si la persona está llenando un formulario.
- **`registerType: 'prompt'`**: avisas con un toast ("Hay una versión nueva — Actualizar") y recargas cuando la
  persona acepte. Más seguro para formularios largos.

Además, **configura el servidor web para que los archivos de arranque no se queden en caché del navegador**
(`no-cache`), o las actualizaciones tardarán en llegar. Con nginx:

```nginx
# Siempre se revisan: así las versiones nuevas llegan
location ~ ^/(index\.html|sw\.js|registerSW\.js|manifest\.webmanifest)$ {
    add_header Cache-Control "no-cache";
}
# Archivos con hash en el nombre: nunca cambian, se pueden cachear un año
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
# SPA: cualquier ruta cae a index.html
location / {
    add_header Cache-Control "no-cache";
    try_files $uri /index.html;
}
```

Si tu SW importa scripts propios (como `push-sw.js`), inclúyelos en la regla de `no-cache`.

### 5.4 Trabajar sin conexión de verdad

Que la app **abra** sin red es solo la mitad. Para que se pueda **trabajar** sin red:

1. **Detectar conexión.** `navigator.onLine` y los eventos `online`/`offline`. Ojo: `onLine = true` solo
   significa que hay red, no que el servidor responda. Trata también los errores de red de `fetch` como "sin
   conexión".
2. **Guardar localmente lo que la persona hace.** Usa **IndexedDB** (permite guardar objetos grandes y `Blob`,
   como fotos). `localStorage` es síncrono, limitado a ~5 MB y solo texto: sirve para banderas pequeñas.
3. **Cola de operaciones pendientes.** Cada acción hecha sin red se guarda en una tabla local y se envía al volver
   la conexión:
   - Dispara el envío **al abrir la app**, en el evento `online`, y con un **temporizador** (p. ej. cada 30 s)
     mientras haya pendientes.
   - Envía **en orden** y **detente en el primer error del servidor** si las siguientes dependen de la anterior.
   - Distingue errores: red / 401 / 5xx → reintentar después; 4xx de validación → marcar con el motivo y pedir
     intervención (no reintentar infinitamente).
4. **Idempotencia.** Genera en el cliente un **UUID por operación** y mándalo al servidor; el servidor debe
   ignorar duplicados con el mismo UUID. Así, si la petición sí llegó pero se cayó la respuesta, el reintento no
   crea registros dobles.
5. **No confíes en el reloj del celular.** Si la hora importa (asistencia, evidencias), el servidor debe ser la
   fuente de verdad: guarda el desfase entre el reloj local y el encabezado `Date` de cada respuesta, usa la hora
   corregida sin red y envía también la hora cruda para que el servidor pueda detectar manipulación.
6. **Mostrar el estado.** Un indicador visible de "Sin conexión" y de "N pendientes de enviar", y avisar cuando
   se sincronicen.
7. **Background Sync** (`SyncManager`) existe en Chrome/Android y reintenta aunque la app esté cerrada, pero **no
   está en iOS/Safari**. Úsalo como mejora, nunca como único mecanismo.

### 5.5 Archivos pesados bajo demanda

Si la app necesita archivos grandes (modelos de IA, mapas), no los metas en el precache. Exclúyelos
(`globIgnores`) y guárdalos con `CacheFirst` la primera vez que se usan; así la instalación inicial sigue
siendo ligera.

---

## 6. Notificaciones push

Hay **dos canales distintos**; una app real suele tener ambos:

| Canal | Cuándo se ve | Cómo funciona |
|---|---|---|
| **Avisos internos** ("campanita") | Con la app abierta | Tu API los guarda; el cliente los consulta cada cierto tiempo o por WebSocket/SSE. |
| **Web Push** | Con la app cerrada y el celular bloqueado | El navegador los entrega por el servicio de push del sistema (FCM en Chrome/Android, APNs en Apple). |

Conviene guardar siempre el aviso interno y **además** mandar el push: el push puede fallar o no llegar, y la
persona debe poder ver el historial dentro de la app.

### 6.1 Cómo funciona Web Push

1. El servidor tiene un par de claves **VAPID** (pública y privada). Se generan **una sola vez**.
2. El navegador pide permiso al usuario, y con la clave pública se **suscribe**; obtiene un `endpoint` (URL del
   servicio de push) y dos claves de cifrado (`p256dh`, `auth`).
3. El cliente envía esa suscripción a tu API, que la **guarda ligada al usuario**.
4. Cuando ocurre un evento, el servidor cifra el mensaje y lo manda al `endpoint`. El servicio de push lo entrega
   al dispositivo y **despierta el service worker**, que muestra la notificación.

### 6.2 Generar las claves VAPID (una vez)

```bash
npx web-push generate-vapid-keys --json
```

Guarda `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:tu-correo@dominio.com`) en variables de
entorno. **No las cambies después:** todas las suscripciones existentes quedarían inválidas y cada persona tendría
que volver a activarlas. La clave privada es secreta (no va a git).

### 6.3 Cliente: pedir permiso y suscribirse

```ts
// La clave pública viaja en base64url; el navegador la pide como bytes
function aBytes(base64Url: string) {
  const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function activarPush(publicKey: string) {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('Sin service worker (¿HTTPS?)');

  const permiso = await Notification.requestPermission();   // SOLO desde un toque del usuario
  if (permiso !== 'granted') return;

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,                                // obligatorio: cada push debe mostrar algo
      applicationServerKey: aBytes(publicKey),
    }));

  await fetch('/api/push/suscripciones', {                  // guardarla ligada al usuario en sesión
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
}
```

Buenas prácticas del cliente:

- **Detecta soporte** antes de mostrar nada: `'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window`.
- **Pide el permiso en contexto** (con un botón "Activar notificaciones" y una explicación), nunca al cargar la
  página. Si la persona lo bloquea, el navegador no vuelve a preguntar: solo se reactiva desde los ajustes.
- Maneja los estados: `no disponible`, `bloqueado`, `apagado`, `activo`.
- **Revisa el estado cuando la app vuelve a primer plano** (`visibilitychange`): la persona pudo cambiar el
  permiso en los ajustes del navegador.
- **Vuelve a registrar la suscripción al abrir la app** con la sesión actual. Si en el mismo celular entra otra
  persona, el aviso debe llegar al usuario que tiene la sesión abierta, no al anterior.
- En iOS, el permiso solo se puede pedir con la PWA **instalada**; explícalo en la interfaz.

### 6.4 Service worker: recibir y mostrar

```js
// push-sw.js (se importa con workbox.importScripts)
self.addEventListener('push', (event) => {
  const datos = (() => { try { return event.data ? event.data.json() : {}; } catch { return {}; } })();
  event.waitUntil(
    self.registration.showNotification(datos.titulo || 'Mi App', {
      body: datos.cuerpo || '',
      icon: '/icon-192.png',          // ícono grande a color
      badge: '/push-badge.png',       // Android lo pinta en la barra de estado: usa solo la silueta (PNG monocromo con transparencia)
      vibrate: [200, 100, 200],
      actions: [{ action: 'ver', title: 'Ver' }],
      data: { ruta: datos.ruta || '/' },
    }),
  );
});

// Al tocar: reutilizar la ventana abierta o abrir la app en la pantalla del aviso
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ruta = event.notification.data?.ruta || '/';
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if ('focus' in v) { await v.focus(); await v.navigate?.(ruta).catch(() => {}); return; }
    }
    await self.clients.openWindow(ruta);
  })());
});
```

Detalles que importan:

- **`userVisibleOnly: true` es obligatorio:** si un push llega y no muestras notificación, el navegador puede
  mostrar una genérica ("Esta aplicación se actualizó en segundo plano") o revocar el permiso.
- **`event.waitUntil(...)`**: sin él, el navegador puede matar el service worker antes de terminar.
- **Título propio por tipo de aviso**, cuerpo corto (~160 caracteres; en pantalla bloqueada no cabe más) y una
  **ruta** para abrir directamente la pantalla relacionada.
- Si usas un **`tag`**, notificaciones del mismo tag se reemplazan en lugar de apilarse (útil para evitar spam).
- Los íconos deben existir en tu dominio y ser PNG.

### 6.5 Servidor (Node con la librería `web-push`)

```ts
import webpush from 'web-push';

webpush.setVapidDetails('mailto:tu-correo@dominio.com', PUBLIC_KEY, PRIVATE_KEY);

async function enviar(sub: { endpoint: string; p256dh: string; auth: string }, payload: object) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 6 * 60 * 60, urgency: 'high' },   // si el celular está apagado, espera hasta 6 h; después ya no sirve
    );
    return 'ok';
  } catch (err: any) {
    if (err.statusCode === 404 || err.statusCode === 410) return 'expirada';  // el navegador ya no existe
    throw err;
  }
}
```

Reglas del servidor:

- **Guarda las suscripciones en base de datos**: `usuario_id`, `endpoint` (único), `p256dh`, `auth`, `user_agent`.
  Un usuario puede tener varias (celular, tablet, escritorio).
- **Borra las suscripciones con 404/410**: significa que la persona desinstaló o revocó el permiso.
- **El push nunca debe romper la operación que lo originó.** Envíalo "sin esperar" y atrapa todos los errores:
  si falla el push, la venta/reporte/asistencia debe guardarse igual.
- **TTL y urgencia:** define cuánto vale la pena entregar un aviso tarde; un aviso de hace 2 días ya no sirve.
- Si el servidor no tiene claves VAPID, deja el push **apagado** (devuelve clave `null` al cliente) en lugar de
  fallar.
- No mandes datos sensibles en el cuerpo: se muestra en la pantalla bloqueada y pasa por servicios de terceros.
  Usa mensajes genéricos y deja el detalle dentro de la app.

### 6.6 Diferencias por plataforma

| | Android (Chrome/Edge) | iOS (Safari 16.4+) | Escritorio |
|---|---|---|---|
| Push con la app instalada | Sí | **Sí (obligatorio instalar)** | Sí |
| Push sin instalar | Sí | **No** | Sí |
| `beforeinstallprompt` | Sí | No (manual: Compartir → Agregar) | Sí (Chrome/Edge) |
| Background Sync | Sí | No | Sí (Chromium) |
| Botones de acción en la notificación | Sí | Limitado | Sí |
| Vibración | Sí | No | — |

Prueba **siempre** en un iPhone real: el simulador no sirve para push.

---

## 7. Cámara, GPS y otros permisos del dispositivo

- **Requieren HTTPS** (o `localhost`). Sin eso, el navegador los bloquea sin avisar claramente.
- **Pide cada permiso en contexto**, con un toque del usuario y una explicación antes. Maneja los tres casos:
  denegado, no disponible y tiempo agotado, con mensajes claros y qué hacer en cada uno.
- **Ubicación:** `navigator.geolocation.getCurrentPosition(ok, err, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 })`.
  Guarda también la **precisión** (`coords.accuracy`) y valida en el servidor; el GPS en interiores puede dar
  errores de decenas de metros.
- **Cámara:** `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })`. Detén las pistas
  (`track.stop()`) y libera las URLs (`URL.revokeObjectURL`) al terminar. Para una foto simple, un
  `<input type="file" accept="image/*" capture="environment">` abre la cámara nativa y es más compatible.
- **Nunca confíes en datos del cliente** para evidencias (hora, ubicación, identidad): el cliente es
  manipulable. Valida y registra en el servidor.
- **UUID sin HTTPS:** `crypto.randomUUID()` solo existe en contextos seguros; si necesitas IDs también fuera de
  HTTPS, genéralos con `crypto.getRandomValues`.

---

## 8. Sesión y seguridad en una PWA

- **Token de acceso corto en memoria** (no en `localStorage`, que cualquier XSS puede leer) y **token de
  refresco en cookie `HttpOnly; Secure; SameSite`**. Al abrir la app, intenta restaurar la sesión con la cookie
  antes de decidir si mostrar el login.
- Distingue **sesión expirada** (limpiar y mandar al login) de **cierre voluntario** (además, borrar datos
  locales sensibles y la suscripción push del usuario).
- **Limita intentos de login** (rate limit). Si estás detrás de un proxy o túnel, configura `trust proxy` y pasa
  la IP real del visitante; si no, todos los usuarios parecerán una sola IP y se bloquearán entre sí.
- **Cabeceras de seguridad** (CSP, HSTS, `X-Content-Type-Options`) en el servidor web.
- **Datos offline = datos en el dispositivo.** Todo lo que guardes en IndexedDB/caché queda en el celular: no
  guardes lo que no necesites y borra al cerrar sesión lo que sea sensible.
- Valida los archivos subidos **por su contenido** (firma real de la imagen), no por la extensión.

---

## 9. Despliegue

1. **Build estático** del frontend (`vite build`) servido por nginx/CDN, con las reglas de caché de la sección 5.3.
2. **API detrás del mismo dominio** (`/api` reenviado por nginx) evita problemas de CORS y de cookies.
3. **HTTPS obligatorio.** Si el servidor no es público, un túnel (Cloudflare Tunnel, por ejemplo) entrega HTTPS
   sin abrir puertos.
4. **Cuerpo máximo de subida** (`client_max_body_size`) acorde a las fotos que se suben; y `proxy_read_timeout`
   suficiente para operaciones lentas.
5. **Docker/Compose** es una forma cómoda de empaquetar web + API + base de datos; cuida que las imágenes copien
   todos los archivos de configuración compartidos del monorepo.
6. **Variables de entorno** para secretos (VAPID, JWT, base de datos); nunca en el repositorio.
7. **Respaldos** de la base de datos y de los archivos subidos, con copia fuera del servidor.
8. Cada despliegue genera un service worker nuevo: valida que las ventanas abiertas se actualicen (sección 5.3).

---

## 10. Cómo probar

| Qué probar | Cómo |
|---|---|
| Que es instalable | Chrome DevTools → **Application → Manifest** (muestra errores del manifest y de íconos) |
| Service worker | **Application → Service Workers** (estado, "Update on reload", "Offline", "Push" de prueba) |
| Caché | **Application → Cache Storage** e **IndexedDB** |
| Modo sin conexión | DevTools → **Network → Offline**; y en el celular real, modo avión |
| Auditoría general | **Lighthouse** (categoría PWA / best practices) |
| En el celular | HTTPS local o túnel; depurar por USB con `chrome://inspect` (Android) o Web Inspector de Safari (iOS) |
| Push | Botón "Push" de DevTools, y luego un envío real con la app cerrada y el celular bloqueado |
| Pantallas | Capturas a 360 px y a escritorio; probar con el teclado abierto y con notch |

Truco de depuración: si algo "no se actualiza", en DevTools marca **Update on reload** y usa **Clear site data**.
Un service worker viejo es la causa de la mayoría de los "ya lo cambié y sigue igual".

---

## 11. Errores comunes y soluciones

| Síntoma | Causa probable | Solución |
|---|---|---|
| No aparece "Instalar" | Sin HTTPS, manifest inválido o sin íconos 192/512 | Revisar **Application → Manifest** |
| Los cambios nuevos no se ven | Service worker o `index.html` en caché | `no-cache` en nginx; `autoUpdate`; cerrar todas las ventanas |
| La app abre en blanco sin red | El HTML no está en el precache o falta `navigateFallback` | Revisar `globPatterns` y `navigateFallback` |
| Las llamadas a la API devuelven `index.html` | `navigateFallback` captura `/api` | `navigateFallbackDenylist: [/^\/api\//]` |
| iOS hace zoom al tocar un campo | Fuente menor a 16 px | `font-size: 16px` en inputs |
| El pellizco sigue haciendo zoom en iOS | Safari ignora `user-scalable=no` | `gesturestart` + `preventDefault` |
| Contenido tapado por el notch o la barra inferior | Falta `viewport-fit=cover` y áreas seguras | `env(safe-area-inset-*)` |
| Altura rara en celular al aparecer la barra | Uso de `100vh` | Usar `dvh` |
| Push no llega en iPhone | PWA no instalada, o iOS < 16.4 | Instalar en pantalla de inicio y pedir permiso desde ahí |
| Push no llega a nadie | Claves VAPID mal pasadas, o cambiadas | Verificar variables; no regenerar las claves |
| `Notification.requestPermission` no hace nada | No se llamó desde un gesto del usuario, o ya está bloqueado | Llamarlo desde un botón; reactivar desde ajustes |
| Cámara/GPS fallan en el celular pero no en la PC | Se entra por HTTP con la IP | Usar HTTPS (certificado local o túnel) |
| Registros duplicados tras reconectar | Reintentos sin idempotencia | UUID por operación validado en el servidor |
| Todos los usuarios se bloquean a la vez en el login | El rate limit ve una sola IP (proxy) | `trust proxy` + reenviar la IP real |
| La app se queda con datos viejos tras días sin usarse | Caché sin revalidación | `StaleWhileRevalidate` / invalidar consultas al volver a enfocar |
| iOS borró los datos locales | Política de limpieza por inactividad | No asumir que lo local es permanente; sincronizar pronto |

---

## 12. Checklist final

**Instalación**
- [ ] HTTPS en producción y en pruebas móviles
- [ ] `manifest` con nombre, `display: standalone`, colores y íconos 192/512/maskable
- [ ] `apple-touch-icon` y `theme-color` en el HTML
- [ ] Instrucciones de instalación para iOS (y botón propio en Android si se desea)

**Comportamiento de app**
- [ ] Zoom bloqueado en las tres capas (viewport, CSS, `gesturestart`) — o decisión consciente de no bloquearlo
- [ ] Inputs a 16 px, zonas táctiles ≥ 44 px
- [ ] `viewport-fit=cover` + áreas seguras en cabecera, barra inferior y pies de modal
- [ ] `dvh` en lugar de `vh`; sin scroll horizontal a 360 px
- [ ] Navegación inferior en celular; modales tipo bottom-sheet; tablas como tarjetas
- [ ] Estados de carga, vacío y error en cada pantalla

**Offline y actualización**
- [ ] Precache del cascarón y `navigateFallback` (excluyendo `/api`)
- [ ] Cola local (IndexedDB) con UUID por operación e idempotencia en el servidor
- [ ] Indicador de "sin conexión" y de pendientes
- [ ] Reloj corregido si la hora es evidencia
- [ ] `no-cache` en `index.html`, `sw.js` y manifest; `immutable` en archivos con hash
- [ ] Estrategia de actualización definida (`autoUpdate` o aviso al usuario)

**Notificaciones**
- [ ] Claves VAPID generadas una vez y guardadas como secretos
- [ ] Tabla de suscripciones por usuario; limpieza de las 404/410
- [ ] Permiso pedido desde un botón, con manejo de estados (no disponible / bloqueado / apagado / activo)
- [ ] Re-registro de la suscripción al abrir la app con la sesión actual
- [ ] Título propio, cuerpo corto, ruta de destino y TTL en cada push
- [ ] Aviso interno siempre guardado; el push nunca rompe la operación original
- [ ] Probado en iPhone real con la PWA instalada

**Seguridad y despliegue**
- [ ] Token de acceso en memoria y refresco en cookie `HttpOnly`
- [ ] Rate limit con la IP real tras el proxy
- [ ] Validación de archivos por contenido; datos de evidencia siempre del servidor
- [ ] Variables de entorno para secretos; respaldos con copia externa
- [ ] Lighthouse y pruebas en Android e iOS reales

---

## 13. Resumen en una frase

> Una PWA que se siente real = **instalable** (manifest + HTTPS) + **sin molestias de navegador** (sin zoom, sin
> rebote, áreas seguras, 16 px) + **resistente a la mala señal** (service worker + cola offline idempotente) +
> **que te busca** (push con la app cerrada) + **que se actualiza sola** (caché bien configurada).

## Referencias

- MDN — Progressive Web Apps: <https://developer.mozilla.org/docs/Web/Progressive_web_apps>
- web.dev — Learn PWA: <https://web.dev/learn/pwa>
- Workbox: <https://developer.chrome.com/docs/workbox>
- vite-plugin-pwa: <https://vite-pwa-org.netlify.app>
- Web Push (librería Node): <https://github.com/web-push-libs/web-push>
- WebKit — Web Push en iOS: <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>
- Prueba de íconos maskable: <https://maskable.app>
