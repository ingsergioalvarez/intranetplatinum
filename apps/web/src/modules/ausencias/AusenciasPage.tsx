import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarOff, Check, FileImage, Plus, X } from 'lucide-react';
import {
  ESTADO_AUSENCIA_LABEL,
  MOTIVOS_CANCELAR_AUSENCIA,
  MOTIVOS_RECHAZAR_AUSENCIA,
  MOTIVO_CANCELAR_AUSENCIA_LABEL,
  MOTIVO_RECHAZAR_AUSENCIA_LABEL,
  TIPO_AUSENCIA_LABEL,
  cancelarAusenciaSchema,
  resolverAusenciaSchema,
  type Ausencia,
  type EstadoAusencia,
  type MotivoCancelarAusencia,
  type MotivoRechazarAusencia,
  PERMISOS,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FormModal,
  Spinner,
  VisorFotos,
  toast,
  type BadgeTone,
} from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { useAuthStore, hasPermission } from '../../core/auth/authStore';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { formatFecha, formatFechaHora, hoyLocal } from '../../core/format/fechas';
import { Chips } from '../asistencia/BitacoraGuardia';
import { MotivoLista } from '../asistencia/MotivoLista';
import { AusenciaModal } from './AusenciaModal';
import { ausenciasService } from './ausencias.service';

const TONO: Record<EstadoAusencia, BadgeTone> = {
  pendiente: 'warning',
  aprobada: 'success',
  rechazada: 'danger',
  cancelada: 'neutral',
};

/**
 * Ausencias justificadas por adelantado (A-43). El admin las registra y aprueba; el supervisor pide la de un
 * guardia suyo y ve las de sus guardias; el guardia pide las suyas ("Mis ausencias").
 */
export function AusenciasPage({ propias = false }: { propias?: boolean }) {
  const user = useAuthStore((s) => s.user)!;
  const puedeResolver = hasPermission(user, PERMISOS.AUSENCIAS_RESOLVER);
  const [filtro, setFiltro] = useState<'pendientes' | 'todas'>('pendientes');
  const [pidiendo, setPidiendo] = useState(false);
  const [rechazando, setRechazando] = useState<Ausencia | null>(null);
  const [cancelando, setCancelando] = useState<Ausencia | null>(null);
  const [aprobando, setAprobando] = useState<Ausencia | null>(null);
  const [comprobante, setComprobante] = useState<string | null>(null);
  const qc = useQueryClient();

  const lista = useQuery({ queryKey: ausenciasService.keys.lista, queryFn: ausenciasService.lista, refetchInterval: 60_000 });
  const items = (lista.data?.items ?? []).filter((a) => filtro === 'todas' || a.estado === 'pendiente');

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: ausenciasService.keys.all });
    void qc.invalidateQueries({ queryKey: ['asistencia'] });
    void qc.invalidateQueries({ queryKey: ['cobertura'] });
    void qc.invalidateQueries({ queryKey: ['avisos'] });
  };

  const aprobar = useMutation({
    mutationFn: (a: Ausencia) => ausenciasService.resolver(a.id, { decision: 'aprobar' }),
    onSuccess: (a) => {
      refrescar();
      toast.success(
        a.faltasJustificadas > 0
          ? `Ausencia aprobada: se justificaron ${a.faltasJustificadas} ${a.faltasJustificadas === 1 ? 'falta' : 'faltas'}`
          : 'Ausencia aprobada',
      );
      setAprobando(null);
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  return (
    <>
      {!propias && (
        <Link to="/asistencia" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500">
          <ArrowLeft className="size-4" /> Asistencia
        </Link>
      )}
      <PageHeader
        title={propias ? 'Mis ausencias' : 'Ausencias'}
        subtitle={
          propias
            ? 'Vacaciones, incapacidades y permisos que pides al administrador'
            : puedeResolver
              ? 'Vacaciones, incapacidades y permisos de los guardias'
              : 'Las ausencias de tus guardias; tú las pides y el administrador las aprueba'
        }
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setPidiendo(true)}>
            {puedeResolver ? 'Registrar ausencia' : 'Pedir ausencia'}
          </Button>
        }
      />
      <div className="mb-4">
        <Chips
          label="Estado"
          todas="Por aprobar"
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
          icon={<CalendarOff className="size-10" />}
          title={filtro === 'pendientes' ? 'Nada por aprobar' : 'Sin ausencias'}
          description={propias ? 'Cuando pidas una ausencia aparecerá aquí.' : 'Las solicitudes y los registros aparecerán aquí.'}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id}>
              <Tarjeta
                ausencia={a}
                puedeResolver={puedeResolver}
                propias={propias}
                miId={user.id}
                onAprobar={() => setAprobando(a)}
                onRechazar={() => setRechazando(a)}
                onCancelar={() => setCancelando(a)}
                onComprobante={() => setComprobante(a.comprobante)}
              />
            </li>
          ))}
        </ul>
      )}

      {pidiendo && <AusenciaModal onClose={() => setPidiendo(false)} />}
      {rechazando && <RechazarModal ausencia={rechazando} onClose={() => setRechazando(null)} onListo={refrescar} />}
      {cancelando && <CancelarModal ausencia={cancelando} onClose={() => setCancelando(null)} onListo={refrescar} />}
      <ConfirmDialog
        open={!!aprobando}
        title="Aprobar la ausencia"
        description={
          aprobando && (
            <>
              <strong>{aprobando.guardia.nombre}</strong> · {TIPO_AUSENCIA_LABEL[aprobando.tipo].toLowerCase()} del{' '}
              {formatFecha(aprobando.desde)} al {formatFecha(aprobando.hasta)}. Esos días no se le contarán como falta y
              las faltas que ya hubiera en ellos se justifican solas. Su sitio puede quedar sin cubrir.
            </>
          )
        }
        confirmLabel="Aprobar"
        loading={aprobar.isPending}
        onConfirm={() => aprobando && aprobar.mutate(aprobando)}
        onCancel={() => setAprobando(null)}
      />
      <VisorFotos fotos={comprobante ? [{ url: comprobante }] : []} indice={comprobante ? 0 : null} onClose={() => setComprobante(null)} />
    </>
  );
}

function Tarjeta({
  ausencia: a,
  puedeResolver,
  propias,
  miId,
  onAprobar,
  onRechazar,
  onCancelar,
  onComprobante,
}: {
  ausencia: Ausencia;
  puedeResolver: boolean;
  propias: boolean;
  miId: number;
  onAprobar: () => void;
  onRechazar: () => void;
  onCancelar: () => void;
  onComprobante: () => void;
}) {
  const hoy = hoyLocal();
  const pendiente = a.estado === 'pendiente';
  // Pendiente: quien la pidió o el admin; aprobada que no ha empezado: solo el admin.
  const puedeCancelar =
    (pendiente && (puedeResolver || a.solicitante.id === miId)) || (a.estado === 'aprobada' && puedeResolver && a.desde > hoy);
  return (
    <Card className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {!propias && <p className="font-semibold text-slate-900">{a.guardia.nombre}</p>}
        <Badge tone="brand">{TIPO_AUSENCIA_LABEL[a.tipo]}</Badge>
        <Badge tone={TONO[a.estado]}>{ESTADO_AUSENCIA_LABEL[a.estado]}</Badge>
      </div>
      <p className="text-sm text-slate-800">
        Del <strong>{formatFecha(a.desde)}</strong> al <strong>{formatFecha(a.hasta)}</strong> ({a.dias}{' '}
        {a.dias === 1 ? 'día' : 'días'})
      </p>
      {a.motivo && <p className="text-sm text-slate-700">Motivo: {a.motivo}</p>}
      <p className="text-xs text-slate-500">
        {a.solicitante.id === a.guardia.id ? 'La pidió el guardia' : `La pidió ${a.solicitante.nombre}`} ·{' '}
        {formatFechaHora(a.createdAt)}
      </p>
      {a.resueltaEn && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <strong>{ESTADO_AUSENCIA_LABEL[a.estado]}</strong>
          {a.resueltaPor ? ` por ${a.resueltaPor}` : ''} · {formatFechaHora(a.resueltaEn)}
          {a.resolucion && <span className="block">{a.resolucion}</span>}
          {a.estado === 'aprobada' && a.faltasJustificadas > 0 && (
            <span className="block">
              Justificó {a.faltasJustificadas} {a.faltasJustificadas === 1 ? 'falta' : 'faltas'} de esos días
            </span>
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {a.comprobante && (
          <Button variant="ghost" icon={<FileImage className="size-4" />} onClick={onComprobante}>
            Ver comprobante
          </Button>
        )}
        {pendiente && puedeResolver && (
          <>
            <Button icon={<Check className="size-4" />} onClick={onAprobar}>
              Aprobar
            </Button>
            <Button variant="secondary" onClick={onRechazar}>
              Rechazar
            </Button>
          </>
        )}
        {puedeCancelar && (
          <Button variant="secondary" icon={<X className="size-4" />} onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </Card>
  );
}

function RechazarModal({ ausencia, onClose, onListo }: { ausencia: Ausencia; onClose: () => void; onListo: () => void }) {
  const [categoria, setCategoria] = useState<MotivoRechazarAusencia | ''>('');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});
  const rechazar = useMutation({
    mutationFn: () =>
      ausenciasService.resolver(ausencia.id, {
        decision: 'rechazar',
        categoria: categoria as MotivoRechazarAusencia,
        nota: nota.trim() || undefined,
      }),
    onSuccess: () => {
      onListo();
      toast.success('Solicitud rechazada');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });
  const onSubmit = () => {
    const r = resolverAusenciaSchema.safeParse({ decision: 'rechazar', categoria: categoria || undefined, nota: nota.trim() || undefined });
    if (!r.success) return setErrores(erroresDeCampos(r.error));
    setErrores({});
    rechazar.mutate();
  };
  return (
    <FormModal
      title="Rechazar la solicitud"
      description={`${ausencia.guardia.nombre} · ${TIPO_AUSENCIA_LABEL[ausencia.tipo].toLowerCase()}`}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Rechazar"
      loading={rechazar.isPending}
      dirty={!!categoria || !!nota}
      size="sm"
    >
      <MotivoLista
        categorias={MOTIVOS_RECHAZAR_AUSENCIA}
        etiquetas={MOTIVO_RECHAZAR_AUSENCIA_LABEL}
        categoria={categoria}
        nota={nota}
        onCategoria={setCategoria}
        onNota={setNota}
        errores={errores}
      />
    </FormModal>
  );
}

function CancelarModal({ ausencia, onClose, onListo }: { ausencia: Ausencia; onClose: () => void; onListo: () => void }) {
  const [categoria, setCategoria] = useState<MotivoCancelarAusencia | ''>('');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});
  const cancelar = useMutation({
    mutationFn: () =>
      ausenciasService.cancelar(ausencia.id, { categoria: categoria as MotivoCancelarAusencia, nota: nota.trim() || undefined }),
    onSuccess: () => {
      onListo();
      toast.success('Ausencia cancelada');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });
  const onSubmit = () => {
    const r = cancelarAusenciaSchema.safeParse({ categoria: categoria || undefined, nota: nota.trim() || undefined });
    if (!r.success) return setErrores(erroresDeCampos(r.error));
    setErrores({});
    cancelar.mutate();
  };
  return (
    <FormModal
      title="Cancelar la ausencia"
      description={`${ausencia.guardia.nombre} · ${TIPO_AUSENCIA_LABEL[ausencia.tipo].toLowerCase()} del ${formatFecha(ausencia.desde)} al ${formatFecha(ausencia.hasta)}`}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Cancelar ausencia"
      loading={cancelar.isPending}
      dirty={!!categoria || !!nota}
      size="sm"
    >
      <MotivoLista
        categorias={MOTIVOS_CANCELAR_AUSENCIA}
        etiquetas={MOTIVO_CANCELAR_AUSENCIA_LABEL}
        categoria={categoria}
        nota={nota}
        onCategoria={setCategoria}
        onNota={setNota}
        errores={errores}
      />
    </FormModal>
  );
}
