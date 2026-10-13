import { Router, type Request, type Response } from 'express';
import {
  HttpError,
  LocalStorageService,
  StorageService,
  claveValida,
  verificarFirma,
  type AppModule,
} from '../../core';

const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

/**
 * Descarga de archivos con URL firmada (`firmarArchivo`): no requiere token de sesión,
 * así funcionan en `<img src>` y en correos. Sin firma válida responde 404.
 */
export function createArchivosModule({
  storage = new LocalStorageService(),
}: { storage?: StorageService } = {}): AppModule {
  const router = Router();

  router.get('/*clave', async (req: Request, res: Response) => {
    const clave = ([] as string[]).concat(req.params.clave as string | string[]).join('/');
    const exp = Number(req.query.exp);
    const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
    if (!claveValida(clave) || !verificarFirma(clave, exp, sig))
      throw HttpError.notFound('Archivo no encontrado');

    const archivo = await storage.leer(clave);
    if (!archivo) throw HttpError.notFound('Archivo no encontrado');

    const ext = clave.split('.').pop() ?? '';
    res.setHeader('Content-Type', MIME_POR_EXTENSION[ext] ?? 'application/octet-stream');
    res.setHeader('Content-Length', archivo.tamano);
    // Privado: el enlace caduca; el navegador puede guardarlo mientras dure.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    archivo.stream.pipe(res);
  });

  return { name: 'archivos', basePath: 'archivos', router };
}

export const archivosModule = createArchivosModule();
