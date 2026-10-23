import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shuffle, XCircle } from 'lucide-react';
import { horaLegible, type Cobertura } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { formatFecha } from '../../core/format/fechas';
import { Button, ConfirmDialog, EmptyState, Spinner, toast } from '../../components/ui';
import { coberturasService } from './coberturas.service';
import { EnviarCubrirModal } from './EnviarCubrirModal';

const dias = (c: Cobertura) =>
  c.desde === c.hasta ? formatFecha(c.desde) : `${formatFecha(c.desde)} – ${formatFecha(c.hasta)}`;

/** Coberturas vigentes y próximas de un sitio, con "Enviar a cubrir" y cancelar (DA-39). */
export function CoberturasDelSitio({
  sitio,
  editable,
}: {
  sitio: { id: number; nombre: string };
  editable: boolean;
}) {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [cancelando, setCancelando] = useState<Cobertura | null>(null);
  const lista = useQuery({
    queryKey: coberturasService.keys.sitio(sitio.id),
    queryFn: () => coberturasService.delSitio(sitio.id),
  });
  const cancelar = useMutation({
    mutationFn: (c: Cobertura) => coberturasService.cancelar(c.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: coberturasService.keys.all });
      setCancelando(null);
      toast.success('Cobertura cancelada');
    },
    onError: (e) => {
      setCancelando(null);
      toast.error(mensajeDeError(e));
    },
  });

  return (
    <div className="space-y-3">
      {lista.isPending ? (
        <div className="flex justify-center py-8 text-brand-600">
          <Spinner className="size-6" />
        </div>
      ) : !lista.data?.length ? (
        <EmptyState
          icon={<Shuffle className="size-9" />}
          title="Nadie cubre este sitio"
          description="Envía a un guardia a cubrir un turno o unos días (por una falta, incapacidad o evento)."
        />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {lista.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900">
                  {c.guardia.nombre}
                  {c.cubreA && (
                    <span className="font-normal text-slate-500"> · en lugar de {c.cubreA.nombre}</span>
                  )}
                </p>
                <p className="text-slate-600">
                  {dias(c)} · entra {horaLegible(c.horaInicio)} · {c.horas} h
                </p>
                <p className="text-slate-500">Motivo: {c.motivo}</p>
                {c.descansoHoras !== null && c.descansoHoras < 12 && (
                  <p className="text-xs text-red-700">Se envió descansando solo {c.descansoHoras} h</p>
                )}
              </div>
              {editable && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-700"
                  icon={<XCircle className="size-4" />}
                  onClick={() => setCancelando(c)}
                >
                  Cancelar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <Button
          variant="secondary"
          fullWidth
          icon={<Shuffle className="size-4" />}
          onClick={() => setEnviando(true)}
        >
          Enviar a cubrir
        </Button>
      )}

      {enviando && <EnviarCubrirModal sitio={sitio} onClose={() => setEnviando(false)} />}
      <ConfirmDialog
        open={cancelando !== null}
        title="Cancelar cobertura"
        description={
          cancelando &&
          `${cancelando.guardia.nombre} ya no cubrirá ${sitio.nombre} (${dias(cancelando)}). Se le avisará.`
        }
        confirmLabel="Cancelar cobertura"
        variant="danger"
        loading={cancelar.isPending}
        onConfirm={() => cancelando && cancelar.mutate(cancelando)}
        onCancel={() => setCancelando(null)}
      />
    </div>
  );
}
