import { ESTADO_COBERTURA_LABEL, type ResumenCobertura } from '@platinum/shared';
import { Card, EmptyState, cn } from '../../components/ui';
import { EstadoIcono } from './EstadoIcono';
import { ESTILO_ESTADO, letraDiaSemana, numeroDia, peorEstado } from './estados';

/**
 * Todos los sitios (AS6-03): un renglón por sitio con los próximos días. Cada día se pinta con su
 * peor estado y muestra el símbolo de cada turno; al tocarlo se abre el calendario del sitio.
 */
export function TodosLosSitios({
  resumen,
  hoy,
  onAbrir,
}: {
  resumen: ResumenCobertura;
  hoy: string;
  onAbrir: (sitioId: number, fecha: string) => void;
}) {
  if (resumen.sitios.length === 0) {
    return <EmptyState title="Sin sitios con turnos" description="Asigna turnos a un sitio para ver su cobertura." />;
  }
  return (
    <ul className="space-y-3">
      {resumen.sitios.map((s) => {
        const huecos = s.dias.filter((d) => d.fecha >= hoy && d.estados.includes('sin_cubrir')).length;
        return (
          <li key={s.sitio.id}>
            <Card>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900">{s.sitio.nombre}</h3>
                  <p className="truncate text-xs text-slate-500">{s.turnos.map((t) => t.etiqueta).join(' · ')}</p>
                </div>
                {huecos > 0 ? (
                  <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {huecos} {huecos === 1 ? 'día' : 'días'} con hueco
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-medium text-emerald-700">Sin huecos</span>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1 p-3 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
                {s.dias.map((d) => {
                  const peor = peorEstado(d.estados);
                  return (
                    <button
                      key={d.fecha}
                      type="button"
                      onClick={() => onAbrir(s.sitio.id, d.fecha)}
                      aria-label={`${s.sitio.nombre}, día ${numeroDia(d.fecha)}: ${d.estados.map((e) => ESTADO_COBERTURA_LABEL[e]).join(', ')}`}
                      className={cn(
                        'flex min-w-0 flex-col items-center gap-0.5 rounded-lg py-1.5 ring-1 ring-inset ring-slate-200 hover:ring-brand-400',
                        ESTILO_ESTADO[peor].fondo,
                        d.fecha === hoy && 'ring-2 ring-brand-600',
                      )}
                    >
                      <span className="text-[10px] text-slate-500">{letraDiaSemana(d.fecha)}</span>
                      <span className="text-xs font-semibold text-slate-800">{numeroDia(d.fecha)}</span>
                      <span className="flex gap-0.5">
                        {d.estados.map((e, i) => (
                          <EstadoIcono key={i} estado={e} className="size-3" />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
