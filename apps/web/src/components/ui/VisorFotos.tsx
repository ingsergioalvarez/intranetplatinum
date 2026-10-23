import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from './cn';

export interface FotoVisor {
  url: string;
  /** Texto debajo de la foto (p. ej. "Intento" o "Rostro registrado"). */
  titulo?: string;
}

/**
 * Visor de fotos flotante sobre la página (sin abrir otra pestaña): foto grande sobre fondo
 * oscuro, flechas o deslizar entre varias, zoom con doble toque o botón, y cerrar con ✕, Esc o
 * tocando fuera. `espejo` muestra las selfies como se vieron en la cámara.
 */
export function VisorFotos({
  fotos,
  indice,
  onClose,
  espejo = false,
}: {
  fotos: FotoVisor[];
  /** Foto abierta; null = cerrado. */
  indice: number | null;
  onClose: () => void;
  espejo?: boolean;
}) {
  const [actual, setActual] = useState(indice ?? 0);
  const [zoom, setZoom] = useState(false);
  const toque = useRef<number | null>(null);
  const abierto = indice !== null && fotos.length > 0;
  const total = fotos.length;

  useEffect(() => {
    if (indice !== null) setActual(indice);
    setZoom(false);
  }, [indice]);

  const mover = (delta: number) => {
    setZoom(false);
    setActual((i) => (i + delta + total) % total);
  };

  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // En captura: Esc cierra solo el visor, no el modal que esté debajo.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft' && total > 1) mover(-1);
      else if (e.key === 'ArrowRight' && total > 1) mover(1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previo;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, onClose, total]);

  if (!abierto) return null;
  const foto = fotos[Math.min(actual, total - 1)];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={foto.titulo ?? 'Foto'}
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-white"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 pt-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="py-3 text-sm text-white/80">
          {total > 1 && `${actual + 1} de ${total}`}
          {foto.titulo && `${total > 1 ? ' · ' : ''}${foto.titulo}`}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => !z)}
            className="rounded-lg p-2.5 hover:bg-white/10"
            aria-label={zoom ? 'Alejar' : 'Acercar'}
          >
            {zoom ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2.5 hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X className="size-6" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          'relative min-h-0 flex-1',
          zoom ? 'overflow-auto' : 'flex items-center justify-center p-2',
        )}
        onTouchStart={(e) => (toque.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const inicio = toque.current;
          toque.current = null;
          if (zoom || inicio === null || total < 2) return;
          const dx = e.changedTouches[0].clientX - inicio;
          if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
        }}
      >
        <img
          src={foto.url}
          alt={foto.titulo ?? 'Foto'}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => setZoom((z) => !z)}
          className={cn(
            'select-none',
            espejo && '-scale-x-100',
            zoom ? 'max-w-none' : 'max-h-full max-w-full rounded-lg object-contain',
          )}
          style={zoom ? { width: '220%' } : undefined}
          draggable={false}
        />
        {total > 1 && !zoom && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                mover(-1);
              }}
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 hover:bg-black/70"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                mover(1);
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 hover:bg-black/70"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>
      <p
        className="px-4 pt-2 pb-4 pb-safe text-center text-xs text-white/60"
        onClick={(e) => e.stopPropagation()}
      >
        {zoom ? 'Doble toque para alejar' : 'Doble toque para acercar · toca fuera para cerrar'}
      </p>
    </div>,
    document.body,
  );
}
