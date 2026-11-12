import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BatteryLow, MapPin, Siren } from 'lucide-react';
import { TIPO_EMERGENCIA_LABEL, type Emergencia } from '@platinum/shared';
import { Button, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { Llamadas } from '../emergencias/Llamadas';
import { RespuestasSos } from '../emergencias/RespuestasSos';
import { emergenciasService, enlaceMapa } from '../emergencias/emergencias.service';
import { RespuestaSosModal } from './RespuestaSosModal';
import { c2Service } from './c2.service';

const duracion = (desde: string, ahora: number) => {
  const s = Math.max(0, Math.floor((ahora - Date.parse(desde)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Emergencias activas (A-61): solo existe cuando hay una. Se queda en rojo hasta que se cierra, aunque ya la estén
 * atendiendo. El C2 puede responder "Estamos atendiendo" y le llega a quien la lanzó, al supervisor y al admin.
 */
export function SosC2({ emergencias, ahora }: { emergencias: Emergencia[]; ahora: number }) {
  const queryClient = useQueryClient();
  const [respondiendo, setRespondiendo] = useState<Emergencia | null>(null);
  const atender = useMutation({
    mutationFn: (id: number) => emergenciasService.acusar(id),
    onSuccess: () => {
      toast.success('Se avisó que la están atendiendo');
      void queryClient.invalidateQueries({ queryKey: c2Service.keys.all });
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  return (
    <div className="mb-4 grid grid-cols-1 gap-3" role="alert">
      {emergencias.map((e) => {
        const mapa = enlaceMapa(e);
        return (
          <div key={e.id} className="rounded-xl border-2 border-red-600 bg-red-100 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-2 text-lg font-bold text-red-700">
                <Siren className="size-5 animate-pulse" aria-hidden /> SOS
                {e.tipo && <span className="text-base font-semibold">· {TIPO_EMERGENCIA_LABEL[e.tipo]}</span>}
              </span>
              <span className="text-sm font-semibold text-red-900">
                {e.usuario.nombre}
                {e.sitio && ` · ${e.sitio.nombre}`}
              </span>
              <span className="ml-auto text-lg font-bold tabular-nums text-red-700">{duracion(e.createdAt, ahora)}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-red-900">
              {e.bateria != null && (
                <span className="inline-flex items-center gap-1">
                  <BatteryLow className="size-4" aria-hidden /> {e.bateria}%
                </span>
              )}
              {mapa && (
                <a href={mapa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline">
                  <MapPin className="size-4" aria-hidden /> Ver mapa
                </a>
              )}
            </div>
            <Llamadas contactos={e.contactos} className="mt-3" />
            <RespuestasSos respuestas={e.respuestas} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-red-900">
                {e.acusadaEn ? `La atiende ${e.acusadaPor}` : 'Nadie la ha recibido'}
                {e.escaladas > 0 && ` · se ha repetido ${e.escaladas} ${e.escaladas === 1 ? 'vez' : 'veces'}`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setRespondiendo(e)}>
                  Registrar respuesta
                </Button>
                {!e.acusadaEn && (
                  <Button variant="danger" onClick={() => atender.mutate(e.id)} loading={atender.isPending}>
                    Estamos atendiendo
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {respondiendo && <RespuestaSosModal emergencia={respondiendo} onClose={() => setRespondiendo(null)} />}
    </div>
  );
}
