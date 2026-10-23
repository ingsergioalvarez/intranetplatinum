import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Marco de cámara a pantalla completa: barra superior (cerrar, título, contador), la cámara
 * o la foto ocupando el fondo y un panel inferior compacto con indicaciones y botones (DA-43: la
 * cámara debe ocupar la mayor parte de la pantalla, también en teléfonos bajitos).
 */
export function PantallaCamara({
  titulo,
  etiqueta,
  onCerrar,
  cerrarDeshabilitado,
  fondo,
  panel,
}: {
  titulo: string;
  etiqueta?: ReactNode;
  onCerrar: () => void;
  cerrarDeshabilitado?: boolean;
  fondo: ReactNode;
  panel: ReactNode;
}) {
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <header className="pt-safe flex items-center gap-2 bg-slate-950 px-2 py-1.5 text-white">
        <button
          type="button"
          onClick={onCerrar}
          disabled={cerrarDeshabilitado}
          aria-label="Cerrar"
          className="rounded-lg p-2 text-white/85 hover:bg-white/10 disabled:opacity-40"
        >
          <X className="size-5" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{titulo}</h2>
        {etiqueta && (
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium whitespace-nowrap">
            {etiqueta}
          </span>
        )}
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">{fondo}</div>

      <div className="pb-safe rounded-t-xl bg-white text-slate-900 shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
        <div className="mx-auto max-w-md space-y-2.5 px-3 pt-3 pb-3 [@media(max-height:720px)]:space-y-1.5 [@media(max-height:720px)]:pt-2 [@media(max-height:720px)]:pb-2">
          {panel}
        </div>
      </div>
    </div>,
    document.body,
  );
}
