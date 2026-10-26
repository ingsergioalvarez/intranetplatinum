import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, FilePlus2, MessageSquare, Navigation, Send } from 'lucide-react';
import {
  ESTATUS_REPORTE_LABEL,
  MAX_FOTOS_REPORTE,
  type BandejaAvisos,
  type EstatusReporte,
  type ReporteDetalle,
} from '@platinum/shared';
import { ApiError, api, mensajeDeError } from '../../core/api';
import { formatFechaHora } from '../../core/format/fechas';
import { mapsUrl } from '../../core/format/mapas';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  FormField,
  PhotoUploader,
  Select,
  Spinner,
  Textarea,
  toast,
} from '../../components/ui';
import { nombreCategoria } from './categoriaIconos';
import { EstatusBadge, PrioridadBadge } from './etiquetas';
import { Galeria } from './Galeria';
import { reportesService } from './reportes.service';

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800">{children}</dd>
    </div>
  );
}

/** Detalle del reporte y su seguimiento en línea de tiempo (F3-05). */
export function ReporteDetallePage() {
  const qc = useQueryClient();
  const id = Number(useParams().id);
  const detalle = useQuery({
    queryKey: reportesService.keys.detail(id),
    queryFn: () => reportesService.detalle(id),
    enabled: Number.isInteger(id),
  });

  const avisos = useQuery({
    queryKey: ['avisos'],
    queryFn: () => api.get<BandejaAvisos>('/avisos'),
  });

  useEffect(() => {
    if (!avisos.data?.items || !Number.isInteger(id)) return;
    const sinLeer = avisos.data.items.filter((a) => !a.leido && a.reporteId === id);
    if (sinLeer.length > 0) {
      Promise.all(sinLeer.map((a) => api.patch(`/avisos/${a.id}/leido`)))
        .then(() => qc.invalidateQueries({ queryKey: ['avisos'] }))
        .catch(() => undefined);
    }
  }, [avisos.data, id, qc]);

  if (detalle.isPending) {
    return (
      <div className="flex justify-center py-16 text-brand-600">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (detalle.isError) {
    const noExiste = detalle.error instanceof ApiError && detalle.error.status === 404;
    return (
      <EmptyState
        title={noExiste ? 'Reporte no encontrado' : 'No se pudo cargar el reporte'}
        description={noExiste ? 'No existe o no tienes acceso a él.' : 'Revisa tu conexión.'}
        action={
          <Link to="/reportes" className="text-sm font-medium text-brand-700">
            Volver a reportes
          </Link>
        }
      />
    );
  }

  const r = detalle.data;
  return (
    <div className="mx-auto max-w-6xl">
      <Link
        to="/reportes"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ChevronLeft className="size-4" /> Reportes
      </Link>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-wider text-slate-900">{r.folio}</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500">{formatFechaHora(r.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <PrioridadBadge prioridad={r.prioridad} />
            <EstatusBadge estatus={r.estatus} />
          </div>
        </div>
        <h1 className="mt-2.5 text-lg font-bold text-slate-900 sm:text-xl md:text-2xl">{r.titulo}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Columna Izquierda: Ficha Técnica y Evidencias (7 de 12) */}
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader title="Datos del Inmueble y Turno" />
            <div className="p-4 pt-2">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3">
                <Dato label="Sitio">
                  <span className="font-semibold text-slate-900">{r.sitio.nombre}</span>
                  <span className="block text-xs text-slate-500">{r.cliente.nombreComercial}</span>
                </Dato>
                <Dato label="Categoría">
                  <span className="font-medium text-slate-900">{nombreCategoria(r.categoria)}</span>
                </Dato>
                <Dato label="Reportó">
                  <span className="font-medium text-slate-900">{r.creadoPor.nombre}</span>
                </Dato>
                {r.ubicacionDetalle && (
                  <Dato label="Ubicación precisa">
                    <span className="text-slate-800">{r.ubicacionDetalle}</span>
                  </Dato>
                )}
                {r.cerradoEn && (
                  <Dato label="Fecha de cierre">
                    <span className="text-slate-800">{formatFechaHora(r.cerradoEn)}</span>
                  </Dato>
                )}
                {r.lat !== null && r.lng !== null && (
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">Ubicación GPS</dt>
                    <dd className="mt-0.5">
                      <a
                        href={mapsUrl(r.lat, r.lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800 underline-offset-2 hover:underline"
                      >
                        <Navigation className="size-3.5" /> Abrir en Google Maps
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader title="Descripción e Incidencia" />
            <div className="space-y-4 p-4 pt-2">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{r.descripcion}</p>

              <div className="border-t border-slate-100 pt-3.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Evidencias fotográficas ({r.evidencias.length})
                  </span>
                  <span className="text-[11px] text-slate-400">Toca para ampliar en alta resolución</span>
                </div>
                <Galeria fotos={r.evidencias} />
              </div>
            </div>
          </Card>
        </div>

        {/* Columna Derecha: Bitácora de Seguimiento y Actualización (5 de 12) */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="flex flex-col">
            <CardHeader
              title="Seguimiento Oficial"
              subtitle={
                r.seguimientos.length === 1
                  ? '1 actualización'
                  : `${r.seguimientos.length} actualizaciones`
              }
            />
            <div className="p-4 pt-2">
              <ol className="space-y-0">
                <EventoLinea
                  titulo={`${r.creadoPor.nombre} (Guardia)`}
                  fecha={r.createdAt}
                  icono={<FilePlus2 className="size-4" />}
                >
                  <p className="text-xs text-slate-600">Registró el reporte formalmente.</p>
                </EventoLinea>
                {r.seguimientos.map((s) => (
                  <EventoLinea
                    key={s.id}
                    titulo={s.usuario.nombre}
                    fecha={s.createdAt}
                    icono={<MessageSquare className="size-4" />}
                  >
                    {s.estatusNuevo && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-slate-600">
                        {s.estatusAnterior && <EstatusBadge estatus={s.estatusAnterior} />}
                        <ArrowRight className="size-3 text-slate-400" />
                        <EstatusBadge estatus={s.estatusNuevo} />
                      </div>
                    )}
                    {s.comentario && (
                      <p className="whitespace-pre-line text-xs leading-relaxed text-slate-800">
                        {s.comentario}
                      </p>
                    )}
                    <Galeria fotos={s.evidencias} compacta />
                  </EventoLinea>
                ))}
              </ol>
            </div>

            {(r.acciones.comentar || r.acciones.estatusPermitidos.length > 0) && (
              <FormSeguimiento reporte={r} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function EventoLinea({
  titulo,
  fecha,
  icono,
  children,
}: {
  titulo: string;
  fecha: string;
  icono: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      <span
        className="absolute left-4 top-8 -ml-px h-[calc(100%-2rem)] w-0.5 bg-slate-200 group-last:hidden"
        aria-hidden="true"
      />
      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-4 ring-white">
        {icono}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5 pt-1">
        <p className="text-sm">
          <span className="font-medium text-slate-900">{titulo}</span>
          <span className="ml-2 text-xs text-slate-500">{formatFechaHora(fecha)}</span>
        </p>
        {children}
      </div>
    </li>
  );
}

/** Comentario, fotos y (si tiene permiso) cambio de estatus. */
function FormSeguimiento({ reporte }: { reporte: ReporteDetalle }) {
  const qc = useQueryClient();
  const [comentario, setComentario] = useState('');
  const [estatus, setEstatus] = useState<EstatusReporte | ''>('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [error, setError] = useState<string | undefined>();
  const permitidos = reporte.acciones.estatusPermitidos;

  const enviar = useMutation({
    mutationFn: () =>
      reportesService.seguimiento(reporte.id, { comentario, estatus: estatus || undefined }, fotos),
    onSuccess: (r) => {
      qc.setQueryData(reportesService.keys.detail(reporte.id), r);
      void qc.invalidateQueries({ queryKey: reportesService.keys.all });
      void qc.invalidateQueries({ queryKey: ['avisos'] });
      setComentario('');
      setEstatus('');
      setFotos([]);
      toast.success('Seguimiento agregado');
    },
    onError: (e) => {
      const campos = e instanceof ApiError ? e.fieldErrors : {};
      setError(Object.values(campos)[0]);
      if (!Object.keys(campos).length) toast.error(mensajeDeError(e));
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comentario.trim() && !estatus && fotos.length === 0) {
      return setError('Escribe un comentario, agrega fotos o cambia el estatus');
    }
    setError(undefined);
    enviar.mutate();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 border-t border-slate-100 p-4">
      <FormField label="Agregar seguimiento" error={error}>
        <Textarea
          rows={3}
          value={comentario}
          maxLength={2000}
          placeholder="¿Qué se hizo o qué cambió?"
          onChange={(e) => {
            setComentario(e.target.value);
            setError(undefined);
          }}
        />
      </FormField>
      {reporte.acciones.comentar && (
        <PhotoUploader value={fotos} onChange={setFotos} max={MAX_FOTOS_REPORTE} />
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        {permitidos.length > 0 && (
          <FormField label="Cambiar estatus" className="md:w-64">
            <Select
              options={permitidos.map((e) => ({ value: e, label: ESTATUS_REPORTE_LABEL[e] }))}
              placeholder="Sin cambio"
              value={estatus}
              onChange={(e) => setEstatus(e.target.value as EstatusReporte | '')}
            />
          </FormField>
        )}
        <Button
          type="submit"
          icon={<Send className="size-4" />}
          loading={enviar.isPending}
          className="md:ml-auto"
        >
          Enviar
        </Button>
      </div>
    </form>
  );
}
