import { useState } from 'react';
import { VisorFotos } from '../../components/ui';

/**
 * Miniatura de la foto con la que el guardia checó su entrada, para la lista de Asistencia (A-75): el
 * avatar de la fila es quién debe estar (su foto de referencia) y esta es quién checó. Al tocarla se
 * amplía sin abrir el detalle de la fila.
 */
export function FotoChecada({ url, nombre }: { url: string | null | undefined; nombre: string }) {
  const [viendo, setViendo] = useState<number | null>(null);
  if (!url) return null;
  return (
    // El visor se pinta aparte pero, para React, sigue dentro de la fila: sin esto, tocarlo abriría el detalle.
    <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setViendo(0)}
        aria-label={`Ver la foto de la checada de ${nombre}`}
        title="Foto de la checada"
        className="block rounded-lg ring-1 ring-slate-200 hover:ring-brand-400 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <img src={url} alt="" className="size-10 -scale-x-100 rounded-lg object-cover" />
      </button>
      <VisorFotos
        fotos={[{ url, titulo: `Foto de la checada · ${nombre}` }]}
        indice={viendo}
        onClose={() => setViendo(null)}
        espejo
      />
    </span>
  );
}
