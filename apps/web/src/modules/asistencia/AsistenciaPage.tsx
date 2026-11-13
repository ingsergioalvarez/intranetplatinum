import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, LogOut, Search, Shuffle } from 'lucide-react';
import { PERMISOS, ROLES, type FilaAsistencia, type NotaSitioC2 } from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  type Column,
} from '../../components/ui';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { hoyLocal } from '../../core/format/fechas';
import { useDebounced } from '../../core/hooks/useDebounced';
import { useNotasC2 } from '../c2/notasC2';
import { asistenciaService } from './asistencia.service';
import { formatDuracion, formatHora, horasEsperadas } from './formato';
import { DescargarHorarioModal } from '../horarios/DescargarHorarioModal';
import { AccesosAsistencia } from './AccesosAsistencia';
import { CerrarJornadaModal } from './CerrarJornadaModal';
import { EstadoJornada } from './EstadoJornada';
import { FotoChecada } from './FotoChecada';
import { HoraMarca } from './HoraMarca';
import { EnviarCubrirModal } from '../clientes/EnviarCubrirModal';

/** `08:00` local de un instante ISO (para precargar la hora del turno). */
const horaLocal = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  );

const LIMIT = 25;

/** Día `AAAA-MM-DD` desplazado `delta` días. */
function moverDia(fecha: string, delta: number) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return new Intl.DateTimeFormat('en-CA').format(d);
}

const hora = (iso: string | undefined) => (iso ? formatHora(iso) : '—');

/** La última nota que el C2 dejó hoy sobre el sitio (A-82): el supervisor ve qué ya se hizo sin entrar a la pantalla del C2. */
function NotaDelC2({ nota }: { nota: NotaSitioC2 }) {
  return (
    <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-xs font-normal text-amber-900 ring-1 ring-amber-200 ring-inset">
      <strong>Nota del C2</strong> · {nota.autor} {hora(nota.en)}: {nota.texto}
    </span>
  );
}

const columns: Column<FilaAsistencia>[] = [
  {
    key: 'guardia',
    header: 'Guardia',
    mobile: 'title',
    render: (f) => {
      const foto = f.guardia.foto || f.jornada?.entrada?.foto;
      return (
        <div className="flex items-center gap-2.5">
          {foto ? (
            <img
              src={foto}
              alt={f.guardia.nombre}
              className="size-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-xs text-brand-800">
              {f.guardia.nombre.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <span className="font-medium text-slate-900 block truncate">{f.guardia.nombre}</span>
            <span className="text-xs text-slate-500 block truncate">{f.guardia.email}</span>
          </div>
        </div>
      );
    },
  },
  {
    key: 'sitio',
    header: 'Sitio',
    mobile: 'subtitle',
    render: (f) => (
      <>
        {f.sitio?.nombre ?? '—'}
        {f.cobertura && (
          <Badge tone="brand" className="ml-1.5 align-middle">
            Cobertura
          </Badge>
        )}
      </>
    ),
  },
  {
    key: 'entrada',
    header: 'Entrada',
    className: 'tabular-nums',
    render: ({ jornada: j, guardia }) =>
      j ? (
        <span className="flex items-start gap-2">
          <FotoChecada url={j.entrada.foto} nombre={guardia.nombre} />
          <HoraMarca jornada={j} tipo="entrada" />
        </span>
      ) : (
        '—'
      ),
  },
  {
    key: 'comidas',
    header: 'Comidas',
    className: 'tabular-nums',
    render: ({ jornada: j }) =>
      j?.comidas.length ? (
        <span className="block space-y-1">
          {j.comidas.map((c, i) => (
            <span
              key={c.inicio.id}
              className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-700"
            >
              <span className="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-semibold text-slate-600">
                {i + 1}ª
              </span>
              <span>
                {hora(c.inicio.registradaEn)} –{' '}
                {c.fin ? (
                  hora(c.fin.registradaEn)
                ) : !j.salida ? (
                  <span className="font-medium text-amber-700">en curso</span>
                ) : (
                  '—'
                )}
              </span>
            </span>
          ))}
        </span>
      ) : (
        '—'
      ),
  },
  {
    key: 'salida',
    header: 'Salida',
    className: 'tabular-nums',
    render: ({ jornada: j }) => (j ? <HoraMarca jornada={j} tipo="salida" /> : '—'),
  },
  {
    key: 'horas',
    header: 'Horas',
    mobile: 'hidden',
    className: 'tabular-nums',
    render: ({ jornada: j }) =>
      j?.salida ? (
        <>
          {formatDuracion(j.entrada.registradaEn, j.salida.registradaEn)}
          {horasEsperadas(j) && <span className="block text-xs text-slate-500">de {horasEsperadas(j)}</span>}
        </>
      ) : (
        '—'
      ),
  },
  { key: 'estado', header: 'Estado', render: (f) => <EstadoJornada jornada={f.jornada} turno={f.turno} /> },
];

/** Asistencia del día: una fila por guardia (con jornada o asignado sin marcas). Solo lectura (AS1-07). */
export function AsistenciaPage() {
  const navigate = useNavigate();
  const puedeRevisar = hasPermission(
    useAuthStore((s) => s.user),
    PERMISOS.ASISTENCIA_ROSTROS,
  );
  const hoy = hoyLocal();
  // Falta o no se presentó: el supervisor o el admin pueden enviar a alguien a cubrir (DA-39).
  const puedeCubrir = useAuthStore((s) => s.user?.rol === ROLES.ADMIN || s.user?.rol === ROLES.SUPERVISOR);
  // La columna "Sitio" suma la última nota del C2 de hoy sobre ese sitio (A-82).
  const notasC2 = useNotasC2();
  const columnas = useMemo(
    () =>
      columns.map((c) =>
        c.key !== 'sitio'
          ? c
          : {
              ...c,
              render: (f: FilaAsistencia) => (
                <>
                  {c.render(f)}
                  {f.sitio && notasC2.has(f.sitio.id) && <NotaDelC2 nota={notasC2.get(f.sitio.id)!} />}
                </>
              ),
            },
      ),
    [notasC2],
  );
  const [horarioAbierto, setHorarioAbierto] = useState(false);
  const [cubrir, setCubrir] = useState<FilaAsistencia | null>(null);
  const [cerrando, setCerrando] = useState<FilaAsistencia | null>(null);
  const [fecha, setFecha] = useState(hoy);
  const [busqueda, setBusqueda] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [page, setPage] = useState(1);
  const q = useDebounced(busqueda.trim());

  const params = { fecha, q, soloAlertas: soloAlertas || undefined, page, limit: LIMIT };
  const lista = useQuery({
    queryKey: asistenciaService.keys.dia(params),
    queryFn: () => asistenciaService.dia(params),
    placeholderData: keepPreviousData,
  });

  // Cualquier cambio de filtro vuelve a la primera página.
  const filtrar =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const cambiarFecha = filtrar(setFecha);

  return (
    <>
      <PageHeader title="Asistencia" subtitle="Una fila por guardia · toca para ver su detalle" />
      {puedeRevisar && <AccesosAsistencia alAbrirHorario={() => setHorarioAbierto(true)} />}

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Día anterior"
              onClick={() => cambiarFecha(moverDia(fecha, -1))}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Input
              type="date"
              aria-label="Día"
              value={fecha}
              max={hoy}
              onChange={(e) => e.target.value && cambiarFecha(e.target.value)}
              className="w-auto"
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Día siguiente"
              disabled={fecha >= hoy}
              onClick={() => cambiarFecha(moverDia(fecha, 1))}
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Guardia o sitio"
              aria-label="Buscar por guardia o sitio"
              value={busqueda}
              onChange={(e) => filtrar(setBusqueda)(e.target.value)}
              className="pl-9"
            />
          </div>
          <Checkbox
            label="Solo con alerta"
            checked={soloAlertas}
            onChange={(e) => filtrar(setSoloAlertas)(e.target.checked)}
          />
        </div>

        {lista.isError ? (
          <EmptyState
            title="No se pudo cargar la asistencia"
            description="Revisa tu conexión e intenta de nuevo."
            action={
              <Button variant="secondary" onClick={() => void lista.refetch()}>
                Reintentar
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columnas}
            rows={lista.data?.items ?? []}
            rowKey={(f) => `${f.guardia.id}-${f.jornada?.entrada.id ?? 'sin'}`}
            loading={lista.isPending}
            onRowClick={(f) => navigate(`/asistencia/guardias/${f.guardia.id}?mes=${fecha.slice(0, 7)}`)}
            actions={
              puedeCubrir
                ? (f) => (
                    <>
                      {f.sitio && (f.turno?.estado === 'falta' || f.turno?.estado === 'no_se_presento') && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Shuffle className="size-4" />}
                          onClick={() => setCubrir(f)}
                        >
                          <span className="hidden sm:inline">Enviar a cubrir</span>
                          <span className="sm:hidden">Cubrir</span>
                        </Button>
                      )}
                      {f.jornada && !f.jornada.salida && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<LogOut className="size-4" />}
                          onClick={() => setCerrando(f)}
                        >
                          <span className="hidden sm:inline">Cerrar jornada</span>
                          <span className="sm:hidden">Cerrar</span>
                        </Button>
                      )}
                    </>
                  )
                : undefined
            }
            emptyTitle="Sin guardias"
            emptyDescription={
              q || soloAlertas ? 'Prueba con otros filtros.' : 'Nadie marcó ni tenía asignación este día.'
            }
          />
        )}

        {lista.data && (
          <Pagination page={page} limit={LIMIT} total={lista.data.total} onPageChange={setPage} />
        )}
      </Card>
      {horarioAbierto && <DescargarHorarioModal onClose={() => setHorarioAbierto(false)} />}
      {cerrando?.jornada && (
        <CerrarJornadaModal
          jornada={cerrando.jornada}
          guardia={cerrando.guardia.nombre}
          onClose={() => setCerrando(null)}
        />
      )}
      {cubrir?.sitio && (
        <EnviarCubrirModal
          sitio={cubrir.sitio}
          fecha={fecha}
          horaInicio={cubrir.turno ? horaLocal(cubrir.turno.entrada) : ''}
          horas={cubrir.turno?.horas}
          cubreA={{ id: cubrir.guardia.id, nombre: cubrir.guardia.nombre }}
          onClose={() => setCubrir(null)}
        />
      )}
    </>
  );
}
