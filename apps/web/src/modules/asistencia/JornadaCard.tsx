import { useState } from 'react';
import { ChevronDown, Coffee, Navigation, TriangleAlert } from 'lucide-react';
import { ALERTA_MARCACION_LABEL, TIPO_MARCACION_LABEL, type Jornada, type Marcacion } from '@platinum/shared';
import { Card, cn } from '../../components/ui';
import { mapsUrl } from '../../core/format/mapas';
import { formatDia, formatDuracion, formatHora, jornadaEnCurso } from './formato';

/**
 * Tarjeta de una jornada (entrada → salida, comida y alertas). La usan "Mis marcas" del guardia
 * y la ficha del guardia del admin; con `detalle` se puede desplegar cada marca con su ubicación.
 */
export function JornadaCard({ jornada: j, detalle = false }: { jornada: Jornada; detalle?: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const enCurso = jornadaEnCurso(j);
  const marcas = [j.entrada, j.inicioComida, j.finComida, j.salida].filter((m): m is Marcacion => m !== null);

  return (
    <Card className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">
            {formatDia(j.entrada.registradaEn)}
            {j.sitio && <span className="font-normal text-slate-500"> · {j.sitio.nombre}</span>}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
            {formatHora(j.entrada.registradaEn)} → {j.salida ? formatHora(j.salida.registradaEn) : '—'}
          </p>
          {j.salida ? (
            <p className="text-sm text-slate-500">
              {formatDuracion(j.entrada.registradaEn, j.salida.registradaEn)}
            </p>
          ) : enCurso ? (
            <p className="text-sm text-emerald-700">Jornada en curso</p>
          ) : (
            <p className="text-sm text-amber-700">Sin salida registrada</p>
          )}
        </div>
        {j.alertas.length > 0 && (
          <TriangleAlert className="size-5 shrink-0 text-amber-500" aria-label="Con alerta" />
        )}
      </div>

      {(j.inicioComida || j.finComida) && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
          <Coffee className="size-4" />
          Comida {j.inicioComida ? formatHora(j.inicioComida.registradaEn) : '—'}–
          {j.finComida ? formatHora(j.finComida.registradaEn) : enCurso ? 'en curso' : 'sin cierre'}
        </p>
      )}

      {j.alertas.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
          {j.alertas.map((a) => (
            <li key={a}>• {ALERTA_MARCACION_LABEL[a]}</li>
          ))}
        </ul>
      )}

      {detalle && (
        <>
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            className="mt-2 flex items-center gap-1 text-sm font-medium text-brand-700"
          >
            Ver marcas <ChevronDown className={cn('size-4 transition-transform', abierta && 'rotate-180')} />
          </button>
          {abierta && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg ring-1 ring-inset ring-slate-200">
              {marcas.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 text-slate-700">{TIPO_MARCACION_LABEL[m.tipo]}</span>
                  <span className="font-medium tabular-nums text-slate-900">
                    {formatHora(m.registradaEn)}
                  </span>
                  <span
                    className={cn(
                      'w-14 text-right tabular-nums',
                      m.alertas.length ? 'text-amber-700' : 'text-slate-500',
                    )}
                    title={m.alertas.map((a) => ALERTA_MARCACION_LABEL[a]).join(', ') || undefined}
                  >
                    {m.distanciaM === null ? '—' : `${m.distanciaM} m`}
                  </span>
                  <a
                    href={mapsUrl(m.lat, m.lng)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Ver en el mapa dónde marcó: ${TIPO_MARCACION_LABEL[m.tipo]}`}
                    className="flex size-8 items-center justify-center rounded-lg text-brand-700 hover:bg-slate-100"
                  >
                    <Navigation className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
