import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CalendarDays,
  BellOff,
  CheckCheck,
  ClipboardList,
  Clock,
  Copy,
  Hand,
  MapPin,
  MessageSquare,
  UserCheck,
  UserX,
  UsersRound,
  RefreshCw,
  ScanFace,
  ShieldAlert,
  SmartphoneNfc,
  TriangleAlert,
} from 'lucide-react';
import type { Aviso, BandejaAvisos, TipoAviso } from '@platinum/shared';
import { api } from '../../core/api';
import { formatFechaHora } from '../../core/format/fechas';
import { Button, EmptyState, Modal, Spinner, cn } from '../ui';

const CLAVE = ['avisos'] as const;

type Tono = 'rojo' | 'ambar' | 'azul' | 'verde';

/** Título, ícono y color (gravedad) de cada tipo de aviso (AS1-13). */
const TIPO: Record<TipoAviso, { titulo: string; icono: typeof Bell; tono: Tono }> = {
  reporte_nuevo: { titulo: 'Nuevo reporte', icono: ClipboardList, tono: 'azul' },
  reporte_estatus: { titulo: 'Reporte actualizado', icono: RefreshCw, tono: 'azul' },
  reporte_comentario: { titulo: 'Nuevo comentario', icono: MessageSquare, tono: 'azul' },
  // Asistencia (A-17)
  rostro_pendiente: { titulo: 'Rostro por revisar', icono: ScanFace, tono: 'ambar' },
  rostro_suplantacion: { titulo: 'Posible suplantación', icono: ShieldAlert, tono: 'rojo' },
  rostro_duplicado: { titulo: 'Rostro ya registrado', icono: Copy, tono: 'rojo' },
  rostro_pantalla: { titulo: 'Pantalla o foto', icono: SmartphoneNfc, tono: 'rojo' },
  rostro_reto: { titulo: 'Gesto no completado', icono: Hand, tono: 'ambar' },
  retardo: { titulo: 'Retardo', icono: Clock, tono: 'ambar' },
  marca_alerta: { titulo: 'Marca con alerta', icono: TriangleAlert, tono: 'ambar' },
  horas_extra: { titulo: 'Horas extra', icono: Clock, tono: 'ambar' },
  cobertura: { titulo: 'Turno sin cubrir', icono: CalendarDays, tono: 'rojo' },
  // Para el guardia (DA-34)
  rostro_aprobado: { titulo: 'Rostro aprobado', icono: UserCheck, tono: 'verde' },
  rostro_rechazado: { titulo: 'Rostro rechazado', icono: UserX, tono: 'rojo' },
  cuenta_intento: { titulo: 'Intento con tu cuenta', icono: ShieldAlert, tono: 'rojo' },
  asignacion: { titulo: 'Tu sitio y horario', icono: MapPin, tono: 'azul' },
  grupo: { titulo: 'Tu grupo', icono: UsersRound, tono: 'azul' },
};

const COLOR: Record<Tono, { barra: string; icono: string }> = {
  rojo: { barra: 'border-l-red-500', icono: 'bg-red-100 text-red-700' },
  ambar: { barra: 'border-l-amber-400', icono: 'bg-amber-100 text-amber-700' },
  azul: { barra: 'border-l-brand-500', icono: 'bg-brand-100 text-brand-700' },
  verde: { barra: 'border-l-emerald-500', icono: 'bg-emerald-100 text-emerald-700' },
};

/** "Pruebas · Entrada: parece una pantalla…" → contexto y detalle. */
function partes(mensaje: string) {
  const i = mensaje.indexOf(': ');
  return i < 0
    ? { contexto: mensaje, detalle: null }
    : { contexto: mensaje.slice(0, i), detalle: mensaje.slice(i + 2) };
}

const diaLocal = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function grupoDe(iso: string, ahora: Date) {
  const d = new Date(iso);
  if (diaLocal(d) === diaLocal(ahora)) return 'Hoy';
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  return diaLocal(d) === diaLocal(ayer) ? 'Ayer' : 'Anteriores';
}

/** "hace 5 min", "hace 2 h"; de ayer o antes, la hora o la fecha. */
function horaRelativa(iso: string, ahora: Date) {
  const d = new Date(iso);
  const min = Math.floor((ahora.getTime() - d.getTime()) / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (diaLocal(d) === diaLocal(ahora)) return `hace ${Math.floor(min / 60)} h`;
  if (grupoDe(iso, ahora) === 'Ayer') {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

/**
 * Avisos en la app (F3-10): ícono con contador de no leídos y bandeja agrupada (Hoy / Ayer /
 * Anteriores). Cada aviso con título por tipo, color según gravedad y, si tiene, miniatura de la
 * foto de evidencia. Se consulta cada minuto y al volver a la pestaña.
 */
export function Campanita({ className, tono = 'oscuro' }: { className?: string; tono?: 'oscuro' | 'claro' }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [abierta, setAbierta] = useState(false);

  const bandeja = useQuery({
    queryKey: CLAVE,
    queryFn: () => api.get<BandejaAvisos>('/avisos'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const marcar = useMutation({
    mutationFn: (id: number) => api.patch(`/avisos/${id}/leido`),
    onSettled: () => qc.invalidateQueries({ queryKey: CLAVE }),
  });
  const marcarTodos = useMutation({
    mutationFn: () => api.patch('/avisos/leidos'),
    onSettled: () => qc.invalidateQueries({ queryKey: CLAVE }),
  });

  const abrir = (a: Aviso) => {
    if (!a.leido) marcar.mutate(a.id);
    setAbierta(false);
    if (a.reporteId) navigate(`/reportes/${a.reporteId}`);
    else if (a.ruta) navigate(a.ruta);
  };

  const noLeidos = bandeja.data?.noLeidos ?? 0;
  const ahora = new Date();
  const grupos: { nombre: string; avisos: Aviso[] }[] = [];
  for (const a of bandeja.data?.items ?? []) {
    const nombre = grupoDe(a.createdAt, ahora);
    if (grupos.at(-1)?.nombre !== nombre) grupos.push({ nombre, avisos: [] });
    grupos.at(-1)!.avisos.push(a);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className={cn(
          'relative rounded-lg p-2',
          tono === 'oscuro'
            ? 'text-brand-100 hover:text-white active:bg-brand-800'
            : 'text-slate-600 hover:bg-slate-100',
          className,
        )}
        aria-label={noLeidos ? `Avisos: ${noLeidos} sin leer` : 'Avisos'}
      >
        <Bell className="size-5" />
        {noLeidos > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white ring-2 ring-brand-900">
            {noLeidos > 99 ? '99+' : noLeidos}
          </span>
        )}
      </button>

      <Modal
        open={abierta}
        onClose={() => setAbierta(false)}
        title="Avisos"
        description={noLeidos ? `${noLeidos} sin leer` : 'Todo al día'}
        footer={
          noLeidos > 0 && (
            <Button
              variant="secondary"
              icon={<CheckCheck className="size-4" />}
              loading={marcarTodos.isPending}
              onClick={() => marcarTodos.mutate()}
            >
              Marcar todo como leído
            </Button>
          )
        }
      >
        {bandeja.isPending ? (
          <div className="flex justify-center py-8 text-brand-600">
            <Spinner className="size-6" />
          </div>
        ) : !grupos.length ? (
          <EmptyState icon={<BellOff className="size-9" />} title="Sin avisos" />
        ) : (
          <div className="-mx-4 md:-mx-6">
            {grupos.map((g) => (
              <section key={g.nombre}>
                <h3 className="bg-slate-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase md:px-6">
                  {g.nombre}
                </h3>
                <ul className="divide-y divide-slate-100">
                  {g.avisos.map((a) => (
                    <li key={a.id}>
                      <FilaAviso aviso={a} ahora={ahora} onAbrir={() => abrir(a)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

function FilaAviso({ aviso: a, ahora, onAbrir }: { aviso: Aviso; ahora: Date; onAbrir: () => void }) {
  const { titulo, icono: Icono, tono } = TIPO[a.tipo];
  const { contexto, detalle } = partes(a.mensaje);
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        'flex w-full gap-3 border-l-4 py-3 pr-4 pl-3 text-left hover:bg-slate-50 md:pr-6 md:pl-5',
        COLOR[tono].barra,
        !a.leido && 'bg-brand-50/50',
      )}
    >
      <span
        className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', COLOR[tono].icono)}
      >
        <Icono className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              a.leido ? 'font-medium text-slate-700' : 'font-semibold text-slate-900',
            )}
          >
            {titulo}
          </span>
          <time
            className="shrink-0 text-xs text-slate-500"
            dateTime={a.createdAt}
            title={formatFechaHora(a.createdAt)}
          >
            {horaRelativa(a.createdAt, ahora)}
          </time>
        </span>
        <span className="block text-sm text-slate-700">{contexto}</span>
        {detalle && <span className="block text-sm text-slate-500">{detalle}</span>}
      </span>
      {a.foto && (
        <img
          src={a.foto}
          alt=""
          className="size-12 shrink-0 -scale-x-100 rounded-lg object-cover ring-1 ring-slate-200"
        />
      )}
      {!a.leido && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" aria-label="Sin leer" />
      )}
    </button>
  );
}
