import { ESTADO_COBERTURA_LABEL, ESTADOS_COBERTURA, type EstadoCobertura } from '@platinum/shared';
import { cn } from '../../components/ui';
import { ESTILO_ESTADO } from './estados';

/** El símbolo de un estado (con su nombre para lectores de pantalla). */
export function EstadoIcono({ estado, className }: { estado: EstadoCobertura; className?: string }) {
  const { icono: Icono, texto } = ESTILO_ESTADO[estado];
  return (
    <>
      <Icono className={cn('size-3.5 shrink-0', texto, className)} aria-hidden />
      <span className="sr-only">{ESTADO_COBERTURA_LABEL[estado]}</span>
    </>
  );
}

/** Qué significa cada símbolo. */
export function Leyenda() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Leyenda">
      {ESTADOS_COBERTURA.map((e) => (
        <li key={e} className="inline-flex items-center gap-1">
          <EstadoIcono estado={e} />
          <span aria-hidden>{ESTADO_COBERTURA_LABEL[e]}</span>
        </li>
      ))}
    </ul>
  );
}
