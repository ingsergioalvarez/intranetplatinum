import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// `vite --mode https`: certificado local para probar cámara y GPS desde el celular
// (el navegador solo los permite con HTTPS o en localhost).
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'https' ? [basicSsl()] : []),
    // App instalable y que abre sin señal (AS2-01). Las checadas sin conexión se guardan en el celular
    // (core/offline) y los modelos de reconocimiento (32 MB) se guardan al abrir el Checador.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Platinum Intranet',
        short_name: 'Platinum',
        description: 'Intranet de Platinum Agency: checador, reportes y asistencia.',
        lang: 'es-MX',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#121d38',
        theme_color: '#121d38',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Notificaciones push (A-20): public/push-sw.js recibe los avisos y abre la app al tocarlos.
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['modelos/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Modelos de reconocimiento y antispoof: se guardan la primera vez que se abre el Checador.
            urlPattern: ({ url }) => url.pathname.startsWith('/modelos/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'modelos',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 120 },
            },
          },
        ],
      },
      // Para probar el modo sin señal desde el celular con `npm run dev:https`.
      devOptions: { enabled: mode === 'https', type: 'module' },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
}));
