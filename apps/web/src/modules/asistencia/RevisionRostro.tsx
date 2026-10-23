import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { ESTADO_ROSTRO_LABEL, type EstadoRostro, type RostroRegistro } from '@platinum/shared';
import {
  Badge,
  Button,
  FormField,
  Modal,
  Textarea,
  VisorFotos,
  toast,
  type BadgeTone,
} from '../../components/ui';
import { formatFechaHora } from '../../core/format/fechas';
import { asistenciaService } from './asistencia.service';

const TONO: Record<EstadoRostro, BadgeTone> = {
  pendiente: 'warning',
  aprobado: 'success',
  rechazado: 'danger',
};

/** Estado del rostro como etiqueta de color. */
export function EstadoRostroBadge({ estado }: { estado: EstadoRostro }) {
  return <Badge tone={TONO[estado]}>{ESTADO_ROSTRO_LABEL[estado]}</Badge>;
}

/**
 * Fotos de un registro de rostro, quién y cuándo, y (si está pendiente) Aprobar / Rechazar.
 * Se usa en "Rostros por revisar" y en la ventana "Rostro" de cada guardia.
 */
export function RevisionRostro({
  guardia,
  rostro,
  puedeRevisar,
}: {
  guardia: { id: number; nombre: string };
  rostro: RostroRegistro;
  puedeRevisar: boolean;
}) {
  const qc = useQueryClient();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [viendo, setViendo] = useState<number | null>(null);

  const refrescar = () => qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
  const aprobar = useMutation({
    mutationFn: () => asistenciaService.aprobarRostro(guardia.id),
    onSuccess: () => {
      toast.success(`Rostro de ${guardia.nombre} aprobado`);
      void refrescar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo aprobar'),
  });
  const rechazar = useMutation({
    mutationFn: () => asistenciaService.rechazarRostro(guardia.id, motivo),
    onSuccess: () => {
      toast.success(`Rostro de ${guardia.nombre} rechazado`);
      setRechazando(false);
      void refrescar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo rechazar'),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <EstadoRostroBadge estado={rostro.estado} />
        <span className="text-slate-600">
          {rostro.autoregistro ? 'Lo registró el guardia' : `Registrado por ${rostro.registradoPor}`} ·{' '}
          {formatFechaHora(rostro.registradoEn)}
        </span>
      </div>
      <ul className="grid grid-cols-5 gap-1.5" aria-label="Fotos del registro">
        {rostro.fotos.map((url, i) => (
          <li key={url}>
            <button
              type="button"
              onClick={() => setViendo(i)}
              aria-label={`Ver foto ${i + 1}`}
              className="w-full"
            >
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className="aspect-[3/4] w-full -scale-x-100 rounded-lg object-cover ring-1 ring-slate-200"
              />
            </button>
          </li>
        ))}
      </ul>
      <VisorFotos
        fotos={rostro.fotos.map((url, i) => ({
          url,
          titulo: `Registro de ${guardia.nombre} · foto ${i + 1}`,
        }))}
        indice={viendo}
        onClose={() => setViendo(null)}
        espejo
      />
      {rostro.estado === 'rechazado' && rostro.motivoRechazo && (
        <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">Motivo: {rostro.motivoRechazo}</p>
      )}
      {rostro.revisadoPor && rostro.estado !== 'pendiente' && (
        <p className="text-xs text-slate-500">
          Revisado por {rostro.revisadoPor} · {formatFechaHora(rostro.revisadoEn)}
        </p>
      )}
      {puedeRevisar && rostro.estado === 'pendiente' && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            icon={<X className="size-4" />}
            disabled={aprobar.isPending}
            onClick={() => setRechazando(true)}
          >
            Rechazar
          </Button>
          <Button
            icon={<Check className="size-4" />}
            loading={aprobar.isPending}
            onClick={() => aprobar.mutate()}
          >
            Aprobar
          </Button>
        </div>
      )}

      <Modal
        open={rechazando}
        onClose={() => setRechazando(false)}
        size="sm"
        title={`Rechazar rostro de ${guardia.nombre}`}
        description="El guardia verá el motivo y deberá registrarse de nuevo al marcar."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRechazando(false)} disabled={rechazar.isPending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={motivo.trim().length < 3}
              loading={rechazar.isPending}
              onClick={() => rechazar.mutate()}
            >
              Rechazar
            </Button>
          </>
        }
      >
        <FormField label="Motivo">
          <Textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. No es la persona, foto borrosa, con lentes oscuros…"
          />
        </FormField>
      </Modal>
    </div>
  );
}
