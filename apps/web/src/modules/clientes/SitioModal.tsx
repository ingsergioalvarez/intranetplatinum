import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Crosshair, MapPinOff, RotateCcw } from 'lucide-react';
import { sitioSchema, type Sitio } from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { Button, ConfirmDialog, FormField, FormModal, Input, Textarea, toast } from '../../components/ui';
import { clientesService } from './clientes.service';

type Accion = 'baja' | 'reactivar';

/** Alta / edición de un sitio o inmueble del cliente (F2-04). */
export function SitioModal({
  clienteId,
  sitio,
  readOnly,
  onClose,
}: {
  clienteId: number;
  sitio: Sitio | null;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const esNuevo = sitio === null;
  const deBaja = !!sitio?.deletedAt;
  const [confirmar, setConfirmar] = useState<Accion | null>(null);
  const [ubicando, setUbicando] = useState(false);
  const form = useForm({
    nombre: sitio?.nombre ?? '',
    direccion: sitio?.direccion ?? '',
    referencias: sitio?.referencias ?? '',
    lat: sitio?.lat?.toString() ?? '',
    lng: sitio?.lng?.toString() ?? '',
  });

  const refrescar = () => qc.invalidateQueries({ queryKey: clientesService.keys.all });

  const guardar = useMutation({
    mutationFn: (data: ReturnType<typeof sitioSchema.parse>) =>
      esNuevo
        ? clientesService.crearSitio(clienteId, data)
        : clientesService.actualizarSitio(clienteId, sitio.id, data),
    onSuccess: () => {
      void refrescar();
      onClose();
      toast.success(esNuevo ? 'Sitio agregado' : 'Sitio actualizado');
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  const accion = useMutation({
    mutationFn: (a: Accion) =>
      a === 'baja'
        ? clientesService.bajaSitio(clienteId, sitio!.id)
        : clientesService.reactivarSitio(clienteId, sitio!.id),
    onSuccess: (_r, a) => {
      void refrescar();
      void qc.invalidateQueries({ queryKey: ['sitios'] });
      onClose();
      toast.success(a === 'baja' ? 'Sitio dado de baja' : 'Sitio reactivado');
    },
    onError: (e) => {
      setConfirmar(null);
      toast.error(mensajeDeError(e));
    },
  });

  const usarUbicacion = () => {
    if (!navigator.geolocation) return toast.error('Este dispositivo no permite obtener la ubicación');
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        form.set('lat', coords.latitude.toFixed(7));
        form.set('lng', coords.longitude.toFixed(7));
        setUbicando(false);
      },
      () => {
        setUbicando(false);
        toast.error('No se pudo obtener la ubicación. Revisa los permisos del navegador.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const onSubmit = () => {
    const data = form.validar(sitioSchema);
    if (data) guardar.mutate(data);
  };

  const { errors, bind } = form;
  const soloLectura = readOnly || deBaja;

  return (
    <>
      <FormModal
        title={esNuevo ? 'Nuevo sitio' : sitio.nombre}
        description={deBaja ? 'Sitio dado de baja' : 'Inmueble donde se presta el servicio'}
        onClose={onClose}
        onSubmit={onSubmit}
        submitLabel={esNuevo ? 'Agregar sitio' : 'Guardar cambios'}
        loading={guardar.isPending}
        dirty={form.cambiado}
        submitDisabled={!esNuevo && !form.cambiado}
        readOnly={soloLectura}
        secondaryAction={
          !esNuevo &&
          !readOnly &&
          (deBaja ? (
            <Button
              variant="secondary"
              icon={<RotateCcw className="size-4" />}
              onClick={() => setConfirmar('reactivar')}
            >
              Reactivar sitio
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-red-700 hover:bg-red-50"
              icon={<MapPinOff className="size-4" />}
              onClick={() => setConfirmar('baja')}
            >
              Dar de baja
            </Button>
          ))
        }
      >
        <FormField label="Nombre del sitio" required error={errors.nombre}>
          <Input {...bind('nombre')} placeholder="Ej. Torre A, Bodega Norte" autoFocus={esNuevo} />
        </FormField>
        <FormField label="Dirección" error={errors.direccion}>
          <Textarea {...bind('direccion')} rows={2} />
        </FormField>
        <FormField label="Referencias" error={errors.referencias} hint="Cómo llegar, acceso, caseta, etc.">
          <Input {...bind('referencias')} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Latitud" error={errors.lat}>
            <Input {...bind('lat')} inputMode="decimal" placeholder="19.4326" />
          </FormField>
          <FormField label="Longitud" error={errors.lng}>
            <Input {...bind('lng')} inputMode="decimal" placeholder="-99.1332" />
          </FormField>
        </div>
        {!soloLectura && (
          <Button
            variant="secondary"
            fullWidth
            loading={ubicando}
            icon={<Crosshair className="size-4" />}
            onClick={usarUbicacion}
          >
            Usar mi ubicación actual
          </Button>
        )}
      </FormModal>

      {sitio && (
        <ConfirmDialog
          open={confirmar !== null}
          title={confirmar === 'baja' ? 'Dar de baja el sitio' : 'Reactivar sitio'}
          description={
            confirmar === 'baja'
              ? `Se terminarán hoy las asignaciones de guardias en ${sitio.nombre} y dejará de aparecerles.`
              : `${sitio.nombre} volverá a estar disponible. Las asignaciones de guardias deben registrarse de nuevo.`
          }
          confirmLabel={confirmar === 'baja' ? 'Dar de baja' : 'Reactivar'}
          variant={confirmar === 'baja' ? 'danger' : 'primary'}
          loading={accion.isPending}
          onConfirm={() => confirmar && accion.mutate(confirmar)}
          onCancel={() => setConfirmar(null)}
        />
      )}
    </>
  );
}
