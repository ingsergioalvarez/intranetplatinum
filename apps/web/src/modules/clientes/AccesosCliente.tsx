import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus } from 'lucide-react';
import {
  MAX_ACCESOS_CLIENTE,
  accesoClienteSchema,
  type AccesoClienteCreado,
  type ClienteDetalle,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { formatFechaHora } from '../../core/format/fechas';
import { Badge, Button, Card, CardHeader, EmptyState, FormField, FormModal, Input, toast } from '../../components/ui';
import { PasswordTemporalModal } from '../usuarios/PasswordTemporalModal';
import { clientesService } from './clientes.service';

/**
 * Usuarios del cliente con acceso a la intranet (A-29): máximo 2, ven lo mismo desde su cuenta.
 * Solo el administrador los da de alta; se le entrega la contraseña temporal para mandarla.
 */
export function AccesosClienteCard({ cliente, puedeEditar }: { cliente: ClienteDetalle; puedeEditar: boolean }) {
  const [agregando, setAgregando] = useState(false);
  const [creado, setCreado] = useState<AccesoClienteCreado | null>(null);
  const activos = cliente.accesos.filter((a) => a.activo);
  const lleno = activos.length >= MAX_ACCESOS_CLIENTE;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 text-slate-400" />
            Acceso a la intranet
          </span>
        }
        subtitle={`${activos.length} de ${MAX_ACCESOS_CLIENTE} usuarios`}
        actions={
          puedeEditar && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="size-4" />}
              disabled={lleno}
              onClick={() => setAgregando(true)}
            >
              Crear acceso
            </Button>
          )
        }
      />
      {cliente.accesos.length === 0 ? (
        <EmptyState
          title="Sin acceso"
          description="Crea el acceso para que el cliente vea sus sitios, guardias y reportes."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {cliente.accesos.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{a.nombre}</p>
                <p className="truncate text-sm text-slate-500">{a.email}</p>
                <p className="text-xs text-slate-500">
                  {a.ultimoAcceso ? `Último acceso ${formatFechaHora(a.ultimoAcceso)}` : 'Aún no ha entrado'}
                </p>
              </div>
              {!a.activo ? (
                <Badge tone="neutral">De baja</Badge>
              ) : a.debeCambiarPassword ? (
                <Badge tone="warning">Contraseña temporal</Badge>
              ) : (
                <Badge tone="success">Activo</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      {agregando && (
        <AccesoModal
          cliente={cliente}
          onClose={() => setAgregando(false)}
          onCreado={(r) => {
            setAgregando(false);
            if (r.passwordTemporal) setCreado(r);
            else toast.success('Usuario ligado al cliente');
          }}
        />
      )}
      <PasswordTemporalModal
        titulo="Acceso del cliente creado"
        resultado={
          creado?.passwordTemporal
            ? { usuario: creado.acceso, passwordTemporal: creado.passwordTemporal }
            : null
        }
        onClose={() => setCreado(null)}
      />
    </Card>
  );
}

function AccesoModal({
  cliente,
  onClose,
  onCreado,
}: {
  cliente: ClienteDetalle;
  onClose: () => void;
  onCreado: (r: AccesoClienteCreado) => void;
}) {
  const qc = useQueryClient();
  const form = useForm({ nombre: '', email: '' });
  const crear = useMutation({
    mutationFn: (data: ReturnType<typeof accesoClienteSchema.parse>) =>
      clientesService.crearAcceso(cliente.id, data),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: clientesService.keys.all });
      onCreado(r);
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });
  const { errors, bind } = form;

  return (
    <FormModal
      title="Crear acceso del cliente"
      description={cliente.nombreComercial}
      onClose={onClose}
      onSubmit={() => {
        const data = form.validar(accesoClienteSchema);
        if (data) crear.mutate(data);
      }}
      submitLabel="Crear acceso"
      loading={crear.isPending}
      dirty={form.cambiado}
      size="sm"
    >
      <FormField label="Nombre" required error={errors.nombre}>
        <Input {...bind('nombre')} autoFocus />
      </FormField>
      <FormField
        label="Correo"
        required
        error={errors.email}
        hint="Con este correo entra y también recibe los avisos de reportes. Si ya existe un usuario cliente con este correo, se liga a este cliente."
      >
        <Input {...bind('email')} type="email" inputMode="email" autoCapitalize="none" />
      </FormField>
    </FormModal>
  );
}
