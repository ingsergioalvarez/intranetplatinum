import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, MapPin, ShieldAlert } from 'lucide-react';
import {
  CONCLUSION_INCIDENCIA_LABEL,
  MOTIVOS_GRAVES,
  MOTIVO_INCIDENCIA_LABEL,
  TIPO_MARCACION_LABEL,
  type ConclusionIncidencia,
  type IncidenciaRostro,
} from '@platinum/shared';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  FormField,
  Modal,
  Spinner,
  Textarea,
  VisorFotos,
  cn,
  toast,
} from '../../components/ui';
import { formatFechaHora } from '../../core/format/fechas';
import { asistenciaService } from './asistencia.service';
import { formatDia, formatHora } from './formato';

/** Rojo para los graves (pantalla, rostro de otro, registro duplicado); naranja los demás. */
export function MotivoIncidencia({ motivo }: { motivo: IncidenciaRostro['motivo'] }) {
  const grave = MOTIVOS_GRAVES.includes(motivo);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-semibold',
        grave ? 'text-red-700' : 'text-amber-700',
      )}
    >
      <span className={cn('size-2 rounded-full', grave ? 'bg-red-500' : 'bg-amber-400')} />
      {MOTIVO_INCIDENCIA_LABEL[motivo]}
    </span>
  );
}

/** Falsa alarma en verde, confirmada en rojo (DA-35). */
function Conclusion({ conclusion }: { conclusion: ConclusionIncidencia | null }) {
  if (!conclusion) return null;
  return (
    <Badge tone={conclusion === 'confirmada' ? 'danger' : 'success'}>
      {CONCLUSION_INCIDENCIA_LABEL[conclusion]}
    </Badge>
  );
}

const cuando = (i: IncidenciaRostro) => `${formatDia(i.creadaEn)} · ${formatHora(i.creadaEn)}`;
const queMarca = (i: IncidenciaRostro) =>
  i.tipoMarca ? TIPO_MARCACION_LABEL[i.tipoMarca] : 'Registro de rostro';

/** Detalle: foto del intento junto al rostro registrado, nota y conclusión (falsa alarma / confirmada). */
export function IncidenciaModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nota, setNota] = useState('');
  const [viendo, setViendo] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState<ConclusionIncidencia | null>(null);
  const detalle = useQuery({
    queryKey: asistenciaService.keys.incidencia(id ?? 0),
    queryFn: () => asistenciaService.incidencia(id!),
    enabled: id !== null,
  });
  const revisar = useMutation({
    mutationFn: (conclusion: ConclusionIncidencia) =>
      asistenciaService.revisarIncidencia(id!, conclusion, nota.trim()),
    onSuccess: (r) => {
      toast.success(
        r.conclusion === 'confirmada'
          ? 'Incidencia cerrada como confirmada: quedó en rojo en el historial del guardia'
          : 'Incidencia cerrada como falsa alarma: quedó en verde en el historial del guardia',
      );
      setConfirmando(null);
      setNota('');
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo marcar como revisada'),
  });
  const i = detalle.data;

  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      size="md"
      title={i ? `${queMarca(i)} · ${cuando(i)}` : 'Incidencia'}
      footer={
        i && (
          <>
            <Link
              to={`/asistencia/guardias/${i.guardia.id}?mes=${i.creadaEn.slice(0, 7)}&vista=bitacora&cat=incidencias`}
              className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
            >
              Ver guardia
            </Link>
            {!i.revisadaEn && (
              <>
                <Button
                  variant="secondary"
                  icon={<CircleCheck className="size-4" />}
                  disabled={revisar.isPending}
                  onClick={() => setConfirmando('falsa_alarma')}
                >
                  Falsa alarma
                </Button>
                <Button
                  variant="danger"
                  icon={<ShieldAlert className="size-4" />}
                  disabled={revisar.isPending}
                  onClick={() => setConfirmando('confirmada')}
                >
                  Confirmada
                </Button>
              </>
            )}
          </>
        )
      }
    >
      {detalle.isPending ? (
        <div className="flex justify-center py-10 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : detalle.isError || !i ? (
        <EmptyState
          title="Esa incidencia ya no está disponible"
          description="Pudo haberla atendido o eliminado alguien más. Búscala en la lista de incidencias."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <figure className="space-y-1.5">
              <button
                type="button"
                onClick={() => setViendo(0)}
                aria-label="Ver la foto del intento"
                className="w-full"
              >
                <img
                  src={i.foto}
                  alt="Foto del intento"
                  className="aspect-[3/4] w-full -scale-x-100 rounded-xl object-cover ring-2 ring-red-300"
                />
              </button>
              <figcaption className="text-center text-xs text-slate-500">Intento</figcaption>
            </figure>
            <figure className="space-y-1.5">
              {i.rostroRegistrado ? (
                <button
                  type="button"
                  onClick={() => setViendo(1)}
                  aria-label="Ver el rostro registrado"
                  className="w-full"
                >
                  <img
                    src={i.rostroRegistrado}
                    alt="Rostro registrado"
                    className="aspect-[3/4] w-full -scale-x-100 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                </button>
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-500">
                  Sin rostro registrado
                </div>
              )}
              <figcaption className="text-center text-xs text-slate-500">
                {i.guardia.nombre} (registrado)
              </figcaption>
            </figure>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-slate-500">Motivo:</dt>
              <dd>
                <MotivoIncidencia motivo={i.motivo} />
                {i.rostroDe && <span className="text-slate-700"> · la cara es de {i.rostroDe.nombre}</span>}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-500">Guardia:</dt>
              <dd className="text-slate-900">{i.guardia.nombre}</dd>
            </div>
            {i.sitio && (
              <div className="flex items-center gap-2">
                <dt className="text-slate-500">Sitio:</dt>
                <dd className="flex items-center gap-1 text-slate-900">
                  <MapPin className="size-3.5" /> {i.sitio.nombre}
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-slate-500">Fecha:</dt>
              <dd className="text-slate-900">{formatFechaHora(i.creadaEn)}</dd>
            </div>
          </dl>

          {i.revisadaEn ? (
            <div
              className={cn(
                'space-y-1 rounded-lg p-3 text-sm',
                i.conclusion === 'confirmada' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800',
              )}
            >
              <Conclusion conclusion={i.conclusion} />
              <p>
                Revisada por {i.revisadaPor} · {formatFechaHora(i.revisadaEn)}
              </p>
              {i.nota && <p className="font-medium">“{i.nota}”</p>}
            </div>
          ) : (
            <FormField label="Nota (opcional)">
              <Textarea
                rows={2}
                value={nota}
                maxLength={255}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej. Se habló con el guardia, era una prueba…"
              />
            </FormField>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmando !== null}
        title={confirmando === 'confirmada' ? '¿Marcar como confirmada?' : '¿Marcar como falsa alarma?'}
        variant={confirmando === 'confirmada' ? 'danger' : 'primary'}
        confirmLabel={confirmando === 'confirmada' ? 'Sí, confirmada' : 'Sí, falsa alarma'}
        loading={revisar.isPending}
        onCancel={() => setConfirmando(null)}
        onConfirm={() => confirmando && revisar.mutate(confirmando)}
        description={
          <div className="space-y-2">
            {confirmando === 'confirmada' ? (
              <p>
                Significa que <strong>sí hubo un problema real</strong>, por ejemplo que otra persona intentó
                marcar por el guardia o que el rostro no era el suyo.
              </p>
            ) : (
              <p>
                Significa que <strong>no hubo problema</strong>: era el guardia y la cámara o el gesto
                fallaron.
              </p>
            )}
            <ul className="list-disc space-y-1 pl-5">
              <li>La incidencia se cierra y deja de salir como "sin atender".</li>
              <li>
                Queda {confirmando === 'confirmada' ? 'en rojo' : 'en verde'} en el historial del guardia con
                tu nombre y la hora.
              </li>
              {nota.trim() && <li>Se guarda tu nota: “{nota.trim()}”.</li>}
              <li>No se puede deshacer.</li>
            </ul>
          </div>
        }
      />
      {i && (
        <VisorFotos
          fotos={[
            { url: i.foto, titulo: 'Intento' },
            ...(i.rostroRegistrado
              ? [{ url: i.rostroRegistrado, titulo: `${i.guardia.nombre} (registrado)` }]
              : []),
          ]}
          indice={viendo}
          onClose={() => setViendo(null)}
          espejo
        />
      )}
    </Modal>
  );
}
