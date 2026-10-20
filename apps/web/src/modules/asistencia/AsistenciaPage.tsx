import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { FilaAsistencia } from '@platinum/shared';
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
import { hoyLocal } from '../../core/format/fechas';
import { useDebounced } from '../../core/hooks/useDebounced';
import { asistenciaService } from './asistencia.service';
import { formatDuracion, formatHora, jornadaEnCurso } from './formato';

const LIMIT = 25;

/** Día `AAAA-MM-DD` desplazado `delta` días. */
function moverDia(fecha: string, delta: number) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return new Intl.DateTimeFormat('en-CA').format(d);
}

const hora = (iso: string | undefined) => (iso ? formatHora(iso) : '—');

function Estado({ fila: { jornada: j } }: { fila: FilaAsistencia }) {
  if (!j) return <Badge>Sin marcas</Badge>;
  if (j.alertas.length) {
    return (
      <Badge tone="warning">
        {j.alertas.length} {j.alertas.length === 1 ? 'alerta' : 'alertas'}
      </Badge>
    );
  }
  if (!j.salida)
    return jornadaEnCurso(j) ? <Badge tone="info">En curso</Badge> : <Badge tone="warning">Sin salida</Badge>;
  return <Badge tone="success">Completa</Badge>;
}

const columns: Column<FilaAsistencia>[] = [
  { key: 'guardia', header: 'Guardia', mobile: 'title', render: (f) => f.guardia.nombre },
  { key: 'sitio', header: 'Sitio', mobile: 'subtitle', render: (f) => f.sitio?.nombre ?? '—' },
  {
    key: 'entrada',
    header: 'Entrada',
    className: 'tabular-nums',
    render: (f) => hora(f.jornada?.entrada.registradaEn),
  },
  {
    key: 'comida',
    header: 'Comida',
    className: 'tabular-nums',
    render: ({ jornada: j }) =>
      j?.inicioComida ? `${hora(j.inicioComida.registradaEn)}–${hora(j.finComida?.registradaEn)}` : '—',
  },
  {
    key: 'salida',
    header: 'Salida',
    className: 'tabular-nums',
    render: (f) => hora(f.jornada?.salida?.registradaEn),
  },
  {
    key: 'horas',
    header: 'Horas',
    mobile: 'hidden',
    className: 'tabular-nums',
    render: ({ jornada: j }) =>
      j?.salida ? formatDuracion(j.entrada.registradaEn, j.salida.registradaEn) : '—',
  },
  { key: 'estado', header: 'Estado', render: (f) => <Estado fila={f} /> },
];

/** Asistencia del día: una fila por guardia (con jornada o asignado sin marcas). Solo lectura (AS1-07). */
export function AsistenciaPage() {
  const navigate = useNavigate();
  const hoy = hoyLocal();
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
            columns={columns}
            rows={lista.data?.items ?? []}
            rowKey={(f) => `${f.guardia.id}-${f.jornada?.entrada.id ?? 'sin'}`}
            loading={lista.isPending}
            onRowClick={(f) => navigate(`/asistencia/guardias/${f.guardia.id}?mes=${fecha.slice(0, 7)}`)}
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
    </>
  );
}
