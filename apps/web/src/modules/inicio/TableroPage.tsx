import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, CircleCheck, LogOut, Shuffle } from 'lucide-react';
import { horaLegible, type TableroItem } from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, Card, CardHeader, EmptyState, Spinner, cn } from '../../components/ui';
import { useAuthStore } from '../../core/auth/authStore';
import { formatFechaHora, hoyLocal } from '../../core/format/fechas';
import { asistenciaService } from '../asistencia/asistencia.service';
import { CerrarJornadaModal } from '../asistencia/CerrarJornadaModal';
import { formatDiaLargo, formatHora } from '../asistencia/formato';
import { EnviarCubrirModal } from '../clientes/EnviarCubrirModal';
import { reportesService } from '../reportes/reportes.service';

/** `1 h 05 min` / `25 min` */
const duracion = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

/** `08:00` local de un instante (para precargar la hora del turno). */
const hora24 = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  );

/** Qué le pasa a cada uno, en una frase. */
function texto(i: TableroItem) {
  const { fila } = i;
  if (i.clase === 'sin_llegar') {
    const e = fila.turno!;
    const debia = horaLegible(hora24(e.entrada));
    return e.estado === 'falta'
      ? `Falta: debía entrar a las ${debia}`
      : `No se ha presentado: debía entrar a las ${debia} (hace ${duracion(i.minutos)})`;
  }
  if (i.clase === 'sin_salida') {
    return `Sin salida: debió salir a las ${horaLegible(hora24(fila.jornada!.programada!.salida))} (hace ${duracion(i.minutos)})`;
  }
  return `Salió a comer a las ${formatHora(fila.jornada!.comidas.at(-1)!.inicio.registradaEn)} y no regresa (${duracion(i.minutos)})`;
}

function Numero({
  to,
  valor,
  etiqueta,
  urgente = false,
}: {
  to: string;
  valor: number | undefined;
  etiqueta: string;
  /** Resalta en rojo cuando hay algo (lo más urgente del día). */
  urgente?: boolean;
}) {
  const rojo = urgente && !!valor;
  return (
    <Link
      to={to}
      className={cn(
        'rounded-xl p-4 ring-1 ring-inset transition-colors',
        rojo
          ? 'bg-red-50 text-red-800 ring-red-200 hover:bg-red-100'
          : 'bg-white text-slate-900 ring-slate-200 hover:bg-slate-50',
      )}
    >
      <span className="block text-3xl font-bold tabular-nums">{valor ?? '…'}</span>
      <span className={cn('block text-sm', rojo ? 'text-red-700' : 'text-slate-600')}>{etiqueta}</span>
    </Link>
  );
}

/**
 * Inicio de admin y supervisor (DA-51): lo que necesita atención hoy, con la acción en la misma
 * fila. El supervisor solo ve sus sitios y guardias.
 */
export function TableroPage() {
  const user = useAuthStore((s) => s.user);
  const [cubrir, setCubrir] = useState<TableroItem | null>(null);
  const [cerrar, setCerrar] = useState<TableroItem | null>(null);

  const tablero = useQuery({
    queryKey: asistenciaService.keys.tablero,
    queryFn: asistenciaService.tablero,
    refetchInterval: 60_000,
  });
  const mes = hoyLocal().slice(0, 7);
  const incidencias = useQuery({
    queryKey: asistenciaService.keys.incidenciasPorGuardia(mes),
    queryFn: () => asistenciaService.incidenciasPorGuardia(mes),
    refetchInterval: 60_000,
  });
  const filtro = { estatus: 'abierto', page: 1, limit: 5 };
  const reportes = useQuery({
    queryKey: reportesService.keys.list(filtro),
    queryFn: () => reportesService.list(filtro),
    refetchInterval: 60_000,
  });

  const items = tablero.data?.items;
  const cuenta = (clase: TableroItem['clase']) => items?.filter((i) => i.clase === clase).length;
  const sinAtender = incidencias.data?.reduce((t, f) => t + f.pendientes, 0);

  return (
    <>
      <PageHeader title={`Hola, ${user?.nombre ?? ''}`} subtitle={formatDiaLargo(new Date())} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Numero to="/asistencia" valor={cuenta('sin_llegar')} etiqueta="Sin llegar" urgente />
        <Numero to="/asistencia" valor={cuenta('sin_salida')} etiqueta="Sin salida" />
        <Numero to="/asistencia" valor={cuenta('comida_abierta')} etiqueta="Comidas sin cierre" />
        <Numero to="/asistencia/incidencias" valor={sinAtender} etiqueta="Incidencias sin atender" />
        <Numero to="/reportes?estatus=abierto" valor={reportes.data?.total} etiqueta="Reportes abiertos" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Requiere tu atención" subtitle="Se actualiza cada minuto" />
          {tablero.isPending ? (
            <div className="flex justify-center py-10 text-brand-600">
              <Spinner className="size-6" />
            </div>
          ) : tablero.isError ? (
            <EmptyState title="No se pudo cargar el tablero" description="Revisa tu conexión." />
          ) : tablero.data.items.length === 0 ? (
            <EmptyState
              icon={<CircleCheck className="size-10 text-emerald-600" />}
              title="Todo en orden"
              description="Nadie sin llegar, sin salida ni con la comida abierta."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tablero.data.items.map((i) => (
                <li
                  key={`${i.clase}-${i.fila.guardia.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/asistencia/guardias/${i.fila.guardia.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {i.fila.guardia.nombre}
                    </Link>
                    {i.fila.sitio && <span className="text-sm text-slate-500"> · {i.fila.sitio.nombre}</span>}
                    <p
                      className={cn('text-sm', i.clase === 'sin_llegar' ? 'text-red-700' : 'text-amber-700')}
                    >
                      {texto(i)}
                    </p>
                  </div>
                  {i.clase === 'sin_llegar' && i.fila.sitio && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Shuffle className="size-4" />}
                      onClick={() => setCubrir(i)}
                    >
                      Enviar a cubrir
                    </Button>
                  )}
                  {i.clase === 'sin_salida' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<LogOut className="size-4" />}
                      onClick={() => setCerrar(i)}
                    >
                      Cerrar jornada
                    </Button>
                  )}
                  {i.clase === 'comida_abierta' && (
                    <Link
                      to={`/asistencia/guardias/${i.fila.guardia.id}`}
                      className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-700"
                    >
                      Ver <ChevronRight className="size-4" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Reportes abiertos"
            actions={
              <Link to="/reportes?estatus=abierto" className="text-sm font-medium text-brand-700">
                Ver todos
              </Link>
            }
          />
          {reportes.isPending ? (
            <div className="flex justify-center py-10 text-brand-600">
              <Spinner className="size-6" />
            </div>
          ) : !reportes.data?.items.length ? (
            <EmptyState title="Sin reportes abiertos" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {reportes.data.items.map((r) => (
                <li key={r.id}>
                  <Link to={`/reportes/${r.id}`} className="block px-4 py-3 hover:bg-slate-50">
                    <p className="truncate font-medium text-slate-900">{r.titulo}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.folio} · {r.sitio.nombre} · {formatFechaHora(r.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {cubrir?.fila.sitio && cubrir.fila.turno && (
        <EnviarCubrirModal
          sitio={cubrir.fila.sitio}
          fecha={tablero.data?.fecha}
          horaInicio={hora24(cubrir.fila.turno.entrada)}
          horas={cubrir.fila.turno.horas}
          cubreA={{ id: cubrir.fila.guardia.id, nombre: cubrir.fila.guardia.nombre }}
          onClose={() => setCubrir(null)}
        />
      )}
      {cerrar?.fila.jornada && (
        <CerrarJornadaModal
          jornada={cerrar.fila.jornada}
          guardia={cerrar.fila.guardia.nombre}
          onClose={() => setCerrar(null)}
        />
      )}
    </>
  );
}
