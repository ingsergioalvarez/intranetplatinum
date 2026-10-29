import { SALIDA_ANTICIPADA_MIN, TOLERANCIA_RETARDO_MIN, type Jornada } from '@platinum/shared';
import { cn } from '../../components/ui';
import { formatHora } from './formato';

/** `25 min`, `9 h 19 min` */
function duracion(m: number) {
  const a = Math.abs(m);
  return a < 60 ? `${a} min` : `${Math.floor(a / 60)} h ${String(a % 60).padStart(2, '0')} min`;
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

  const justificada = j.justificadas.includes(tipo === 'entrada' ? 'retardo' : 'salida_anticipada');

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="font-medium text-slate-900">{marca ? formatHora(marca.registradaEn) : '—'}</span>
      {programada && (
        <span
          className={cn(
            'max-w-full rounded px-1.5 py-0.5 text-[11px] leading-tight font-medium ring-1 ring-inset',
            !marca
              ? 'bg-slate-50 text-slate-600 ring-slate-200'
              : !fuera
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : justificada
                  ? 'bg-brand-50 text-brand-700 ring-brand-200'
                  : tipo === 'entrada'
                  ? 'bg-red-50 text-red-700 ring-red-200'
                  : 'bg-amber-50 text-amber-800 ring-amber-200',
          )}
          title={
            marca && fuera && tipo === 'entrada'
              ? `Hora de entrada programada. ${diferencia - TOLERANCIA_RETARDO_MIN} min fuera de la tolerancia`
              : tipo === 'entrada'
                ? 'Hora de entrada programada'
                : 'Hora de salida programada'
          }
        >
          {tipo === 'entrada' ? 'Entra a las' : 'Sale a las'} {formatHora(programada)}
          {marca && fuera && ` · ${duracion(diferencia)} ${tipo === 'entrada' ? 'tarde' : 'antes'}`}
          {marca && fuera && justificada && ' · justificado'}
        </span>
      )}
    </span>
  );
}
