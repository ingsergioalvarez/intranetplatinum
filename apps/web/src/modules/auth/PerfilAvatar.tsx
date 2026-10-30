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
export function PerfilAvatar({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-700 text-base font-bold text-white',
        className,
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}
