import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, Card, Checkbox, EmptyState, Select, Spinner, cn } from '../../components/ui';
import { hoyLocal } from '../../core/format/fechas';
import { EnviarCubrirModal } from '../clientes/EnviarCubrirModal';
import { CalendarioMes } from './CalendarioMes';
import { DiaCoberturaModal, type PedirCobertura } from './DiaCoberturaModal';
import { Leyenda } from './EstadoIcono';
import { TodosLosSitios } from './TodosLosSitios';
import { coberturaService } from './cobertura.service';
import { nombreMes, primerDia, rangoProximos, sumarMes, ultimoDia } from './estados';

const VISTAS = [
  ['sitio', 'Por sitio'],
  ['sitios', 'Todos los sitios'],
] as const;

/**
 * Calendario de cobertura (AS6-02, AS6-03): por cada sitio y día, quién cubre cada turno y dónde hay
 * huecos. El supervisor ve sus sitios; el admin, todos. Los huecos se resuelven desde el día (AS6-04).
 */
export function CalendarioPage() {
  const hoy = hoyLocal();
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') === 'sitios' ? 'sitios' : 'sitio';
  const mesParam = params.get('mes');
  const mes = mesParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : hoy.slice(0, 7);
  const dia = params.get('dia') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('dia')!) ? params.get('dia')! : null;
  const [soloHuecos, setSoloHuecos] = useState(false);
  const [cubriendo, setCubriendo] = useState<PedirCobertura | null>(null);

  const cambiar = (cambios: Record<string, string | null>) =>
    setParams(
      (actual) => {
        const siguiente = new URLSearchParams(actual);
        for (const [k, v] of Object.entries(cambios)) {
          if (v) siguiente.set(k, v);
          else siguiente.delete(k);
        }
        return siguiente;
      },
      { replace: true },
    );

  const rango = rangoProximos(hoy);
  const resumen = useQuery({
    queryKey: coberturaService.keys.resumen(rango),
    queryFn: () => coberturaService.resumen(rango),
    refetchInterval: 60_000,
  });
  const sitios = resumen.data?.sitios ?? [];
  const sitioId = Number(params.get('sitio')) || sitios[0]?.sitio.id || null;

  const consulta = sitioId ? { sitioId, desde: primerDia(mes), hasta: ultimoDia(mes) } : null;
  const calendario = useQuery({
    queryKey: consulta ? coberturaService.keys.sitio(consulta) : ['cobertura', 'sitio', 'sin-sitio'],
    queryFn: () => coberturaService.sitio(consulta!),
    enabled: vista === 'sitio' && !!consulta,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  return (
    <>
      <Link
        to="/asistencia"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader title="Calendario de cobertura" subtitle="Quién cubre cada turno y dónde hay huecos" />

      <div role="tablist" aria-label="Vista" className="mb-3 flex gap-1 rounded-xl bg-slate-200/60 p-1 sm:inline-flex">
        {VISTAS.map(([v, etiqueta]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            onClick={() => cambiar({ vista: v === 'sitio' ? null : v, dia: null })}
            className={cn(
              'flex-1 rounded-lg px-5 py-2 text-sm font-medium sm:flex-none',
              vista === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {etiqueta}
            {v === 'sitios' && (resumen.data?.sinCubrir ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                {resumen.data!.sinCubrir}
              </span>
            )}
          </button>
        ))}
      </div>

      {resumen.isPending ? (
        <div className="flex justify-center py-10 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : resumen.isError ? (
        <EmptyState
          title="No se pudo cargar la cobertura"
          description="Revisa tu conexión e intenta de nuevo."
          action={
            <Button variant="secondary" onClick={() => void resumen.refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : vista === 'sitios' ? (
        <div className="space-y-3">
          <Leyenda />
          <TodosLosSitios
            resumen={resumen.data}
            hoy={hoy}
            onAbrir={(id, fecha) => cambiar({ vista: null, sitio: String(id), mes: fecha.slice(0, 7), dia: fecha })}
          />
        </div>
      ) : sitios.length === 0 || !sitioId ? (
        <EmptyState title="Sin sitios con turnos" description="Asigna turnos a un sitio para ver su cobertura." />
      ) : (
        <Card>
          <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 md:grid-cols-[minmax(0,16rem)_1fr_auto] md:items-center">
            <Select
              aria-label="Sitio"
              value={String(sitioId)}
              onChange={(e) => cambiar({ sitio: e.target.value, dia: null })}
              options={sitios.map((s) => ({ value: String(s.sitio.id), label: s.sitio.nombre }))}
            />
            <div className="flex items-center justify-between gap-1 md:justify-center">
              <Button variant="ghost" size="sm" aria-label="Mes anterior" onClick={() => cambiar({ mes: sumarMes(mes, -1), dia: null })}>
                <ChevronLeft className="size-5" />
              </Button>
              <span className="min-w-36 text-center font-semibold text-slate-900">{nombreMes(mes)}</span>
              <Button variant="ghost" size="sm" aria-label="Mes siguiente" onClick={() => cambiar({ mes: sumarMes(mes, 1), dia: null })}>
                <ChevronRight className="size-5" />
              </Button>
            </div>
            <Checkbox label="Solo huecos" checked={soloHuecos} onChange={(e) => setSoloHuecos(e.target.checked)} />
          </div>
          <div className="space-y-3 p-3 sm:p-4">
            <Leyenda />
            {calendario.isError ? (
              <EmptyState
                title="No se pudo cargar el calendario"
                action={
                  <Button variant="secondary" onClick={() => void calendario.refetch()}>
                    Reintentar
                  </Button>
                }
              />
            ) : !calendario.data ? (
              <div className="flex justify-center py-10 text-brand-600">
                <Spinner className="size-7" />
              </div>
            ) : (
              <CalendarioMes
                data={calendario.data}
                mes={mes}
                hoy={hoy}
                soloHuecos={soloHuecos}
                onDia={(fecha) => cambiar({ dia: fecha })}
              />
            )}
          </div>
        </Card>
      )}

      {dia && calendario.data && vista === 'sitio' && !cubriendo && (
        <DiaCoberturaModal
          data={calendario.data}
          fecha={dia}
          hoy={hoy}
          onClose={() => cambiar({ dia: null })}
          onCubrir={(p) => {
            setCubriendo(p);
            cambiar({ dia: null });
          }}
        />
      )}
      {cubriendo && calendario.data && (
        <EnviarCubrirModal
          sitio={calendario.data.sitio}
          fecha={cubriendo.fecha}
          horaInicio={cubriendo.turno.horaInicio}
          horas={cubriendo.turno.horas}
          cubreA={cubriendo.cubreA}
          onClose={() => setCubriendo(null)}
        />
      )}
    </>
  );
}
