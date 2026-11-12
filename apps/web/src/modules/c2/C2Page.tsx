import { Fragment, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Phone, Search, Volume2, VolumeX } from 'lucide-react';
import {
  C2_CLIENTES_POR_HOJA,
  ESTADO_SITIO_C2_LABEL,
  type ClienteC2,
  type EstadoSitioC2,
  type GuardiaC2,
  type SitioC2,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, Card, EmptyState, Input, Pagination, Spinner, cn } from '../../components/ui';
import { formatHora } from '../asistencia/formato';
import { Avatar } from '../clientes/AsignarTurnoModal';
import { SosC2 } from './SosC2';
import { HistorialC2 } from './HistorialC2';
import { c2Service } from './c2.service';
import { useSonidoC2 } from './sonidoC2';

const REFRESCO_MS = 15_000;

/** Estilo de cada estado: color del punto, fondo de la fila y del texto. */
const ESTILO: Record<EstadoSitioC2, { punto: string; fila: string; texto: string }> = {
  sos: { punto: 'bg-red-600 animate-pulse', fila: 'bg-red-100', texto: 'text-red-700' },
  solo: { punto: 'bg-red-500', fila: 'bg-red-50', texto: 'text-red-700' },
  parcial: { punto: 'bg-amber-500', fila: 'bg-amber-50', texto: 'text-amber-800' },
  por_llegar: { punto: 'bg-sky-400', fila: '', texto: 'text-sky-700' },
  cubierto: { punto: 'bg-emerald-500', fila: '', texto: 'text-emerald-700' },
  sin_turno: { punto: 'bg-slate-300', fila: '', texto: 'text-slate-500' },
};

/** Los clientes con problema se abren solos; los demás, cerrados (la persona puede abrir o cerrar cualquiera). */
const seAbreSolo = (e: EstadoSitioC2) => e === 'sos' || e === 'solo' || e === 'parcial';

/** Cada cuánto se vuelve a calcular "hace…" aunque no haya datos nuevos. */
function useAhora(ms = 15_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return ahora;
}

function minutosHace(desde: string | null, ahora: number) {
  return desde ? Math.max(0, Math.floor((ahora - Date.parse(desde)) / 60_000)) : null;
}

const textoDuracion = (min: number) => (min < 60 ? `${min} m` : `${Math.floor(min / 60)} h ${min % 60} m`);

function EstadoPunto({ estado }: { estado: EstadoSitioC2 }) {
  const e = ESTILO[estado];
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-semibold', e.texto)}>
      <span className={cn('size-2.5 shrink-0 rounded-full', e.punto)} aria-hidden />
      {ESTADO_SITIO_C2_LABEL[estado]}
    </span>
  );
}

function Contador({ n, etiqueta, tono }: { n: number; etiqueta: string; tono: 'red' | 'amber' | 'dark' }) {
  const colores = {
    red: n > 0 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500',
    amber: n > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500',
    dark: 'bg-slate-100 text-slate-700',
  }[tono];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold', colores)}>
      <span className="text-base tabular-nums">{n}</span> {etiqueta}
    </span>
  );
}

function GuardiaInfo({ g }: { g: GuardiaC2 }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar foto={g.foto} nombre={g.nombre} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{g.nombre}</p>
        <p className="text-xs text-slate-500">
          {g.presente ? `Entró ${formatHora(g.entrada!)}` : 'No ha checado'}
          {g.horario && ` · ${formatHora(g.horario.entrada)}–${formatHora(g.horario.salida)}`}
        </p>
      </div>
    </div>
  );
}

function SupervisorLink({ s }: { s: SitioC2['supervisor'] }) {
  if (!s?.telefono) return null;
  return (
    <a
      href={`tel:${s.telefono}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
      aria-label={`Llamar a ${s.nombre}, supervisor`}
    >
      <Phone className="size-3" aria-hidden /> {s.nombre}
    </a>
  );
}

function Hace({ sitio, ahora }: { sitio: SitioC2; ahora: number }) {
  const desde = sitio.desde ?? (sitio.estado === 'por_llegar' ? (sitio.guardias[0]?.horario?.entrada ?? null) : null);
  const min = minutosHace(desde, ahora);
  if (min === null) return <span className="text-slate-300">—</span>;
  return <span className={cn('tabular-nums text-sm font-semibold', ESTILO[sitio.estado].texto)}>{textoDuracion(min)}</span>;
}

/** Filas de un sitio en la tabla de escritorio: una por guardia, con el sitio y su estado a lo largo de todas. */
function FilasSitio({ sitio, ahora }: { sitio: SitioC2; ahora: number }) {
  const guardias: (GuardiaC2 | null)[] = sitio.guardias.length ? sitio.guardias : [null];
  const estilo = ESTILO[sitio.estado];
  return (
    <>
      {guardias.map((g, i) => (
        <tr key={g?.id ?? 'sin'} className={cn(estilo.fila, i === 0 && 'border-t border-slate-100')}>
          {i === 0 && (
            <>
              <td rowSpan={guardias.length} className="py-2 pl-10 pr-3 align-top">
                <p className="text-sm font-medium text-slate-900">{sitio.nombre}</p>
                <SupervisorLink s={sitio.supervisor} />
              </td>
              <td rowSpan={guardias.length} className="px-3 py-2 align-top">
                <EstadoPunto estado={sitio.estado} />
              </td>
              <td rowSpan={guardias.length} className="px-3 py-2 align-top">
                <Hace sitio={sitio} ahora={ahora} />
              </td>
            </>
          )}
          <td className="px-3 py-2">{g ? <GuardiaInfo g={g} /> : <span className="text-sm text-slate-400">Nadie asignado a esta hora</span>}</td>
        </tr>
      ))}
    </>
  );
}

function TarjetaSitio({ sitio, ahora }: { sitio: SitioC2; ahora: number }) {
  const estilo = ESTILO[sitio.estado];
  return (
    <div className={cn('rounded-xl border border-slate-200 p-3', estilo.fila || 'bg-white')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{sitio.nombre}</p>
          <SupervisorLink s={sitio.supervisor} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <EstadoPunto estado={sitio.estado} />
          <Hace sitio={sitio} ahora={ahora} />
        </div>
      </div>
      {sitio.guardias.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2">
          {sitio.guardias.map((g) => (
            <GuardiaInfo key={g.id} g={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResumenCliente({ c }: { c: ClienteC2 }) {
  const detalle = [c.solos ? `${c.solos} solo${c.solos > 1 ? 's' : ''}` : null, c.parciales ? `${c.parciales} parcial${c.parciales > 1 ? 'es' : ''}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-sm font-bold uppercase tracking-wide text-slate-800">{c.nombre}</span>
      <span className="text-xs text-slate-500">
        {c.sitios.length} sitio{c.sitios.length > 1 ? 's' : ''}
      </span>
      {detalle ? <span className={cn('text-xs font-semibold', ESTILO[c.estado].texto)}>{detalle}</span> : <EstadoPunto estado={c.estado} />}
    </span>
  );
}

function EnVivo() {
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(C2_CLIENTES_POR_HOJA[0]);
  const [manual, setManual] = useState<Record<number, boolean>>({});
  const ahora = useAhora();

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(texto.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [texto]);

  const consulta = { q: q || undefined, page, limit };
  const tablero = useQuery({
    queryKey: c2Service.keys.tablero(consulta),
    queryFn: () => c2Service.tablero(consulta),
    refetchInterval: REFRESCO_MS,
    placeholderData: keepPreviousData,
  });
  const datos = tablero.data;

  // Qué está pendiente ahora: cada sitio solo y cada SOS. Sirve para el sonido (que no depende de la hoja que se vea).
  const alertas = useMemo(
    () => [
      ...(datos?.emergencias ?? []).map((e) => `sos:${e.id}`),
      ...(datos?.sitiosSolos ?? []).map((id) => `solo:${id}`),
    ],
    [datos],
  );
  const sonido = useSonidoC2(alertas);

  const abierto = (c: ClienteC2) => manual[c.id] ?? seAbreSolo(c.estado);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar cliente, sitio o guardia…"
            aria-label="Buscar cliente, sitio o guardia"
            className="pl-9"
          />
        </div>
        <Contador n={datos?.resumen.sos ?? 0} etiqueta="SOS" tono="red" />
        <Contador n={datos?.resumen.solos ?? 0} etiqueta="solos" tono="red" />
        <Contador n={datos?.resumen.parciales ?? 0} etiqueta="parciales" tono="amber" />
        <Contador n={datos?.resumen.sitios ?? 0} etiqueta="sitios" tono="dark" />
        <div className="ml-auto flex items-center gap-2">
          {sonido.activo && sonido.sonando && (
            <Button variant="danger" size="sm" onClick={sonido.silenciar}>
              <VolumeX className="size-4" aria-hidden /> Silenciar
            </Button>
          )}
          <Button variant={sonido.activo ? 'secondary' : 'primary'} size="sm" onClick={sonido.alternar} aria-pressed={sonido.activo}>
            {sonido.activo ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
            {sonido.activo ? 'Sonido activo' : 'Activar sonido'}
          </Button>
        </div>
      </div>
      {sonido.bloqueado && (
        <p role="alert" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          El navegador no deja sonar. Toca cualquier parte de la pantalla.
        </p>
      )}
      {!sonido.activo && alertas.length > 0 && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          Hay alertas sin atender y el sonido está apagado.
        </p>
      )}

      {datos && datos.emergencias.length > 0 && <SosC2 emergencias={datos.emergencias} ahora={ahora} />}

      <Card className="overflow-hidden">
        {tablero.isPending ? (
          <div className="flex justify-center py-12 text-brand-600">
            <Spinner className="size-6" />
          </div>
        ) : tablero.isError ? (
          <EmptyState title="No se pudo cargar" description="Se volverá a intentar solo en unos segundos." />
        ) : !datos || datos.clientes.length === 0 ? (
          <EmptyState title={q ? 'Sin resultados' : 'Todavía no hay sitios'} description={q ? 'Prueba con otro nombre.' : 'Cuando haya clientes y sitios activos aparecerán aquí.'} />
        ) : (
          <>
            {/* Escritorio: tabla */}
            <table className="hidden w-full text-left md:table">
              <thead className="bg-slate-900 text-xs font-semibold uppercase tracking-wide text-white">
                <tr>
                  <th className="py-3 pl-4 pr-3">Cliente / Sitio</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Hace</th>
                  <th className="px-3 py-3">Guardia</th>
                </tr>
              </thead>
              <tbody>
                {datos.clientes.map((c) => (
                  <Fragment key={c.id}>
                    <tr className={cn('cursor-pointer border-t border-slate-200 hover:bg-slate-50', ESTILO[c.estado].fila || 'bg-slate-50/60')}>
                      <td colSpan={4} className="p-0">
                        <button
                          type="button"
                          onClick={() => setManual((m) => ({ ...m, [c.id]: !abierto(c) }))}
                          aria-expanded={abierto(c)}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
                        >
                          {abierto(c) ? <ChevronDown className="size-4 shrink-0" aria-hidden /> : <ChevronRight className="size-4 shrink-0" aria-hidden />}
                          <ResumenCliente c={c} />
                        </button>
                      </td>
                    </tr>
                    {abierto(c) && c.sitios.map((s) => <FilasSitio key={s.id} sitio={s} ahora={ahora} />)}
                  </Fragment>
                ))}
              </tbody>
            </table>

            {/* Celular: tarjetas */}
            <div className="md:hidden">
              {datos.clientes.map((c) => (
                <div key={c.id} className="border-t border-slate-200 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setManual((m) => ({ ...m, [c.id]: !abierto(c) }))}
                    aria-expanded={abierto(c)}
                    className={cn('flex w-full items-center gap-2 px-3 py-3 text-left', ESTILO[c.estado].fila || 'bg-slate-50/60')}
                  >
                    {abierto(c) ? <ChevronDown className="size-4 shrink-0" aria-hidden /> : <ChevronRight className="size-4 shrink-0" aria-hidden />}
                    <ResumenCliente c={c} />
                  </button>
                  {abierto(c) && (
                    <div className="grid grid-cols-1 gap-2 p-3">
                      {c.sitios.map((s) => (
                        <TarjetaSitio key={s.id} sitio={s} ahora={ahora} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {datos && datos.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pr-4">
            <Pagination page={page} limit={limit} total={datos.total} onPageChange={setPage} />
            <div className="flex items-center gap-1 text-sm text-slate-500">
              Mostrar:
              {C2_CLIENTES_POR_HOJA.map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={n === limit ? 'primary' : 'ghost'}
                  onClick={() => {
                    setLimit(n);
                    setPage(1);
                  }}
                  aria-pressed={n === limit}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

/** Monitoreo del C2 (A-61): qué sitios tienen guardia ahora y el historial de los que se quedaron solos. */
export function C2Page() {
  const [vista, setVista] = useState<'vivo' | 'historial'>('vivo');
  return (
    <>
      <PageHeader
        title="C2 · Monitoreo de sitios"
        subtitle="Se actualiza solo cada 15 segundos"
        actions={
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Vista">
            {(
              [
                ['vivo', 'En vivo'],
                ['historial', 'Historial'],
              ] as const
            ).map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                role="tab"
                aria-selected={vista === clave}
                onClick={() => setVista(clave)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium',
                  vista === clave ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        }
      />
      {vista === 'vivo' ? <EnVivo /> : <HistorialC2 />}
    </>
  );
}
