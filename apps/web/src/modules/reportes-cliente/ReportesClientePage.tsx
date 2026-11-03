import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareWarning, Plus } from 'lucide-react';
import {
  ESTATUS_REPORTE_CLIENTE_LABEL,
  ROLES,
  TIPO_REPORTE_CLIENTE_LABEL,
  atenderReporteClienteSchema,
  type EstatusReporteCliente,
  type ReporteCliente,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, EmptyState, FormField, FormModal, Spinner, Textarea, toast, type BadgeTone } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { formatFechaHora } from '../../core/format/fechas';
import { Chips } from '../asistencia/BitacoraGuardia';
import { ReporteClienteModal } from './ReporteClienteModal';
import { reportesClienteService } from './reportesCliente.service';

const TONO: Record<EstatusReporteCliente, BadgeTone> = { abierto: 'warning', en_revision: 'info', resuelto: 'success' };

/**
 * Reportes del cliente sobre el servicio o un guardia (A-59). El cliente levanta los suyos y ve la respuesta; el
 * supervisor del sitio y el administrador los toman a revisión o los resuelven.
 */
export function ReportesClientePage() {
  const user = useAuthStore((s) => s.user)!;
  const esCliente = user.rol === ROLES.CLIENTE;
  const [filtro, setFiltro] = useState<'pendientes' | 'todos'>('pendientes');
  const [creando, setCreando] = useState(false);
  const [atendiendo, setAtendiendo] = useState<ReporteCliente | null>(null);
  const qc = useQueryClient();

  const lista = useQuery({
    queryKey: reportesClienteService.keys.lista,
    queryFn: reportesClienteService.lista,
    refetchInterval: 60_000,
  });
  const items = (lista.data?.items ?? []).filter((r) => filtro === 'todos' || r.estatus !== 'resuelto');

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: reportesClienteService.keys.all });
    void qc.invalidateQueries({ queryKey: ['avisos'] });
  };

  const tomar = useMutation({
    mutationFn: (r: ReporteCliente) => reportesClienteService.atender(r.id, { estatus: 'en_revision' }),
    onSuccess: () => {
      refrescar();
      toast.success('Lo tomaste a revisión: se le avisó al cliente');
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  return (
    <>
      <PageHeader
        title={esCliente ? 'Mis reportes' : 'Reportes de clientes'}
        subtitle={
          esCliente
            ? 'Reporta algo del servicio o de un guardia y consulta la respuesta'
            : 'Lo que reportan los clientes del servicio y de sus guardias'
        }
        actions={
          esCliente && (
            <Button icon={<Plus className="size-4" />} onClick={() => setCreando(true)}>
              Nuevo reporte
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Chips
          label="Estado"
          todas="Pendientes"
          opciones={[['todos', 'Todos'] as const]}
          valor={filtro === 'todos' ? 'todos' : null}
          onChange={(v) => setFiltro(v === 'todos' ? 'todos' : 'pendientes')}
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
          icon={<MessageSquareWarning className="size-10" />}
          title={filtro === 'pendientes' ? 'Nada pendiente' : 'Sin reportes'}
          description={
            esCliente
              ? 'Cuando reportes algo del servicio aparecerá aquí con su respuesta.'
              : 'Cuando un cliente reporte algo aparecerá aquí.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id}>
              <Tarjeta
                reporte={r}
                esCliente={esCliente}
                tomando={tomar.isPending && tomar.variables?.id === r.id}
                onTomar={() => tomar.mutate(r)}
                onResolver={() => setAtendiendo(r)}
              />
            </li>
          ))}
        </ul>
      )}

      {creando && <ReporteClienteModal onClose={() => setCreando(false)} />}
      {atendiendo && <ResolverModal reporte={atendiendo} onClose={() => setAtendiendo(null)} onListo={refrescar} />}
    </>
  );
}

function Tarjeta({
  reporte: r,
  esCliente,
  tomando,
  onTomar,
  onResolver,
}: {
  reporte: ReporteCliente;
  esCliente: boolean;
  tomando: boolean;
  onTomar: () => void;
  onResolver: () => void;
}) {
  const pendiente = r.estatus !== 'resuelto';
  return (
    <Card className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 break-words font-semibold text-slate-900">{r.asunto}</p>
        {r.urgente && pendiente && <Badge tone="danger">Urgente</Badge>}
        <Badge tone={TONO[r.estatus]}>{ESTATUS_REPORTE_CLIENTE_LABEL[r.estatus]}</Badge>
      </div>
      <p className="text-sm text-slate-600">
        {TIPO_REPORTE_CLIENTE_LABEL[r.tipo]}
        {r.guardia ? `: ${r.guardia.nombre}` : ''} · {r.sitio.nombre}
        {!esCliente && ` · ${r.cliente.nombreComercial}`}
      </p>
      <p className="whitespace-pre-line text-sm text-slate-800">{r.descripcion}</p>
      <p className="text-xs text-slate-500">
        {esCliente ? 'Enviado' : `Lo envió ${r.creadoPor.nombre}`} · {formatFechaHora(r.createdAt)}
      </p>
      {r.atendidoEn && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <strong>{ESTATUS_REPORTE_CLIENTE_LABEL[r.estatus]}</strong>
          {r.atendidoPor && !esCliente ? ` por ${r.atendidoPor}` : ''} · {formatFechaHora(r.atendidoEn)}
          {r.respuesta && <span className="block whitespace-pre-line">{r.respuesta}</span>}
        </p>
      )}
      {!esCliente && pendiente && (
        <div className="flex flex-wrap gap-2 pt-1">
          {r.estatus === 'abierto' && (
            <Button variant="secondary" loading={tomando} onClick={onTomar}>
              Tomar a revisión
            </Button>
          )}
          <Button onClick={onResolver}>Resolver</Button>
        </div>
      )}
    </Card>
  );
}

/** Resolver exige decir qué se hizo: es lo que lee el cliente. */
function ResolverModal({ reporte, onClose, onListo }: { reporte: ReporteCliente; onClose: () => void; onListo: () => void }) {
  const [respuesta, setRespuesta] = useState('');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});
  const resolver = useMutation({
    mutationFn: () => reportesClienteService.atender(reporte.id, { estatus: 'resuelto', respuesta: respuesta.trim() }),
    onSuccess: () => {
      onListo();
      toast.success('Reporte resuelto: se le avisó al cliente');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });
  const onSubmit = () => {
    const r = atenderReporteClienteSchema.safeParse({ estatus: 'resuelto', respuesta: respuesta.trim() });
    if (!r.success) return setErrores(erroresDeCampos(r.error));
    setErrores({});
    resolver.mutate();
  };
  return (
    <FormModal
      title="Resolver el reporte"
      description={`${reporte.asunto} · ${reporte.cliente.nombreComercial}`}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Resolver"
      loading={resolver.isPending}
      dirty={!!respuesta}
      size="sm"
    >
      <FormField label="¿Qué se hizo?" required error={errores.respuesta} hint="Es lo que lee el cliente.">
        <Textarea rows={4} maxLength={500} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
      </FormField>
    </FormModal>
  );
}
