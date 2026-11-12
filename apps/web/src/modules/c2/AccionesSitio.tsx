import { useEffect, useRef, useState } from 'react';
import { ClipboardPlus, Megaphone, NotebookPen, Phone, type LucideIcon } from 'lucide-react';
import type { SitioC2 } from '@platinum/shared';
import { cn } from '../../components/ui';

export type AccionC2 = 'avisar' | 'nota' | 'reporte';

const BOTON =
  'inline-flex size-9 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500';

/** "Llamar": abre los números del supervisor del sitio (el personal y el de la empresa), uno por botón. */
function Llamar({ sitio, tenue }: { sitio: SitioC2; tenue: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const telefonos = sitio.supervisor?.telefonos ?? [];

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const etiqueta = `Llamar al supervisor de ${sitio.nombre}`;
  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={etiqueta}
        title={telefonos.length ? 'Llamar al supervisor' : 'Este sitio no tiene supervisor con teléfono'}
        disabled={telefonos.length === 0}
        className={cn(BOTON, tenue && 'opacity-60 hover:opacity-100', 'disabled:cursor-not-allowed disabled:opacity-30')}
      >
        <Phone className="size-4" aria-hidden />
      </button>
      {abierto && (
        <div role="menu" className="absolute top-full right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl bg-white p-1 shadow-lg ring-1 ring-slate-200">
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-500">Supervisor · {sitio.supervisor?.nombre}</p>
          {telefonos.map((t) => (
            <a
              key={t.numero}
              role="menuitem"
              href={`tel:${t.numero}`}
              className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              <Phone className="size-4 text-slate-500" aria-hidden /> {t.numero}
              <span className="text-xs font-normal text-slate-500">{t.etiqueta === 'personal' ? 'personal' : 'empresa'}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const ACCIONES: { accion: AccionC2; icono: LucideIcon; titulo: string }[] = [
  { accion: 'avisar', icono: Megaphone, titulo: 'Avisar al supervisor' },
  { accion: 'nota', icono: NotebookPen, titulo: 'Agregar una nota' },
  { accion: 'reporte', icono: ClipboardPlus, titulo: 'Levantar un reporte' },
];

/**
 * Acciones del C2 sobre un sitio (A-80), solo iconos: llamar al supervisor, avisarle, anotar y reportar. Están en todas las
 * filas (el C2 también puede ver algo en un sitio cubierto), más tenues en las que no tienen problema.
 */
export function AccionesSitio({ sitio, onAccion }: { sitio: SitioC2; onAccion: (accion: AccionC2) => void }) {
  const tenue = sitio.estado === 'cubierto' || sitio.estado === 'sin_turno';
  return (
    <div className="flex items-center justify-end gap-1.5" role="group" aria-label={`Acciones de ${sitio.nombre}`}>
      <Llamar sitio={sitio} tenue={tenue} />
      {ACCIONES.map(({ accion, icono: Icono, titulo }) => (
        <button
          key={accion}
          type="button"
          onClick={() => onAccion(accion)}
          title={titulo}
          aria-label={`${titulo}: ${sitio.nombre}`}
          className={cn(BOTON, tenue && 'opacity-60 hover:opacity-100')}
        >
          <Icono className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
