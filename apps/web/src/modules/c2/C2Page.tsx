import { Fragment, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, CircleHelp, Search, Volume2, VolumeX } from 'lucide-react';
import {
  C2_CLIENTES_POR_HOJA,
  ESTADO_SITIO_C2_LABEL,
  type ClienteC2,
  type EstadoSitioC2,
  type FilaSitioC2,
  type SitioC2,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, Card, EmptyState, Input, Pagination, Spinner, cn } from '../../components/ui';
import { formatHora } from '../asistencia/formato';
import { AyudaC2 } from './AyudaC2';
import { AccionesSitio, type AccionC2 } from './AccionesSitio';
import { BitacoraC2 } from './BitacoraC2';
import { AvisarModal, NotaModal } from './ModalesC2';
import { QuePasa } from './QuePasa';
import { ReporteC2Modal } from './ReporteC2Modal';
import { SosC2 } from './SosC2';
import { c2Service } from './c2.service';
import { ESTILO, LEYENDA, ayudaYaVista, marcarAyudaVista, minutosHace, textoDuracion, useAhora } from './c2.estilos';
import { useSonidoC2 } from './sonidoC2';

const REFRESCO_MS = 15_000;
/** Cubiertos y sin turno de un cliente: si son más de estos, se esconden tras "Ver los N". */
const CUBIERTOS_VISIBLES = 3;

const esProblema = (e: EstadoSitioC2) => e === 'sos' || e === 'solo' || e === 'parcial' || e === 'por_llegar';

function EstadoPunto({ estado }: { estado: EstadoSitioC2 }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-bold uppercase', ESTILO[estado].texto)}>
      <span className={cn('size-2.5 shrink-0 rounded-full', ESTILO[estado].punto)} aria-hidden />
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

function Hace({ sitio, ahora }: { sitio: SitioC2; ahora: number }) {
  const desde = sitio.desde ?? (sitio.estado === 'por_llegar' ? (sitio.guardias[0]?.horario?.entrada ?? null) : null);
  const min = minutosHace(desde, ahora);
  if (min === null) return <span className="text-slate-300">—</span>;
  return <span className={cn('text-sm font-bold tabular-nums', ESTILO[sitio.estado].texto)}>{textoDuracion(min)}</span>;
}

/** Por qué un sitio está mal, en una frase (para el resumen del cliente cerrado). */
function razon(s: SitioC2, ahora: number) {
  const min = minutosHace(s.desde, ahora);
  const tiempo = min === null ? '' : ` (${textoDuracion(min)})`;
  const faltan = s.guardias.filter((g) => !g.presente).map((g) => g.nombre);
  switch (s.estado) {
    case 'solo':
      return `sin guardia${tiempo}`;
    case 'parcial':
      return `falta ${faltan.join(', ')}${tiempo}`;
    case 'por_llegar':
      return `debe entrar ${faltan.join(', ')}`;
    case 'sos':
      return 'SOS';
    default:
      return '';
  }
}

type AlAccionar = (accion: AccionC2, sitio: SitioC2, cliente: string) => void;

/** Una fila de la tabla de escritorio. El nombre del cliente se oculta en la vista agrupada (ya sale arriba). */
function FilaSitio({ cliente, mostrarCliente = true, sitio, ahora, onAccion }: { cliente: string; mostrarCliente?: boolean; sitio: SitioC2; ahora: number; onAccion: AlAccionar }) {
  const e = ESTILO[sitio.estado];
  return (
    <tr className={cn('border-t border-slate-100 align-top', e.fila)}>
      <td className={cn('border-l-4 py-3 pl-3 pr-2 text-sm font-bold uppercase tracking-wide text-slate-700', e.barra)}>{mostrarCliente ? cliente : ''}</td>
      <td className="px-2 py-3">
        <p className="text-sm font-semibold text-slate-900">{sitio.nombre}</p>
      </td>
      <td className="px-2 py-3">
        <EstadoPunto estado={sitio.estado} />
      </td>
      <td className="px-2 py-3">
        <Hace sitio={sitio} ahora={ahora} />
      </td>
      <td className="px-2 py-3">
        <QuePasa sitio={sitio} />
      </td>
      <td className="py-3 pr-3 pl-2">
        <AccionesSitio sitio={sitio} onAccion={(a) => onAccion(a, sitio, cliente)} />
      </td>
    </tr>
  );
}

function TarjetaSitio({ cliente, mostrarCliente = true, sitio, ahora, onAccion }: { cliente: string; mostrarCliente?: boolean; sitio: SitioC2; ahora: number; onAccion: AlAccionar }) {
  const e = ESTILO[sitio.estado];
  return (
    <div className={cn('rounded-xl border border-slate-200 border-l-4 p-3', e.barra, e.fila || 'bg-white')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {mostrarCliente && <p className="truncate text-xs font-bold uppercase tracking-wide text-slate-500">{cliente}</p>}
          <p className="truncate text-sm font-semibold text-slate-900">{sitio.nombre}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <EstadoPunto estado={sitio.estado} />
          <Hace sitio={sitio} ahora={ahora} />
        </div>
      </div>
      <div className="mt-3">
        <QuePasa sitio={sitio} />
      </div>
      <div className="mt-3 border-t border-slate-200/70 pt-2">
        <AccionesSitio sitio={sitio} onAccion={(a) => onAccion(a, sitio, cliente)} />
      </div>
    </div>
  );
}

/** Encabezado del cliente en la vista agrupada: nunca vacío, resume lo que pasa dentro. */
function ResumenCliente({ c, ahora }: { c: ClienteC2; ahora: number }) {
  const solos = c.sitios.filter((s) => s.estado === 'solo').length;
  const parciales = c.sitios.filter((s) => s.estado === 'parcial').length;
  const sos = c.sitios.filter((s) => s.estado === 'sos').length;
  const problemas = c.sitios.filter((s) => esProblema(s.estado));
  const conteo = [sos ? `${sos} SOS` : null, solos ? `${solos} solo${solos > 1 ? 's' : ''}` : null, parciales ? `${parciales} parcial${parciales > 1 ? 'es' : ''}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className="grid min-w-0 grid-cols-1 gap-0.5">
      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="text-sm font-bold uppercase tracking-wide text-slate-800">{c.nombre}</span>
        <span className="text-xs text-slate-500">
          {c.sitios.length} sitio{c.sitios.length > 1 ? 's' : ''}
        </span>
        {conteo ? <span className={cn('text-xs font-bold', ESTILO[c.estado].texto)}>{conteo}</span> : <EstadoPunto estado={c.estado} />}
      </span>
      {problemas.length > 0 && (
        <span className={cn('truncate text-xs', ESTILO[c.estado].texto)}>
          {problemas
            .slice(0, 2)
            .map((s) => `${s.nombre} · ${razon(s, ahora)}`)
            .join('   |   ')}
          {problemas.length > 2 && `   |   +${problemas.length - 2} más`}
        </span>
      )}
    </span>
  );
}

const ENCABEZADOS = ['Cliente', 'Sitio', 'Estado', 'Hace', 'Qué pasa', 'Acciones'];

function EnVivo({ onAyuda }: { onAyuda: () => void }) {
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(C2_CLIENTES_POR_HOJA[0]);
  const [problema, setProblema] = useState(false);
  const [agrupar, setAgrupar] = useState(false);
  const [estado, setEstado] = useState<EstadoSitioC2 | undefined>();
  const [manual, setManual] = useState<Record<number, boolean>>({});
  const [verCubiertos, setVerCubiertos] = useState<Record<number, boolean>>({});
  const ahora = useAhora();
  // Acción del C2 en curso (nota, aviso o reporte) sobre un sitio.
  const [accion, setAccion] = useState<{ tipo: AccionC2; sitio: SitioC2; cliente: string } | null>(null);
  const alAccionar: AlAccionar = (tipo, sitio, cliente) => setAccion({ tipo, sitio, cliente });

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(texto.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [texto]);

  const consulta = { q: q || undefined, page, limit, problema, agrupar, estado };
  const tablero = useQuery({
    queryKey: c2Service.keys.tablero(consulta),
    queryFn: () => c2Service.tablero(consulta),
    refetchInterval: REFRESCO_MS,
    placeholderData: keepPreviousData,
  });
  const datos = tablero.data;

  // Qué está pendiente ahora: cada sitio solo y cada SOS. Sirve para el sonido (no depende de la hoja ni del filtro).
  const alertas = useMemo(
    () => [...(datos?.emergencias ?? []).map((e) => `sos:${e.id}`), ...(datos?.sitiosSolos ?? []).map((id) => `solo:${id}`)],
    [datos],
  );
  const sonido = useSonidoC2(alertas);

  const cambiar = <T,>(poner: (v: T) => void) => (v: T) => {
    poner(v);
    setPage(1);
  };
  const abierto = (c: ClienteC2) => manual[c.id] ?? c.sitios.some((s) => esProblema(s.estado));
  const total = datos?.total ?? 0;
  const vacio = !datos || total === 0;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
          <Button variant="ghost" size="sm" onClick={onAyuda} aria-label="Ayuda: cómo leer esta pantalla">
            <CircleHelp className="size-4" aria-hidden /> <span className="hidden sm:inline">Ayuda</span>
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="inline-flex items-center gap-2 text-sm text-slate-600">
          Ver:
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Qué sitios ver">
            {(
              [
                [false, 'Todos'],
                [true, 'Con problema'],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={etiqueta}
                type="button"
                aria-pressed={problema === valor}
                onClick={() => cambiar(setProblema)(valor)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium',
                  problema === valor ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={agrupar}
            onChange={(e) => cambiar(setAgrupar)(e.target.checked)}
            className="size-4 rounded border-slate-300 accent-brand-700"
          />
          Agrupar por cliente
        </label>
      </div>

      {/* Leyenda: cada color se puede tocar para ver solo esos sitios. */}
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Colores: toca uno para ver solo esos sitios">
        {LEYENDA.map((l) => (
          <button
            key={l.estado}
            type="button"
            title={l.explicacion}
            aria-pressed={estado === l.estado}
            onClick={() => cambiar(setEstado)(estado === l.estado ? undefined : l.estado)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset',
              estado === l.estado ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
            )}
          >
            <span className={cn('size-2.5 rounded-full', ESTILO[l.estado].punto)} aria-hidden />
            <strong>{l.nombre}</strong>
            <span className="hidden md:inline">: {l.corta}</span>
          </button>
        ))}
        {estado && (
          <button type="button" onClick={() => cambiar(setEstado)(undefined)} className="px-2 text-xs font-medium text-brand-700 hover:underline">
            Quitar filtro
          </button>
        )}
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
        ) : vacio ? (
          <EmptyState
            title={q || problema || estado ? 'Sin resultados' : 'Todavía no hay sitios'}
            description={
              q || estado
                ? 'Prueba con otro nombre o quita el filtro.'
                : problema
                  ? 'Ningún sitio necesita atención ahora.'
                  : 'Cuando haya clientes y sitios activos aparecerán aquí.'
            }
          />
        ) : (
          <>
            {/* Escritorio: tabla con anchos fijos para que encabezado y filas coincidan */}
            <table className="hidden w-full table-fixed text-left md:table">
              <colgroup>
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
                <col />
                <col className="w-[10.5rem]" />
              </colgroup>
              <thead className="bg-slate-900 text-xs font-semibold uppercase tracking-wide text-white">
                <tr>
                  {ENCABEZADOS.map((h, i) => (
                    <th key={h} className={cn('py-3', i === 0 ? 'pl-4 pr-2' : 'px-2', i === ENCABEZADOS.length - 1 && 'pr-4 text-right')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!agrupar &&
                  datos.sitios.map((f: FilaSitioC2) => <FilaSitio key={f.sitio.id} cliente={f.cliente.nombre} sitio={f.sitio} ahora={ahora} onAccion={alAccionar} />)}
                {agrupar &&
                  datos.clientes.map((c) => {
                    const mal = c.sitios.filter((s) => esProblema(s.estado));
                    const bien = c.sitios.filter((s) => !esProblema(s.estado));
                    const colapsar = bien.length > CUBIERTOS_VISIBLES && !verCubiertos[c.id];
                    return (
                      <Fragment key={c.id}>
                        <tr className={cn('border-t border-slate-200', ESTILO[c.estado].fila || 'bg-slate-50')}>
                          <td colSpan={6} className="p-0">
                            <button
                              type="button"
                              onClick={() => setManual((m) => ({ ...m, [c.id]: !abierto(c) }))}
                              aria-expanded={abierto(c)}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
                            >
                              {abierto(c) ? <ChevronDown className="size-4 shrink-0" aria-hidden /> : <ChevronRight className="size-4 shrink-0" aria-hidden />}
                              <ResumenCliente c={c} ahora={ahora} />
                            </button>
                          </td>
                        </tr>
                        {abierto(c) && (
                          <>
                            {mal.map((s) => (
                              <FilaSitio key={s.id} cliente={c.nombre} mostrarCliente={false} sitio={s} ahora={ahora} onAccion={alAccionar} />
                            ))}
                            {(colapsar ? [] : bien).map((s) => (
                              <FilaSitio key={s.id} cliente={c.nombre} mostrarCliente={false} sitio={s} ahora={ahora} onAccion={alAccionar} />
                            ))}
                            {colapsar && (
                              <tr className="border-t border-slate-100">
                                <td colSpan={6} className="px-4 py-2">
                                  <button type="button" onClick={() => setVerCubiertos((v) => ({ ...v, [c.id]: true }))} className="text-sm font-medium text-brand-700 hover:underline">
                                    Ver los {bien.length} sitios cubiertos o sin turno
                                  </button>
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>

            {/* Celular: tarjetas */}
            <div className="md:hidden">
              {!agrupar && (
                <div className="grid grid-cols-1 gap-2 p-3">
                  {datos.sitios.map((f) => (
                    <TarjetaSitio key={f.sitio.id} cliente={f.cliente.nombre} sitio={f.sitio} ahora={ahora} onAccion={alAccionar} />
                  ))}
                </div>
              )}
              {agrupar &&
                datos.clientes.map((c) => {
                  const mal = c.sitios.filter((s) => esProblema(s.estado));
                  const bien = c.sitios.filter((s) => !esProblema(s.estado));
                  const colapsar = bien.length > CUBIERTOS_VISIBLES && !verCubiertos[c.id];
                  return (
                    <div key={c.id} className="border-t border-slate-200 first:border-t-0">
                      <button
                        type="button"
                        onClick={() => setManual((m) => ({ ...m, [c.id]: !abierto(c) }))}
                        aria-expanded={abierto(c)}
                        className={cn('flex w-full items-start gap-2 px-3 py-3 text-left', ESTILO[c.estado].fila || 'bg-slate-50')}
                      >
                        {abierto(c) ? <ChevronDown className="mt-0.5 size-4 shrink-0" aria-hidden /> : <ChevronRight className="mt-0.5 size-4 shrink-0" aria-hidden />}
                        <ResumenCliente c={c} ahora={ahora} />
                      </button>
                      {abierto(c) && (
                        <div className="grid grid-cols-1 gap-2 p-3">
                          {[...mal, ...(colapsar ? [] : bien)].map((s) => (
                            <TarjetaSitio key={s.id} cliente={c.nombre} mostrarCliente={false} sitio={s} ahora={ahora} onAccion={alAccionar} />
                          ))}
                          {colapsar && (
                            <button type="button" onClick={() => setVerCubiertos((v) => ({ ...v, [c.id]: true }))} className="text-left text-sm font-medium text-brand-700">
                              Ver los {bien.length} sitios cubiertos o sin turno
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </>
        )}
        {datos && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pr-4">
            <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <span className="hidden sm:inline">{agrupar ? 'Clientes' : 'Sitios'} por hoja:</span>
              <span className="sm:hidden">Mostrar:</span>
              {C2_CLIENTES_POR_HOJA.map((n) => (
                <Button key={n} size="sm" variant={n === limit ? 'primary' : 'ghost'} onClick={() => cambiar(setLimit)(n)} aria-pressed={n === limit}>
                  {n}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>
      {datos && (
        <p className="mt-2 text-xs text-slate-400">
          Actualizado {formatHora(datos.generadoEn)} · se actualiza solo cada 15 segundos
        </p>
      )}
      {accion?.tipo === 'nota' && <NotaModal sitio={{ id: accion.sitio.id, nombre: accion.sitio.nombre, cliente: accion.cliente }} onClose={() => setAccion(null)} />}
      {accion?.tipo === 'avisar' && (
        <AvisarModal
          sitio={{ id: accion.sitio.id, nombre: accion.sitio.nombre, cliente: accion.cliente }}
          estado={accion.sitio.estado}
          supervisor={accion.sitio.supervisor?.nombre ?? null}
          onClose={() => setAccion(null)}
        />
      )}
      {accion?.tipo === 'reporte' && <ReporteC2Modal sitio={{ id: accion.sitio.id, nombre: accion.sitio.nombre, cliente: accion.cliente }} onClose={() => setAccion(null)} />}
    </>
  );
}

/** Monitoreo del C2 (A-61): qué sitios tienen guardia ahora y el historial de los que se quedaron solos. */
export function C2Page() {
  const [vista, setVista] = useState<'vivo' | 'bitacora'>('vivo');
  // La ayuda se abre sola la primera vez que se entra.
  const [ayuda, setAyuda] = useState(() => !ayudaYaVista());
  const cerrarAyuda = () => {
    marcarAyudaVista();
    setAyuda(false);
  };
  return (
    <>
      <PageHeader
        title="C2 · Monitoreo de sitios"
        subtitle="Lo peor aparece arriba"
        actions={
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Vista">
            {(
              [
                ['vivo', 'En vivo'],
                ['bitacora', 'Bitácora'],
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
      {vista === 'vivo' ? <EnVivo onAyuda={() => setAyuda(true)} /> : <BitacoraC2 />}
      <AyudaC2 open={ayuda} onClose={cerrarAyuda} />
    </>
  );
}
