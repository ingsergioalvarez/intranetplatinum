import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { cn } from './cn';
import { useToastStore, type ToastTone } from './toastStore';

const styles: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-emerald-600' },
  error: { icon: XCircle, className: 'text-red-600' },
  info: { icon: Info, className: 'text-sky-600' },
  warning: { icon: AlertTriangle, className: 'text-amber-600' },
};

/** Montar una vez en la raíz. En celular aparece arriba (no tapa la navegación inferior). */
export function Toaster() {
  const { items, dismiss } = useToastStore();
  return (
    <div
      aria-live="polite"
      className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 md:items-end md:p-4"
    >
      {items.map((t) => {
        const { icon: Icon, className } = styles[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', className)} />
            <p className="flex-1 text-sm text-slate-800">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Cerrar aviso"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
