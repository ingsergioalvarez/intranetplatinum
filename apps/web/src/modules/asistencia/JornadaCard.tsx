import { useState } from 'react';
import { Camera, ChevronDown, Coffee, Navigation, TriangleAlert } from 'lucide-react';
import {
  ALERTA_MARCACION_LABEL,
  TIPO_MARCACION_LABEL,
  UMBRAL_ROSTRO,
  parecidoRostro,
  type Jornada,
  type Marcacion,
  type RostroRegistro,
} from '@platinum/shared';
import { Button, Card, Modal, VisorFotos, cn } from '../../components/ui';
import { formatFechaHora } from '../../core/format/fechas';
import { mapsUrl } from '../../core/format/mapas';
import { formatDia, formatDuracion, formatHora, jornadaEnCurso } from './formato';
import { HoraMarca } from './HoraMarca';

/** Color del parecido con el rostro registrado: verde holgado, ámbar cerca del límite, rojo fuera. */
function tonoParecido(distancia: number) {
  if (distancia <= UMBRAL_ROSTRO * 0.8) return 'bg-emerald-100 text-emerald-800';
  if (distancia <= UMBRAL_ROSTRO) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

/**
 * Tarjeta de una jornada (entrada → salida, comida y alertas). La usan "Mis marcas" del guardia
 * y la ficha del guardia del admin; con `detalle` se puede desplegar cada marca con su ubicación y
 * con `miniaturas` se ven las fotos de entrada/salida con su parecido (AS1-12).
 */
export function JornadaCard({
  jornada: j,
  detalle = false,
  miniaturas = false,
  rostro = null,
}: {
  jornada: Jornada;
  detalle?: boolean;
  miniaturas?: boolean;
  /** Rostro registrado del guardia, para comparar con la foto de cada marca (vista del admin). */
  rostro?: RostroRegistro | null;
}) {
  const [abierta, setAbierta] = useState(false);
  const [foto, setFoto] = useState<Marcacion | null>(null);
  const enCurso = jornadaEnCurso(j);
  const marcas = [j.entrada, j.inicioComida, j.finComida, j.salida].filter((m): m is Marcacion => m !== null);
  // Marcó con el rostro pendiente y después se aprobó: ya no es alerta (AS1-14).
  const aprobadoEn = marcas.find((m) => m.rostroAprobadoEn)?.rostroAprobadoEn ?? null;

  return (
    <Card className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">
            {formatDia(j.entrada.registradaEn)}
            {j.sitio && <span className="font-normal text-slate-500"> · {j.sitio.nombre}</span>}
          </p>
          <div className="mt-0.5 flex items-start gap-2 text-lg tabular-nums text-slate-900">
            <HoraMarca jornada={j} tipo="entrada" />
            <span className="text-slate-400">→</span>
            <HoraMarca jornada={j} tipo="salida" />
          </div>
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
          Comida {j.inicioComida ? formatHora(j.inicioComida.registradaEn) : '—'} –{' '}
          {j.finComida ? formatHora(j.finComida.registradaEn) : enCurso ? 'en curso' : 'sin cierre'}
        </p>
      )}

      {miniaturas && marcas.some((m) => m.foto) && (
        <ul className="mt-3 flex gap-3">
          {marcas
            .filter((m) => m.foto)
            .map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setFoto(m)}
                  aria-label={`Ver la foto: ${TIPO_MARCACION_LABEL[m.tipo]}`}
                  className="flex items-center gap-2 text-left"
                >
                  <img
                    src={m.foto!}
                    alt=""
                    className="size-14 shrink-0 -scale-x-100 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                  <span className="text-xs">
                    <span className="block font-medium text-slate-700">{TIPO_MARCACION_LABEL[m.tipo]}</span>
                    <span className="block tabular-nums text-slate-500">{formatHora(m.registradaEn)}</span>
                    {m.rostro?.distancia != null && (
                      <span
                        className={cn(
                          'mt-0.5 inline-block rounded px-1.5 py-0.5 font-semibold tabular-nums',
                          tonoParecido(m.rostro.distancia),
                        )}
                      >
                        {parecidoRostro(m.rostro.distancia)} %
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}

      {j.alertas.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
          {j.alertas.map((a) => (
            <li key={a} className={cn(a === 'rostro_rechazado' && 'font-medium text-red-700')}>
              • {ALERTA_MARCACION_LABEL[a]}
            </li>
          ))}
        </ul>
      )}
      {aprobadoEn && (
        <p className="mt-1 text-xs text-slate-500">
          • Rostro aprobado después ({formatFechaHora(aprobadoEn)})
        </p>
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
                  {m.foto ? (
                    <button
                      type="button"
                      onClick={() => setFoto(m)}
                      aria-label={`Ver la foto: ${TIPO_MARCACION_LABEL[m.tipo]}`}
                      className="flex size-8 items-center justify-center rounded-lg text-brand-700 hover:bg-slate-100"
                    >
                      <Camera className="size-4" />
                    </button>
                  ) : (
                    <span className="size-8" />
                  )}
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
      <FotoMarcaModal marca={foto} rostro={rostro} onClose={() => setFoto(null)} />
    </Card>
  );
}

/** Foto de la marca junto al rostro registrado, con el resultado del reconocimiento. */
function FotoMarcaModal({
  marca: m,
  rostro,
  onClose,
}: {
  marca: Marcacion | null;
  rostro: RostroRegistro | null;
  onClose: () => void;
}) {
  const [viendo, setViendo] = useState<number | null>(null);
  return (
    <Modal
      open={m !== null}
      onClose={onClose}
      size="md"
      title={
        m
          ? `${TIPO_MARCACION_LABEL[m.tipo]} · ${formatDia(m.registradaEn)} ${formatHora(m.registradaEn)}`
          : ''
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {m && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <figure className="space-y-1.5">
              <button
                type="button"
                onClick={() => setViendo(0)}
                aria-label="Ver la foto de la marca"
                className="w-full"
              >
                <img
                  src={m.foto!}
                  alt="Foto de la marca"
                  className="aspect-[3/4] w-full -scale-x-100 rounded-xl object-cover ring-1 ring-slate-200"
                />
              </button>
              <figcaption className="text-center text-xs text-slate-500">Foto de la marca</figcaption>
            </figure>
            <figure className="space-y-1.5">
              {rostro ? (
                <button
                  type="button"
                  onClick={() => setViendo(1)}
                  aria-label="Ver el rostro registrado"
                  className="w-full"
                >
                  <img
                    src={rostro.fotoUrl}
                    alt="Rostro registrado"
                    className="aspect-[3/4] w-full -scale-x-100 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                </button>
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-500">
                  Sin rostro registrado
                </div>
              )}
              <figcaption className="text-center text-xs text-slate-500">Rostro registrado</figcaption>
            </figure>
          </div>
          {m.rostro && (
            <p className="text-center text-sm text-slate-700">
              {m.rostro.distancia === null
                ? 'Sin comparación'
                : `Parecido ${parecidoRostro(m.rostro.distancia)} %`}{' '}
              · {m.rostro.intentos} {m.rostro.intentos === 1 ? 'intento' : 'intentos'}
            </p>
          )}
          {m.alertas.length > 0 && (
            <ul className="space-y-0.5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {m.alertas.map((a) => (
                <li key={a}>• {ALERTA_MARCACION_LABEL[a]}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {m && (
        <VisorFotos
          fotos={[
            { url: m.foto!, titulo: 'Foto de la marca' },
            ...(rostro ? [{ url: rostro.fotoUrl, titulo: 'Rostro registrado' }] : []),
          ]}
          indice={viendo}
          onClose={() => setViendo(null)}
          espejo
        />
      )}
    </Modal>
  );
}
