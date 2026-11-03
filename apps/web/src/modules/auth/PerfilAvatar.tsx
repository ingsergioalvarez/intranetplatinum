import { cn } from '../../components/ui';

/** Iniciales (hasta 2) del nombre: "Eleazar Santiago Martinez" → "ES". */
const iniciales = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

/** Círculo con las iniciales (A-40: las tarjetas no llevan foto, por si el celular se comparte). */
export function PerfilAvatar({
  nombre,
  className,
  pendientes = 0,
}: {
  nombre: string;
  className?: string;
  /** Avisos sin leer (A-58): burbuja roja sobre el círculo. */
  pendientes?: number;
}) {
  return (
    <span className="relative shrink-0">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-12 items-center justify-center rounded-full bg-brand-700 text-base font-bold text-white',
          className,
        )}
      >
        {iniciales(nombre)}
      </span>
      {pendientes > 0 && (
        <span
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs leading-none font-bold text-white ring-2 ring-white"
          aria-label={`${pendientes} avisos sin leer`}
        >
          {pendientes > 99 ? '99+' : pendientes}
        </span>
      )}
    </span>
  );
}
