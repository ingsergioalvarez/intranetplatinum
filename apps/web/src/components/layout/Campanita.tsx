import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck, ClipboardList, MessageSquare, RefreshCw } from 'lucide-react';
import type { Aviso, BandejaAvisos, TipoAviso } from '@platinum/shared';
import { api } from '../../core/api';
import { formatFechaHora } from '../../core/format/fechas';
import { Button, EmptyState, Modal, Spinner, cn } from '../ui';

const CLAVE = ['avisos'] as const;

const ICONO: Record<TipoAviso, typeof Bell> = {
  reporte_nuevo: ClipboardList,
  reporte_estatus: RefreshCw,
  reporte_comentario: MessageSquare,
};

/**
 * Avisos en la app (F3-10): ícono con contador de no leídos y bandeja.
 * Se consulta cada minuto y al volver a la pestaña.
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
  };

  const noLeidos = bandeja.data?.noLeidos ?? 0;

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
        ) : !bandeja.data?.items.length ? (
          <EmptyState icon={<BellOff className="size-9" />} title="Sin avisos" />
        ) : (
          <ul className="-mx-4 divide-y divide-slate-100 md:-mx-6">
            {bandeja.data.items.map((a) => {
              const Icono = ICONO[a.tipo];
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => abrir(a)}
                    className={cn(
                      'flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 md:px-6',
                      !a.leido && 'bg-brand-50/60',
                    )}
                  >
                    <Icono
                      className={cn('mt-0.5 size-5 shrink-0', a.leido ? 'text-slate-400' : 'text-brand-700')}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-sm',
                          a.leido ? 'text-slate-600' : 'font-medium text-slate-900',
                        )}
                      >
                        {a.mensaje}
                      </span>
                      <span className="text-xs text-slate-500">{formatFechaHora(a.createdAt)}</span>
                    </span>
                    {!a.leido && (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600"
                        aria-label="Sin leer"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </>
  );
}
