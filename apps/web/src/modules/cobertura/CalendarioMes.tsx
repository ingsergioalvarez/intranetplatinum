import { ESTADO_COBERTURA_LABEL, type CoberturaSitio, type TurnoDiaCobertura } from '@platinum/shared';
import { cn } from '../../components/ui';
import { EstadoIcono } from './EstadoIcono';
import { ESTILO_ESTADO, numeroDia, peorEstado, primerNombre, semanasDelMes } from './estados';

const SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Lo que se lee en la celda (solo en pantallas anchas): quién cubre, o "Sin cubrir". */
function textoTurno(t: TurnoDiaCobertura) {
  if (t.estado === 'sin_cubrir') return 'Sin cubrir';
  if (t.estado === 'sin_turno') return '';
  const [primero, ...resto] = t.guardias;
  if (!primero) return '';
  return resto.length ? `${primerNombre(primero.nombre)} +${resto.length}` : primerNombre(primero.nombre);
}

/**
 * Mes de un sitio (AS6-02): una línea por turno en cada día, con su símbolo. En celular solo los
 * símbolos (cuadrícula de 7 columnas sin scroll); en pantallas anchas también quién cubre.
 */
export function CalendarioMes({
  data,
  mes,
  hoy,
  soloHuecos,
  onDia,
}: {
  data: CoberturaSitio;
  mes: string;
  hoy: string;
  soloHuecos: boolean;
  onDia: (fecha: string) => void;
}) {
  const porFecha = new Map(data.dias.map((d) => [d.fecha, d.turnos]));
  const varios = data.turnos.length > 1;
  return (
    <div role="grid" aria-label="Calendario del mes">
      <div role="row" className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium text-slate-500">
        {SEMANA.map((d) => (
          <span key={d} role="columnheader">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-1">
        {semanasDelMes(mes).map((semana, i) => (
          <div key={i} role="row" className="grid grid-cols-7 gap-1">
            {semana.map((fecha, j) => {
              if (!fecha) return <span key={j} role="gridcell" aria-hidden />;
              const turnos = porFecha.get(fecha) ?? [];
              const peor = peorEstado(turnos.map((t) => t.estado));
              const conHueco = turnos.some((t) => t.estado === 'sin_cubrir');
              return (
                <button
                  key={fecha}
                  type="button"
                  role="gridcell"
                  onClick={() => onDia(fecha)}
                  aria-label={`${numeroDia(fecha)}: ${turnos.map((t) => ESTADO_COBERTURA_LABEL[t.estado]).join(', ') || 'sin turnos'}`}
                  className={cn(
                    'flex min-h-14 min-w-0 flex-col items-stretch gap-0.5 rounded-lg p-1 text-left ring-1 ring-inset ring-slate-200 hover:ring-brand-400 sm:min-h-20 sm:p-1.5',
                    ESTILO_ESTADO[peor].fondo,
                    fecha === hoy && 'ring-2 ring-brand-600',
                    soloHuecos && !conHueco && 'opacity-30',
                  )}
                >
                  <span className={cn('text-xs font-semibold text-slate-700', fecha === hoy && 'text-brand-700')}>
                    {numeroDia(fecha)}
                  </span>
                  {turnos.map((t) => (
                    <span key={t.clave} className="flex min-w-0 items-center gap-1 text-[11px] leading-tight">
                      <EstadoIcono estado={t.estado} />
                      <span className={cn('hidden min-w-0 truncate sm:inline', ESTILO_ESTADO[t.estado].texto)}>
                        {varios && t.estado !== 'sin_turno' && (
                          <span className="mr-1 text-slate-400">{data.turnos.find((x) => x.clave === t.clave)?.horaInicio}</span>
                        )}
                        {textoTurno(t)}
                      </span>
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
