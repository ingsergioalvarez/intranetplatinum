import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, HandHelping, X } from 'lucide-react';
import {
  ESTADO_SOLICITUD_LABEL,
  MOTIVOS_CANCELAR_SOLICITUD,
  MOTIVO_CANCELAR_SOLICITUD_LABEL,
  ROLES,
  cancelarSolicitudSchema,
  type EstadoSolicitud,
  type MotivoCancelarSolicitud,
  type SolicitudCobertura,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, EmptyState, FormModal, Spinner, toast, type BadgeTone } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { formatFecha, formatFechaHora } from '../../core/format/fechas';
import { Chips } from '../asistencia/BitacoraGuardia';
import { MotivoLista } from '../asistencia/MotivoLista';
import { solicitudesService } from './solicitudes.service';

const TONO: Record<EstadoSolicitud, BadgeTone> = { pendiente: 'warning', atendida: 'success', cancelada: 'neutral' };

/**
 * Solicitudes de cobertura (A-39, completa A-26): lo que un supervisor pide al admin cuando necesita un guardia
 * de otro supervisor. El admin las atiende desde el calendario del sitio (se cierran solas al asignar); el
 * supervisor ve solo las suyas y puede cancelarlas.
 */
export function SolicitudesPage() {
  const esAdmin = useAuthStore((s) => s.user?.rol === ROLES.ADMIN);
  const [filtro, setFiltro] = useState<'pendientes' | 'todas'>('pendientes');
  const [cancelando, setCancelando] = useState<SolicitudCobertura | null>(null);
  const lista = useQuery({
    queryKey: solicitudesService.keys.lista,
    queryFn: solicitudesService.lista,
    refetchInterval: 60_000,
  });
  const items = (lista.data?.items ?? []).filter((s) => filtro === 'todas' || s.estado === 'pendiente');

  return (
    <>
      <Link to="/asistencia" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500">
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader
        title="Solicitudes de cobertura"
        subtitle={esAdmin ? 'Guardias que piden los supervisores para sus sitios' : 'Los guardias que pediste para tus sitios'}
      />
      <div className="mb-4">
        <Chips
          label="Estado"
          todas="Pendientes"
          opciones={[['todas', 'Todas'] as const]}
          valor={filtro === 'todas' ? 'todas' : null}
          onChange={(v) => setFiltro(v === 'todas' ? 'todas' : 'pendientes')}
        />
      </div>

      {lista.isPending ? (
        <div className="flex justify-center py-12 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : lista.isError ? (
        <EmptyState title="No se pudo cargar" description="Revisa tu conexión e intenta de nuevo." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<HandHelping className="size-10" />}
          title={filtro === 'pendientes' ? 'Sin solicitudes pendientes' : 'Sin solicitudes'}
          description={
            esAdmin
              ? 'Cuando un supervisor pida un guardia de otro supervisor aparecerá aquí.'
              : 'Se crean cuando mandas a casa a un guardia, el sitio queda solo y pides uno de otro supervisor.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <li key={s.id}>
              <Tarjeta solicitud={s} esAdmin={esAdmin} onCancelar={() => setCancelando(s)} />
            </li>
          ))}
        </ul>
      )}
      {cancelando && <CancelarModal solicitud={cancelando} onClose={() => setCancelando(null)} />}
    </>
  );
}

function Tarjeta({
  solicitud: s,
  esAdmin,
  onCancelar,
}: {
  solicitud: SolicitudCobertura;
  esAdmin: boolean;
  onCancelar: () => void;
}) {
  const pendiente = s.estado === 'pendiente';
  return (
    <Card className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-semibold text-slate-900">{s.sitio.nombre}</p>
        <Badge tone={TONO[s.estado]}>{ESTADO_SOLICITUD_LABEL[s.estado]}</Badge>
        <span className="text-sm text-slate-500">Para el {formatFecha(s.fecha)}</span>
      </div>
      <p className="text-sm text-slate-700">
        {esAdmin && (
          <>
            Pide <strong>{s.solicitante.nombre}</strong> ·{' '}
          </>
        )}
        {s.guardia ? `Por ${s.guardia.nombre}. ` : ''}Motivo: {s.motivo}
      </p>
      <p className="text-xs text-slate-500">Creada el {formatFechaHora(s.createdAt)}</p>
      {!pendiente && s.cerradaEn && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <strong>{ESTADO_SOLICITUD_LABEL[s.estado]}</strong>
          {s.cerradaPor ? ` por ${s.cerradaPor}` : ''} · {formatFechaHora(s.cerradaEn)}
          {s.resolucion && <span className="block">{s.resolucion}</span>}
        </p>
      )}
      {pendiente && (
        <div className="flex flex-wrap gap-2 pt-1">
          {esAdmin && (
            <Link
              to={`/asistencia/calendario?sitio=${s.sitio.id}&mes=${s.fecha.slice(0, 7)}&dia=${s.fecha}`}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
            >
              <CalendarDays className="size-4" /> Elegir quién cubre
            </Link>
          )}
          <Button variant="secondary" icon={<X className="size-4" />} onClick={onCancelar}>
            Cancelar solicitud
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Cancelar una solicitud: motivo de lista; con "otro", el detalle es obligatorio. */
function CancelarModal({ solicitud, onClose }: { solicitud: SolicitudCobertura; onClose: () => void }) {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<MotivoCancelarSolicitud | ''>('');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});

  const cancelar = useMutation({
    mutationFn: () =>
      solicitudesService.cancelar(solicitud.id, {
        categoria: categoria as MotivoCancelarSolicitud,
        nota: nota.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: solicitudesService.keys.all });
      void qc.invalidateQueries({ queryKey: ['avisos'] });
      toast.success('Solicitud cancelada');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const onSubmit = () => {
    const r = cancelarSolicitudSchema.safeParse({ categoria: categoria || undefined, nota: nota.trim() || undefined });
    if (!r.success) return setErrores(erroresDeCampos(r.error));
    setErrores({});
    cancelar.mutate();
  };

  return (
    <FormModal
      title="Cancelar la solicitud"
      description={`${solicitud.sitio.nombre} · ${formatFecha(solicitud.fecha)}`}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Cancelar solicitud"
      loading={cancelar.isPending}
      dirty={!!categoria || !!nota}
      size="sm"
    >
      <MotivoLista
        categorias={MOTIVOS_CANCELAR_SOLICITUD}
        etiquetas={MOTIVO_CANCELAR_SOLICITUD_LABEL}
        categoria={categoria}
        nota={nota}
        onCategoria={setCategoria}
        onNota={setNota}
        errores={errores}
      />
    </FormModal>
  );
}
