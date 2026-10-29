import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Botones de acción; en celular quedan fijos abajo. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Evita cerrar al tocar fuera (formularios con cambios). */
  dismissible?: boolean;
  /** Sin botón de cerrar ni Escape: la persona debe resolver lo que pide el modal. */
  cerrable?: boolean;
}

const sizes = { sm: 'md:max-w-sm', md: 'md:max-w-lg', lg: 'md:max-w-3xl' };

/**
 * Modal accesible. En celular se muestra como bottom-sheet; en escritorio, centrado.
 * Cierra con Escape, bloquea el scroll del fondo y devuelve el foco al cerrar.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  cerrable = true,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // `onClose` casi siempre llega como función nueva en cada render del padre: si el efecto dependiera
  // de ella, cada letra escrita devolvería el foco al botón de atrás y el campo lo perdería.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  // Quién tenía el foco al abrir (antes de que un campo con `autoFocus` lo tome): ahí vuelve al cerrar.
  const abierta = useRef(false);
  const focoPrevio = useRef<HTMLElement | null>(null);
  if (open && !abierta.current) focoPrevio.current = document.activeElement as HTMLElement | null;
  abierta.current = open;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Un campo con autoFocus ya tomó el foco: no se lo quitamos.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cerrable) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      focoPrevio.current?.focus();
    };
  }, [open, cerrable]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col bg-white shadow-xl outline-none',
          'rounded-t-2xl md:rounded-2xl',
          sizes[size],
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 md:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 md:px-6 md:py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {cerrable && (
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:flex-row md:justify-end md:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
