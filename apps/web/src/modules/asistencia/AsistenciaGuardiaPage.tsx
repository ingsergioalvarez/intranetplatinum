import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  FileText,
  ChevronRight,
  Lock,
  MapPin,
  ShieldAlert,
  UserRound,
  LogOut,
} from 'lucide-react';
import {
  CATEGORIAS_BITACORA,
  CLASES_INCIDENCIA,
  ESTADOS_INCIDENCIA,
  claseIncidencia,
  incidenciaCuenta,
  incidenciaPendiente,
  PERMISOS,
  ROLES,
  TIPOS_EVENTO_BITACORA,
  type EventoBitacora,
  type GuardiaResumen,
  type Jornada,
  type MiSitio,
  type RostroRegistro,
  TIPO_EVENTO_BITACORA_LABEL,
  type TipoEventoBitacora,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Modal,
  Spinner,
  cn,
  type Column,
} from '../../components/ui';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { formatFecha, hoyLocal } from '../../core/format/fechas';
import { describirAsignacion } from '../clientes/asignaciones';
import { asistenciaService } from './asistencia.service';
import { CerrarJornadaModal } from './CerrarJornadaModal';
import { BitacoraGuardia, ListaEventos, type FiltroBitacora } from './BitacoraGuardia';
import { NuevoInformeModal } from '../informes/NuevoInformeModal';
import { TablaInformes } from '../informes/TablaInformes';
import { EstadoJornada } from './EstadoJornada';
import { formatDia, formatDuracion, formatHora, formatMes, horasEsperadas, moverMes } from './formato';
import { HoraMarca } from './HoraMarca';
import { JornadaCard } from './JornadaCard';
import { EstadoRostroBadge, RevisionRostro } from './RevisionRostro';

type Vista = 'asistencia' | 'bitacora';

const hora = (iso: string | undefined) => (iso ? formatHora(iso) : '—');

/** Margen para ligar un intento de rostro a la jornada (suelen ser justo antes de marcar). */
const MARGEN_ROSTRO_MS = 2 * 3_600_000;

/**
 * Incidencias de una jornada (DA-42): las de sus marcas (retardo, salida antes, comida fuera,
 * patrón) y los intentos de rostro entre 2 h antes de la entrada y 2 h después de la salida.
 */
function incidenciasDeJornada(j: Jornada, eventos: EventoBitacora[] | undefined) {
  const marcas = new Set(
    [j.entrada, ...j.comidas.flatMap((c) => [c.inicio, c.fin]), j.salida].flatMap((m) => (m ? [m.id] : [])),
  );
  const desde = Date.parse(j.entrada.registradaEn) - MARGEN_ROSTRO_MS;
  const ultima = j.comidas.at(-1);
  const fin = j.salida ?? ultima?.fin ?? ultima?.inicio ?? j.entrada;
  const hasta = Date.parse(fin.registradaEn) + MARGEN_ROSTRO_MS;
  return (eventos ?? []).filter((e) => {
    const clase = claseIncidencia(e.tipo);
    if (clase === 'asistencia') return e.marcacionId !== null && marcas.has(e.marcacionId);
    const t = Date.parse(e.ocurrioEn);
    return clase === 'rostro' && t >= desde && t <= hasta;
  });
}

/** Estado de la jornada; si tiene incidencias, abre la lista (y dice cuántas faltan por atender). */
function EstadoConIncidencias({
  jornada,
  incidencias,
  onAbrir,
}: {
  jornada: Jornada;
  incidencias: EventoBitacora[];
  onAbrir: () => void;
}) {
  if (incidencias.length === 0) return <EstadoJornada jornada={jornada} />;
  const sinAtender = incidencias.filter(incidenciaPendiente).length;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAbrir();
      }}
      className="group inline-flex flex-col items-start gap-1 rounded-lg text-left"
      aria-label={`Ver ${incidencias.length === 1 ? 'la incidencia' : `las ${incidencias.length} incidencias`} de esta jornada`}
    >
      {sinAtender > 0 ? (
        // Las alertas ya se ven en la entrada/salida y en la lista: aquí lo urgente.
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-red-700 ring-1 ring-red-200 ring-inset group-hover:bg-red-100">
          <ShieldAlert className="size-3.5" />
          {sinAtender} sin atender
        </span>
      ) : (
        <>
          <EstadoJornada jornada={jornada} />
          <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-brand-700 group-hover:underline">
            <ShieldAlert className="size-3.5" />
            {incidencias.length === 1 ? 'Ver incidencia' : `Ver ${incidencias.length}`}
          </span>
        </>
      )}
    </button>
  );
}

const columnasAsistencia = (
  eventos: EventoBitacora[] | undefined,
  onIncidencias: (j: Jornada) => void,
  esCliente = false,
): Column<Jornada>[] => [
  {
    key: 'dia',
    header: 'Día',
    render: (j) => (
      <span className="whitespace-nowrap">
        {formatDia(j.entrada.registradaEn)}
        <span className="block text-xs text-slate-500">{j.sitio?.nombre ?? '—'}</span>
      </span>
    ),
  },
  {
    key: 'entrada',
    header: 'Entrada',
    className: 'tabular-nums',
    render: (j) => <HoraMarca jornada={j} tipo="entrada" />,
  },
  {
    key: 'comida',
    header: 'Comidas',
    className: 'tabular-nums',
    render: (j) =>
      j.comidas.length ? (
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
    render: (j) => <HoraMarca jornada={j} tipo="salida" />,
  },
  {
    key: 'horas',
    header: 'Horas',
    className: 'tabular-nums',
    render: (j) =>
      j.salida ? (
        <>
          <span className="whitespace-nowrap">
            {formatDuracion(j.entrada.registradaEn, j.salida.registradaEn)}
          </span>
          {horasEsperadas(j) && <span className="block text-xs text-slate-500">de {horasEsperadas(j)}</span>}
        </>
      ) : (
        '—'
      ),
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (j) =>
      esCliente ? (
        <EstadoJornada jornada={j} />
      ) : (
        <EstadoConIncidencias
          jornada={j}
          incidencias={incidenciasDeJornada(j, eventos)}
          onAbrir={() => onIncidencias(j)}
        />
      ),
  },
];

/**
 * Ficha de un guardia (AS1-07, DA-41). En escritorio, a la izquierda su rostro de referencia, su
 * turno actual y el resumen del mes; a la derecha, pestañas Asistencia (jornadas, solo lectura) y
 * Bitácora (todo lo que le pasó, con notas y justificaciones). En celular, todo en columna.
 */
export function AsistenciaGuardiaPage() {
  const user = useAuthStore((s) => s.user);
  const esCliente = user?.rol === ROLES.CLIENTE;
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const mesActual = hoyLocal().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesActual;
  const vista: Vista = esCliente
    ? 'asistencia'
    : params.get('vista') === 'bitacora'
      ? 'bitacora'
      : 'asistencia';
  const filtro: FiltroBitacora = {
    categoria: CATEGORIAS_BITACORA.find((c) => c === params.get('cat')) ?? null,
    clase: CLASES_INCIDENCIA.find((c) => c === params.get('clase')) ?? null,
    estado: ESTADOS_INCIDENCIA.find((e) => e === params.get('estado')) ?? null,
    tipo: TIPOS_EVENTO_BITACORA.find((t) => t === params.get('tipo')) ?? null,
  };
  const [abierta, setAbierta] = useState<Jornada | null>(null);
  // Admin y supervisor pueden cerrar una jornada sin salida (DA-49).
  const puedeCerrar = user?.rol === ROLES.ADMIN || user?.rol === ROLES.SUPERVISOR;
  const [cerrando, setCerrando] = useState<Jornada | null>(null);
  // Reporte oficial de asistencia de este guardia (DA-52).
  const [reportando, setReportando] = useState(false);
  // Jornada de la que se ven sus incidencias (se recalculan de la bitácora al agregar una nota o justificar).
  const [conIncidencias, setConIncidencias] = useState<Jornada | null>(null);

  const ficha = useQuery({
    queryKey: asistenciaService.keys.guardia(id, mes),
    queryFn: () => asistenciaService.guardia(id, mes),
    placeholderData: keepPreviousData,
  });
  const bitacora = useQuery({
    queryKey: asistenciaService.keys.bitacora(id, mes),
    queryFn: () => asistenciaService.bitacora(id, mes),
    placeholderData: keepPreviousData,
    enabled: !esCliente,
  });

  /** Cambia parámetros de la URL conservando los demás (null los quita). */
  const cambiar = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };
  const verVista = (v: Vista) => cambiar({ vista: v === 'asistencia' ? null : v });
  const verBitacora = (f: Partial<FiltroBitacora>) =>
    cambiar({
      vista: 'bitacora',
      cat: f.categoria ?? null,
      clase: f.clase ?? null,
      estado: f.estado ?? null,
      tipo: f.tipo ?? null,
    });

  const selectorMes = (
    <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200 ring-inset">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Mes anterior"
        onClick={() => cambiar({ mes: moverMes(mes, -1) })}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <span className="min-w-36 text-center font-medium text-slate-800">{formatMes(mes)}</span>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Mes siguiente"
        disabled={mes >= mesActual}
        onClick={() => cambiar({ mes: moverMes(mes, 1) })}
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );

  return (
    <>
      <Link
        to="/asistencia"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader
        title={ficha.data?.guardia.nombre ?? 'Guardia'}
        subtitle={ficha.data?.guardia.email}
        actions={
          <>
            {selectorMes}
            {puedeCerrar && (
              <Button
                variant="secondary"
                icon={<FileText className="size-4" />}
                aria-label="Reporte de asistencia"
                onClick={() => setReportando(true)}
              >
                <span className="hidden sm:inline">Reporte</span>
              </Button>
            )}
          </>
        }
      />

      {ficha.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : ficha.isError ? (
        <EmptyState title="No se pudo cargar la ficha del guardia" description="Revisa tu conexión." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <aside className="space-y-3">
            <Referencia guardia={ficha.data.guardia} rostro={ficha.data.rostro} />
            <TurnoActual asignaciones={ficha.data.asignaciones} />
            <ResumenMes
              mes={mes}
              jornadas={ficha.data.jornadas}
              eventos={bitacora.data}
              onAsistencia={() => verVista('asistencia')}
              onBitacora={verBitacora}
            />
          </aside>

          <section className="min-w-0 space-y-3">
            {!esCliente && (
              <div role="tablist" aria-label="Vista" className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
                {(
                  [
                    ['asistencia', 'Asistencia'],
                    ['bitacora', 'Bitácora'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={vista === v}
                    onClick={() => verVista(v)}
                    className={cn(
                      'flex-1 rounded-lg px-5 py-2 text-sm font-medium lg:flex-none',
                      vista === v
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    {label}
                    {v === 'bitacora' && !!bitacora.data?.length && (
                      <span className="ml-1.5 text-xs text-slate-500">{bitacora.data.length}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {vista === 'asistencia' ? (
              ficha.data.jornadas.length === 0 ? (
                <EmptyState icon={<CalendarDays className="size-10" />} title="Sin marcas en este mes" />
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {ficha.data.jornadas.map((j) => {
                      const incidencias = esCliente ? [] : incidenciasDeJornada(j, bitacora.data);
                      return (
                        <div key={j.entrada.id} className="space-y-1.5">
                          <JornadaCard
                            jornada={j}
                            detalle
                            miniaturas
                            rostro={esCliente ? null : ficha.data.rostro}
                          />
                          {incidencias.length > 0 && (
                            <BotonIncidencias
                              incidencias={incidencias}
                              onClick={() => setConIncidencias(j)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Card className="hidden md:block">
                    <DataTable
                      columns={columnasAsistencia(bitacora.data, setConIncidencias, esCliente)}
                      rows={ficha.data.jornadas}
                      rowKey={(j) => j.entrada.id}
                      onRowClick={setAbierta}
                      actions={
                        puedeCerrar
                          ? (j) =>
                              !j.salida && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={<LogOut className="size-4" />}
                                  onClick={() => setCerrando(j)}
                                >
                                  Cerrar jornada
                                </Button>
                              )
                          : undefined
                      }
                    />
                  </Card>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="size-3.5" /> Las marcas no se pueden modificar ni borrar.
                  </p>
                </>
              )
            ) : bitacora.isError ? (
              <EmptyState title="No se pudo cargar la bitácora" description="Revisa tu conexión." />
            ) : (
              <BitacoraGuardia
                eventos={bitacora.data}
                cargando={bitacora.isPending}
                filtro={filtro}
                onFiltro={verBitacora}
              />
            )}

            {puedeCerrar && (
              <Card>
                <CardHeader
                  title="Reportes emitidos"
                  subtitle="Reportes oficiales de asistencia de este guardia"
                />
                <TablaInformes guardiaId={id} filtros={false} />
              </Card>
            )}
          </section>
        </div>
      )}

      {reportando && (
        <NuevoInformeModal
          guardia={{ id, nombre: ficha.data?.guardia.nombre ?? 'Guardia' }}
          onClose={() => setReportando(false)}
        />
      )}

      {cerrando && (
        <CerrarJornadaModal
          jornada={cerrando}
          guardia={ficha.data?.guardia.nombre ?? 'el guardia'}
          onClose={() => setCerrando(null)}
        />
      )}

      <Modal
        open={abierta !== null}
        onClose={() => setAbierta(null)}
        size="md"
        title={abierta ? formatDia(abierta.entrada.registradaEn) : ''}
        footer={
          <Button variant="secondary" onClick={() => setAbierta(null)}>
            Cerrar
          </Button>
        }
      >
        {abierta && (
          <div className="space-y-4">
            <JornadaCard jornada={abierta} detalle miniaturas rostro={ficha.data?.rostro ?? null} />
            {incidenciasDeJornada(abierta, bitacora.data).length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Incidencias de esta jornada</h3>
                <ListaEventos
                  eventos={incidenciasDeJornada(abierta, bitacora.data)}
                  cargando={false}
                  vacio=""
                />
              </section>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={conIncidencias !== null}
        onClose={() => setConIncidencias(null)}
        size="md"
        title={conIncidencias ? `Incidencias · ${formatDia(conIncidencias.entrada.registradaEn)}` : ''}
        footer={
          <Button variant="secondary" onClick={() => setConIncidencias(null)}>
            Cerrar
          </Button>
        }
      >
        {conIncidencias && (
          <ListaEventos
            eventos={incidenciasDeJornada(conIncidencias, bitacora.data)}
            cargando={false}
            vacio="Ya no hay incidencias en esta jornada."
          />
        )}
      </Modal>
    </>
  );
}

/** En celular, debajo de la tarjeta de la jornada: abre sus incidencias. */
function BotonIncidencias({ incidencias, onClick }: { incidencias: EventoBitacora[]; onClick: () => void }) {
  const sinAtender = incidencias.filter(incidenciaPendiente).length;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-medium ring-1 ring-inset',
        sinAtender
          ? 'bg-red-50 text-red-800 ring-red-200'
          : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
      )}
    >
      <ShieldAlert className="size-4 shrink-0" />
      <span className="flex-1">
        {incidencias.length === 1 ? '1 incidencia' : `${incidencias.length} incidencias`}
        {sinAtender > 0 && ` · ${sinAtender} sin atender`}
      </span>
      <ChevronRight className="size-4" />
    </button>
  );
}

/** Sitios y horarios que tiene hoy. */
function TurnoActual({ asignaciones }: { asignaciones: MiSitio[] }) {
  return (
    <Card className="p-3">
      <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">Turno actual</p>
      {asignaciones.length === 0 ? (
        <p className="text-sm text-slate-600">Sin sitio asignado hoy</p>
      ) : (
        <ul className="space-y-2">
          {asignaciones.map((a) => (
            <li key={a.asignacionId} className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900">
                  {a.sitio.nombre}
                  {a.grupo && (
                    <Badge tone="brand" className="ml-1.5 align-middle">
                      {a.grupo}
                    </Badge>
                  )}
                </p>
                <p className="text-slate-500">{a.cliente.nombreComercial}</p>
                <p className="text-slate-600">{describirAsignacion(a)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Resumen del mes. Retardos, salidas, faltas e incidencias salen de la bitácora sin contar los
 * justificados; tocar un número abre la bitácora filtrada (o la asistencia).
 */
function ResumenMes({
  mes,
  jornadas,
  eventos,
  onAsistencia,
  onBitacora,
}: {
  mes: string;
  jornadas: Jornada[];
  eventos: EventoBitacora[] | undefined;
  onAsistencia: () => void;
  onBitacora: (f: Partial<FiltroBitacora>) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const esCliente = user?.rol === ROLES.CLIENTE;
  const dias = new Set(jornadas.map((j) => new Date(j.entrada.registradaEn).toDateString())).size;
  const minutos = jornadas.reduce(
    (t, j) =>
      j.salida ? t + (Date.parse(j.salida.registradaEn) - Date.parse(j.entrada.registradaEn)) / 60_000 : t,
    0,
  );

  if (esCliente) {
    const retardos = jornadas.filter((j) => (j.retardoMin ?? 0) > 10).length;
    const comidasTomadas = jornadas.reduce((acc, j) => acc + j.comidas.length, 0);
    const datosCliente: {
      label: string;
      valor: number | string | undefined;
      alerta?: boolean;
      onClick: () => void;
    }[] = [
      { label: 'Días trabajados', valor: dias, onClick: onAsistencia },
      { label: 'Horas', valor: `${Math.floor(minutos / 60)} h`, onClick: onAsistencia },
      { label: 'Retardos', valor: retardos, alerta: retardos > 0, onClick: onAsistencia },
      { label: 'Comidas registradas', valor: comidasTomadas, onClick: onAsistencia },
    ];
    return (
      <Card className="p-3">
        <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
          Resumen de {formatMes(mes).toLowerCase()}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {datosCliente.map((d) => {
            const marcado = d.alerta && typeof d.valor === 'number' && d.valor > 0;
            return (
              <button
                key={d.label}
                type="button"
                onClick={d.onClick}
                className={cn(
                  'rounded-lg px-3 py-2 text-left ring-1 ring-inset',
                  marcado
                    ? 'bg-amber-50 ring-amber-200 hover:bg-amber-100'
                    : 'ring-slate-200 hover:bg-slate-50',
                )}
              >
                <span
                  className={cn(
                    'block text-xl font-bold tabular-nums',
                    marcado ? 'text-amber-800' : 'text-slate-900',
                  )}
                >
                  {d.valor ?? '…'}
                </span>
                <span className="text-xs text-slate-600">{d.label}</span>
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  const cuenta = (tipo: TipoEventoBitacora) =>
    eventos?.filter((e) => e.tipo === tipo && incidenciaCuenta(e)).length;
  const justificados = eventos?.filter((e) => e.justificacion).length ?? 0;
  const pendientes = eventos?.filter(incidenciaPendiente) ?? [];
  const sinAtender = pendientes.length;
  // Qué falta por atender, para no tener que abrirlas a ver cuál es (A-27).
  const porTipo = new Map<TipoEventoBitacora, number>();
  for (const e of pendientes) porTipo.set(e.tipo, (porTipo.get(e.tipo) ?? 0) + 1);
  const detalleSinAtender = [...porTipo]
    .map(([tipo, n]) => `${n} ${TIPO_EVENTO_BITACORA_LABEL[tipo].toLowerCase()}`)
    .join(' · ');
  const evento = (label: string, tipo: TipoEventoBitacora) => ({
    label,
    valor: cuenta(tipo),
    alerta: true,
    onClick: () => onBitacora({ categoria: 'incidencias', tipo }),
  });

  const datos: {
    label: string;
    valor: number | string | undefined;
    alerta?: boolean;
    onClick: () => void;
  }[] = [
    { label: 'Días trabajados', valor: dias, onClick: onAsistencia },
    { label: 'Horas', valor: `${Math.floor(minutos / 60)} h`, onClick: onAsistencia },
    evento('Retardos', 'retardo'),
    evento('Salidas antes', 'salida_anticipada'),
    evento('Faltas', 'falta'),
    {
      label: 'Rostro',
      valor: cuenta('incidencia_rostro'),
      alerta: true,
      onClick: () => onBitacora({ categoria: 'incidencias', clase: 'rostro' }),
    },
  ];

  return (
    <Card className="p-3">
      <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
        Resumen de {formatMes(mes).toLowerCase()}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {datos.map((d) => {
          const marcado = d.alerta && typeof d.valor === 'number' && d.valor > 0;
          return (
            <button
              key={d.label}
              type="button"
              onClick={d.onClick}
              className={cn(
                'rounded-lg px-3 py-2 text-left ring-1 ring-inset',
                marcado
                  ? 'bg-amber-50 ring-amber-200 hover:bg-amber-100'
                  : 'ring-slate-200 hover:bg-slate-50',
              )}
            >
              <span
                className={cn(
                  'block text-xl font-bold tabular-nums',
                  marcado ? 'text-amber-800' : 'text-slate-900',
                )}
              >
                {d.valor ?? '…'}
              </span>
              <span className="text-xs text-slate-600">{d.label}</span>
            </button>
          );
        })}
      </div>
      {sinAtender > 0 && (
        <button
          type="button"
          onClick={() => onBitacora({ categoria: 'incidencias', estado: 'pendientes' })}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-left text-sm font-medium text-red-800 ring-1 ring-red-200 ring-inset hover:bg-red-100"
        >
          <ShieldAlert className="size-4 shrink-0" />
          <span className="flex-1">
            {sinAtender === 1 ? '1 incidencia sin atender' : `${sinAtender} incidencias sin atender`}
            {detalleSinAtender && <span className="block text-xs font-normal">{detalleSinAtender}</span>}
          </span>
          <ChevronRight className="size-4" />
        </button>
      )}
      {justificados > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          No cuenta {justificados === 1 ? '1 evento justificado' : `${justificados} eventos justificados`}.
        </p>
      )}
    </Card>
  );
}

/** Foto de referencia del registro (para comparar con las de cada marca). */
function Referencia({ guardia, rostro }: { guardia: GuardiaResumen; rostro: RostroRegistro | null }) {
  const [viendo, setViendo] = useState(false);
  const user = useAuthStore((s) => s.user);
  const esCliente = user?.rol === ROLES.CLIENTE;
  const puedeRevisar = hasPermission(user, PERMISOS.ASISTENCIA_ROSTROS);
  const foto = rostro?.fotoUrl || guardia.foto;

  return (
    <>
      <Card className="flex items-center gap-3 p-3">
        {foto ? (
          esCliente ? (
            <img
              src={foto}
              alt="Guardia asignado"
              className="size-20 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
            />
          ) : (
            <button
              type="button"
              onClick={() => setViendo(true)}
              aria-label="Ver las fotos del registro"
              className="shrink-0"
            >
              <img
                src={foto}
                alt="Rostro registrado"
                className="size-20 -scale-x-100 rounded-xl object-cover ring-1 ring-slate-200"
              />
            </button>
          )
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <UserRound className="size-9" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {esCliente ? 'Guardia asignado' : 'Rostro de referencia'}
          </p>
          {esCliente ? (
            <>
              <p className="font-semibold text-slate-900 truncate">{guardia.nombre}</p>
              <p className="text-xs text-slate-500 truncate">{guardia.email}</p>
            </>
          ) : rostro ? (
            <>
              <EstadoRostroBadge estado={rostro.estado} />
              <p className="text-sm text-slate-600">
                {formatFecha(rostro.registradoEn.slice(0, 10))} ·{' '}
                <button type="button" onClick={() => setViendo(true)} className="font-medium text-brand-700">
                  Ver {rostro.fotos.length} fotos
                </button>
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">Sin rostro registrado</p>
          )}
        </div>
      </Card>

      {!esCliente && rostro && (
        <Modal
          open={viendo}
          onClose={() => setViendo(false)}
          size="md"
          title={`Rostro de ${guardia.nombre}`}
          footer={
            <Button variant="secondary" onClick={() => setViendo(false)}>
              Cerrar
            </Button>
          }
        >
          <RevisionRostro guardia={guardia} rostro={rostro} puedeRevisar={puedeRevisar} />
        </Modal>
      )}
    </>
  );
}
