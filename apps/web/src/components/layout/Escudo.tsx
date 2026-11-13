import { cn } from '../ui';

/**
 * Escudo oficial de Platinum (A-89) sobre una pastilla blanca, para que se vea con sus colores sobre las barras azules
 * (login, menú lateral y barra del celular). El tamaño lo da `className` (por ejemplo `size-8`).
 */
export function Escudo({ className, titulo }: { className?: string; titulo?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-lg bg-white', className)}
      {...(titulo ? { role: 'img', 'aria-label': titulo } : { 'aria-hidden': true })}
    >
      <img src="/escudo.svg" alt="" draggable={false} className="h-[86%] w-auto" />
    </span>
  );
}
