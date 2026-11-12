import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Phone, Siren, Volume2 } from 'lucide-react';
import {
  RESULTADO_EMERGENCIA_LABEL,
  RESULTADOS_EMERGENCIA,
  TIPO_EMERGENCIA_LABEL,
  emergenciaCerrarSchema,
  type Emergencia,
  type ResultadoEmergencia,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, EmptyState, FormModal, Spinner, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { formatFechaHora } from '../../core/format/fechas';
import { Chips } from '../asistencia/BitacoraGuardia';
import { MotivoLista } from '../asistencia/MotivoLista';
import { Llamadas } from './Llamadas';
import { emergenciasService, enlaceMapa } from './emergencias.service';
import { probarSirena } from './sirena';

/** Emergencias (A-60): las alertas del botón de pánico, activas y el historial. Atenderlas y cerrarlas. */
export function EmergenciasPage() {
  const [filtro, setFiltro] = useState<'activas' | 'todas'>('activas');
  const [cerrando, setCerrando] = useState<Emergencia | null>(null);
  const qc = useQueryClient();
  const lista = useQuery({
    queryKey: filtro === 'activas' ? emergenciasService.keys.activas : emergenciasService.keys.todas,
    queryFn: () => emergenciasService.lista(filtro),
    refetchInterval: 10_000,
  });
  const acusar = useMutation({
    mutationFn: (id: number) => emergenciasService.acusar(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: emergenciasService.keys.all });
      void qc.invalidateQueries({ queryKey: ['avisos'] });
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });
  const items = lista.data?.items ?? [];

  return (
    <>
      <Link to="/asistencia" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500">
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader
        title="Emergencias"
        subtitle="Alertas del botón de pánico de guardias y supervisores"
        actions={
          <Button
            variant="secondary"
            icon={<Volume2 className="size-4" />}
            onClick={() =>
              probarSirena()
                ? toast.success('Si no la escuchaste, sube el volumen y revisa que no esté en silencio')
                : toast.error('El navegador bloqueó el sonido: toca la pantalla e inténtalo de nuevo')
            }
          >
            Probar sonido
          </Button>
        }
      />
      <div className="mb-4">
        <Chips
          label="Mostrar"
          todas="Activas"
          opciones={[['todas', 'Todas'] as const]}
          valor={filtro === 'todas' ? 'todas' : null}
          onChange={(v) => setFiltro(v === 'todas' ? 'todas' : 'activas')}
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
          icon={<Siren className="size-10" />}
          title={filtro === 'activas' ? 'Sin emergencias activas' : 'Sin emergencias'}
          description="Cuando alguien presione el botón SOS aparecerá aquí."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((e) => (
            <li key={e.id}>
              <Tarjeta
                emergencia={e}
                acusando={acusar.isPending && acusar.variables === e.id}
                onAcusar={() => acusar.mutate(e.id)}
                onCerrar={() => setCerrando(e)}
              />
            </li>
          ))}
        </ul>
      )}
      {cerrando && <CerrarModal emergencia={cerrando} onClose={() => setCerrando(null)} />}
    </>
  );
}

function Tarjeta({
  emergencia: e,
  acusando,
  onAcusar,
  onCerrar,
}: {
  emergencia: Emergencia;
  acusando: boolean;
  onAcusar: () => void;
  onCerrar: () => void;
}) {
  const activa = e.estado === 'activa';
  const mapa = enlaceMapa(e);
  return (
    <Card className={activa ? 'space-y-2 border-red-300 p-4 ring-2 ring-red-200' : 'space-y-2 p-4'}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-semibold text-slate-900">{e.usuario.nombre}</p>
        <Badge tone={activa ? 'danger' : e.resultado === 'falsa_alarma' ? 'neutral' : 'success'}>
          {activa ? 'Activa' : e.resultado ? RESULTADO_EMERGENCIA_LABEL[e.resultado] : 'Cerrada'}
        </Badge>
        {e.tipo && <Badge tone="warning">{TIPO_EMERGENCIA_LABEL[e.tipo]}</Badge>}
      </div>
      <p className="text-sm text-slate-700">
        {e.sitio ? e.sitio.nombre : 'Sin sitio asignado'} · {formatFechaHora(e.createdAt)}
        {e.bateria != null && ` · Batería ${e.bateria}%`}
      </p>
      {activa && (
        <p className="text-sm text-slate-700">
          {e.acusadaPor ? (
            <>
              <strong>{e.acusadaPor}</strong> la recibió y va en camino.
            </>
          ) : (
            <strong className="text-red-700">Nadie la ha recibido{e.escaladas > 0 ? ` (se repitió ${e.escaladas} vez/veces)` : ''}.</strong>
          )}
        </p>
      )}
      {!activa && e.cerradaEn && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Cerrada por {e.cerradaPor} · {formatFechaHora(e.cerradaEn)}
          {e.acusadaPor && <span className="block">La recibió {e.acusadaPor}</span>}
          {e.nota && <span className="block">{e.nota}</span>}
        </p>
      )}
      <Llamadas contactos={e.contactos} />
      <div className="flex flex-wrap gap-2 pt-1">
        {mapa && (
          <a
            href={mapa}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset"
          >
            <MapPin className="size-4" /> Ver mapa
          </a>
        )}
        {!e.contactos?.length && e.usuario.telefono && (
          <a
            href={`tel:${e.usuario.telefono}`}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset"
          >
            <Phone className="size-4" /> Llamar a {e.usuario.nombre.split(' ')[0]}
            {e.usuario.telefonoEtiqueta && (
              <span className="text-xs font-normal text-slate-500">
                ({e.usuario.telefonoEtiqueta === 'personal' ? 'personal' : 'empresa'})
              </span>
            )}
          </a>
        )}
        {activa && !e.acusadaPor && (
          <Button loading={acusando} onClick={onAcusar}>
            Voy en camino
          </Button>
        )}
        {activa && (
          <Button variant="secondary" onClick={onCerrar}>
            Atender y cerrar
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Cerrar una emergencia: cómo terminó (lista) y, con "otro", qué pasó. */
function CerrarModal({ emergencia, onClose }: { emergencia: Emergencia; onClose: () => void }) {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<ResultadoEmergencia | ''>('');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});

  const cerrar = useMutation({
    mutationFn: () =>
      emergenciasService.cerrar(emergencia.id, {
        resultado: categoria as ResultadoEmergencia,
        nota: nota.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: emergenciasService.keys.all });
      void qc.invalidateQueries({ queryKey: ['avisos'] });
      toast.success('Emergencia cerrada');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const onSubmit = () => {
    const r = emergenciaCerrarSchema.safeParse({ resultado: categoria || undefined, nota: nota.trim() || undefined });
    if (!r.success) {
      const campos = erroresDeCampos(r.error);
      return setErrores({ categoria: campos.resultado, nota: campos.nota });
    }
    setErrores({});
    cerrar.mutate();
  };

  return (
    <FormModal
      title="Cerrar la emergencia"
      description={`${emergencia.usuario.nombre}${emergencia.sitio ? ` · ${emergencia.sitio.nombre}` : ''}`}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Cerrar emergencia"
      loading={cerrar.isPending}
      dirty={!!categoria || !!nota}
      size="sm"
    >
      <MotivoLista
        categorias={RESULTADOS_EMERGENCIA}
        etiquetas={RESULTADO_EMERGENCIA_LABEL}
        categoria={categoria}
        nota={nota}
        onCategoria={setCategoria}
        onNota={setNota}
        errores={errores}
      />
    </FormModal>
  );
}
