import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Evidencia } from '@platinum/shared';
import { formatFechaHora } from '../../core/format/fechas';
import { Modal } from '../../components/ui';

/** Miniaturas de evidencia; al tocar una se abre en grande con navegación. */
export function Galeria({ fotos, compacta }: { fotos: Evidencia[]; compacta?: boolean }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  if (fotos.length === 0) return null;
  const actual = abierta !== null ? fotos[abierta] : null;
  const mover = (d: number) => setAbierta((i) => (i === null ? null : (i + d + fotos.length) % fotos.length));

  return (
    <>
      <div
        className={
          compacta
            ? 'flex flex-wrap gap-2 pt-1'
            : 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4'
        }
      >
        {fotos.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setAbierta(i)}
            className={
              compacta
                ? 'size-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 hover:opacity-90'
                : 'group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm hover:border-slate-300'
            }
            aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
          >
            <img
              src={f.url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {actual && (
        <Modal
          open
          onClose={() => setAbierta(null)}
          size="lg"
          title={`Foto ${abierta! + 1} de ${fotos.length}`}
          description={`${actual.subidaPor.nombre} · ${formatFechaHora(actual.createdAt)}`}
        >
          <div className="relative flex items-center justify-center bg-slate-900/5">
            <img
              src={actual.url}
              alt={`Evidencia ${abierta! + 1}`}
              className="max-h-[65dvh] w-auto object-contain"
            />
            {fotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => mover(-1)}
                  className="absolute left-2 rounded-full bg-white/90 p-2 shadow"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(1)}
                  className="absolute right-2 rounded-full bg-white/90 p-2 shadow"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
