import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ESTATUS_CLIENTE,
  ESTATUS_CLIENTE_LABEL,
  clienteCreateSchema,
  type Cliente,
  type ClienteResumen,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { FormField, FormModal, Input, Select, Textarea, toast } from '../../components/ui';
import { clientesService } from './clientes.service';

const estatusOptions = ESTATUS_CLIENTE.map((e) => ({ value: e, label: ESTATUS_CLIENTE_LABEL[e] }));

/** Alta (`cliente = null`) o edición de los datos generales de un cliente. */
export function ClienteModal({
  cliente,
  onClose,
  onCreated,
}: {
  cliente: Cliente | null;
  onClose: () => void;
  onCreated?: (cliente: ClienteResumen) => void;
}) {
  const qc = useQueryClient();
  const esNuevo = cliente === null;
  const form = useForm({
    nombreComercial: cliente?.nombreComercial ?? '',
    razonSocial: cliente?.razonSocial ?? '',
    rfc: cliente?.rfc ?? '',
    giro: cliente?.giro ?? '',
    telefono: cliente?.telefono ?? '',
    email: cliente?.email ?? '',
    direccionFiscal: cliente?.direccionFiscal ?? '',
    estatus: cliente?.estatus ?? 'activo',
    notas: cliente?.notas ?? '',
  });

  const guardar = useMutation({
    mutationFn: (data: ReturnType<typeof clienteCreateSchema.parse>) =>
      esNuevo ? clientesService.create(data) : clientesService.update(cliente.id, data),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: clientesService.keys.all });
      onClose();
      if (esNuevo) {
        toast.success('Cliente creado');
        onCreated?.(res);
      } else toast.success('Cambios guardados');
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  const onSubmit = () => {
    const data = form.validar(clienteCreateSchema);
    if (data) guardar.mutate(data);
  };

  const { errors, bind } = form;

  return (
    <FormModal
      title={esNuevo ? 'Nuevo cliente' : 'Editar cliente'}
      description={esNuevo ? 'Después podrás agregar contactos y sitios.' : cliente.nombreComercial}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={esNuevo ? 'Crear cliente' : 'Guardar cambios'}
      loading={guardar.isPending}
      dirty={form.cambiado}
      submitDisabled={!esNuevo && !form.cambiado}
      size="lg"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Nombre comercial" required error={errors.nombreComercial}>
          <Input {...bind('nombreComercial')} autoFocus={esNuevo} />
        </FormField>
        <FormField label="Razón social" required error={errors.razonSocial}>
          <Input {...bind('razonSocial')} />
        </FormField>
        <FormField label="RFC" error={errors.rfc}>
          <Input {...bind('rfc')} autoCapitalize="characters" maxLength={13} className="uppercase" />
        </FormField>
        <FormField label="Giro" error={errors.giro} hint="Ej. centro comercial, corporativo, residencial">
          <Input {...bind('giro')} />
        </FormField>
        <FormField label="Teléfono" error={errors.telefono}>
          <Input {...bind('telefono')} type="tel" inputMode="tel" />
        </FormField>
        <FormField label="Correo" error={errors.email}>
          <Input {...bind('email')} type="email" inputMode="email" autoCapitalize="none" />
        </FormField>
      </div>
      <FormField label="Dirección fiscal" error={errors.direccionFiscal}>
        <Textarea {...bind('direccionFiscal')} rows={2} />
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Estatus del servicio"
          error={errors.estatus}
          hint="Suspendido: los guardias dejan de ver sus sitios."
        >
          <Select {...bind('estatus')} options={estatusOptions} />
        </FormField>
      </div>
      <FormField label="Notas internas" error={errors.notas}>
        <Textarea {...bind('notas')} rows={3} />
      </FormField>
    </FormModal>
  );
}
