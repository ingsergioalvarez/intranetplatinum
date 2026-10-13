import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { contactoSchema, type Contacto } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { Button, Checkbox, ConfirmDialog, FormField, FormModal, Input, toast } from '../../components/ui';
import { clientesService } from './clientes.service';

/** Alta / edición de un contacto o responsable del cliente (F2-03). */
export function ContactoModal({
  clienteId,
  contacto,
  readOnly,
  onClose,
}: {
  clienteId: number;
  contacto: Contacto | null;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const esNuevo = contacto === null;
  const [confirmar, setConfirmar] = useState(false);
  const form = useForm({
    nombre: contacto?.nombre ?? '',
    puesto: contacto?.puesto ?? '',
    telefono: contacto?.telefono ?? '',
    celular: contacto?.celular ?? '',
    email: contacto?.email ?? '',
    esResponsable: contacto?.esResponsable ?? false,
    recibeNotificaciones: contacto?.recibeNotificaciones ?? false,
    prioridad: String(contacto?.prioridad ?? 0),
  });

  const refrescar = () => qc.invalidateQueries({ queryKey: clientesService.keys.all });

  const guardar = useMutation({
    mutationFn: (data: ReturnType<typeof contactoSchema.parse>) =>
      esNuevo
        ? clientesService.crearContacto(clienteId, data)
        : clientesService.actualizarContacto(clienteId, contacto.id, data),
    onSuccess: () => {
      void refrescar();
      onClose();
      toast.success(esNuevo ? 'Contacto agregado' : 'Contacto actualizado');
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  const eliminar = useMutation({
    mutationFn: () => clientesService.eliminarContacto(clienteId, contacto!.id),
    onSuccess: () => {
      void refrescar();
      onClose();
      toast.success('Contacto eliminado');
    },
    onError: (e) => {
      setConfirmar(false);
      toast.error(mensajeDeError(e));
    },
  });

  const onSubmit = () => {
    const data = form.validar(contactoSchema);
    if (data) guardar.mutate(data);
  };

  const { errors, bind, bindCheck } = form;

  return (
    <>
      <FormModal
        title={esNuevo ? 'Nuevo contacto' : contacto.nombre}
        description={esNuevo ? undefined : (contacto.puesto ?? 'Contacto')}
        onClose={onClose}
        onSubmit={onSubmit}
        submitLabel={esNuevo ? 'Agregar contacto' : 'Guardar cambios'}
        loading={guardar.isPending}
        dirty={form.cambiado}
        submitDisabled={!esNuevo && !form.cambiado}
        readOnly={readOnly}
        secondaryAction={
          !esNuevo &&
          !readOnly && (
            <Button
              variant="ghost"
              className="text-red-700 hover:bg-red-50"
              icon={<Trash2 className="size-4" />}
              onClick={() => setConfirmar(true)}
            >
              Eliminar
            </Button>
          )
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Nombre" required error={errors.nombre}>
            <Input {...bind('nombre')} autoFocus={esNuevo} />
          </FormField>
          <FormField label="Puesto" error={errors.puesto}>
            <Input {...bind('puesto')} placeholder="Ej. Gerente de operaciones" />
          </FormField>
          <FormField label="Celular" error={errors.celular}>
            <Input {...bind('celular')} type="tel" inputMode="tel" />
          </FormField>
          <FormField label="Teléfono de oficina" error={errors.telefono}>
            <Input {...bind('telefono')} type="tel" inputMode="tel" />
          </FormField>
          <FormField label="Correo" error={errors.email}>
            <Input {...bind('email')} type="email" inputMode="email" autoCapitalize="none" />
          </FormField>
          <FormField label="Prioridad" error={errors.prioridad} hint="Orden de contacto: 0 es el primero.">
            <Input {...bind('prioridad')} type="number" inputMode="numeric" min={0} max={99} />
          </FormField>
        </div>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
          <Checkbox
            {...bindCheck('esResponsable')}
            label="Responsable del servicio"
            description="Persona principal con quien se coordina el servicio."
          />
          <Checkbox
            {...bindCheck('recibeNotificaciones')}
            label="Recibe notificaciones de reportes"
            description="Se le enviará por correo cada reporte de sus sitios."
          />
        </div>
      </FormModal>

      {contacto && (
        <ConfirmDialog
          open={confirmar}
          title="Eliminar contacto"
          description={`${contacto.nombre} dejará de aparecer y de recibir notificaciones.`}
          confirmLabel="Eliminar"
          variant="danger"
          loading={eliminar.isPending}
          onConfirm={() => eliminar.mutate()}
          onCancel={() => setConfirmar(false)}
        />
      )}
    </>
  );
}
