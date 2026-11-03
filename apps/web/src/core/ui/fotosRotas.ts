import { queryClient } from '../api';

/** Silueta neutra para la foto que no se pudo cargar (en lugar del ícono de imagen rota). */
const SIN_FOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f1f5f9"/>' +
      '<circle cx="32" cy="25" r="11" fill="#cbd5e1"/><path d="M10 58c2-13 11-20 22-20s20 7 22 20z" fill="#cbd5e1"/></svg>',
  );

let ultimoRefresco = 0;

/**
 * Fotos que no cargan (A-53): las fotos se sirven con un enlace firmado que caduca (60 min), así que una
 * pantalla abierta mucho tiempo o una lista en caché puede mostrar imágenes rotas. Al fallar una foto:
 *  - si el enlace ya caducó, se vuelven a pedir los datos de la pantalla para traer enlaces nuevos;
 *  - si no (el archivo ya no existe), se muestra una silueta neutra en lugar de la imagen rota.
 */
export function instalarManejoDeFotos() {
  document.addEventListener(
    'error',
    (ev) => {
      const img = ev.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.fotoRota) return;
      const src = img.getAttribute('src') ?? '';
      if (!src.includes('/api/archivos/')) return;
      let caducado = false;
      try {
        const exp = Number(new URL(src, window.location.href).searchParams.get('exp'));
        caducado = exp > 0 && exp * 1000 < Date.now();
      } catch {
        // Enlace raro: se trata como archivo que falta.
      }
      img.dataset.fotoRota = '1';
      img.src = SIN_FOTO;
      if (caducado && Date.now() - ultimoRefresco > 30_000) {
        ultimoRefresco = Date.now();
        void queryClient.invalidateQueries();
      }
    },
    true,
  );
  // Si React le pone un enlace nuevo a la misma imagen y carga bien, vuelve a vigilarse.
  document.addEventListener(
    'load',
    (ev) => {
      const img = ev.target;
      if (img instanceof HTMLImageElement && img.dataset.fotoRota && img.src !== SIN_FOTO) delete img.dataset.fotoRota;
    },
    true,
  );
}
