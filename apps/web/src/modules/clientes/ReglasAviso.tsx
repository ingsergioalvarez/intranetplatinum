import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellRing, Lock, Pencil, TriangleAlert } from 'lucide-react';
import {
  DESTINOS_AVISO,
  DESTINO_AVISO_LABEL,
  PRIORIDAD_REPORTE,
  PRIORIDAD_REPORTE_LABEL,
  avisaACliente,
  reglasAvisoSchema,
  resolverDestino,
  type ClienteDetalle,
  type DestinoAviso,
  type PrioridadReporte,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { Button, Card, CardHeader, FormField, FormModal, Select, toast } from '../../components/ui';
import { clientesService } from './clientes.service';

const destinoOptions = DESTINOS_AVISO.map((d) => ({ value: d, label: DESTINO_AVISO_LABEL[d] }));

/** Tarjeta de la ficha: a quién se avisa de los reportes de este cliente (F3-09, D-016). */
export function ReglasAvisoCard({ cliente, puedeEditar }: { cliente: ClienteDetalle; puedeEditar: boolean }) {
  const [editando, setEditando] = useState(false);
  const { reglasAviso } = cliente;
  const excepciones = PRIORIDAD_REPORTE.filter((p) => reglasAviso.porPrioridad[p]);
  const incluyeCliente = PRIORIDAD_REPORTE.some((p) => avisaACliente(resolverDestino(reglasAviso, p)));
  const sinDestinatarios =
    incluyeCliente && !cliente.contactos.some((c) => c.recibeNotificaciones && c.email);

  return (
    <Card className="md:col-span-2">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <BellRing className="size-4 text-slate-400" />
            Avisos de reportes
          </span>
        }
        subtitle="A quién se le avisa cuando un guardia reporta en sus sitios"
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon={puedeEditar ? <Pencil className="size-4" /> : <Lock className="size-4" />}
            onClick={() => setEditando(true)}
          >
            {puedeEditar ? 'Configurar' : 'Ver'}
          </Button>
        }
      />
      <div className="space-y-3 p-4 text-sm">
        <p>
          <span className="text-slate-500">Por defecto: </span>
          <span className="font-medium text-slate-900">{DESTINO_AVISO_LABEL[reglasAviso.porDefecto]}</span>
        </p>
        {excepciones.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {excepciones.map((p) => (
              <li key={p} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
                Prioridad {PRIORIDAD_REPORTE_LABEL[p].toLowerCase()}:{' '}
                <span className="font-medium">{DESTINO_AVISO_LABEL[reglasAviso.porPrioridad[p]!]}</span>
              </li>
            ))}
          </ul>
        )}
        {sinDestinatarios && (
          <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            Se avisa al cliente, pero ningún contacto tiene correo y “Recibe notificaciones”.
          </p>
        )}
        {incluyeCliente && (
          <p className="text-xs text-slate-500">
            Los correos al cliente quedan en cola y se enviarán cuando se configure el servidor de correo.
          </p>
        )}
      </div>
      {editando && (
        <ReglasAvisoModal cliente={cliente} soloLectura={!puedeEditar} onClose={() => setEditando(false)} />
      )}
    </Card>
  );
}

function ReglasAvisoModal({
  cliente,
  soloLectura,
  onClose,
}: {
  cliente: ClienteDetalle;
  soloLectura: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const inicial = cliente.reglasAviso;
  const [porDefecto, setPorDefecto] = useState<DestinoAviso>(inicial.porDefecto);
  const [porPrioridad, setPorPrioridad] = useState<Partial<Record<PrioridadReporte, DestinoAviso | ''>>>(
    inicial.porPrioridad,
  );
  const cambiado =
    porDefecto !== inicial.porDefecto ||
    PRIORIDAD_REPORTE.some((p) => (porPrioridad[p] || undefined) !== inicial.porPrioridad[p]);

  const guardar = useMutation({
    mutationFn: () =>
      clientesService.reglasAviso(
        cliente.id,
        reglasAvisoSchema.parse({
          porDefecto,
          porPrioridad: Object.fromEntries(PRIORIDAD_REPORTE.map((p) => [p, porPrioridad[p] || null])),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clientesService.keys.all });
      onClose();
      toast.success('Avisos actualizados');
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  return (
    <FormModal
      title="Avisos de reportes"
      description={cliente.nombreComercial}
      onClose={onClose}
      onSubmit={() => guardar.mutate()}
      submitLabel="Guardar"
      loading={guardar.isPending}
      dirty={cambiado}
      submitDisabled={!cambiado}
      readOnly={soloLectura}
    >
      {soloLectura && (
        <p className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Solo un administrador puede cambiar a quién se avisa.
        </p>
      )}
      <FormField label="Por defecto, avisar a" hint="Aplica a todas las prioridades sin excepción.">
        <Select
          options={destinoOptions}
          value={porDefecto}
          onChange={(e) => setPorDefecto(e.target.value as DestinoAviso)}
        />
      </FormField>
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-3 text-sm font-medium text-slate-800">Excepciones por prioridad</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PRIORIDAD_REPORTE.map((p) => (
            <FormField key={p} label={`Prioridad ${PRIORIDAD_REPORTE_LABEL[p].toLowerCase()}`}>
              <Select
                options={destinoOptions}
                placeholder="Usar por defecto"
                value={porPrioridad[p] ?? ''}
                onChange={(e) => setPorPrioridad((r) => ({ ...r, [p]: e.target.value as DestinoAviso | '' }))}
              />
            </FormField>
          ))}
        </div>
      </div>
    </FormModal>
  );
}
