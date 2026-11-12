import type { RespuestaSos } from '@platinum/shared';
import { formatHora } from '../asistencia/formato';

/** Lo que ya se hizo con una emergencia (A-81): quién la atiende y lo que registró el C2, con la hora. */
export function RespuestasSos({ respuestas }: { respuestas: RespuestaSos[] | undefined }) {
  if (!respuestas?.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Lo que ya se hizo</p>
      <ol className="mt-1 grid grid-cols-1 gap-1">
        {respuestas.map((r) => (
          <li key={r.id} className="flex gap-2 text-sm text-slate-800">
            <span className="shrink-0 font-semibold tabular-nums text-slate-600">{formatHora(r.en)}</span>
            <span>
              {r.texto}
              {r.por && <span className="text-xs text-slate-500"> · {r.por}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
