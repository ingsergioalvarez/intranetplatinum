import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileSpreadsheet, FileText, Lock, TriangleAlert } from 'lucide-react';
import {
  ESTADO_DIA_INFORME_LABEL,
  TIPO_INFORME_LABEL,
  type EstadoDiaInforme,
  type Informe,
  type InformeDia,
  type InformeGuardia,
  type InformeResumen,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, CardHeader, EmptyState, Spinner, cn, toast, type BadgeTone } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { formatFecha, formatFechaHora } from '../../core/format/fechas';
import { formatHora } from '../asistencia/formato';
import { informesService, type FormatoInforme } from './informes.service';
import { periodoTexto } from './formato';

const hhmm = (min: number | null) =>
  min === null ? '—' : `${Math.floor(min / 60)}:${String(Math.abs(min) % 60).padStart(2, '0')}`;
const hora = (iso: string | null) => (iso ? formatHora(iso) : '—');

const TONO: Record<EstadoDiaInforme, BadgeTone> = {
  completa: 'success',
  retardo: 'warning',
  falta: 'danger',
  falta_justificada: 'warning',
  descanso: 'neutral',
  sin_salida: 'warning',
  cerrada: 'info',
  en_curso: 'info',
};

function Cifra({ valor, etiqueta, alerta }: { valor: string | number; etiqueta: string; alerta?: boolean }) {
  return (
    <div className={cn('rounded-xl p-3 ring-1 ring-inset', alerta ? 'bg-red-50 ring-red-200' : 'bg-white ring-slate-200')}>
      <p className={cn('text-xl font-bold tabular-nums', alerta ? 'text-red-700' : 'text-slate-900')}>{valor}</p>
      <p className="text-xs text-slate-500">{etiqueta}</p>
    </div>
  );
}

function Totales({ r }: { r: InformeResumen }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      <Cifra valor={r.programados} etiqueta="Días programados" />
      <Cifra valor={r.trabajados} etiqueta="Días trabajados" />
      <Cifra valor={r.faltas} etiqueta="Faltas" alerta={r.faltas > 0} />
      <Cifra valor={r.justificadas} etiqueta="Justificadas" />
      <Cifra valor={r.retardos} etiqueta={`Retardos (${r.retardoMin} min)`} />
      <Cifra valor={r.salidasAntes} etiqueta="Salidas antes" />
      <Cifra valor={r.comidas} etiqueta="Comidas" />
      <Cifra valor={`${hhmm(r.minutosTrabajados)} h`} etiqueta={`de ${hhmm(r.minutosEsperados)} h esperadas`} />
    </div>
  );
}

/** Detalle día por día de un guardia: tarjetas en celular, tabla en escritorio. */
function Dias({ dias }: { dias: InformeDia[] }) {
  if (dias.length === 0) return <EmptyState title="Sin turnos ni jornadas en el periodo" />;
  return (
    <>
      <ul className="divide-y divide-slate-100 md:hidden">
        {dias.map((d, n) => (
          <li key={`${d.fecha}-${n}`} className="space-y-1 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{formatFecha(d.fecha)}</span>
              <Badge tone={TONO[d.estado]}>{ESTADO_DIA_INFORME_LABEL[d.estado]}</Badge>
            </div>
            <p className="text-sm text-slate-600">
              {d.sitio ?? '—'}
              {d.horario ? ` · ${d.horario}` : ''}
            </p>
            {d.entrada && (
              <p className="text-sm text-slate-700">
                Entrada {hora(d.entrada)}
                {d.estado === 'retardo' && d.retardoMin ? ` (+${d.retardoMin} min)` : ''} · Salida {hora(d.salida)} ·{' '}
                {hhmm(d.minutos)} h
              </p>
            )}
            {d.notas.map((t) => (
              <p key={t} className="border-l-2 border-slate-300 pl-2 text-xs text-slate-500 italic">
                {t}
              </p>
            ))}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              {['Fecha', 'Sitio', 'Horario', 'Entrada', 'Comida', 'Salida', 'Horas', 'Estado'].map((h) => (
                <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {dias.map((d, n) => (
              <tr key={`${d.fecha}-${n}`} className="align-top">
                <td className="px-4 py-2.5 font-medium whitespace-nowrap text-slate-900">{formatFecha(d.fecha)}</td>
                <td className="px-4 py-2.5 text-slate-700">
                  {d.sitio ?? '—'}
                  {d.cobertura && <span className="block text-xs text-slate-500">Cobertura</span>}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{d.horario ?? (d.estado === 'descanso' ? 'Descanso' : '—')}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {hora(d.entrada)}
                  {d.estado === 'retardo' && d.retardoMin ? (
                    <span className="block text-xs font-medium text-amber-700">+{d.retardoMin} min</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                  {d.comidas.length ? d.comidas.map((c) => `${hora(c.inicio)} – ${hora(c.fin)}`).join(', ') : '—'}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {hora(d.salida)}
                  {(d.salidaAnticipadaMin ?? 0) >= 10 && (
                    <span className="block text-xs font-medium text-amber-700">-{d.salidaAnticipadaMin} min</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-semibold tabular-nums">{hhmm(d.minutos)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={TONO[d.estado]}>{ESTADO_DIA_INFORME_LABEL[d.estado]}</Badge>
                  {d.notas.map((t) => (
                    <p key={t} className="mt-1 max-w-xs border-l-2 border-slate-300 pl-2 text-xs text-slate-500 italic">
                      {t}
                    </p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PorGuardia({ guardias }: { guardias: InformeGuardia[] }) {
  const [abierto, setAbierto] = useState<number | null>(null);
  if (guardias.length === 0) return <EmptyState title="Sin guardias con turnos o jornadas en el periodo" />;
  return (
    <ul className="divide-y divide-slate-100">
      {guardias.map((g) => (
        <li key={g.id}>
          <button
            type="button"
            onClick={() => setAbierto(abierto === g.id ? null : g.id)}
            aria-expanded={abierto === g.id}
            className="grid w-full grid-cols-1 gap-1 px-4 py-3 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-900">{g.nombre}</span>
              <span className="block truncate text-xs text-slate-500">{g.sitios.join(', ') || '—'}</span>
            </span>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-slate-600 tabular-nums">
              <span>{g.resumen.trabajados}/{g.resumen.programados} días</span>
              <span className={g.resumen.faltas ? 'font-semibold text-red-700' : ''}>{g.resumen.faltas} faltas</span>
              <span>{g.resumen.retardos} retardos</span>
              <span className="font-semibold text-slate-800">
                {hhmm(g.resumen.minutosTrabajados)} / {hhmm(g.resumen.minutosEsperados)} h
              </span>
            </span>
          </button>
          {abierto === g.id && (
            <div className="border-t border-slate-100 bg-slate-50/50">
              <Dias dias={g.dias} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** El reporte congelado tal como se emitió (solo lectura): lo que muestra el PDF, en pantalla. */
export function InformeVerPage() {
  const id = Number(useParams().id);
  const [bajando, setBajando] = useState<FormatoInforme | null>(null);
  const q = useQuery({ queryKey: informesService.keys.uno(id), queryFn: () => informesService.obtener(id) });

  const descargar = async (i: Informe, formato: FormatoInforme) => {
    setBajando(formato);
    try {
      await informesService.descargar(i, formato);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setBajando(null);
    }
  };

  const volver = (
    <Link
      to="/asistencia/reportes"
      className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
    >
      <ArrowLeft className="size-4" /> Reportes emitidos
    </Link>
  );

  if (q.isPending) {
    return (
      <>
        {volver}
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        {volver}
        <EmptyState title="No se encontró el reporte" description="No existe o no tienes acceso a él." />
      </>
    );
  }
  const i = q.data;
  const d = i.datos;

  return (
    <>
      {volver}
      <PageHeader
        title={i.folio}
        subtitle={`Reporte ${TIPO_INFORME_LABEL[i.tipo].toLowerCase()} · ${d.alcance}`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              loading={bajando === 'excel'}
              disabled={!!bajando}
              onClick={() => void descargar(i, 'excel')}
            >
              Excel
            </Button>
            <Button
              icon={<FileText className="size-4" />}
              loading={bajando === 'pdf'}
              disabled={!!bajando}
              onClick={() => void descargar(i, 'pdf')}
            >
              PDF oficial
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        {i.reemplazadoPor && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Este reporte fue reemplazado por{' '}
              <Link to={`/asistencia/reportes/${i.reemplazadoPor.id}`} className="font-semibold underline">
                {i.reemplazadoPor.folio}
              </Link>
              . Se conserva tal como se emitió.
            </span>
          </p>
        )}

        <Card className="p-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Periodo', periodoTexto(i)],
              ['Generó', i.generadoPor ?? '—'],
              ['Emitido (hora del servidor)', formatFechaHora(i.createdAt)],
              ['Código de verificación', i.codigo],
              ...(i.reemplaza ? [['Reemplaza al folio', i.reemplaza.folio]] : []),
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="size-3.5" /> Solo lectura: los datos quedaron congelados al emitirlo.
          </p>
        </Card>

        <Totales r={d.resumen} />

        {i.tipo === 'personal' ? (
          <Card>
            <CardHeader title="Detalle día por día" />
            <Dias dias={d.guardias[0]?.dias ?? []} />
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader title="Asistencia por guardia" subtitle="Toca un guardia para ver su detalle" />
              <PorGuardia guardias={d.guardias} />
            </Card>
            {d.porSitio.length > 0 && (
              <Card>
                <CardHeader title="Subtotales por sitio" />
                <ul className="divide-y divide-slate-100">
                  {d.porSitio.map((s) => (
                    <li key={s.sitio} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span className="font-medium text-slate-900">
                        {s.sitio} <span className="font-normal text-slate-500">· {s.guardias} guardias</span>
                      </span>
                      <span className="text-slate-600 tabular-nums">
                        {s.resumen.faltas} faltas · {s.resumen.retardos} retardos ·{' '}
                        <span className="font-semibold text-slate-800">
                          {hhmm(s.resumen.minutosTrabajados)} / {hhmm(s.resumen.minutosEsperados)} h
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}

        {d.hechos.length > 0 && (
          <Card>
            <CardHeader title="Hechos relevantes" />
            <ul className="divide-y divide-slate-100">
              {d.hechos.map((h, n) => (
                <li key={n} className="px-4 py-2.5 text-sm">
                  <p className="text-xs text-slate-500">
                    {formatFechaHora(h.en)} · {h.guardia}
                  </p>
                  <p className="text-slate-800">{h.texto}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader title="Criterios aplicados" />
          <ul className="list-disc space-y-1 px-8 py-3 text-sm text-slate-600">
            {d.criterios.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
