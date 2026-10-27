import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { type TurnoCatalogo } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { Badge, FormModal, Select, Spinner, toast } from '../../components/ui';
import { sitiosService } from '../clientes/clientes.service';
import { turnosService } from './turnos.service';
import { textoHorario } from './turnos.texto';

/**
 * Borrar un turno del catálogo. Sin asignaciones se borra directo (con una confirmación); si está
 * asignado, dice a qué sitios y obliga a elegir el turno nuevo de cada sitio activo: los guardias pasan
 * a ese turno y se les avisa. El supervisor solo cambia sus sitios.
 */
export function BorrarTurnoModal({
  turno,
  onClose,
  onBorrado,
}: {
  turno: TurnoCatalogo;
  onClose: () => void;
  onBorrado: () => void;
}) {
  const qc = useQueryClient();
  const [elegidos, setElegidos] = useState<Record<number, string>>({});
  const uso = useQuery({ queryKey: turnosService.keys.uso(turno.id), queryFn: () => turnosService.uso(turno.id) });
  const lista = useQuery({ queryKey: turnosService.keys.all, queryFn: turnosService.list });
  const opciones = (lista.data ?? []).filter((t) => t.activo && t.id !== turno.id);

  const sitios = uso.data?.sitios ?? [];
  const activos = sitios.filter((s) => s.activo);
  const completo = activos.every((s) => !!elegidos[s.sitio.id]);
  const bloqueado = !!uso.data && !uso.data.puedeBorrar;

  const borrar = useMutation({
    mutationFn: () =>
      turnosService.eliminar(turno.id, {
        reemplazos: activos.map((s) => ({ sitioId: s.sitio.id, turnoId: Number(elegidos[s.sitio.id]) })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: turnosService.keys.all });
      void qc.invalidateQueries({ queryKey: sitiosService.keys.all });
      void qc.invalidateQueries({ queryKey: ['cobertura'] });
      toast.success(activos.length ? 'Turno borrado; los guardias pasaron al turno nuevo' : 'Turno borrado');
      onBorrado();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  return (
    <FormModal
      title={`Borrar "${turno.nombre}"`}
      description={textoHorario(turno.horas, turno.horaEntrada)}
      onClose={onClose}
      onSubmit={() => borrar.mutate()}
      submitLabel="Borrar turno"
      loading={borrar.isPending}
      submitDisabled={uso.isPending || bloqueado || !completo}
      readOnly={bloqueado}
      dirty
    >
      {uso.isPending ? (
        <div className="flex justify-center py-6 text-brand-600">
          <Spinner className="size-6" />
        </div>
      ) : uso.isError ? (
        <p className="text-sm text-red-600">No se pudo revisar dónde se usa este turno. Intenta de nuevo.</p>
      ) : sitios.length === 0 ? (
        <p className="text-sm text-slate-700">Ningún sitio lo usa. ¿Seguro que quieres borrarlo? Esto no se puede deshacer.</p>
      ) : (
        <>
          <p className="text-sm text-slate-700">
            Este turno está asignado en {sitios.length === 1 ? '1 sitio' : `${sitios.length} sitios`}.{' '}
            {activos.length > 0 && 'Elige el turno nuevo de cada sitio activo: los guardias pasarán a ese turno y se les avisará.'}
          </p>
          {bloqueado && (
            <p className="flex items-start gap-1.5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {uso.data!.motivo}
            </p>
          )}
          <ul className="space-y-2">
            {sitios.map((s) => (
              <li key={s.sitio.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{s.sitio.nombre}</span>
                  {!s.activo && <Badge>Sitio de baja</Badge>}
                  {s.activo && !s.propio && <Badge tone="warning">De otro supervisor</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-slate-600">Asignado a: {s.asignados.join(', ')}</p>
                {s.activo && s.propio && !bloqueado && (
                  <div className="mt-2">
                    <Select
                      aria-label={`Turno nuevo de ${s.sitio.nombre}`}
                      value={elegidos[s.sitio.id] ?? ''}
                      onChange={(e) => setElegidos({ ...elegidos, [s.sitio.id]: e.target.value })}
                      placeholder="Elige el turno nuevo…"
                      options={opciones.map((t) => ({
                        value: String(t.id),
                        label: `${t.nombre} · ${textoHorario(t.horas, t.horaEntrada)}`,
                      }))}
                    />
                  </div>
                )}
                {!s.activo && <p className="mt-1 text-xs text-slate-500">No necesita turno nuevo: el sitio está de baja.</p>}
              </li>
            ))}
          </ul>
          {!bloqueado && (
            <p className="text-sm font-medium text-red-700">
              ¿Seguro que quieres borrarlo? Esto no se puede deshacer.
            </p>
          )}
        </>
      )}
    </FormModal>
  );
}
