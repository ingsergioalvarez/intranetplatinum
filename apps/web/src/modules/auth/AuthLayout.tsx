import type { ReactNode } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { cn } from '../../components/ui';

/**
 * Marco de las pantallas de acceso (login, cambio de contraseña).
 * En celular: marca arriba y hoja blanca al fondo; en escritorio: tarjeta centrada.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col bg-brand-900 md:items-center md:justify-center md:p-6">
      <div className="flex flex-col items-center gap-3 px-6 pb-8 pt-14 text-center text-white md:pt-0">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-800 ring-1 ring-brand-700">
          <ShieldCheck className="size-9 text-platinum-300" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight">
            Platinum <span className="font-normal text-platinum-300">Intranet</span>
          </p>
          <p className="mt-1 text-sm text-brand-200">Seguridad intramuros</p>
        </div>
      </div>

      <main className="flex-1 rounded-t-3xl bg-white px-6 pb-8 pt-8 md:w-full md:max-w-sm md:flex-none md:rounded-2xl md:shadow-xl">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-xs text-slate-400">{footer}</div>}
      </main>
    </div>
  );
}

/** Aviso de error/advertencia dentro de un formulario de acceso. */
export function FormAlert({
  tone = 'error',
  icon,
  children,
}: {
  tone?: 'error' | 'warning';
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-2 rounded-lg px-3 py-2.5 text-sm',
        tone === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700',
      )}
    >
      <span className="mt-0.5 shrink-0">{icon ?? <AlertCircle className="size-4" />}</span>
      <span>{children}</span>
    </div>
  );
}
