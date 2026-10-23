import { SALIDA_ANTICIPADA_MIN, TOLERANCIA_RETARDO_MIN, type Jornada } from '@platinum/shared';
import { cn } from '../../components/ui';
import { formatHora } from './formato';

/** `+25 min`, `−1 h 05 min` */
function minutos(m: number) {
  const a = Math.abs(m);
  const texto = a < 60 ? `${a} min` : `${Math.floor(a / 60)} h ${String(a % 60).padStart(2, '0')} min`;
  return `${m > 0 ? '+' : '−'}${texto}`;
}

/**
 * Hora real de la entrada o salida con una etiqueta debajo con la hora programada (DA-33):
 * verde a tiempo, roja con retardo, naranja si salió antes. Sin horario, solo la hora.
 */
export function HoraMarca({ jornada: j, tipo }: { jornada: Jornada; tipo: 'entrada' | 'salida' }) {
  const marca = tipo === 'entrada' ? j.entrada : j.salida;
  const programada = j.programada && (tipo === 'entrada' ? j.programada.entrada : j.programada.salida);
  const diferencia = tipo === 'entrada' ? j.retardoMin : j.salidaAnticipadaMin;
  const fuera =
    diferencia !== null &&
    (tipo === 'entrada' ? diferencia > TOLERANCIA_RETARDO_MIN : diferencia >= SALIDA_ANTICIPADA_MIN);

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="font-medium text-slate-900">{marca ? formatHora(marca.registradaEn) : '—'}</span>
      {programada && (
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset',
            !marca
              ? 'bg-slate-50 text-slate-600 ring-slate-200'
              : !fuera
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : tipo === 'entrada'
                  ? 'bg-red-50 text-red-700 ring-red-200'
                  : 'bg-amber-50 text-amber-800 ring-amber-200',
          )}
          title={tipo === 'entrada' ? 'Hora de entrada programada' : 'Hora de salida programada'}
        >
          Debía {formatHora(programada)}
          {marca && fuera && ` · ${minutos(tipo === 'entrada' ? diferencia : -diferencia)}`}
        </span>
      )}
    </span>
  );
}
