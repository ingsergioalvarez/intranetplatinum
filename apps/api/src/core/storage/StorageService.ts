import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../../config/env';
import { extensionDe } from './imagenes';

export interface ArchivoLeido {
  stream: Readable;
  tamano: number;
}

/**
 * Almacenamiento de archivos (fotos de evidencia). Las claves son rutas relativas
 * (`reportes/2026/10/<uuid>.jpg`); nunca se exponen directamente: se sirven con URL firmada.
 * Cambiar a S3/R2 = otra implementación con el mismo contrato (STORAGE_DRIVER).
 */
export abstract class StorageService {
  /** Guarda el contenido y devuelve su clave. */
  abstract guardar(contenido: Buffer, mime: string, carpeta: string): Promise<string>;
  abstract leer(clave: string): Promise<ArchivoLeido | null>;
  abstract eliminar(clave: string): Promise<void>;

  /** Clave nueva agrupada por año/mes. */
  protected nuevaClave(carpeta: string, mime: string, ahora = new Date()) {
    const mes = String(ahora.getUTCMonth() + 1).padStart(2, '0');
    return `${carpeta}/${ahora.getUTCFullYear()}/${mes}/${randomUUID()}.${extensionDe(mime)}`;
  }
}

/** Claves válidas: segmentos alfanuméricos, sin `..` ni rutas absolutas. */
export function claveValida(clave: string) {
  return /^[a-z0-9-]+(\/[a-z0-9-]+)*\/[a-f0-9-]+\.[a-z0-9]+$/i.test(clave) && !clave.includes('..');
}

export class LocalStorageService extends StorageService {
  private readonly raiz: string;

  constructor(raiz = env.UPLOADS_DIR) {
    super();
    this.raiz = path.resolve(raiz);
  }

  async guardar(contenido: Buffer, mime: string, carpeta: string) {
    const clave = this.nuevaClave(carpeta, mime);
    const destino = this.ruta(clave);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, contenido);
    return clave;
  }

  async leer(clave: string) {
    if (!claveValida(clave)) return null;
    const ruta = this.ruta(clave);
    try {
      const { size } = await stat(ruta);
      return { stream: createReadStream(ruta), tamano: size };
    } catch {
      return null;
    }
  }

  async eliminar(clave: string) {
    if (claveValida(clave)) await rm(this.ruta(clave), { force: true });
  }

  private ruta(clave: string) {
    const ruta = path.resolve(this.raiz, clave);
    if (!ruta.startsWith(this.raiz + path.sep)) throw new Error('Clave de archivo fuera del almacenamiento');
    return ruta;
  }
}
