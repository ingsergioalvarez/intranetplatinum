import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock, Plus } from 'lucide-react';
import { textoDias, type TurnoCatalogo } from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, EmptyState, Spinner, cn } from '../../components/ui';
import { TurnoModal } from './TurnoModal';
import { textoHorario } from './turnos.texto';
import { turnosService } from './turnos.service';

/** Catálogo de turnos (DA-37): se crean una vez y se asignan desde la cobertura de cada sitio. */
export function TurnosPage() {
  const [editando, setEditando] = useState<TurnoCatalogo | 'nuevo' | null>(null);
  const turnos = useQuery({ queryKey: turnosService.keys.all, queryFn: turnosService.list });

  return (
    <>
      <PageHeader
        title="Turnos"
        subtitle="Aquí creas y editas los horarios; en cada sitio solo eliges cuál usa"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditando('nuevo')}>
            Nuevo turno
          </Button>
        }
      />

      {turnos.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : turnos.isError ? (
        <EmptyState title="No se pudieron cargar los turnos" description="Revisa tu conexión." />
      ) : turnos.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Clock className="size-10" />}
            title="Sin turnos"
            description="Crea el primero, por ejemplo 24 h con entrada a las 8:00 a.m."
          />
        </Card>
      ) : (
        <Card className="max-w-3xl divide-y divide-slate-100">
          {turnos.data.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setEditando(t)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50',
                !t.activo && 'opacity-60',
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">
                {t.horas}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900">{t.nombre}</span>
                <span className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Clock className="size-3.5 shrink-0" /> {textoHorario(t.horas, t.horaEntrada)}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <CalendarDays className="size-3.5 shrink-0" /> {textoDias(t.dias)} ·{' '}
                  {t.enUso === 0
                    ? 'Sin usar'
                    : `Usado en ${t.enUso} ${t.enUso === 1 ? 'asignación' : 'asignaciones'}`}
                </span>
              </span>
              {!t.activo && <Badge>De baja</Badge>}
            </button>
          ))}
        </Card>
      )}

      {editando && (
        <TurnoModal turno={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} />
      )}
    </>
  );
}
