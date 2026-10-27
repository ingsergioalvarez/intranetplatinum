import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Timer } from 'lucide-react';
import { duracionExtra, type HoraExtraGuardia } from '@platinum/shared';
import { Button, Modal, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { horasExtraService } from '../horas-extra/horasExtra.service';
import { asistenciaService } from './asistencia.service';
import { formatHora } from './formato';
import type { Ubicacion } from './ubicacion';

const claveNo = (entradaId: number) => `horaExtra.no.${entradaId}`;
const yaDijoNo = (entradaId: number) => {
  try {
    return sessionStorage.getItem(claveNo(entradaId)) === '1';
  } catch {
    return false;
  }
};

/**
 * Horas extra en la pantalla de checar (AS5): pasada su hora de salida se pregunta una vez "¿sigues en
 * turno?"; si dice que sí queda la solicitud con su supervisor y se habilita la salida final. Si dijo
 * que no, queda el botón "Extender mi horario" por si después se queda.
 */
export function HorasExtraGuardia({
  extra,
  ubicacion,
  dentroDelSitio,
}: {
  extra: HoraExtraGuardia;
  ubicacion: Ubicacion | null;
  /** Dentro del radio del sitio con la ubicación actual; null si no se puede saber. */
  dentroDelSitio: boolean | null;
}) {
  const queryClient = useQueryClient();
  const [dijoNo, setDijoNo] = useState(() => yaDijoNo(extra.entradaId));
  const fin = formatHora(new Date(extra.finProgramado));

  const extender = useMutation({
    mutationFn: () => {
      if (!navigator.onLine) throw new Error('Necesitas conexión para extender tu horario');
      return horasExtraService.extender(
        ubicacion ? { lat: ubicacion.lat, lng: ubicacion.lng, precisionM: ubicacion.precisionM } : {},
      );
    },
    onSuccess: () => {
      toast.success('Listo, avisamos a tu supervisor');
      void queryClient.invalidateQueries({ queryKey: asistenciaService.keys.all });
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const { solicitud } = extra;
  if (solicitud?.estado === 'abierta') {
    return (
      <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
        <Timer className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">Extendiste tu horario desde las {formatHora(new Date(solicitud.desde))}</p>
          <p>Tu supervisor ya fue avisado. Cuando termines, checa tu salida.</p>
        </div>
      </div>
    );
  }
  if (solicitud?.estado === 'por_aprobar') {
    return (
      <div className="flex gap-3 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
        <Clock className="mt-0.5 size-5 shrink-0" />
        <p>
          Tus horas extra{solicitud.minutos ? ` (${duracionExtra(solicitud.minutos)})` : ''} las revisa tu supervisor.
        </p>
      </div>
    );
  }
  if (!extra.preguntar || dentroDelSitio === false) return null;
  // Ya marcó su salida: sin saber dónde está no se puede preguntar.
  if (extra.requiereUbicacion && dentroDelSitio === null) return null;

  const no = () => {
    try {
      sessionStorage.setItem(claveNo(extra.entradaId), '1');
    } catch {
      // Sin almacenamiento: solo se recuerda mientras la pantalla esté abierta.
    }
    setDijoNo(true);
  };

  return (
    <>
      {dijoNo && (
        <Button
          variant="secondary"
          fullWidth
          icon={<Timer className="size-4" />}
          loading={extender.isPending}
          onClick={() => extender.mutate()}
        >
          Extender mi horario
        </Button>
      )}
      <Modal
        open={!dijoNo}
        onClose={no}
        title="¿Sigues en turno?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={no} disabled={extender.isPending}>
              No, ya terminé
            </Button>
            <Button onClick={() => extender.mutate()} loading={extender.isPending}>
              Sí, sigo aquí
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Tu hora de salida era a las {fin}; si te quedas más tiempo, se registra como horas extra y tu
          supervisor las revisa.
        </p>
      </Modal>
    </>
  );
}
