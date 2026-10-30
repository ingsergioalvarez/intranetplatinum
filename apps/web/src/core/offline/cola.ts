import { useMemo, useSyncExternalStore } from 'react';
import type { TipoMarcacion } from '@platinum/shared';

/** Una checada hecha sin conexión, guardada en el celular hasta poder enviarla (AS2-02). */
export interface MarcaPendiente {
  /** UUID de la marca: el servidor no la duplica si se reenvía. */
  idCliente: string;
  usuarioId: number;
  tipo: TipoMarcacion;
  lat: number;
  lng: number;
  precisionM: number;
  intento: number;
  descriptor?: number[];
  conLentes?: boolean;
  /** Foto de entrada o salida. */
  foto?: Blob;
  /** Reloj crudo del celular y hora estimada (reloj corregido) al checar. */
  horaCelular: string;
  capturadaEn: string;
  /** Para mostrarla y calcular qué sigue sin consultar al servidor. */
  sitio: { id: number; nombre: string } | null;
  /** Comidas que le tocan en este turno (solo en la entrada). */
  comidas?: number;
  /** Motivo por el que el servidor la rechazó (la cola se detiene hasta que se descarte). */
  error?: string;
}

const BD = 'platinum-offline';
const TABLA = 'marcas';

let cache: MarcaPendiente[] = [];
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === 'undefined') return ko(new Error('Sin IndexedDB'));
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TABLA, { keyPath: 'idCliente' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, f: (t: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, ko) => {
    const req = f(db.transaction(TABLA, modo).objectStore(TABLA));
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
}

const ordenar = (l: MarcaPendiente[]) => [...l].sort((a, b) => a.capturadaEn.localeCompare(b.capturadaEn));

const listo = tx('readonly', (t) => t.getAll() as IDBRequest<MarcaPendiente[]>)
  .then((l) => {
    cache = ordenar(l);
    avisar();
  })
  .catch(() => undefined);

/** Guarda la checada en el celular. Sin IndexedDB queda solo en memoria (se pierde al cerrar la app). */
export async function encolarMarca(m: MarcaPendiente) {
  await listo;
  cache = ordenar([...cache.filter((x) => x.idCliente !== m.idCliente), m]);
  avisar();
  await tx('readwrite', (t) => t.put(m)).catch(() => undefined);
}

export async function quitarMarca(idCliente: string) {
  cache = cache.filter((x) => x.idCliente !== idCliente);
  avisar();
  await tx('readwrite', (t) => t.delete(idCliente)).catch(() => undefined);
}

export async function marcarConError(idCliente: string, error: string) {
  const m = cache.find((x) => x.idCliente === idCliente);
  if (!m) return;
  const nueva = { ...m, error };
  cache = cache.map((x) => (x.idCliente === idCliente ? nueva : x));
  avisar();
  await tx('readwrite', (t) => t.put(nueva)).catch(() => undefined);
}

export const pendientesDe = (usuarioId: number) => cache.filter((m) => m.usuarioId === usuarioId);

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => void oyentes.delete(f);
};

/** Checadas pendientes de enviar de ese usuario, en orden. */
export function useCola(usuarioId: number | undefined) {
  const todas = useSyncExternalStore(suscribir, () => cache);
  return useMemo(
    () => (usuarioId === undefined ? [] : todas.filter((m) => m.usuarioId === usuarioId)),
    [todas, usuarioId],
  );
}
